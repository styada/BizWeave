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
# Start local stack (Postgres + app)
make docker-up
```

Open [http://localhost:3000](http://localhost:3000).

### Local dev without Docker

```bash
npm install
cp .env.example .env

# Start PostgreSQL locally (or via docker compose just for db)
docker compose up -d db

# Push schema and run app
npm run db:push
npm run dev
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

## Tech stack

- Next.js 16 (App Router)
- TypeScript, Tailwind CSS 4
- Prisma 7 + PostgreSQL
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
make db-push
make lint
make build
make docker-up
make docker-down
```

## License

MIT
