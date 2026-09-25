-- migrate:up
CREATE EXTENSION IF NOT EXISTS unaccent;

-- migrate:down
DROP EXTENSION IF EXISTS unaccent;
