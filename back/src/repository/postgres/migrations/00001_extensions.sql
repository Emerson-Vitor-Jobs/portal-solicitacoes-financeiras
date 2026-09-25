-- migrate:up
-- unaccent: busca por fornecedor sem acento ("servicos" acha "Serviços"), DECISOES_FUNDACAO §7.3.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- migrate:down
DROP EXTENSION IF EXISTS unaccent;
