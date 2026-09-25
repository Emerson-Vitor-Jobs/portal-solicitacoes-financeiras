-- migrate:up
CREATE TABLE sessions (
  id_hash      BYTEA       PRIMARY KEY CHECK (octet_length(id_hash) = 32),
  user_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL
);

-- migrate:down
DROP TABLE sessions;
