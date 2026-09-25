-- migrate:up
CREATE TABLE users (
  id            UUID        PRIMARY KEY,
  name          TEXT        NOT NULL CHECK (btrim(name) <> '' AND char_length(name) <= 200),
  -- E-mail guardado já normalizado (minúsculo, sem espaço): o UNIQUE compara a forma canônica.
  email         TEXT        NOT NULL UNIQUE CHECK (email = lower(btrim(email)) AND email <> ''),
  role          TEXT        NOT NULL CHECK (role IN ('REQUESTER', 'FINANCE')),
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- migrate:down
DROP TABLE users;
