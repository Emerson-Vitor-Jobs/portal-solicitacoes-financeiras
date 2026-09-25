#!/bin/sh
set -e
. "$(dirname "$0")/dbmate_url.sh"

echo ">>> applying migrations"
dbmate --url "$(with_sslmode_disabled "$DATABASE_URL")" --wait --no-dump-schema --migrations-dir ./migrations up

echo ">>> loading the seed (idempotent)"
node dist/seed.js

echo ">>> starting the API"
exec node dist/main.js
