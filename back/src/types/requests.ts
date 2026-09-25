import { z } from 'zod';
import {
  businessDateSchema,
  categorySchema,
  instantSchema,
  statusSchema,
  userRefSchema,
} from './common.js';

const text = (max: number) => z.string().trim().min(1).max(max);

export const competenceSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'competência deve estar no formato YYYY-MM')
  .describe('Mês de competência, YYYY-MM');

export const createRequestBodySchema = z.object({
  supplier_name: text(200),
  supplier_cnpj: z.string().trim().min(1).max(32),
  invoice_number: text(50),
  amount_cents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  competence: competenceSchema,
  due_date: businessDateSchema,
  category: categorySchema,
  description: z.string().trim().max(1000).nullish(),
});
export type CreateRequestBody = z.infer<typeof createRequestBodySchema>;

export const listRequestsQuerySchema = z.object({
  status: statusSchema.optional(),
  supplier: z.string().trim().max(200).optional(),
  due_from: businessDateSchema.optional(),
  due_to: businessDateSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;

export const decisionBodySchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('APPROVE') }),
  z.object({ decision: z.literal('REJECT'), reason: text(500) }),
]);
export type DecisionBody = z.infer<typeof decisionBodySchema>;

export const markPaidBodySchema = z.object({
  paid_at: instantSchema,
  payment_reference: text(100),
});
export type MarkPaidBody = z.infer<typeof markPaidBodySchema>;

export const requestListItemSchema = z
  .object({
    id: z.uuid(),
    supplier_name: z.string(),
    invoice_number: z.string(),
    amount_cents: z.number().int(),
    due_date: businessDateSchema,
    status: statusSchema,
    is_overdue: z.boolean(),
    requester: userRefSchema,
  })
  .meta({ id: 'RequestListItem' });

export const requestListResponseSchema = z
  .object({
    data: z.array(requestListItemSchema),
    page: z.number().int(),
    page_size: z.number().int(),
    total: z.number().int(),
    total_pages: z.number().int(),
    reference_date: businessDateSchema,
  })
  .meta({ id: 'RequestList' });

export const historyEventSchema = z
  .object({
    id: z.uuid(),
    previous_status: statusSchema.nullable(),
    new_status: statusSchema,
    actor: userRefSchema,
    reason: z.string().nullable(),
    created_at: instantSchema,
  })
  .meta({ id: 'HistoryEvent' });

export const requestDetailSchema = z
  .object({
    id: z.uuid(),
    requester: userRefSchema,
    supplier_name: z.string(),
    supplier_cnpj: z.string(),
    invoice_number: z.string(),
    amount_cents: z.number().int(),
    competence: competenceSchema,
    due_date: businessDateSchema,
    category: categorySchema,
    description: z.string().nullable(),
    status: statusSchema,
    is_overdue: z.boolean(),
    rejection_reason: z.string().nullable(),
    paid_at: instantSchema.nullable(),
    payment_reference: z.string().nullable(),
    created_at: instantSchema,
    updated_at: instantSchema,
    history: z.array(historyEventSchema),
  })
  .meta({ id: 'RequestDetail' });
