# ── Daily commands ────────────────────────────────────────────────────────────
.PHONY: install test clean lint start typecheck

install:
	npm install

test:
	npm run test

clean:
	rm -rf .next node_modules/.cache coverage test-results playwright-report tsconfig.tsbuildinfo

lint:
	npm run lint

typecheck:
	npx tsc --noEmit

start:
	npm run dev

# ── Build & dev aliases ───────────────────────────────────────────────────────
.PHONY: dev build

dev: start

build:
	npm run build

# ── Focused test suites ───────────────────────────────────────────────────────
.PHONY: test-unit test-integration test-scheduler test-supabase test-supabase-db test-e2e

test-unit:
	npm run test:unit

test-integration:
	npm run test:integration

test-scheduler:
	npm run test:scheduler

test-supabase:
	npm run test -- src/lib/supabase/__tests__/

test-supabase-db:
	cd supabase && pgrx test || echo "pgrx not available; use 'supabase db test' instead"

test-e2e:
	npm run test:e2e

# ── Database, backend, Docker, Supabase ───────────────────────────────────────
.PHONY: db-generate db-push local-setup local-dev supabase-ensure scheduler-tick scheduler-worker backend-sync backend-migrate backend-revision docker-up docker-down docker-logs supabase-start supabase-stop supabase-reset supabase-test-db supabase-gen-types

db-generate:
	npm run db:generate

db-push:
	npm run db:push

# Start Supabase locally if it isn't already running. Optional — only needed
# for Supabase auth flows, storage, or the admin tooling. The default dev path
# (Homebrew Postgres + demo Supabase env vars) does NOT need this.
#
# Note: `npx supabase start` takes 1-3 minutes (Docker). Don't chain it into
# the default `local-setup` path; that's why we split it out below.
supabase-ensure:
	@if ! curl -fsS http://localhost:54321/auth/v1/health >/dev/null 2>&1; then \
		echo "Starting local Supabase stack (1-3 min, requires Docker)..."; \
		npx supabase start; \
	else \
		echo "Supabase already running at http://localhost:54321"; \
	fi

# 30-second local setup. Uses Homebrew Postgres only.
# Verifies: Postgres up, bizweave DB exists, Prisma schema pushed, .env created.
# Does NOT start Supabase (use `make supabase-ensure` separately if needed).
local-setup:
	@if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then \
		echo "Postgres not reachable on localhost:5432."; \
		echo "Install with: brew install postgresql@16 && brew services start postgresql@16"; \
		exit 1; \
	fi
	@if ! psql "postgresql://postgres:postgres@localhost:5432/postgres" -tAc "SELECT 1 FROM pg_database WHERE datname='bizweave'" 2>/dev/null | grep -q 1; then \
		echo "Creating database 'bizweave'..."; \
		createdb -h localhost -U postgres bizweave 2>/dev/null || \
			(echo "Failed to create DB. Check postgres role has password 'postgres'." && exit 1); \
	fi
	@if [ ! -f .env ]; then cp .env.development .env; echo "Created .env from .env.development"; fi
	@echo "Pushing Prisma schema..."
	npm run db:push -- --accept-data-loss

local-dev: local-setup
	npm run dev

# Full local setup with Supabase (for testing real auth flows). Slower.
local-dev-full: local-setup supabase-ensure
	npm run dev

scheduler-tick:
	npm run scheduler:tick

scheduler-worker:
	npm run worker:scheduler

backend-sync:
	cd backend && uv sync

backend-migrate:
	ALEMBIC_BACKEND_ONLY=1 bash scripts/backend-alembic.sh upgrade head

backend-revision:
	ALEMBIC_BACKEND_ONLY=1 bash scripts/backend-alembic.sh revision --autogenerate -m "new storage version"

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f frontend backend

supabase-start:
	npx supabase start

supabase-stop:
	npx supabase stop

supabase-reset:
	npx supabase db reset

supabase-test-db:
	npx supabase test db

supabase-gen-types:
	npx supabase gen types typescript --local > src/generated/supabase-types.ts
