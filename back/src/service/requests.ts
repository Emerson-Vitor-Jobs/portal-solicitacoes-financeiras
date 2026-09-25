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
  requesterId: string | null;
  status: Status | null;
  supplier: string | null;
  dueFrom: string | null;
  dueTo: string | null;
}

export interface RequestStore {
  insertRequest(request: NewRequest): Promise<void>;
  updateStatus(change: StatusChange): Promise<boolean>;
  findStatus(id: string): Promise<Status | null>;
  findTransitionInstant(requestId: string, status: Status): Promise<Date | null>;
  insertAuditEvent(event: NewAuditEvent): Promise<void>;
  findById(id: string): Promise<FinanceRequest | null>;
  listHistory(requestId: string): Promise<AuditEvent[]>;
}

export interface RequestRepository {
  inTransaction<T>(fn: (store: RequestStore) => Promise<T>): Promise<T>;
  list(
    filter: RequestFilter,
    page: { limit: number; offset: number },
  ): Promise<{ items: FinanceRequest[]; total: number }>;
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
  today: () => string;
  now: () => Date;
  newId?: () => string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeInvoiceNumber(value: string): string {
  return value.trim().toUpperCase();
}

function invalidTransition(current: Status, to: Status): InvalidTransitionError {
  return new InvalidTransitionError(`A solicitação está ${current}; não pode ir para ${to}.`);
}

function assertRole(actor: User, role: User['role']): void {
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
    assertRole(actor, 'REQUESTER');
    const supplierCnpj = normalizeCnpj(input.supplierCnpj);
    if (!isValidCnpj(supplierCnpj)) {
      throw new ValidationError([{ field: 'supplier_cnpj', message: 'CNPJ inválido.' }]);
    }
    const description = input.description?.trim() || null;
    const id = this.newId();

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
        supplier: supplier || null,
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
    assertRole(actor, 'FINANCE');
    return this.transition(actor, id, 'APPROVED', { reason: null });
  }

  async reject(actor: User, id: string, reason: string): Promise<RequestDetail> {
    assertRole(actor, 'FINANCE');
    const trimmed = reason.trim();
    if (trimmed === '') {
      throw new ValidationError([{ field: 'reason', message: 'Informe o motivo da rejeição.' }]);
    }
    return this.transition(actor, id, 'REJECTED', { reason: trimmed, rejectionReason: trimmed });
  }

  async markPaid(actor: User, id: string, input: MarkPaidInput): Promise<RequestDetail> {
    assertRole(actor, 'FINANCE');
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
        const approvedAt = await store.findTransitionInstant(id, 'APPROVED');
        if (approvedAt === null) {
          throw new Error('broken invariant: approved request without an approval event');
        }
        if (input.paidAt.getTime() < floorToMinute(approvedAt).getTime()) {
          throw new ValidationError([
            { field: 'paid_at', message: 'O pagamento não pode ser anterior à aprovação.' },
          ]);
        }
      },
    );
  }

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
        const latestStatus = await store.findStatus(id);
        throw invalidTransition(latestStatus ?? current, to);
      }
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
  if (!request) throw new Error('request vanished inside its own transaction');
  return { request, history: await store.listHistory(id) };
}
