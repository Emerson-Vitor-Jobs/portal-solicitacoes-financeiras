#!/bin/sh
# Testes de integração contra o Postgres local (o do stack principal, em localhost), no banco próprio dos testes.
# Nunca o banco do app: o TRUNCATE antes de cada teste apagaria os dados de quem está usando o portal (§9.3).
set -e
cd "$(dirname "$0")/.."

IT_DATABASE_URL="${IT_DATABASE_URL:-postgresql://gex:gex_local_password@localhost:5432/gex_finance_it}"

echo ">>> aplicando as migrations no banco de teste (dbmate)"
docker run --rm --network host \
  -v "$PWD/src/repository/postgres/migrations:/migrations:ro" \
  ghcr.io/amacneil/dbmate:2.36.0 \
  --url "$IT_DATABASE_URL?sslmode=disable" --no-dump-schema --migrations-dir /migrations up

echo ">>> rodando os testes de integração"
DATABASE_URL="$IT_DATABASE_URL" exec npx vitest run --project integration "$@"
