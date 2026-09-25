import { z } from 'zod';
import { businessDateSchema } from './common.js';

export const dashboardSummarySchema = z
  .object({
    pending_amount_cents: z.number().int(),
    approved_amount_cents: z.number().int(),
    paid_this_month_amount_cents: z.number().int(),
    overdue_count: z.number().int(),
    reference_date: businessDateSchema,
  })
  .meta({ id: 'DashboardSummary' });
