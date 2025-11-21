#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)

if command -v alembic >/dev/null 2>&1; then
  # Local environment (venv/system Python)
  pushd "$PROJECT_ROOT/backend" >/dev/null
  alembic upgrade head
  popd >/dev/null
else
  # Fallback to Docker Compose backend container
  pushd "$PROJECT_ROOT/infrastructure" >/dev/null
  docker-compose run --rm backend alembic upgrade head
  popd >/dev/null
fi
