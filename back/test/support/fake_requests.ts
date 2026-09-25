// Fake escrito à mão da porta RequestRepository (sem vi.mock). Simula o que importa do banco:
// o UNIQUE (CNPJ, nota), o compare-and-set do status e o ROLLBACK quando a transação lança.
import { DuplicateInvoiceError } from '../../src/service/errors.js';
import type {
  NewAuditEvent,
  NewRequest,
  RequestFilter,
  RequestRepository,
  RequestStore,
  StatusChange,
} from '../../src/service/requests.js';
import type { Status } from '../../src/types/common.js';
import type { AuditEvent, FinanceRequest } from '../../src/types/domain.js';
import { SEED_USERS } from './users.js';

interface StoredEvent extends AuditEvent {
  requestId: string;
}

const nameOf = (userId: string) => SEED_USERS.find((u) => u.id === userId)?.name ?? '?';

export class FakeRequestRepository implements RequestRepository {
  requests = new Map<string, FinanceRequest>();
  events: StoredEvent[] = [];
  // Roda entre a leitura do status e o UPDATE: permite simular outra transação vencendo a corrida.
  beforeUpdate: ((requests: Map<string, FinanceRequest>) => void) | null = null;
  private clock = Date.parse('2026-09-18T12:00:00Z');

  private tick(): Date {
    this.clock += 1000;
    return new Date(this.clock);
  }

  // Atalho dos testes: põe uma solicitação num status qualquer, com os eventos coerentes.
  seed(overrides: Partial<FinanceRequest> & { id: string }, approvedAt?: Date): FinanceRequest {
    const request: FinanceRequest = {
      requester: { id: SEED_USERS[0]!.id, name: SEED_USERS[0]!.name },
      supplierName: 'Aurora Serviços Digitais',
      supplierCnpj: '10000000000145',
      invoiceNumber: `NF-${overrides.id.slice(-4)}`,
      amountCents: 125000,
      competence: '2026-09',
      dueDate: '2026-09-30',
      category: 'SOFTWARE',
      description: null,
      status: 'PENDING',
      rejectionReason: null,
      paidAt: null,
      paymentReference: null,
      createdAt: this.tick(),
      updatedAt: this.tick(),
      ...overrides,
    };
    this.requests.set(request.id, request);
    if (approvedAt) {
      this.events.push({
        id: `ev-${request.id}`,
        requestId: request.id,
        previousStatus: 'PENDING',
        newStatus: 'APPROVED',
        actor: { id: SEED_USERS[2]!.id, name: SEED_USERS[2]!.name },
        reason: null,
        createdAt: approvedAt,
      });
    }
    return request;
  }

  async inTransaction<T>(fn: (store: RequestStore) => Promise<T>): Promise<T> {
    const snapshot = {
      requests: new Map([...this.requests].map(([k, v]) => [k, { ...v }])),
      events: [...this.events],
    };
    try {
      return await fn(this.store());
    } catch (err) {
      // ROLLBACK: nada do que a transação escreveu fica.
      this.requests = snapshot.requests;
      this.events = snapshot.events;
      throw err;
    }
  }

  list(
    filter: RequestFilter,
    page: { limit: number; offset: number },
  ): Promise<{ items: FinanceRequest[]; total: number }> {
    const matches = [...this.requests.values()]
      .filter((r) => filter.requesterId === null || r.requester.id === filter.requesterId)
      .filter((r) => filter.status === null || r.status === filter.status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return Promise.resolve({
      items: matches.slice(page.offset, page.offset + page.limit),
      total: matches.length,
    });
  }

  findDetail(id: string): Promise<{ request: FinanceRequest; history: AuditEvent[] } | null> {
    const request = this.requests.get(id);
    return Promise.resolve(request ? { request, history: this.historyOf(id) } : null);
  }

  historyOf(id: string): AuditEvent[] {
    return this.events.filter((e) => e.requestId === id);
  }

  private store(): RequestStore {
    return {
      insertRequest: (r: NewRequest) => {
        for (const existing of this.requests.values()) {
          if (
            existing.supplierCnpj === r.supplierCnpj &&
            existing.invoiceNumber === r.invoiceNumber
          ) {
            return Promise.reject(new DuplicateInvoiceError());
          }
        }
        const now = this.tick();
        this.requests.set(r.id, {
          id: r.id,
          requester: { id: r.requesterId, name: nameOf(r.requesterId) },
          supplierName: r.supplierName,
          supplierCnpj: r.supplierCnpj,
          invoiceNumber: r.invoiceNumber,
          amountCents: r.amountCents,
          competence: r.competence,
          dueDate: r.dueDate,
          category: r.category,
          description: r.description,
          status: 'PENDING',
          rejectionReason: null,
          paidAt: null,
          paymentReference: null,
          createdAt: now,
          updatedAt: now,
        });
        return Promise.resolve();
      },
      updateStatus: (c: StatusChange) => {
        this.beforeUpdate?.(this.requests);
        const current = this.requests.get(c.id);
        if (!current || current.status !== c.from) return Promise.resolve(false);
        this.requests.set(c.id, {
          ...current,
          status: c.to,
          rejectionReason: c.rejectionReason,
          paidAt: c.paidAt,
          paymentReference: c.paymentReference,
          updatedAt: this.tick(),
        });
        return Promise.resolve(true);
      },
      findStatus: (id: string) => Promise.resolve(this.requests.get(id)?.status ?? null),
      findTransitionInstant: (requestId: string, status: Status) => {
        const found = this.events
          .filter((e) => e.requestId === requestId && e.newStatus === status)
          .at(-1);
        return Promise.resolve(found?.createdAt ?? null);
      },
      insertAuditEvent: (e: NewAuditEvent) => {
        this.events.push({
          id: e.id,
          requestId: e.requestId,
          previousStatus: e.previousStatus,
          newStatus: e.newStatus,
          actor: { id: e.actorId, name: nameOf(e.actorId) },
          reason: e.reason,
          createdAt: this.tick(),
        });
        return Promise.resolve();
      },
      findById: (id: string) => Promise.resolve(this.requests.get(id) ?? null),
      listHistory: (id: string) => Promise.resolve(this.historyOf(id)),
    };
  }
}
