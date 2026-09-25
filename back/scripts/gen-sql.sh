#!/bin/sh
set -e
cd "$(dirname "$0")/.."

GEN_DATABASE_URL="${GEN_DATABASE_URL:-postgresql://gex:gex_local_password@localhost:5432/gex_finance_test}"

echo ">>> starting the compose postgres"
docker compose -f ../docker-compose.yml up -d --wait postgres

echo ">>> applying migrations (dbmate)"
./scripts/migrate.sh "$GEN_DATABASE_URL"

echo ">>> generating the query types"
DATABASE_URL="$GEN_DATABASE_URL" npx pgtyped -c pgtyped.json
