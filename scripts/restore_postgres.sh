#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to a valid Postgres connection string}"
INPUT_FILE=${1:?Usage: restore_postgres.sh path/to/backup.sql}

psql "$DATABASE_URL" < "$INPUT_FILE"
echo "Restore completed from $INPUT_FILE"
