// Adaptador da porta RequestRepository (service/requests.ts) sobre as queries geradas pelo PgTyped.
import pg from 'pg';
import { DuplicateInvoiceError } from '../../service/errors.js';
import type {
  NewAuditEvent,
  NewRequest,
  RequestFilter,
  RequestRepository,
  RequestStore,
  StatusChange,
} from '../../service/requests.js';
import type { Status } from '../../types/common.js';
import type { AuditEvent, FinanceRequest } from '../../types/domain.js';
import { toCategory, toSafeInteger, toStatus } from './map.js';
import {
  countRequests,
  findRequestById,
  findRequestStatus,
  findTransitionInstant,
  insertAuditEvent,
  insertRequest,
  listAuditEvents,
  listRequests,
  updateRequestStatus,
  type IFindRequestByIdResult,
  type IListAuditEventsResult,
} from './queries/requests.queries.js';
import { withTransaction } from './tx.js';

const DUPLICATE_INVOICE_CONSTRAINT = 'requests_supplier_cnpj_invoice_number_key';

// Linha → domínio. Competência: o banco guarda o dia 1 do mês, a API fala YYYY-MM (§6.1).
function mapRequest(row: IFindRequestByIdResult): FinanceRequest {
  return {
    id: row.id,
    requester: { id: row.requester_id, name: row.requester_name },
    supplierName: row.supplier_name,
    supplierCnpj: row.supplier_cnpj,
    invoiceNumber: row.invoice_number,
    amountCents: toSafeInteger(row.amount_cents),
    competence: row.competence.slice(0, 7),
    dueDate: row.due_date,
    category: toCategory(row.category),
    description: row.description,
    status: toStatus(row.status),
    rejectionReason: row.rejection_reason,
    paidAt: row.paid_at,
    paymentReference: row.payment_reference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAuditEvent(row: IListAuditEventsResult): AuditEvent {
  return {
    id: row.id,
    previousStatus: row.previous_status === null ? null : toStatus(row.previous_status),
    newStatus: toStatus(row.new_status),
    actor: { id: row.actor_id, name: row.actor_name },
    reason: row.reason,
    createdAt: row.created_at,
  };
}

// `%`, `_` e `\` digitados na busca são literais, não curingas (§7.3). O ILIKE usa `\` como escape padrão.
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function isDuplicateInvoice(err: unknown): boolean {
  return (
    err instanceof pg.DatabaseError &&
    err.code === '23505' &&
    err.constraint === DUPLICATE_INVOICE_CONSTRAINT
  );
}

class PgRequestStore implements RequestStore {
  constructor(private readonly client: pg.PoolClient) {}

  async insertRequest(request: NewRequest): Promise<void> {
    try {
      await insertRequest.run(
        {
          id: request.id,
          requesterId: request.requesterId,
          supplierName: request.supplierName,
          supplierCnpj: request.supplierCnpj,
          invoiceNumber: request.invoiceNumber,
          amountCents: request.amountCents,
          competence: `${request.competence}-01`,
          dueDate: request.dueDate,
          category: request.category,
          description: request.description,
        },
        this.client,
      );
    } catch (err) {
      // O 23505 desta constraint vira erro de domínio; qualquer outro erro segue como veio.
      if (isDuplicateInvoice(err)) throw new DuplicateInvoiceError();
      throw err;
    }
  }

  async updateStatus(change: StatusChange): Promise<boolean> {
    const rows = await updateRequestStatus.run(
      {
        id: change.id,
        from: change.from,
        to: change.to,
        rejectionReason: change.rejectionReason,
        paidAt: change.paidAt,
        paymentReference: change.paymentReference,
      },
      this.client,
    );
    return rows.length === 1;
  }

  async findStatus(id: string): Promise<Status | null> {
    const [row] = await findRequestStatus.run({ id }, this.client);
    return row ? toStatus(row.status) : null;
  }

  async findTransitionInstant(requestId: string, status: Status): Promise<Date | null> {
    const [row] = await findTransitionInstant.run({ requestId, newStatus: status }, this.client);
    return row ? row.created_at : null;
  }

  async insertAuditEvent(event: NewAuditEvent): Promise<void> {
    await insertAuditEvent.run(
      {
        id: event.id,
        requestId: event.requestId,
        actorId: event.actorId,
        previousStatus: event.previousStatus,
        newStatus: event.newStatus,
        reason: event.reason,
      },
      this.client,
    );
  }

  async findById(id: string): Promise<FinanceRequest | null> {
    const [row] = await findRequestById.run({ id }, this.client);
    return row ? mapRequest(row) : null;
  }

  async listHistory(requestId: string): Promise<AuditEvent[]> {
    const rows = await listAuditEvents.run({ requestId }, this.client);
    return rows.map(mapAuditEvent);
  }
}

export class RequestStorage implements RequestRepository {
  constructor(private readonly pool: pg.Pool) {}

  inTransaction<T>(fn: (store: RequestStore) => Promise<T>): Promise<T> {
    return withTransaction(this.pool, (client) => fn(new PgRequestStore(client)));
  }

  list(
    filter: RequestFilter,
    page: { limit: number; offset: number },
  ): Promise<{ items: FinanceRequest[]; total: number }> {
    const where = {
      requesterId: filter.requesterId,
      status: filter.status,
      supplier: filter.supplier === null ? null : escapeLike(filter.supplier),
      dueFrom: filter.dueFrom,
      dueTo: filter.dueTo,
    };
    // Mesmo snapshot para a página e o total: o total nunca descreve outra versão dos dados (§4b).
    return withTransaction(
      this.pool,
      async (client) => {
        const rows = await listRequests.run({ ...where, ...page }, client);
        const [count] = await countRequests.run(where, client);
        if (!count) throw new Error('agregação da contagem não devolveu linha');
        return { items: rows.map(mapRequest), total: toSafeInteger(count.total) };
      },
      { isolation: 'REPEATABLE READ', readOnly: true },
    );
  }

  findDetail(id: string): Promise<{ request: FinanceRequest; history: AuditEvent[] } | null> {
    return withTransaction(
      this.pool,
      async (client) => {
        const store = new PgRequestStore(client);
        const request = await store.findById(id);
        return request ? { request, history: await store.listHistory(id) } : null;
      },
      { isolation: 'REPEATABLE READ', readOnly: true },
    );
  }
}
