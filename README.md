# Bizweave

**Your business, woven online while you sleep.**

Bizweave is a production-grade AI platform for **existing businesses** — liquor stores, retail shops, restaurants, and SaaS products. Connect your inventory, location, and brand. AI agents build your website, create marketing plans, set up support templates, and pass everything through a **Safeguard** last-bastion review before anything goes live.

The pipeline now includes a **Trust Index** in the Safeguard verdict so every run is explainable and reliability-scored before publish.

Bring Your Own Keys (BYOK) for OpenAI and Anthropic — your API keys are encrypted at rest with AES-256-GCM.

## Features

- **6-agent pipeline**: Intake → Planner → Builder → Marketing → Support → Safeguard
- **BYOK**: OpenAI & Anthropic with connection testing
- **Business onboarding**: Multi-step wizard with CSV inventory import
- **Generated sites**: Mobile-first HTML/CSS preview
- **Demo mode**: Works without API keys using intelligent templates
- **Design system**: See [DESIGN.md](./DESIGN.md)

## Quick start (30 seconds, no Docker)

The fastest path. Works with Homebrew Postgres only.

**Prerequisites (one-time per machine):**

```bash
brew install postgresql@17 pgvector
brew services start postgresql@17
createuser -s postgres 2>/dev/null || true
psql postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"
```

**Boot the app:**

```bash
make local-setup   # creates bizweave DB + pushes Prisma schema + writes .env
make dev           # starts Next.js in <1s
```

Open [http://localhost:3000](http://localhost:3000). Sign up, create a business, chat with the operator.

`make local-setup` is idempotent and:

- Verifies Postgres is reachable on `localhost:5432`
- Creates the `bizweave` database if missing
- Writes `.env` from `.env.development` if missing
- Pushes the Prisma schema (creates all 49 tables, including `pgvector` extension)

No Docker, no Supabase CLI, no network calls. Demo mode is the default — add OpenAI/Anthropic keys in `/dashboard/settings/keys` when you want real LLM calls.

### When you need Supabase features (auth flows, storage, admin)

Some features (OAuth, file storage, the admin tooling) require a running Supabase stack. This is a **separate, optional step** that takes 1-3 minutes:

```bash
make supabase-ensure    # starts Supabase via Docker
make local-dev-full     # local-setup + supabase-ensure + npm run dev
```

For the full Docker stack (frontend + backend + Postgres + Supabase):

```bash
make docker-up
```

If Docker image pulls are flaky, use a mirror:

```bash
FRONTEND_NODE_IMAGE=public.ecr.aws/docker/library/node:22-bookworm-slim \
POSTGRES_IMAGE=public.ecr.aws/docker/library/postgres:16-alpine \
docker compose up --build
```

### Optional backend setup (Python service)

```bash
make backend-sync
export BACKEND_DATABASE_URL="postgresql+psycopg://user:pass@host:5432/backend_db"
make backend-migrate
```

Backend Alembic commands are intentionally guarded and require backend-only opt-in + URL.
See [docs/orm-ownership-boundaries.md](./docs/orm-ownership-boundaries.md).

1. **Sign up** at `/signup` (email/password or Google/Apple/GitHub)
2. **Onboard** a business at `/onboarding`
3. **Add API keys** (optional) at `/dashboard/settings/keys`
4. **Run agents** from the business dashboard

## OAuth setup (Google, Apple, GitHub)

The login + signup pages expose "Continue with Google/Apple/GitHub" buttons. To enable them in production:

1. Create a Supabase project (or use the existing one)
2. In the Supabase dashboard: **Authentication → Providers**, enable Google, Apple, and GitHub. Follow the per-provider setup (OAuth client ID/secret, Service ID for Apple, GitHub OAuth app).
3. Add the callback URL to the Supabase project's allow-list:
   - `https://your-domain.com/api/auth/oauth/callback` (production)
   - `http://localhost:3000/api/auth/oauth/callback` (local dev)
4. Ensure these env vars are set in `.env.local` and in your deploy environment:
   - `NEXT_PUBLIC_SUPABASE_URL` (e.g. `https://xxx.supabase.co`)
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the `sb_publishable_...` anon key)
5. For local dev, the `.env.development` file already has placeholder values; replace with real ones to test the flow.

The OAuth flow:
- User clicks "Continue with Google" on `/login`
- Browser redirects to `/api/auth/oauth/start?provider=google`
- Server calls Supabase `signInWithOAuth`, gets the provider's consent URL
- User consents, provider redirects to `/api/auth/oauth/callback?code=...`
- Server exchanges the code for a Supabase session, reads the user, provisions a Bizweave `User` row (or links an existing one by email), mints a Bizweave JWT cookie, and redirects to the original destination.

The middleware (`src/middleware.ts`) is unchanged — it just reads the JWT cookie. So OAuth users land on the dashboard with the same session as email/password users.

Optional backend setup (for the Python service):

```bash
make backend-sync
export BACKEND_DATABASE_URL="postgresql+psycopg://user:pass@host:5432/backend_db"
make backend-migrate
```

Backend Alembic commands are intentionally guarded and require backend-only opt-in + URL.
See [docs/orm-ownership-boundaries.md](./docs/orm-ownership-boundaries.md).

1. **Sign up** at `/signup`
2. **Onboard** a business at `/onboarding`
3. **Add API keys** (optional) at `/dashboard/settings/keys`
4. **Run agents** from the business dashboard

## Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL URL, e.g. `postgresql://postgres:postgres@localhost:5432/bizweave?schema=public` |
| `AUTH_SECRET` | JWT session signing secret |
| `ENCRYPTION_KEY` | 64-char hex or passphrase for AES-256-GCM |
| `NEXT_PUBLIC_APP_URL` | App URL for redirects |
| `NEXT_PUBLIC_BACKEND_URL` | Backend API base URL used by the frontend container |
| `SCHEDULER_SECRET` | Secret for protected scheduler tick endpoints |

## Tech stack

- Next.js 16 (App Router)
- TypeScript, Tailwind CSS 4
- Prisma 7 + PostgreSQL
- Python 3.12 backend service with `uv` + Alembic storage migrations
- Jose (JWT sessions), bcryptjs
- Framer Motion, Lucide icons

## Agent architecture

All agents share safety rules in prompts and strict JSON contracts. The **Safeguard Agent** reviews every artifact before status moves to `live`, emits a **Trust Index** (0-100), and blocks publish when reliability is too low. Without a valid BYOK key, the pipeline uses production-quality template fallbacks so the product works end-to-end in demo mode.

## Tests

```bash
make test-unit
make test-integration
make test-e2e
make test-supabase
make test-supabase-db
```

Supabase tests come in two flavours:

**1. Vitest integration tests** (`test:supabase`) — Test Supabase client imports,
environment configuration, and module shape. Run against the configured Supabase
project using `@supabase/supabase-js`.

```bash
npm run test:supabase        # or: make test-supabase
```

**2. Database contract tests** (`test:supabase:db`) — pgTAP SQL files under
`supabase/tests/database` that verify RLS policies, schema columns, indexes,
and policy contracts are correct against the actual database.

```bash
# Ensure the pgTAP extension is installed in your database first:
#   Docker Compose: docker compose up -d db-test
#   Homebrew:       brew install pgtap && psql $DATABASE_URL -c "CREATE EXTENSION pgtap"
npm run test:supabase:db    # or: make test-supabase-db
```

The SQL files follow [Supabase's pgTAP testing
guide](https://supabase.com/docs/guides/database/testing) and are run via
`scripts/run-pgtap-tests.sh` which connects using `DATABASE_URL` from `.env`.

## Ops commands

```bash
make install
make local-setup
make local-dev
make db-local-stop
make db-push
make lint
make build
make docker-up
make docker-down
```

For backend storage migrations:

```bash
export BACKEND_DATABASE_URL="postgresql+psycopg://user:pass@host:5432/backend_db"
make backend-migrate
make backend-revision
```

## Package manager recommendation

For the Node/TypeScript frontend, `pnpm` is the best overall choice for speed, reliability, and workspace ergonomics. `npm` is the simplest and most compatible, but slower. `bun` is fast, but the ecosystem maturity is still weaker for a Prisma + Next.js production stack. I kept the existing npm lockfile for now so the current app remains stable, but `pnpm` would be the best next-step migration if you want to modernize the frontend toolchain.

## License

MIT
