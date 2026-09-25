/* @name InsertSeedUser */
INSERT INTO users (id, name, email, role, password_hash)
VALUES (:id!, :name!, :email!, :role!, :passwordHash!)
ON CONFLICT DO NOTHING
RETURNING id;

/* @name InsertSeedRequest */
INSERT INTO requests (
  id, requester_id, supplier_name, supplier_cnpj, invoice_number, amount_cents, competence, due_date,
  category, description, status, rejection_reason, paid_at, payment_reference, created_at, updated_at
)
VALUES (
  :id!, :requesterId!, :supplierName!, :supplierCnpj!, :invoiceNumber!, :amountCents!, :competence!, :dueDate!,
  :category!, :description, :status!, :rejectionReason, :paidAt, :paymentReference, :createdAt!, :updatedAt!
)
ON CONFLICT DO NOTHING
RETURNING id;

/* @name InsertSeedAuditEvent */
INSERT INTO audit_events (id, request_id, actor_id, previous_status, new_status, reason, created_at)
VALUES (:id!, :requestId!, :actorId!, :previousStatus, :newStatus!, :reason, :createdAt!)
ON CONFLICT DO NOTHING
RETURNING id;
