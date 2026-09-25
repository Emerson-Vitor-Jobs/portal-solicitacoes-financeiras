#!/bin/sh
set -e
cd "$(dirname "$0")/.."

IT_DATABASE_URL="${IT_DATABASE_URL:-postgresql://gex:gex_local_password@localhost:5432/gex_finance_it}"

echo ">>> applying migrations to the test database (dbmate)"
./scripts/migrate.sh "$IT_DATABASE_URL"

echo ">>> running the integration tests"
DATABASE_URL="$IT_DATABASE_URL" exec npx vitest run --project integration "$@"
