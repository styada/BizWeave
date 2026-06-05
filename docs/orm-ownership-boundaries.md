# ORM Ownership Boundaries (Prisma vs Alembic)

This repository uses a split ownership model to prevent schema drift:

- Prisma owns shared app tables in the Supabase/Postgres `public` schema.
- Alembic owns backend-only storage schema changes for the Python service.

## Rules

- Do not run Alembic against the shared app `public` schema by default.
- Do not use Prisma to manage backend-only Alembic storage tables.
- Treat Prisma schema + generated migrations/push as source-of-truth for app data model.
- Treat Alembic revisions as source-of-truth only for backend storage model.

## Anti-drift workflow

1. App/shared schema changes:
   - Update `prisma/schema.prisma`
   - Run `npm run db:generate`
   - Run `npm run db:push` (or your Prisma migration flow)
2. Backend-only storage changes:
   - Set `BACKEND_DATABASE_URL` to backend-only database/schema
   - Run `make backend-migrate` or `npm run backend:migrate`
   - For new revision: `make backend-revision` or `npm run backend:revision`

## Guardrails

`backend` Alembic commands route through `scripts/backend-alembic.sh`, which:

- requires explicit opt-in via `ALEMBIC_BACKEND_ONLY=1`
- requires `BACKEND_DATABASE_URL`
- blocks `?schema=public` URLs unless explicitly overridden with `ALLOW_ALEMBIC_PUBLIC_SCHEMA=1`

This keeps Alembic available while making accidental writes to shared app schema unlikely.