#!/bin/sh
# Gera os *.queries.ts a partir dos *.sql (PgTyped, DECISOES_FUNDACAO §12).
# O PgTyped pergunta os tipos ao próprio Postgres, então o banco precisa estar de pé e migrado.
set -e
cd "$(dirname "$0")/.."

GEN_DATABASE_URL="${GEN_DATABASE_URL:-postgresql://gex:gex_local_password@localhost:5432/gex_finance_test}"

echo ">>> subindo o postgres do compose"
docker compose -f ../docker-compose.yml up -d --wait postgres

echo ">>> aplicando as migrations (dbmate)"
docker run --rm --network host \
  -v "$PWD/src/repository/postgres/migrations:/migrations:ro" \
  ghcr.io/amacneil/dbmate:2.36.0 \
  --url "$GEN_DATABASE_URL?sslmode=disable" --no-dump-schema --migrations-dir /migrations up

echo ">>> gerando os tipos das queries"
DATABASE_URL="$GEN_DATABASE_URL" npx pgtyped -c pgtyped.json
