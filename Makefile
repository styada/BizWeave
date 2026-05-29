.RECIPEPREFIX := >

.PHONY: install dev lint build test test-unit test-integration test-scheduler test-e2e db-generate db-push scheduler-tick scheduler-worker docker-up docker-down docker-logs

install:
> npm install

dev:
> npm run dev

lint:
> npm run lint

build:
> npm run build

test:
> npm run test

test-unit:
> npm run test:unit

test-integration:
> npm run test:integration

test-scheduler:
> npm run test:scheduler

test-e2e:
> npm run test:e2e

db-generate:
> npm run db:generate

db-push:
> npm run db:push

scheduler-tick:
> npm run scheduler:tick

scheduler-worker:
> npm run worker:scheduler

docker-up:
> docker compose up --build -d

docker-down:
> docker compose down

docker-logs:
> docker compose logs -f app
