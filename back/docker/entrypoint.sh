#!/bin/sh
# Ordem garantida pelo `set -e`: se a migration falhar, a API não sobe (DECISOES_FUNDACAO §9.1).
set -e

# O dbmate (lib/pq) exige TLS por padrão; o Postgres local do compose não tem TLS, e o driver `pg` da API
# também não usa. Sem sslmode explícito na URL, alinha o dbmate ao comportamento da API.
case "$DATABASE_URL" in
  *sslmode=*) DBMATE_URL="$DATABASE_URL" ;;
  *\?*) DBMATE_URL="$DATABASE_URL&sslmode=disable" ;;
  *) DBMATE_URL="$DATABASE_URL?sslmode=disable" ;;
esac

echo ">>> aplicando migrations"
dbmate --url "$DBMATE_URL" --wait --no-dump-schema --migrations-dir ./migrations up

echo ">>> iniciando a API"
# exec: o Node vira o PID 1 e recebe o SIGTERM do `docker compose down`.
exec node dist/main.js
