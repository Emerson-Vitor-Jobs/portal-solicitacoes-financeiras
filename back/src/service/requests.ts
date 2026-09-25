// Casos de uso das solicitações (Transaction Script, DECISOES_FUNDACAO §16.2). A persistência entra pela porta
// RequestRepository, declarada aqui; o adaptador PgTyped está em repository/postgres/requests_storage.ts.
import { randomUUID } from 'node:crypto';
import { isValidCnpj, normalizeCnpj } from '../modules/cnpj.js';
import { isOverdue } from '../modules/date.js';
import type { Category, Status } from '../types/common.js';
import type {
  AuditEvent,
  FinanceRequest,
  RequestDetail,
  RequestView,
  User,
} from '../types/domain.js';
import {
  ForbiddenError,
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
} from './errors.js';
import { canTransition } from './transitions.js';

export interface NewRequest {
  id: string;
  requesterId: string;
  supplierName: string;
  supplierCnpj: string;
  invoiceNumber: string;
  amountCents: number;
  competence: string;
  dueDate: string;
  category: Category;
  description: string | null;
}

// Compare-and-set: só muda se o status ainda for `from`.
export interface StatusChange {
  id: string;
  from: Status;
  to: Status;
  rejectionReason: string | null;
  paidAt: Date | null;
  paymentReference: string | null;
}

export interface NewAuditEvent {
  id: string;
  requestId: string;
  actorId: string;
  previousStatus: Status | null;
  newStatus: Status;
  reason: string | null;
}

export interface RequestFilter {
  // null = todas (FINANCE); o id = só as da pessoa (REQUESTER).
  requesterId: string | null;
  status: Status | null;
  // Termo como digitado; o escape dos curingas do LIKE é detalhe do adaptador (§7.3).
  supplier: string | null;
  dueFrom: string | null;
  dueTo: string | null;
}

// Operações que rodam dentro de uma transação aberta pelo repositório.
export interface RequestStore {
  // Lança DuplicateInvoiceError quando o UNIQUE (CNPJ, nota) barra o INSERT.
  insertRequest(request: NewRequest): Promise<void>;
  // true se mudou; false se o status já não era o esperado (perdeu a corrida ou nunca foi).
  updateStatus(change: StatusChange): Promise<boolean>;
  findStatus(id: string): Promise<Status | null>;
  findTransitionInstant(requestId: string, status: Status): Promise<Date | null>;
  insertAuditEvent(event: NewAuditEvent): Promise<void>;
  findById(id: string): Promise<FinanceRequest | null>;
  listHistory(requestId: string): Promise<AuditEvent[]>;
}

// Porta de saída (o consumidor define a interface).
export interface RequestRepository {
  // Tudo ou nada: COMMIT se `fn` terminar, ROLLBACK se lançar.
  inTransaction<T>(fn: (store: RequestStore) => Promise<T>): Promise<T>;
  // Página e total no mesmo snapshot (§4b).
  list(
    filter: RequestFilter,
    page: { limit: number; offset: number },
  ): Promise<{ items: FinanceRequest[]; total: number }>;
  // Solicitação e histórico no mesmo snapshot.
  findDetail(id: string): Promise<{ request: FinanceRequest; history: AuditEvent[] } | null>;
}

export interface CreateRequestInput {
  supplierName: string;
  supplierCnpj: string;
  invoiceNumber: string;
  amountCents: number;
  competence: string;
  dueDate: string;
  category: Category;
  description: string | null | undefined;
}

export interface ListRequestsInput {
  status: Status | undefined;
  supplier: string | undefined;
  dueFrom: string | undefined;
  dueTo: string | undefined;
  page: number;
  pageSize: number;
}

export interface RequestPage {
  items: RequestView[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  referenceDate: string;
}

export interface MarkPaidInput {
  paidAt: Date;
  paymentReference: string;
}

export interface RequestServiceDeps {
  // A data de referência (APP_TODAY ou hoje em SP), relida a cada operação.
  today: () => string;
  // Relógio real (injetável): "pagamento futuro" é fato do relógio, não do calendário de referência (§6.3).
  now: () => Date;
  newId?: () => string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Número da nota na forma canônica do UNIQUE (§7.2). Hífen e espaço interno ficam: são parte do número.
export function normalizeInvoiceNumber(value: string): string {
  return value.trim().toUpperCase();
}

function invalidTransition(current: Status, to: Status): InvalidTransitionError {
  return new InvalidTransitionError(`A solicitação está ${current}; não pode ir para ${to}.`);
}

function requireRole(actor: User, role: User['role']): void {
  if (actor.role !== role) throw new ForbiddenError();
}

export class RequestService {
  private readonly newId: () => string;

  constructor(
    private readonly repo: RequestRepository,
    private readonly deps: RequestServiceDeps,
  ) {
    this.newId = deps.newId ?? randomUUID;
  }

  async create(actor: User, input: CreateRequestInput): Promise<RequestDetail> {
    requireRole(actor, 'REQUESTER');
    const supplierCnpj = normalizeCnpj(input.supplierCnpj);
    if (!isValidCnpj(supplierCnpj)) {
      throw new ValidationError([{ field: 'supplier_cnpj', message: 'CNPJ inválido.' }]);
    }
    const description = input.description?.trim() ? input.description.trim() : null;
    const id = this.newId();

    // Sem "verificar antes de inserir": quem garante a unicidade, inclusive em corrida, é o UNIQUE do banco.
    const detail = await this.repo.inTransaction(async (store) => {
      await store.insertRequest({
        id,
        requesterId: actor.id,
        supplierName: input.supplierName.trim(),
        supplierCnpj,
        invoiceNumber: normalizeInvoiceNumber(input.invoiceNumber),
        amountCents: input.amountCents,
        competence: input.competence,
        dueDate: input.dueDate,
        category: input.category,
        description,
      });
      await store.insertAuditEvent({
        id: this.newId(),
        requestId: id,
        actorId: actor.id,
        previousStatus: null,
        newStatus: 'PENDING',
        reason: null,
      });
      return loadDetail(store, id);
    });
    return this.toDetail(detail);
  }

  async list(actor: User, input: ListRequestsInput): Promise<RequestPage> {
    const referenceDate = this.deps.today();
    const supplier = input.supplier?.trim();
    const { items, total } = await this.repo.list(
      {
        requesterId: actor.role === 'REQUESTER' ? actor.id : null,
        status: input.status ?? null,
        supplier: supplier ? supplier : null,
        dueFrom: input.dueFrom ?? null,
        dueTo: input.dueTo ?? null,
      },
      { limit: input.pageSize, offset: (input.page - 1) * input.pageSize },
    );
    return {
      items: items.map((r) => withOverdue(r, referenceDate)),
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.ceil(total / input.pageSize),
      referenceDate,
    };
  }

  // Inexistente, alheia (para REQUESTER) ou id que não é UUID: o mesmo 404 (§5.4, §5.8).
  async get(actor: User, id: string): Promise<RequestDetail> {
    if (!UUID.test(id)) throw new NotFoundError();
    const found = await this.repo.findDetail(id);
    if (!found) throw new NotFoundError();
    if (actor.role === 'REQUESTER' && found.request.requester.id !== actor.id) {
      throw new NotFoundError();
    }
    return this.toDetail(found);
  }

  async approve(actor: User, id: string): Promise<RequestDetail> {
    return this.transition(actor, id, 'APPROVED', { reason: null });
  }

  async reject(actor: User, id: string, reason: string): Promise<RequestDetail> {
    requireRole(actor, 'FINANCE');
    const trimmed = reason.trim();
    if (trimmed === '') {
      throw new ValidationError([{ field: 'reason', message: 'Informe o motivo da rejeição.' }]);
    }
    return this.transition(actor, id, 'REJECTED', { reason: trimmed, rejectionReason: trimmed });
  }

  // Travas da data de pagamento (§6.3): nem posterior ao agora real, nem anterior à aprovação. O APP_TODAY vale só
  // para as regras de calendário (vencido, pago no mês).
  async markPaid(actor: User, id: string, input: MarkPaidInput): Promise<RequestDetail> {
    requireRole(actor, 'FINANCE');
    const paymentReference = input.paymentReference.trim();
    if (paymentReference === '') {
      throw new ValidationError([
        { field: 'payment_reference', message: 'Informe a referência do pagamento.' },
      ]);
    }
    if (input.paidAt.getTime() > this.deps.now().getTime()) {
      throw new ValidationError([
        { field: 'paid_at', message: 'A data de pagamento não pode ser futura.' },
      ]);
    }
    return this.transition(
      actor,
      id,
      'PAID',
      { reason: paymentReference, paidAt: input.paidAt, paymentReference },
      async (store) => {
        // Lido na mesma transação do pagamento. A auditoria é append-only, então o instante não muda.
        const approvedAt = await store.findTransitionInstant(id, 'APPROVED');
        if (approvedAt === null) {
          throw new Error('invariante quebrada: solicitação aprovada sem evento de aprovação');
        }
        // Compara na precisão que a pessoa consegue informar: o formulário tem data e hora até o MINUTO. Sem isso,
        // aprovar às 14:51:37 e pagar "agora" (14:51, ou seja 14:51:00) seria recusado como anterior à aprovação.
        if (input.paidAt.getTime() < floorToMinute(approvedAt).getTime()) {
          throw new ValidationError([
            { field: 'paid_at', message: 'O pagamento não pode ser anterior à aprovação.' },
          ]);
        }
      },
    );
  }

  // Uma transição = compare-and-set do status + evento de auditoria, na MESMA transação (§5.5).
  private async transition(
    actor: User,
    id: string,
    to: Status,
    change: {
      reason: string | null;
      rejectionReason?: string;
      paidAt?: Date;
      paymentReference?: string;
    },
    afterUpdate?: (store: RequestStore) => Promise<void>,
  ): Promise<RequestDetail> {
    requireRole(actor, 'FINANCE');
    if (!UUID.test(id)) throw new NotFoundError();

    const detail = await this.repo.inTransaction(async (store) => {
      const current = await store.findStatus(id);
      if (current === null) throw new NotFoundError();
      if (!canTransition(current, to)) throw invalidTransition(current, to);

      const changed = await store.updateStatus({
        id,
        from: current,
        to,
        rejectionReason: change.rejectionReason ?? null,
        paidAt: change.paidAt ?? null,
        paymentReference: change.paymentReference ?? null,
      });
      if (!changed) {
        // Perdeu a corrida: outra transação mudou o status entre a leitura e o UPDATE.
        const now = await store.findStatus(id);
        throw invalidTransition(now ?? current, to);
      }
      // Uma trava que lança aqui desfaz o UPDATE junto (ROLLBACK).
      if (afterUpdate) await afterUpdate(store);

      await store.insertAuditEvent({
        id: this.newId(),
        requestId: id,
        actorId: actor.id,
        previousStatus: current,
        newStatus: to,
        reason: change.reason,
      });
      return loadDetail(store, id);
    });
    return this.toDetail(detail);
  }

  private toDetail(found: { request: FinanceRequest; history: AuditEvent[] }): RequestDetail {
    return { ...withOverdue(found.request, this.deps.today()), history: found.history };
  }
}

function floorToMinute(instant: Date): Date {
  return new Date(Math.floor(instant.getTime() / 60_000) * 60_000);
}

function withOverdue(request: FinanceRequest, referenceDate: string): RequestView {
  return { ...request, isOverdue: isOverdue(request.status, request.dueDate, referenceDate) };
}

async function loadDetail(
  store: RequestStore,
  id: string,
): Promise<{ request: FinanceRequest; history: AuditEvent[] }> {
  const request = await store.findById(id);
  if (!request) throw new Error('solicitação sumiu dentro da própria transação');
  return { request, history: await store.listHistory(id) };
}
