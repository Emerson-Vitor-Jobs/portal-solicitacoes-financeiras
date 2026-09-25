import type pg from 'pg';
import type { DashboardRepository, SummaryScope } from '../../service/dashboard.js';
import type { DashboardSummary } from '../../types/domain.js';
import { toSafeInteger } from './map.js';
import { dashboardSummary } from './queries/dashboard.queries.js';

export class DashboardStorage implements DashboardRepository {
  constructor(private readonly pool: pg.Pool) {}

  async summary(scope: SummaryScope): Promise<DashboardSummary> {
    const [row] = await dashboardSummary.run(
      {
        requesterId: scope.requesterId,
        referenceDate: scope.referenceDate,
        monthStart: scope.monthStart,
        monthEnd: scope.monthEnd,
      },
      this.pool,
    );
    if (!row) throw new Error('dashboard aggregation returned no row');
    return {
      pendingAmountCents: toSafeInteger(row.pending_amount_cents),
      approvedAmountCents: toSafeInteger(row.approved_amount_cents),
      paidThisMonthAmountCents: toSafeInteger(row.paid_this_month_amount_cents),
      overdueCount: toSafeInteger(row.overdue_count),
    };
  }
}
