#!/bin/sh
set -e
cd "$(dirname "$0")/.."
. ./docker/dbmate_url.sh

docker run --rm --network host \
  -v "$PWD/src/repository/postgres/migrations:/migrations:ro" \
  ghcr.io/amacneil/dbmate:2.36.0 \
  --url "$(with_sslmode_disabled "$1")" --no-dump-schema --migrations-dir /migrations up
