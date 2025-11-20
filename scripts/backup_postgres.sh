#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to a valid Postgres connection string}"
OUTPUT_DIR=${1:-backups}
mkdir -p "$OUTPUT_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="$OUTPUT_DIR/township-$STAMP.sql"

pg_dump "$DATABASE_URL" > "$FILE"
echo "Backup written to $FILE"
