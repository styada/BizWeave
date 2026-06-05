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

## Quick start

```bash
# Start local stack (frontend + backend + Postgres)
make docker-up
```

Open [http://localhost:3000](http://localhost:3000).

If Docker image pulls are flaky in your network, use the no-Docker local path below.

If Docker Hub is timing out specifically for `node:22-bookworm-slim`, you can use a mirror image for the frontend build:

```bash
FRONTEND_NODE_IMAGE=public.ecr.aws/docker/library/node:22-bookworm-slim \
POSTGRES_IMAGE=public.ecr.aws/docker/library/postgres:16-alpine \
docker compose up --build
```

### Local dev without Docker

```bash
npm install
cp .env.example .env

# One-command local setup (Homebrew PostgreSQL + role/db bootstrap + Prisma push)
make local-setup

# Run the Next.js app
make dev
```

`make local-setup` does all of the following:

- Starts `postgresql@16` via Homebrew services
- Ensures role `postgres` exists with password `postgres`
- Ensures database `bizweave` exists and is owned by `postgres`
- Pushes Prisma schema to `DATABASE_URL`

Optional backend setup (for the Python service):

```bash
make backend-sync
make backend-migrate
```

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
```

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

## Package manager recommendation

For the Node/TypeScript frontend, `pnpm` is the best overall choice for speed, reliability, and workspace ergonomics. `npm` is the simplest and most compatible, but slower. `bun` is fast, but the ecosystem maturity is still weaker for a Prisma + Next.js production stack. I kept the existing npm lockfile for now so the current app remains stable, but `pnpm` would be the best next-step migration if you want to modernize the frontend toolchain.

## License

MIT
