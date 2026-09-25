/* Indicadores numa varredura só (DECISOES_FUNDACAO §14.2). A referência e os limites do mês vêm da aplicação
   (APP_TODAY ou hoje em SP), nunca de CURRENT_DATE. "Pago no mês" é intervalo semiaberto em instantes de SP
   ([início do mês, início do mês seguinte)), sem função em volta da coluna. Escopo: requesterId nulo = todas. */

/* @name DashboardSummary */
SELECT
  COALESCE(SUM(amount_cents) FILTER (WHERE status = 'PENDING'), 0) AS "pending_amount_cents!",
  COALESCE(SUM(amount_cents) FILTER (WHERE status = 'APPROVED'), 0) AS "approved_amount_cents!",
  COALESCE(
    SUM(amount_cents) FILTER (WHERE status = 'PAID' AND paid_at >= :monthStart! AND paid_at < :monthEnd!),
    0
  ) AS "paid_this_month_amount_cents!",
  COUNT(*) FILTER (WHERE status IN ('PENDING', 'APPROVED') AND due_date < :referenceDate!) AS "overdue_count!"
FROM requests
WHERE (:requesterId::uuid IS NULL OR requester_id = :requesterId);
