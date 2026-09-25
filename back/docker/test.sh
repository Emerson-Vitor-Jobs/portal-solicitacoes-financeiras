#!/bin/sh
set -e
. "$(dirname "$0")/dbmate_url.sh"

echo ">>> applying migrations to the test database"
dbmate --url "$(with_sslmode_disabled "$DATABASE_URL")" --wait --no-dump-schema --migrations-dir ./src/repository/postgres/migrations up

echo ">>> running the tests"
exec npm test
