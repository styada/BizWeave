.PHONY: install dev lint build test test-unit test-integration test-scheduler test-e2e db-generate db-push db-local-start db-local-bootstrap db-local-stop local-setup local-dev scheduler-tick scheduler-worker backend-sync backend-migrate backend-revision docker-up docker-down docker-logs

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

test-e2e:
	npm run test:e2e

db-generate:
	npm run db:generate

db-push:
	npm run db:push

db-local-start:
	brew services start postgresql@16

db-local-bootstrap:
	if [[ "$$(psql -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='postgres'")" != "1" ]]; then \
		psql -d postgres -c "CREATE ROLE postgres LOGIN SUPERUSER PASSWORD 'postgres';"; \
	else \
		psql -d postgres -c "ALTER ROLE postgres WITH LOGIN SUPERUSER PASSWORD 'postgres';"; \
	fi
	if [[ "$$(psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='bizweave'")" != "1" ]]; then \
		createdb -O postgres bizweave; \
	fi

db-local-stop:
	brew services stop postgresql@16

local-setup: db-local-start db-local-bootstrap db-push

local-dev: local-setup
	npm run dev

scheduler-tick:
	npm run scheduler:tick

scheduler-worker:
	npm run worker:scheduler

backend-sync:
	cd backend && uv sync

backend-migrate:
	cd backend && uv run alembic upgrade head

backend-revision:
	cd backend && uv run alembic revision --autogenerate -m "new storage version"

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f frontend backend
