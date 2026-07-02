<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:bizweave-context -->
# Bizweave — Agent Rules & Codebase Guide

## Project Identity
- **Name**: Bizweave
- **Tagline**: "Your business, woven online while you sleep"
- **Purpose**: AI platform for **existing businesses** (retail, SaaS, services) — not startups.
  Agents ingest inventory/location/brand, build a website, create marketing plans, support templates,
  and pass everything through a **Safeguard** last-bastion review before going live.
- **Positioning vs Polsia**: Polsia = AI employee for founders building new companies; Bizweave = AI team for existing businesses.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | **Next.js 16** (App Router), React 19 |
| Language | TypeScript (strict), Python 3.12 |
| Styling | Tailwind CSS 4, `tw-animate-css`, custom dark-premium design tokens |
| Database ORM | **Prisma 7** with `@prisma/adapter-pg` — source of truth for `public` schema |
| Auth | Supabase Auth (SSR) + JWT sessions via `jose` + bcryptjs password hashing |
| LLM | OpenAI (`gpt-4o-mini`) & Anthropic (`claude-3-5-haiku`) — **BYOK** model |
| Encryption | AES-256-GCM for API keys at rest |
| State/Data | `@tanstack/react-query`, `@tanstack/react-table`, Zod validation |
| Backend | **FastAPI** (Python) with SQLAlchemy + Alembic for backend-only storage migrations |
| Containerization | Docker Compose (frontend + backend + postgres + test db) |
| Testing | Vitest (unit/integration), Playwright (E2E), pgtap (database) |
| Infrastructure | Supabase (auth, config), Prisma 7 adapter pattern |

## Project Structure

```
bizweave/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/             # Login/signup pages
│   │   ├── api/                # Route handlers
│   │   │   ├── ai/sql/         # AI-generated SQL endpoint
│   │   │   ├── auth/           # Auth routes (login, logout, signup)
│   │   │   ├── businesses/     # Business CRUD + agent triggers
│   │   │   ├── internal/       # Internal scheduler tick endpoint
│   │   │   ├── keys/           # BYOK API key management
│   │   │   └── supabase-proxy/ # Supabase management API proxy
│   │   ├── auth/               # Auth callback pages
│   │   ├── dashboard/          # Business dashboard + settings
│   │   ├── onboarding/         # Multi-step business setup wizard
│   │   └── protected/          # Generic protected route shell
│   ├── components/
│   │   ├── agents/             # Agent pipeline visualization
│   │   ├── dashboard/          # Dashboard widgets (sidebar, approvals, etc.)
│   │   ├── marketing/          # Marketing landing page sections
│   │   ├── site/               # Site preview components
│   │   ├── supabase-manager/   # Supabase management UI
│   │   └── ui/                 # shadcn/ui primitives (button, card, etc.)
│   ├── contexts/               # React contexts (SheetNavigationContext)
│   ├── hooks/                  # Custom hooks (use-auth, use-logs, use-secrets, etc.)
│   ├── lib/
│   │   ├── agents/             # ★ Core agent system
│   │   │   ├── types.ts        # AgentId, pipeline order, output types
│   │   │   ├── contracts.ts    # Zod schemas for agent outputs
│   │   │   ├── orchestrator.ts # Pipeline runner (runAgentPipeline)
│   │   │   ├── prompts.ts      # System prompts per agent
│   │   │   ├── fallback.ts     # Template fallbacks when no LLM keys
│   │   │   └── __tests__/      # Unit + integration tests
│   │   ├── llm/                # LLM client (OpenAI, Anthropic)
│   │   │   ├── client.ts       # complete(), testConnection()
│   │   │   ├── keys.ts         # getUserApiKey(), getPreferredProvider()
│   │   │   └── types.ts        # LLMProvider, LLMMessage, etc.
│   │   ├── supabase/           # Supabase SSR helpers
│   │   │   ├── client.ts       # Browser client
│   │   │   ├── server.ts       # Server client
│   │   │   └── middleware.ts   # Auth middleware (updateSession)
│   │   ├── schemas/            # DB schema introspection (auth, secrets)
│   │   ├── pg-meta/            # PostgreSQL metadata query helpers
│   │   ├── db.ts               # Prisma client singleton
│   │   ├── auth.ts             # Session management (JWT)
│   │   ├── crypto.ts           # AES-256-GCM encrypt/decrypt
│   │   ├── scheduler.ts        # Business automation scheduler
│   │   ├── rate-limit.ts       # In-memory rate limiter
│   │   ├── validations.ts      # Zod schemas for forms
│   │   └── utils.ts            # Utility helpers
│   ├── generated/              # Auto-generated code
│   │   ├── prisma/             # Prisma client output
│   │   └── supabase-types.ts   # Supabase DB types
│   └── middleware.ts           # Next.js middleware (auth guard)
├── backend/                    # Python FastAPI service
│   ├── app/
│   │   ├── main.py             # FastAPI app (health, storage/version)
│   │   ├── database.py         # SQLAlchemy engine + session
│   │   ├── settings.py         # Pydantic settings
│   │   └── agents/             # Backend agent logic (future)
│   ├── alembic/                # Backend-only storage migrations
│   ├── pyproject.toml          # Python project config
│   └── alembic.ini
├── prisma/
│   └── schema.prisma           # ★ Single source of truth for public schema
├── supabase/
│   ├── config.toml             # Supabase local config
│   ├── tests/database/         # pgtap SQL tests
│   └── snippets/               # SQL snippets
├── scripts/
│   ├── backend-alembic.sh      # Guarded Alembic runner
│   ├── run-pgtap-tests.sh      # DB test runner
│   └── scheduler-worker.mjs    # Standalone scheduler worker
├── docs/                       # Design docs, gap analysis, roadmap
├── DESIGN.md                   # Full design system spec
├── Makefile                    # Common command shortcuts
├── docker-compose.yml          # Local development stack
└── .env.example
```

## Database Schema (key models)

- **User** — id (cuid), supabaseAuthId (uuid, unique), email, passwordHash, name
- **ApiKey** — userId + provider (unique), encryptedKey, keyHint, isValid
- **Business** — id, userId, name, type, tagline, description, location, phone, email, status
- **InventoryItem** — businessId, name, sku, price, quantity, category
- **AgentRun** — businessId, status, currentStep, taskExecutionId (optional link to scheduler)
- **AgentLog** — runId, agent, status, input, output, durationMs, errorCode, usedFallback
- **GeneratedSite** — businessId (unique), html, css, meta, status (draft/live)
- **MarketingPlan** — businessId (unique), channels, content, schedule, status
- **ApprovalPolicy** — businessId + actionType (unique), requiresApproval, minRiskLevel
- **PendingAction** — businessId, runId, actionType, riskLevel, payload, status
- **ScheduledTask** — businessId + agent (unique), cadence, cronExpr, enabled, nextRunAt
- **TaskExecution** — scheduledTaskId, status, retryCount, maxAttempts (3), nextAttemptAt
- **ActivityEvent** — businessId, runId, agent, eventType, level, message, payload

## Agent Architecture

### Pipeline order (6 agents):
1. **Intake** → Persona, value props, tone, competitor hints, constraints
2. **Planner** → Site structure, content themes, marketing angles, timeline
3. **Builder** → Full HTML/CSS website (mobile-first, accessible, dark-premium)
4. **Marketing** → Channels, campaigns, SEO keywords
5. **Support** → FAQs, auto-replies, escalation rules
6. **Safeguard** → Last-bastion review: approved bool, issues, reliabilityIndex (0-100), scores (safety, consistency, channelReadiness)

### Key mechanics:
- Each agent has a **Zod contract** (`src/lib/agents/contracts.ts`) for output validation
- Each agent has a **fallback template** (`src/lib/agents/fallback.ts`) — used when no LLM keys configured or when LLM output fails validation
- Pipeline runs with `runAgentPipeline(businessId, userId)` in `orchestrator.ts`
- Agents use `getPreferredProvider()` to find the user's first valid BYOK key (OpenAI > Anthropic)
- **Timeout**: 45s per step, **max 2 retry attempts**
- **ActivityEvent** stream is non-blocking — failures don't stop the run
- **Safeguard verdict** determines if artifacts can move to "live" status

### BYOK (Bring Your Own Keys):
- Users provide OpenAI or Anthropic API keys
- Keys encrypted with AES-256-GCM (`ENCRYPTION_KEY` env var)
- Stored in `ApiKey` table, decrypted at runtime
- `testConnection()` validates keys before saving
- Without valid keys, the pipeline uses fallback templates (demo mode)

## Key Code Conventions

### Imports
- Path alias `@/` maps to `src/`
- Prisma client: `import { db } from "@/lib/db"`
- AI client: `import { complete } from "@/lib/llm/client"`
- Auth: `import { getSession } from "@/lib/auth"` (JWT) or Supabase SSR

### Prisma 7
- Client generated to `src/generated/prisma/`
- Uses `@prisma/adapter-pg` with explicit connection string
- Generate with `./node_modules/.bin/prisma generate` (not `npx prisma generate`)
- Schema env loading needs `dotenv/config` in `prisma.config.ts`

### Database ownership
- **Prisma** = source of truth for shared app tables in `public` schema
- **Alembic** = backend-only storage (guarded by `ALEMBIC_BACKEND_ONLY=1`)
- See `docs/orm-ownership-boundaries.md`

### Auth
- Dual auth: Supabase Auth SSR + JWT session cookie (`bizweave_session`)
- Middleware in `src/middleware.ts` delegates to `src/lib/supabase/middleware.ts`
- Protected routes redirect to `/auth/login`

### API design
- Route handlers under `src/app/api/`
- Supabase management API proxied through `src/app/api/supabase-proxy/`
- Scheduler tick endpoint: `POST /api/internal/scheduler/tick` (protected by `SCHEDULER_SECRET`)

### UI/Styling
- Dark-premium design system (see `DESIGN.md` for full spec)
- CSS variables in `globals.css` (--bg-base, --accent-primary, etc.)
- Tailwind v4 with `@theme inline` directives
- shadcn/ui primitives in `src/components/ui/`
- Fonts: DM Sans (body), Instrument Serif (display), JetBrains Mono (code)

### Testing
- Unit: `vitest run src/lib/agents/__tests__/contracts.test.ts`
- Integration: `vitest run src/lib/agents/__tests__/orchestrator.integration.test.ts`
- Scheduler: `vitest run src/lib/agents/__tests__/scheduler.test.ts`
- Supabase: `vitest run src/lib/supabase/__tests__/`
- DB (pgtap): `bash scripts/run-pgtap-tests.sh`
- E2E: `playwright test`

## Common Commands

```bash
# Development
npm run dev                  # Next.js dev server
make docker-up               # Full Docker Compose stack
make local-setup             # Homebrew PostgreSQL + Prisma push

# Database
npm run db:generate          # Prisma generate
npm run db:push              # Prisma db push
npm run db:studio            # Prisma Studio

# Backend
make backend-sync            # uv sync
make backend-migrate         # Alembic upgrade head

# Testing
npm test                     # Vitest run
npm run test:unit            # Agent contract tests
npm run test:integration     # Orchestrator integration tests
npm run test:e2e             # Playwright E2E
make supabase-test-db        # Supabase DB tests

# Scheduler
npm run scheduler:tick       # Manual scheduler tick
npm run worker:scheduler     # Run scheduler worker
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (Prisma format) |
| `AUTH_SECRET` | ✅ | JWT signing secret |
| `ENCRYPTION_KEY` | ✅ | 64-char hex or passphrase for AES-256-GCM |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase anon key |
| `NEXT_PUBLIC_APP_URL` | ✅ | App URL for redirects |
| `SCHEDULER_SECRET` | ✅ | Protects scheduler tick endpoint |
| `NEXT_PUBLIC_BACKEND_URL` | ⚠️ | Backend API base URL (container env) |
| `BACKEND_DATABASE_URL` | ⚠️ | Backend-only DB URL (Alembic migrations) |

## Critical Rules for Agents

1. **Next.js 16 has breaking changes** — always check `node_modules/next/dist/docs/` before writing Next.js code.
2. **Prisma 7 client**: Use `./node_modules/.bin/prisma generate`, not `npx prisma generate` (can hang).
3. **Prisma 7 adapter**: Must use `new PrismaPg({ connectionString })` — old `datasourceUrl` method doesn't work.
4. **Supabase SSR**: Always create a fresh client per request. Never store SSR clients in globals.
5. **Auth middleware**: `src/middleware.ts` imports from `@/lib/supabase/middleware` — do not self-import.
6. **BYOK**: LLM calls require user-provided keys. Without keys, fallbacks activate gracefully.
7. **Database split**: Never modify `public` schema via Alembic. Never modify backend-only tables via Prisma.
8. **Safeguard is mandatory**: No artifact goes live without passing the Safeguard agent review.
9. **Activity events are non-blocking**: ActivityEvent creation failures must not break agent runs.
10. **Dark theme only**: No light mode. Design tokens are hard-coded dark in `globals.css`.
11. **Scheduler retry**: Exponential backoff (30s base, 10min max). Dead letter after 3 failed attempts.
12. **Agent contracts**: Every agent output is validated with a Zod schema before use. If validation fails, fallback is used.
<!-- END:bizweave-context -->
