import type { FastifyReply } from 'fastify';
import type { z } from 'zod';
import type { RequestService } from '../../../service/requests.js';
import type {
  CreateRequestBody,
  DecisionBody,
  ListRequestsQuery,
  MarkPaidBody,
  historyEventSchema,
  requestDetailSchema,
  requestListItemSchema,
  requestListResponseSchema,
} from '../../../types/requests.js';
import type { AuditEvent, RequestDetail, RequestView, User } from '../../../types/domain.js';

type RequestDetailResponse = z.infer<typeof requestDetailSchema>;

export function toHistoryEventResponse(e: AuditEvent): z.infer<typeof historyEventSchema> {
  return {
    id: e.id,
    previous_status: e.previousStatus,
    new_status: e.newStatus,
    actor: { id: e.actor.id, name: e.actor.name },
    reason: e.reason,
    created_at: e.createdAt.toISOString(),
  };
}

export function toRequestListItemResponse(r: RequestView): z.infer<typeof requestListItemSchema> {
  return {
    id: r.id,
    supplier_name: r.supplierName,
    invoice_number: r.invoiceNumber,
    amount_cents: r.amountCents,
    due_date: r.dueDate,
    status: r.status,
    is_overdue: r.isOverdue,
    requester: { id: r.requester.id, name: r.requester.name },
  };
}

export function toRequestDetailResponse(r: RequestDetail): RequestDetailResponse {
  return {
    id: r.id,
    requester: { id: r.requester.id, name: r.requester.name },
    supplier_name: r.supplierName,
    supplier_cnpj: r.supplierCnpj,
    invoice_number: r.invoiceNumber,
    amount_cents: r.amountCents,
    competence: r.competence,
    due_date: r.dueDate,
    category: r.category,
    description: r.description,
    status: r.status,
    is_overdue: r.isOverdue,
    rejection_reason: r.rejectionReason,
    paid_at: r.paidAt?.toISOString() ?? null,
    payment_reference: r.paymentReference,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    history: r.history.map(toHistoryEventResponse),
  };
}

export class RequestController {
  constructor(private readonly service: RequestService) {}

  async create(
    user: User,
    body: CreateRequestBody,
    reply: FastifyReply,
  ): Promise<RequestDetailResponse> {
    const created = await this.service.create(user, {
      supplierName: body.supplier_name,
      supplierCnpj: body.supplier_cnpj,
      invoiceNumber: body.invoice_number,
      amountCents: body.amount_cents,
      competence: body.competence,
      dueDate: body.due_date,
      category: body.category,
      description: body.description,
    });
    reply.code(201).header('location', `/api/requests/${created.id}`);
    return toRequestDetailResponse(created);
  }

  async list(
    user: User,
    query: ListRequestsQuery,
  ): Promise<z.infer<typeof requestListResponseSchema>> {
    const page = await this.service.list(user, {
      status: query.status,
      supplier: query.supplier,
      dueFrom: query.due_from,
      dueTo: query.due_to,
      page: query.page,
      pageSize: query.page_size,
    });
    return {
      data: page.items.map(toRequestListItemResponse),
      page: page.page,
      page_size: page.pageSize,
      total: page.total,
      total_pages: page.totalPages,
      reference_date: page.referenceDate,
    };
  }

  async get(user: User, id: string): Promise<RequestDetailResponse> {
    return toRequestDetailResponse(await this.service.get(user, id));
  }

  async decide(user: User, id: string, body: DecisionBody): Promise<RequestDetailResponse> {
    const updated =
      body.decision === 'APPROVE'
        ? await this.service.approve(user, id)
        : await this.service.reject(user, id, body.reason);
    return toRequestDetailResponse(updated);
  }

  async markPaid(user: User, id: string, body: MarkPaidBody): Promise<RequestDetailResponse> {
    const updated = await this.service.markPaid(user, id, {
      paidAt: new Date(body.paid_at),
      paymentReference: body.payment_reference,
    });
    return toRequestDetailResponse(updated);
  }
}
