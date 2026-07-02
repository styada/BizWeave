.PHONY: install dev lint build test test-unit test-integration test-scheduler test-supabase test-supabase-db test-e2e db-generate db-push local-setup local-dev supabase-ensure scheduler-tick scheduler-worker backend-sync backend-migrate backend-revision docker-up docker-down docker-logs supabase-start supabase-stop supabase-reset supabase-test-db supabase-gen-types

install:
	npm install

dev:
	npm run dev

lint:
	npm run lint

build:
	npm run build

test:
	npm run test

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

db-generate:
	npm run db:generate

db-push:
	npm run db:push

# Start Supabase locally if it isn't already running.
# Used by `local-setup` / `local-dev`. `make docker-up` is the alternative
# for containerized development.
supabase-ensure:
	@if ! curl -fsS http://localhost:54321/auth/v1/health >/dev/null 2>&1; then \
		echo "Starting local Supabase stack..."; \
		npx supabase start; \
	else \
		echo "Supabase already running at http://localhost:54321"; \
	fi

local-setup: supabase-ensure
	npm run db:push

local-dev: local-setup
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
