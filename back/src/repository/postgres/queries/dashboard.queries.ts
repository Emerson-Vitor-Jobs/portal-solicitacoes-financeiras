/** Types generated for queries found in "src/repository/postgres/queries/dashboard.sql" */
import { PreparedQuery } from '@pgtyped/runtime';

export type DateOrString = Date | string;

/** 'DashboardSummary' parameters type */
export interface IDashboardSummaryParams {
  monthEnd: DateOrString;
  monthStart: DateOrString;
  referenceDate: string;
  requesterId?: string | null | void;
}

/** 'DashboardSummary' return type */
export interface IDashboardSummaryResult {
  approved_amount_cents: string;
  overdue_count: string;
  paid_this_month_amount_cents: string;
  pending_amount_cents: string;
}

/** 'DashboardSummary' query type */
export interface IDashboardSummaryQuery {
  params: IDashboardSummaryParams;
  result: IDashboardSummaryResult;
}

const dashboardSummaryIR: any = {"usedParamSet":{"monthStart":true,"monthEnd":true,"referenceDate":true,"requesterId":true},"params":[{"name":"monthStart","required":true,"transform":{"type":"scalar"},"locs":[{"a":278,"b":289}]},{"name":"monthEnd","required":true,"transform":{"type":"scalar"},"locs":[{"a":305,"b":314}]},{"name":"referenceDate","required":true,"transform":{"type":"scalar"},"locs":[{"a":438,"b":452}]},{"name":"requesterId","required":false,"transform":{"type":"scalar"},"locs":[{"a":496,"b":507},{"a":541,"b":552}]}],"statement":"SELECT\n  COALESCE(SUM(amount_cents) FILTER (WHERE status = 'PENDING'), 0) AS \"pending_amount_cents!\",\n  COALESCE(SUM(amount_cents) FILTER (WHERE status = 'APPROVED'), 0) AS \"approved_amount_cents!\",\n  COALESCE(\n    SUM(amount_cents) FILTER (WHERE status = 'PAID' AND paid_at >= :monthStart! AND paid_at < :monthEnd!),\n    0\n  ) AS \"paid_this_month_amount_cents!\",\n  COUNT(*) FILTER (WHERE status IN ('PENDING', 'APPROVED') AND due_date < :referenceDate!) AS \"overdue_count!\"\nFROM requests\nWHERE (:requesterId::uuid IS NULL OR requester_id = :requesterId)"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   COALESCE(SUM(amount_cents) FILTER (WHERE status = 'PENDING'), 0) AS "pending_amount_cents!",
 *   COALESCE(SUM(amount_cents) FILTER (WHERE status = 'APPROVED'), 0) AS "approved_amount_cents!",
 *   COALESCE(
 *     SUM(amount_cents) FILTER (WHERE status = 'PAID' AND paid_at >= :monthStart! AND paid_at < :monthEnd!),
 *     0
 *   ) AS "paid_this_month_amount_cents!",
 *   COUNT(*) FILTER (WHERE status IN ('PENDING', 'APPROVED') AND due_date < :referenceDate!) AS "overdue_count!"
 * FROM requests
 * WHERE (:requesterId::uuid IS NULL OR requester_id = :requesterId)
 * ```
 */
export const dashboardSummary = new PreparedQuery<IDashboardSummaryParams,IDashboardSummaryResult>(dashboardSummaryIR);


