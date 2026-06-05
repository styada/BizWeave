#!/usr/bin/env bash
# Runs pgTAP database unit tests against the configured Postgres.
#
# Usage:
#   DATABASE_URL="postgresql://..." ./scripts/run-pgtap-tests.sh
#
# If DATABASE_URL is not set, it is loaded from .env.
# If the pgTAP extension is not installed, the script attempts to install it.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

# ---- Resolve DATABASE_URL ----
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f .env ]; then
    DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | sed 's/^DATABASE_URL=//' | head -1)"
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set and was not found in .env" >&2
  exit 1
fi

# Strip URL query params for psql (e.g. ?schema=public)
PSQL_URI="${DATABASE_URL%%\?*}"
echo "Database: $PSQL_URI"
echo ""

# ---- Ensure pgTAP extension is available ----
echo "Ensuring pgTAP extension is installed..."
if psql "$PSQL_URI" -c "CREATE EXTENSION IF NOT EXISTS pgtap CASCADE;" 2>/dev/null; then
  echo "pgTAP ready."
else
  echo ""
  echo "ERROR: Could not install pgTAP extension."
  echo ""
  echo "  To build a Postgres image with pgTAP for local dev:"
  echo "    docker compose build db-test"
  echo "    docker compose up -d db-test"
  echo "    # Then re-run this script with DATABASE_URL pointing to the test container"
  echo ""
  echo "  To install pgTAP in a Homebrew Postgres:"
  echo "    brew install pgtap"
  echo "    psql \$DATABASE_URL -c 'CREATE EXTENSION IF NOT EXISTS pgtap CASCADE;'"
  exit 1
fi
echo ""

# ---- Run tests ----
TEST_DIR="supabase/tests/database"
EXIT_CODE=0
TOTAL=0
PASSED=0
FAILED=0

for test_file in "$TEST_DIR"/*.test.sql; do
  if [ ! -f "$test_file" ]; then
    echo "No test files found in $TEST_DIR"
    exit 0
  fi
  TOTAL=$((TOTAL + 1))
  name="$(basename "$test_file")"
  echo "────────────────────────────────────────"
  echo "  Running: $name"
  echo "────────────────────────────────────────"
  if psql "$PSQL_URI" -f "$test_file"; then
    echo "  ✓ PASS: $name"
    PASSED=$((PASSED + 1))
  else
    echo "  ✗ FAIL: $name"
    FAILED=$((FAILED + 1))
    EXIT_CODE=1
  fi
  echo ""
done

echo "════════════════════════════════════════"
echo "  Results: $TOTAL files, $PASSED passed, $FAILED failed"
echo "════════════════════════════════════════"
exit $EXIT_CODE
