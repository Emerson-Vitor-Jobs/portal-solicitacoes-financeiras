// Controller fino: chama o service e converte domínio → contrato.
import type { z } from 'zod';
import type { DashboardService, DashboardView } from '../../../service/dashboard.js';
import type { dashboardSummarySchema } from '../../../types/dashboard.js';
import type { User } from '../../../types/domain.js';

type DashboardSummaryResponse = z.infer<typeof dashboardSummarySchema>;

export function toDashboardSummaryResponse(v: DashboardView): DashboardSummaryResponse {
  return {
    pending_amount_cents: v.pendingAmountCents,
    approved_amount_cents: v.approvedAmountCents,
    paid_this_month_amount_cents: v.paidThisMonthAmountCents,
    overdue_count: v.overdueCount,
    reference_date: v.referenceDate,
  };
}

export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  async summary(user: User): Promise<DashboardSummaryResponse> {
    return toDashboardSummaryResponse(await this.service.summary(user));
  }
}
