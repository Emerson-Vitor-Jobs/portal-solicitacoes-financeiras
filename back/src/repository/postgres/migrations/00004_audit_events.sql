-- migrate:up
CREATE TABLE audit_events (
  id              UUID        PRIMARY KEY,
  request_id      UUID        NOT NULL REFERENCES requests (id),
  actor_id        UUID        NOT NULL REFERENCES users (id),
  previous_status TEXT        CHECK (previous_status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID')),
  new_status      TEXT        NOT NULL CHECK (new_status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID')),
  -- Motivo da rejeição, ou a referência do pagamento (como nos eventos do seed).
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Só as transições permitidas pelo enunciado viram evento (a criação é NULL → PENDING).
  -- Os dois ramos são escritos para nunca darem NULL: um CHECK que avalia NULL é considerado satisfeito,
  -- e (NULL, 'APPROVED') IN (...) daria NULL, deixando passar uma "criação" direto em APPROVED.
  CONSTRAINT audit_events_valid_transition CHECK (
    (previous_status IS NULL AND new_status = 'PENDING')
    OR (
      previous_status IS NOT NULL
      AND (previous_status, new_status) IN (('PENDING', 'APPROVED'), ('PENDING', 'REJECTED'), ('APPROVED', 'PAID'))
    )
  )
);

CREATE INDEX audit_events_request_id_idx ON audit_events (request_id, created_at);

-- Histórico append-only: nada o edita ou apaga depois de gravado.
-- (TRUNCATE não dispara trigger de linha, então os testes conseguem limpar o banco de teste.)
CREATE FUNCTION audit_events_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events é append-only: % não é permitido', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER audit_events_no_update_delete
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();

-- migrate:down
DROP TABLE audit_events;
DROP FUNCTION audit_events_append_only();
