#!/bin/sh
# Roda a suíte do back contra o banco de teste (gex_finance_it), nunca o banco do app.
set -e

# O dbmate (lib/pq) exige TLS por padrão; o Postgres local do compose não tem TLS, e o driver `pg` da API
# também não usa. Sem sslmode explícito na URL, alinha o dbmate ao comportamento da API.
case "$DATABASE_URL" in
  *sslmode=*) DBMATE_URL="$DATABASE_URL" ;;
  *\?*) DBMATE_URL="$DATABASE_URL&sslmode=disable" ;;
  *) DBMATE_URL="$DATABASE_URL?sslmode=disable" ;;
esac

echo ">>> aplicando migrations no banco de teste"
dbmate --url "$DBMATE_URL" --wait --no-dump-schema --migrations-dir ./src/repository/postgres/migrations up

echo ">>> rodando os testes"
exec npm test
