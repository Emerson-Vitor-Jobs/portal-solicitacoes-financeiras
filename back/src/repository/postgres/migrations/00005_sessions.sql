-- migrate:up
-- Sessão opaca (DECISOES_FUNDACAO §8.1): o cookie leva 32 bytes aleatórios; aqui fica só o SHA-256 deles.
CREATE TABLE sessions (
  id_hash      BYTEA       PRIMARY KEY CHECK (octet_length(id_hash) = 32),
  user_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Expiração absoluta (login + 8 h); a ociosa é last_seen_at + 30 min, checada na aplicação.
  expires_at   TIMESTAMPTZ NOT NULL
);

-- migrate:down
DROP TABLE sessions;
