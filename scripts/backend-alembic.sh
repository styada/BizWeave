#!/usr/bin/env bash
set -euo pipefail

if [[ "${ALEMBIC_BACKEND_ONLY:-}" != "1" ]]; then
  echo "Refusing to run Alembic without explicit backend-only opt-in."
  echo "Set ALEMBIC_BACKEND_ONLY=1 and BACKEND_DATABASE_URL, then retry."
  exit 1
fi

if [[ -z "${BACKEND_DATABASE_URL:-}" ]]; then
  echo "BACKEND_DATABASE_URL is required for backend Alembic commands."
  echo "Example: BACKEND_DATABASE_URL=postgresql+psycopg://user:pass@host:5432/backend_db"
  exit 1
fi

if [[ "${BACKEND_DATABASE_URL}" == *"schema=public"* ]] && [[ "${ALLOW_ALEMBIC_PUBLIC_SCHEMA:-}" != "1" ]]; then
  echo "Refusing Alembic target with schema=public (shared app schema)."
  echo "Use a backend-only schema/database, or set ALLOW_ALEMBIC_PUBLIC_SCHEMA=1 to override intentionally."
  exit 1
fi

cd backend
DATABASE_URL="${BACKEND_DATABASE_URL}" uv run alembic "$@"