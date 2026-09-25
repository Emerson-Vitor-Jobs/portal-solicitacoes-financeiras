-- migrate:up
CREATE TABLE requests (
  id                UUID        PRIMARY KEY,
  requester_id      UUID        NOT NULL REFERENCES users (id),

  supplier_name     TEXT        NOT NULL CHECK (btrim(supplier_name) <> '' AND char_length(supplier_name) <= 200),
  supplier_cnpj     TEXT        NOT NULL CHECK (supplier_cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$'),
  invoice_number    TEXT        NOT NULL CHECK (
                                  invoice_number = upper(btrim(invoice_number))
                                  AND invoice_number <> ''
                                  AND char_length(invoice_number) <= 50
                                ),
  amount_cents      BIGINT      NOT NULL CHECK (amount_cents > 0),
  competence        DATE        NOT NULL CHECK (extract(day FROM competence) = 1),
  due_date          DATE        NOT NULL,
  category          TEXT        NOT NULL CHECK (category IN ('INFRAESTRUTURA', 'MARKETING', 'SERVIÇOS', 'SOFTWARE')),
  description       TEXT        CHECK (description IS NULL OR (btrim(description) <> '' AND char_length(description) <= 1000)),

  status            TEXT        NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID')),
  rejection_reason  TEXT        CHECK (rejection_reason IS NULL OR (btrim(rejection_reason) <> '' AND char_length(rejection_reason) <= 500)),
  paid_at           TIMESTAMPTZ,
  payment_reference TEXT        CHECK (payment_reference IS NULL OR (btrim(payment_reference) <> '' AND char_length(payment_reference) <= 100)),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT requests_supplier_cnpj_invoice_number_key UNIQUE (supplier_cnpj, invoice_number),

  CONSTRAINT requests_rejection_reason_iff_rejected CHECK ((status = 'REJECTED') = (rejection_reason IS NOT NULL)),
  CONSTRAINT requests_payment_iff_paid CHECK (
    (status = 'PAID') = (paid_at IS NOT NULL) AND (paid_at IS NULL) = (payment_reference IS NULL)
  )
);

CREATE INDEX requests_requester_id_idx ON requests (requester_id);

-- migrate:down
DROP TABLE requests;
