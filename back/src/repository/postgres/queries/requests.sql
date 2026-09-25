/* @name InsertRequest */
INSERT INTO requests (
  id, requester_id, supplier_name, supplier_cnpj, invoice_number, amount_cents, competence, due_date,
  category, description, status
)
VALUES (
  :id!, :requesterId!, :supplierName!, :supplierCnpj!, :invoiceNumber!, :amountCents!, :competence!, :dueDate!,
  :category!, :description, 'PENDING'
);

/* @name UpdateRequestStatus */
UPDATE requests
SET status = :to!,
    rejection_reason = :rejectionReason,
    paid_at = :paidAt,
    payment_reference = :paymentReference,
    updated_at = now()
WHERE id = :id! AND status = :from!
RETURNING id;

/* @name FindRequestStatus */
SELECT status
FROM requests
WHERE id = :id!;

/* @name InsertAuditEvent */
INSERT INTO audit_events (id, request_id, actor_id, previous_status, new_status, reason)
VALUES (:id!, :requestId!, :actorId!, :previousStatus, :newStatus!, :reason);

/* @name FindTransitionInstant */
SELECT created_at
FROM audit_events
WHERE request_id = :requestId! AND new_status = :newStatus!
ORDER BY created_at DESC
LIMIT 1;

/* @name FindRequestById */
SELECT r.id, r.requester_id, u.name AS requester_name, r.supplier_name, r.supplier_cnpj, r.invoice_number,
       r.amount_cents, r.competence, r.due_date, r.category, r.description, r.status, r.rejection_reason,
       r.paid_at, r.payment_reference, r.created_at, r.updated_at
FROM requests r
JOIN users u ON u.id = r.requester_id
WHERE r.id = :id!;

/* @name ListAuditEvents */
SELECT e.id, e.previous_status, e.new_status, e.reason, e.created_at, e.actor_id, u.name AS actor_name
FROM audit_events e
JOIN users u ON u.id = e.actor_id
WHERE e.request_id = :requestId!
ORDER BY e.created_at, e.id;

/* @name ListRequests */
SELECT r.id, r.requester_id, u.name AS requester_name, r.supplier_name, r.supplier_cnpj, r.invoice_number,
       r.amount_cents, r.competence, r.due_date, r.category, r.description, r.status, r.rejection_reason,
       r.paid_at, r.payment_reference, r.created_at, r.updated_at
FROM requests r
JOIN users u ON u.id = r.requester_id
WHERE (:requesterId::uuid IS NULL OR r.requester_id = :requesterId)
  AND (:status::text IS NULL OR r.status = :status)
  AND (:supplier::text IS NULL OR unaccent(r.supplier_name) ILIKE unaccent('%' || :supplier || '%'))
  AND (:dueFrom::date IS NULL OR r.due_date >= :dueFrom)
  AND (:dueTo::date IS NULL OR r.due_date <= :dueTo)
ORDER BY r.created_at DESC, r.id DESC
LIMIT :limit! OFFSET :offset!;

/* @name CountRequests */
SELECT COUNT(*) AS "total!"
FROM requests r
WHERE (:requesterId::uuid IS NULL OR r.requester_id = :requesterId)
  AND (:status::text IS NULL OR r.status = :status)
  AND (:supplier::text IS NULL OR unaccent(r.supplier_name) ILIKE unaccent('%' || :supplier || '%'))
  AND (:dueFrom::date IS NULL OR r.due_date >= :dueFrom)
  AND (:dueTo::date IS NULL OR r.due_date <= :dueTo);
