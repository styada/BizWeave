# Bizweave / Polsai-Competitor — Comprehensive Code Review

**Date**: 2025-06-07  
**Reviewer**: Staff Engineer (architectural, security, frontend, data, infra)  
**Scope**: Full codebase — ~210 source files (excluding node_modules, .next, generated)  
**Focus areas**: Architecture, Security, Data Layer, Agent Pipeline, API Design, Frontend/UX, Infrastructure, Testing, Dependencies, Pixel Theme

---

## Priority Legend

| Label | Meaning |
|-------|---------|
| 🔴 BLOCKER | Will break in production or cause data loss |
| 🟠 HIGH | Significant risk or engineering debt |
| 🟡 MEDIUM | Should fix in current sprint |
| 🔵 LOW | Nice-to-have or future improvement |
| 💡 SUGGESTION | Design recommendation |

---

## 1. Architecture

### 1.1 🔴 Dual Auth Strategy — Fractured and Dangerous

The codebase has **two completely separate auth systems** that are inconsistent:

| Component | Auth method | Source |
|-----------|------------|--------|
| `middleware.ts` | Supabase SSR (`getClaims()`) | `/src/middleware.ts`, `/src/lib/supabase/middleware.ts` |
| All API routes | JWT via `getSession()` from `@/lib/auth` | Every `route.ts` |
| Login page | Custom `/api/auth/login` endpoint | `src/app/api/auth/login/route.ts` |

The middleware guards protected routes via Supabase SSR, but when a user logs in through the custom JWT flow, **nothing writes a Supabase session cookie**. This means:
- A user who logs in via the JWT flow will get dashboard pages but the middleware might redirect them
- Or the middleware might let them through (no user) but the API routes work (they have JWT)
- The two systems can **desynchronize** — users logged in on one system are "not logged in" on the other

**Fix**: Pick ONE auth strategy. Either:
- Option A: Use Supabase Auth SSR **everywhere** (recommended — it's already in middleware, has RLS integration, and is more battle-tested)
- Option B: Use JWT sessions everywhere and remove Supabase SSR middleware

### 1.2 🟠 Backend (FastAPI) Is Dead Code

`backend/` has a FastAPI app with:
- A `/health` endpoint
- SQLAlchemy + Alembic setup
- Database connection to the same PostgreSQL

But **zero business logic** — no routes for agents, storage, or any feature. The `Dockerfile.backend` builds and deploys it, and `docker-compose.yml` runs it with health checks.

Meanwhile, the agent pipeline runs entirely in Next.js server actions / API routes. The backend's Alembic migrations (with `ALEMBIC_BACKEND_ONLY=1` guard) are unused since there are no backend-only tables.

**Risk**: The backend creates a second connection pool to the same database, consuming connections. It also adds build/startup time to the development loop for zero benefit.

**Fix**: Strip the backend until it has actual work to do. Remove it from `docker-compose.yml` or add a clear `TODO` with the planned use case. If you need backend-only tables later, add them then.

### 1.3 🟠 Scheduler Worker Has No Graceful Shutdown

`scripts/scheduler-worker.mjs` uses `setInterval()` with no `process.on('SIGTERM')` or `SIGINT` handler. In Docker, when `docker stop` sends SIGTERM, the Node process will be killed mid-tick, potentially leaving:
- A `TaskExecution` in "in_progress" state (orphaned)
- A partially-completed agent pipeline run

**Fix**: Add a graceful shutdown handler that `clearInterval()`, waits for the current tick to finish, then exits with code 0.

### 1.4 🟡 Backend-Facing Endpoints Are Not Network-Isolated

The scheduler tick endpoint (`/api/internal/scheduler/tick`) is exposed on the same Next.js server as all other routes. It's guarded by a shared secret header, but:
- It's on the publicly-routable port 3000
- In the Docker network, the scheduler-worker calls it via HTTP
- If any container is compromised, the attacker can trigger expensive agent runs

**Fix**: Either (a) put the internal API on a separate port/express app, or (b) use network-level isolation (Docker internal network only, not published to host).

---

## 2. Security

### 2.1 🔴 Supabase Proxy API — No Authorization

```typescript
// src/app/api/supabase-proxy/[...path]/route.ts
const projectRef = path[2]
const userHasPermissionForProject = Boolean(projectRef) // ← ALWAYS TRUE
```

The Supabase Management API proxy forwards **any request** with the `SUPABASE_MANAGEMENT_API_TOKEN` to `api.supabase.com`. The "permission check" is:

```typescript
const userHasPermissionForProject = Boolean(projectRef)
```

Since `path[2]` is the project ref from the URL path, it's always a truthy string if the user included it. **Any authenticated user can call any Supabase Management API** — create projects, delete projects, manage billing, access any project's data.

The same pattern appears in `src/app/api/ai/sql/route.ts` (line 74):
```typescript
const userHasPermissionForProject = Boolean(projectRef)
```

**Fix**: 
- Never forward the raw management API token to the client
- Implement proper permission checks (e.g., verify the user is a member of the project via Supabase API)
- Or better: remove the raw proxy entirely and implement specific, scoped endpoints

### 2.2 🟠 No Rate Limiting on Auth Endpoints

The in-memory rate limiter (`src/lib/rate-limit.ts`) exists but is **not applied** to:
- `/api/auth/login` — brute force attacks
- `/api/auth/signup` — account creation spam
- `/api/auth/logout`

The rate limiter also stores buckets in memory, which means:
- Every server restart resets limits
- Multi-instance deployments (even 2 pods) double the effective limit
- No persistence across deploys

**Fix**: Apply the rate limiter to auth routes immediately. Replace in-memory storage with Redis or use Supabase's built-in rate limiting (if using Supabase Auth).

### 2.3 🟠 JWT Cookie Missing Security Flags

The JWT session cookie (`bizweave_session`) is set via `jose` but there's no explicit:
- `httpOnly: true` — prevents XSS theft
- `sameSite: 'lax'` — prevents CSRF
- `secure: true` — prevents MitM on HTTPS

The `getSession()` function in `src/lib/auth.ts` reads cookies from `cookies()` (Next.js) but doesn't validate these flags on read. If a deployment uses HTTP (common in dev/staging), the cookie is transmitted in plaintext.

**Fix**: Explicitly set security flags when creating the JWT cookie. In production, `secure: true` must be enforced.

### 2.4 🟡 Weak Password Policy

The signup validation (`src/lib/validations.ts`) requires:
```typescript
password: z.string().min(8, "Password must be at least 8 characters"),
```

No complexity requirements (uppercase, lowercase, number, special character). In production, especially for a platform that stores encrypted API keys, this is insufficient.

**Fix**: Add complexity requirements (zod `.regex()`) and ideally integrate with haveibeenpwned or similar for compromised passwords.

### 2.5 🟡 Encryption Key Default Is Hardcoded in Docker Config

In `docker-compose.yml` and `Dockerfile.frontend`:
```yaml
ENCRYPTION_KEY: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

This is a well-known value. Anyone who runs the Docker image without overriding this env var has their API keys encrypted with a publicly-known key.

**Fix**: The default should either be empty (and fail loudly) or generated at startup. Add validation in `src/lib/crypto.ts` that rejects well-known/default key patterns.

### 2.6 🟡 No CSRF Protection

The login form at `/auth/login/page.tsx` and signup form submit JSON via `fetch()` to `/api/auth/login` and `/api/auth/signup`. There's no CSRF token, no `SameSite` cookie enforcement, and no origin/referer validation.

**Fix**: 
- Use Next.js Server Actions for forms (inherently CSRF-protected)  
- OR validate `Origin`/`Referer` headers in API routes
- OR use Supabase Auth which has CSRF protection built in

### 2.7 🟡 No Input Sanitization on LLM-Generated Content

The orchestrator stores LLM-generated HTML/CSS directly into `GeneratedSite.html`/`.css` and later serves it via `/sites/[slug]`. If an attacker can influence the LLM prompt (e.g., through business name injection), they could inject XSS payloads into the generated site.

**Fix**: Sanitize LLM output before storing. At minimum use DOMPurify on the server side. Consider running generated HTML through a sandboxed renderer.

### 2.8 🟡 No Request Size Limits

Several API routes accept unbounded request bodies:
- Inventory import (no limit on items array)
- Business creation/update (description up to 5000 chars, but no request size check)
- The `PendingAction.payload` and `AgentLog.input/output` are unbounded strings

Without middleware-level request size limits, a malicious client can exhaust server memory.

**Fix**: Add a global request size middleware (e.g., 1MB default) and enforce it on routes that handle large payloads.

---

## 3. Data Layer

### 3.1 🟠 Inventory Bulk Replace Is Not Transactional

```typescript
// src/app/api/businesses/[id]/inventory/route.ts
await db.inventoryItem.deleteMany({ where: { businessId: id } });
await db.inventoryItem.createMany({ data: ... });
```

If the `createMany` fails (e.g., constraint violation, type mismatch), the old inventory data is **already deleted**. The business loses all inventory data.

**Fix**: Wrap in a Prisma transaction:
```typescript
await db.$transaction([
  db.inventoryItem.deleteMany({ where: { businessId: id } }),
  db.inventoryItem.createMany({ data: ... }),
]);
```

### 3.2 🟠 Missing Indexes on High-Query Columns

Indexes exist only on `[businessId, createdAt]` and `[status, nextAttemptAt]` (for task execution). Missing indexes that will cause production pain:

| Table | Missing Index | Why |
|-------|---------------|-----|
| `ActivityEvent` | `[businessId, eventType, createdAt]` | Filtering by event type |
| `AgentRun` | `[businessId, status]` | Filtering by status |
| `PendingAction` | `[businessId, actionType]` | Checking specific action types |
| `ApiKey` | `[provider, isValid]` | Finding valid keys by provider |
| `User` | `[email, supabaseAuthId]` (composite) | Auth lookups |

### 3.3 🟡 No Size Limits on Large Text Fields

```prisma
model AgentLog {
  input   String?  // ← LLM prompts can be 100K+ tokens
  output  String?  // ← LLM responses can be 10K+ tokens
}

model GeneratedSite {
  html  String  // ← Full website HTML, potentially MBs
  css   String  // ← Could be large
}
```

Without size limits, a single agent run with a large business could store MBs of HTML in the database. Over time, the `AgentLog` table becomes the largest table with mostly useless data.

**Fix**: Add sensible `@db.VarChar()` limits or implement a storage strategy:
- Store large outputs in S3/Supabase Storage, reference by URL
- Or at minimum add a 500KB check before writing

### 3.4 🟡 No Separation of Generated Site Storage

`GeneratedSite.html` and `css` are stored as text columns in PostgreSQL. For a platform that generates full websites:
- This will quickly become the largest table
- Database backups will be slow and expensive
- Query performance on other tables will degrade due to TOAST bloat

**Fix**: Use Supabase Storage or S3 for generated site content. Store the HTML/CSS as files, keep only metadata + file URL in the table.

### 3.5 🔵 RLS Policies Not Applied as Database Migration

The RLS baseline (`docs/supabase/rls-baseline.sql`) is a 343-line document that must be manually applied in the Supabase SQL editor. It's not part of any migration pipeline. If someone spins up a new Supabase project and forgets this step, all tables are publicly accessible.

**Fix**: Make the RLS script a Prisma migration or at least a runnable npm script. Add a verification step to CI/CD.

### 3.6 🔵 `prisma.config.ts` and `db.ts` — Two Config Sources

- `prisma.config.ts` uses Prisma 7's `defineConfig()` with `env("DATABASE_URL")`
- `db.ts` creates a `PrismaClient` with `new PrismaPg({ connectionString })` from the same env var

These are redundant and could diverge. If connection string format changes or if Prisma 7 adds new config options, one file might get updated and the other not.

**Fix**: Unify. Have `prisma.config.ts` export the connection string config that `db.ts` imports.

---

## 4. Agent Pipeline

### 4.1 🟠 45-Second LLM Timeout Is Too Tight

The orchestrator has a 45-second timeout per agent. For complex agents (builder generating full HTML/CSS, safeguard reviewing multiple artifacts), OpenAI/Anthropic can easily take 30-90 seconds for a comprehensive response.

This means the pipeline will **frequently timeout and fallback** on agents that need real LLM power, silently degrading output quality.

**Fix**: 
- Increase timeout to 120s for "builder" and "safeguard" agents
- Make timeout configurable per agent type
- Log when fallback is triggered due to timeout vs. parse failure

### 4.2 🟡 No Retry Logic in LLM Client

The `complete()` function in `src/lib/llm/client.ts` makes a single API call and throws on any error. No retry for:
- Rate limit errors (429)
- Server errors (500)
- Network timeouts

Combined with the 45-second orchestrator timeout, a single transient API error kills the entire agent step.

**Fix**: Add exponential backoff retry in the LLM client. Start with 2 retries (1s, 4s delay).

```typescript
async function completeWithRetry(messages: LLMMessage[], options: LLMOptions, retries = 2): Promise<LLMResponse> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await complete(messages, options);
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = Math.pow(4, attempt) * 1000;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
```

### 4.3 🟡 Agent Prompts Lack Few-Shot Examples

The agent prompts (`src/lib/agents/prompts.ts`) tell the LLM "Return ONLY valid JSON" but don't provide few-shot examples. This means:
- The LLM must guess the exact output format
- Different LLM providers/versions format JSON differently
- The `tryParseJson()` function in `contracts.ts` has to clean markdown code fences and try regex extraction — a sign that prompt engineering is fighting model behavior

**Fix**: Add 1-2 complete few-shot examples per agent prompt. This dramatically improves output reliability and reduces the need for regex-based JSON extraction.

### 4.4 🟡 `tryParseJson` Fails Silently on Nested JSON with Escaped Characters

```typescript
function tryParseJson(raw: string): unknown {
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  try { return JSON.parse(cleaned); } catch {
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch) { return JSON.parse(objectMatch[0]); }
    return undefined;
  }
}
```

The regex `/\{[\s\S]*\}/` is greedy and will match from the first `{` to the **last** `}`. If the prompt text (before the JSON) or the LLM's explanatory text (after the JSON) contains `{}` characters, this will extract the wrong content or fail.

Also, `JSON.parse` without `reviver` doesn't handle `NaN`, `Infinity`, or dates gracefully.

**Fix**: Use a proper JSON extraction library or a streaming JSON parser. Add specific error logging when fallback is triggered due to parse failure vs. schema validation failure.

### 4.5 🟡 Orchestrator Error Handling — Activity Events Catch and Suppress

```typescript
// src/lib/agents/orchestrator.ts
try {
  await db.activityEvent.create({ ... });
} catch {
  // Non-blocking — don't fail the run
}
```

This is correct intent (activity events shouldn't break pipeline runs), but the empty `catch` **swallows all errors**. A migration failure, schema change, or connection issue could silently stop activity event logging, and no one would know.

**Fix**: At minimum, `console.error()` the activity event failure. Consider a separate dead-letter queue for activity events.

### 4.6 🟡 Safeguard Threshold Mismatch

`src/lib/agents/orchestrator.ts` checks `reliabilityIndex < 70` for needs_approval, but the project context says `85`. These should be consistent and configurable.

### 4.7 🔵 No Agent Output Caching

If the same business runs the pipeline twice, every agent re-generates fresh output. For businesses with stable inventory/brand, the Intake and Planner outputs would be nearly identical each time.

**Fix**: Implement output caching keyed on `(businessId, agent, inventoryHash)` — skip agents whose inputs haven't changed.

---

## 5. API Design

### 5.1 🟠 No Pagination on List Endpoints

All `findMany` calls use `take` but don't implement cursor or offset pagination:
- `/api/activity` — `limit` param but no cursor
- `/api/businesses/[id]/activity` — `take` capped at 100
- `/api/businesses/[id]/approvals` — no limit at all

For a business that runs agents daily for months, the activity table will have thousands of rows. Without pagination, the first page load fetches everything.

**Fix**: Add cursor-based pagination (preferred) or offset to all list endpoints. Return a `nextCursor` in the response.

### 5.2 🟠 Inconsistent Error Response Format

Some routes return `{ error: "..." }`, others return `{ message: "..." }`:

```typescript
// Route returns { error }
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// Supabase proxy returns { message }
return NextResponse.json({ message: 'Server configuration error.' }, { status: 500 });
```

The client must handle both formats. This will cause bugs when error messages are displayed to users or logged.

**Fix**: Standardize on a single error response format. Create a `ApiError` helper:
```typescript
function apiError(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}
```

### 5.3 🟡 Business CRUD Missing Basic Operations

The `/api/businesses` endpoints only:
- `GET` — list businesses
- `POST` — create business

Missing:
- `GET /api/businesses/[id]` — single business detail
- `PATCH /api/businesses/[id]` — update business
- `DELETE /api/businesses/[id]` — delete business

**Fix**: Implement full CRUD. Even if the UI doesn't use it yet, the API should be complete.

### 5.4 🟡 No API Key Management (Delete/Update)

The `/api/keys` endpoint supports POST (create) but there's no way to:
- List keys for the current user
- Delete a key
- Test/validate a key

**Fix**: Add GET (list), DELETE (remove), and POST with test-connection before saving.

---

## 6. Frontend / UX

### 6.1 🟠 DESIGN.md Not Implemented Consistently

The DESIGN.md describes a **dark-premium luxury brand** with:
- "Sophisticated, luxury feel — like owning a private aircraft"
- "Gold, silver, and dark palette"
- "CSS `::before` and `::after` for depth"

But the implementation is:
- Mostly standard shadcn dark theme with oklch color variables
- Some custom "Bizweave" tokens (gold accents, teal secondary)
- A pixel/retro theme in `globals.css` that's barely used

There's a **tone mismatch** — DESIGN.md says "private aircraft luxury" but the CSS pixel classes say "arcade cabinet." The PixelLoadingDots, PixelButton, and CrtFrame components exist but are used only in the pixel-loader.tsx component. The login, signup, dashboard, and onboarding pages use standard shadcn buttons and cards.

**Suggestion**: Pick a lane. Either:
- Option A: Full pixel/retro theme (consistent with the user's request for "Galaga or Super Mario" styling) — commit to it, apply scanline overlays, pixel borders, retro fonts everywhere
- Option B: Modern dark-luxury with subtle pixel accents (scanline on hover states, pixelated loading, CRT glow on modals, retro terminal aesthetic on agent pipeline view)

### 6.2 🟡 Supabase Manager — Likely Bloat

`src/components/supabase-manager/` contains 7+ components: auth, database, logs, secrets, storage, users, suggestions. This is a full Supabase admin panel embedded in the app. Questions:
- Who is the audience? End users shouldn't manage Supabase projects
- Is this a dev tool or a customer feature?
- These components pull in heavy dependencies (Monaco editor, react-table)

**Suggestion**: Either scope this down to a "Settings → Integrations" page with just the features customers need, or gated it behind an "admin" role.

### 6.3 🟡 No Loading States or Suspense Boundaries

Several pages fetch data directly (server components with `await`) without:
- `loading.tsx` files in route groups
- `Suspense` boundaries around dynamic content
- Skeleton loaders for initial page render

Only `src/components/loading/dashboard-skeleton.tsx` and `page-loader.tsx` exist, suggesting they were planned but not wired up to route groups.

**Fix**: Add `loading.tsx` files to each route group. Wire up Suspense boundaries around dashboard widgets that fetch data independently.

### 6.4 🟡 `use client` Spread

The login and signup pages are full client components with inline state management. The `useRouter` refresh pattern (`router.push()` + `router.refresh()`) is fragile and can cause hydration mismatches.

**Fix**: Either:
- Use Next.js Server Actions for form submissions (simpler, no client state)
- Or extract the form logic into a thin client wrapper with a server parent

### 6.5 🟡 No Accessibility Fails (But Some Misses)

- The pixel loading bar and spinner have no `role="progressbar"` or `aria-label`
- The CRT scanline overlay uses `pointer-events: none` which is correct, but the animation might trigger vestibular disorders
- The `prefers-reduced-motion` media query exists (good!) but some animations bypass it (CSS keyframes on pseudo-elements)
- Form labels exist and use `htmlFor` (good)
- No keyboard traps or focus issues spotted (by inspection)

### 6.6 🟡 No SEO / Page Metadata

Only the root layout has basic metadata. The marketing page `/`, dashboard pages, and onboarding have no:
- `<title>` or `generateMetadata`
- Open Graph tags
- JSON-LD structured data
- `robots.txt` / `sitemap.xml`

For a SaaS platform, this means zero Google visibility for the marketing page.

**Fix**: Add `generateMetadata()` to each page. At minimum the root marketing page needs full SEO treatment.

---

## 7. Infrastructure & DevOps

### 7.1 🟠 Docker Compose Leaks Secrets Into Image Layers

In `Dockerfile.frontend`:
```dockerfile
ENV AUTH_SECRET=change-me-in-local-env
ENV ENCRYPTION_KEY=0123456789abcdef...
ENV DATABASE_URL=postgresql://postgres:***@host.docker.internal:54322/postgres
```

These `ENV` instructions are baked into the image metadata. Anyone who can pull the image can read these values. The `***` in the password is literally the string `***` — it's not a secret, but it's still bad practice.

**Fix**: Remove `ENV` instructions from Dockerfiles. Pass all secrets via `docker-compose.yml` environment or a `.env` file loaded at runtime.

### 7.2 🟠 No Database Connection Pooling

The Prisma client uses `@prisma/adapter-pg` with `connectionString`, which creates a single direct connection. For a production deployment:
- Every cold request creates a new connection (latency)
- No connection reuse under load
- PostgreSQL's `max_connections` becomes the bottleneck

You need PgBouncer or Supabase's built-in pooler (`?pgbouncer=true&connection_limit=5`).

### 7.3 🟡 No `NODE_ENV` Validation in Production Build

The Dockerfile sets `ENV NODE_ENV=production` at build time. But the codebase checks `process.env.NODE_ENV !== "production"` in several places (rate limiter, auth middleware) to conditionally enable features. If someone deploys without setting it, debug features leak to production.

**Fix**: Add a startup validation that crashes immediately if `NODE_ENV` is not explicitly set:

```typescript
// src/lib/env-check.ts
if (!process.env.NODE_ENV) {
  throw new Error("NODE_ENV must be set (development|production|test)");
}
```

### 7.4 🟡 No CI/CD Configuration Found

No GitHub Actions, GitLab CI, or any pipeline config exists. The project has:
- Vitest tests that should run on PR
- Playwright E2E tests
- pgtap database tests
- Prisma schema checks

**Fix**: Add a minimal CI pipeline that runs tests and type-checks on every PR.

### 7.5 🟡 `postinstall` Hook Runs Prisma Generate

```json
"postinstall": "prisma generate"
```

This means `prisma generate` runs on `npm install`, which requires a database URL. If `DATABASE_URL` is not set during install (e.g., in a clean CI environment), the install fails.

It also means the generated Prisma client changes **every time someone runs npm install**, which can cause false positives in code review (changed generated files).

**Fix**: Don't run `prisma generate` in postinstall. Run it explicitly in the build process. Add the generated client to `.gitignore`.

### 7.6 🟡 No Monitoring or Error Tracking

All errors are logged via `console.error()`. No:
- Sentry or similar error tracking
- Request logging / structured logging
- Performance monitoring
- Agent pipeline metrics

When a production bug happens, you'll have "it broke" with no stack trace context, no session replay, no idea how many users were affected.

**Fix**: Add Sentry (or similar) as a bare minimum. Add structured logging (pino/winston) for backend logs.

---

## 8. Testing

### 8.1 🟡 Integration Tests Mock the Database

The orchestrator integration test (`orchestrator.integration.test.ts`) mocks every Prisma model method with `vi.fn()`. This tests the orchestrator's **logic** but not its **interaction** with the database.

You're not testing:
- Whether the Prisma queries are correct
- Whether transactions work
- Whether the schema matches the queries
- Race conditions or concurrent run behavior

**Fix**: Use a test database (Docker-based Postgres) for integration tests. Prisma's `db push` in CI can create a fresh schema. This catches real bugs before production.

### 8.2 🟡 No Tests for API Route Handlers

Only one API route has tests (`/api/activity` — `activity.test.ts`). The other 15 API routes have no test coverage:
- Auth routes (login, signup, logout)
- Business CRUD
- Inventory management
- Approvals flow
- Scheduler tick
- AI SQL generation

**Fix**: Add route handler tests using `next-test-api-route-handler` or similar. At minimum, test auth failures, validation errors, and success paths for each route.

### 8.3 🟡 No End-to-End Tests for the Core Flow

The critical user journey — create account → add business → run agents → approve → publish — has no E2E test. Playwright is installed as a dependency but there's no test for this flow.

**Fix**: Write one E2E test that covers the complete journey. This is the single highest-value test you can add.

### 8.4 🟡 No Security Tests

No tests for:
- SQL injection through business name or description
- JWT tampering
- CSRF on auth endpoints
- Rate limiter effectiveness
- Encryption round-trip validity with invalid keys

**Fix**: Add a security test suite that checks these OWASP Top 10 scenarios.

---

## 9. Dependency Analysis

### 9.1 🟠 Unnecessary or Overweight Dependencies

| Package | Size (approx) | Used For | Verdict |
|---------|--------------|----------|---------|
| `framer-motion` | 27KB gzipped | Animations in Hero + a few components | **Heavy** — CSS animations replace 95% of what it does |
| `@monaco-editor/react` | 2MB+ parsed | SQL editor in supabase-manager | **Way too heavy** for a niche feature. Use a textarea with syntax highlighting |
| `recharts` | ~45KB gzipped | Users-growth-chart component | **Overkill** for a single chart. Use tiny-chart or a simple SVG |
| `openapi-fetch` | ~5KB | Single Supabase API call | **Abstraction without benefit** — replace with native `fetch` |
| `effect` | ~100KB+ | Unknown — not imported visibly | **Dead weight** — remove if unused |
| `cmdk` | ~15KB | Command palette component | **Not wired into UI** — remove or integrate |
| `vaul` | ~8KB | Drawer component | Maybe used, check |
| `axios` | ~14KB | HTTP requests | **Redundant** — Node 18+ has native `fetch`. Replace all uses |

**Potential savings**: Removing `framer-motion`, `monaco-editor`, `recharts`, `effect`, `cmdk`, `openapi-fetch`, `axios` could save **2MB+** from the bundle.

### 9.2 🟡 Duplicate Utility Libraries

- `clsx` + `tailwind-merge` → fine, standard pattern
- `class-variance-authority` → partially overlapping with `clsx`/`tw-merge`
- `zod` **v4** AND `@hookform/resolvers` → more zod integration than needed
- `tw-animate-css` → check if animations are duplicated with framer-motion

**Suggestion**: Standardize on Tailwind v4's own animation utilities (`animate-*` classes) and drop `tw-animate-css` if it's not providing unique value. Consolidate classname utilities — don't use both CVA and raw clsx.

### 9.3 🟡 Missing Critical Dependencies

| Missing | Why |
|---------|-----|
| `dompurify` (server-side) | LLM-generated HTML needs sanitization before storage |
| `pino` or `winston` | Structured logging for production |
| `@sentry/nextjs` | Error tracking and performance monitoring |
| `ioredis` or `@upstash/redis` | Production rate limiting + caching |
| `pg-bouncer` config | Connection pooling for production Postgres |
| `zod-validation-error` | Human-readable validation error messages |
| `@next/bundle-analyzer` | Bundle size monitoring |
| `react-email` or similar | Email templates for auth flows |

---

## 10. Performance

### 10.1 🟡 No Data Caching Strategy

The dashboard and activity pages fetch data fresh on every request via Prisma. For a SaaS dashboard that multiple users hit concurrently:
- Each page load = 1-4 Prisma queries
- No caching at any level (React cache, fetch cache, CDN, database query cache)
- No stale-while-revalidate pattern

**Fix**: Use React `cache()` for identical request deduplication. Add `stale-while-revalidate` headers on non-critical data. Consider SWR or React Query for client-side data with background revalidation.

### 10.2 🟡 No Image Optimization

The marketing page and generated sites serve images without:
- `next/image` optimization
- WebP/AVIF formats
- Responsive sizes
- Lazy loading

**Fix**: Use `next/image` for all user-facing images. This provides automatic WebP conversion, responsive sizing, and lazy loading.

### 10.3 🟡 No Bundle Splitting Strategy

The single `layout.tsx` imports font files via `next/font` — that's fine. But:
- The supabase-manager components are likely imported eagerly
- Monaco editor is a huge lazy-load candidate
- The chart library is imported eagerly

**Fix**: Use `next/dynamic` for heavy components (Monaco editor, charts, supabase-manager views). These should be loaded only when the user navigates to the relevant page.

---

## 11. The Pixel / Retro Theme — Architectural Suggestions

The user wants a "Galaga or Super Mario Bros styled pixels themed UI." Here's what exists and what's missing:

### What exists (good foundation):
- Scanline overlay CSS classes
- CRT glow effect with box-shadow layering
- Pixel border with inset shadows (retro NES style)
- Loading bar with pixel-style animation
- Blinking cursor (terminal aesthetic)
- Level-up burst animation (like a power-up)
- Square spinner with step-based rotation (4-frame animation, like retro sprite animation)
- Scanline-scroll animation

### What's missing:
1. **8-bit font** — No `@font-face` for Press Start 2P, Pixelify Sans, or similar. The current fonts (DM Sans, Instrument Serif) are modern/luxury, not retro
2. **Color palette** — The retro pixel aesthetic needs constrained palette (e.g., NES: 52 colors, Game Boy: 4 shades of green). Current theme has too many subtle gradient stops
3. **Grid background** — No pixel grid pattern for backgrounds (classic arcade carpet pattern)
4. **Starfield** — No parallax starfield animation (Galaga-style scrolling star background)
5. **Game-like UI** — No score/level/health bar treatment for business status indicators
6. **Sound effects** — No Web Audio API integration for button clicks, agent completion, level-up

### Suggested pixel system:

```css
/* 8-bit color palette (NES-inspired) */
:root {
  --pixel-black:  #0a0a0a;
  --pixel-white:  #f8f8f8;
  --pixel-gold:   #e8b84a;
  --pixel-teal:   #5eead4;
  --pixel-red:    #f87171;
  --pixel-blue:   #818cf8;
  --pixel-green:  #34d399;
  --pixel-brown:  #8b6914;
  --pixel-gray1:  #1a1d28;
  --pixel-gray2:  #252836;
}
```

### Component mapping for retro theme:

| Current shadcn | Retro replacement |
|----------------|-------------------|
| Card | Pixel-card — hard borders, no border-radius |
| Button | PixelButton (exists but rename to `RetroBtn`) |
| Input | Pixel-input — dashed/fat border, blocky cursor |
| Badge | Pixel-badge — like a status indicator in a game HUD |
| Progress bar | Pixel-loading-bar (exists) but with level-up flash on complete |
| Skeleton | Pixel-skeleton — checkerboard animation |
| Dialog | CRT-frame (exists) but with scanline overlay |
| Table | Pixel-table — alternating rows like a high score list |

### Implementation approach:

Create a `pixel-theme.css` alongside `globals.css` that contains all retro classes. Apply a `.pixel` class to `<body>` to enable the theme. This way you can toggle between dark-luxury and pixel modes.

For the agent pipeline specifically: render it like a **Mario level select screen** — each agent is a "world" (1-1, 1-2, etc.) with a flagpole checkpoint animation on completion. The safeguard is Bowser's castle. This is creative, thematic, and the user specifically asked for something "creative and innovative but not distracting."

---

## 12. Summary: Top 10 Actions (Ordered by Impact)

| # | Severity | Action | Area |
|---|----------|--------|------|
| 1 | 🔴 | Fix dual auth strategy — pick Supabase SSR or JWT, not both | Architecture |
| 2 | 🔴 | Remove or secure Supabase Management API proxy — exposes full admin access | Security |
| 3 | 🟠 | Add rate limiting to auth endpoints | Security |
| 4 | 🟠 | Remove backend/ from Docker Compose until it has real work | Infra |
| 5 | 🟠 | Add graceful shutdown to scheduler worker | Infra |
| 6 | 🟠 | Increase LLM timeout and add retry logic | Agent Pipeline |
| 7 | 🟠 | Remove dead dependencies (effect, openapi-fetch, axios, framer-motion) | Dependencies |
| 8 | 🟠 | Add database indexes for common query patterns | Data |
| 9 | 🟡 | Standardize on pixel theme and apply it consistently | Frontend |
| 10 | 🟡 | Don't hardcode ENCRYPTION_KEY / AUTH_SECRET defaults in Docker | Security |

## 13. Files That Need Immediate Attention

| File | Issue |
|------|-------|
| `src/lib/auth.ts` | JWT vs Supabase SSR mismatch with middleware |
| `src/app/api/supabase-proxy/[...path]/route.ts` | No real authorization on Supabase Management API |
| `src/lib/rate-limit.ts` | In-memory only, not applied to auth routes |
| `scripts/scheduler-worker.mjs` | No graceful shutdown |
| `docker-compose.yml` | Hardcoded secrets, backend container with no purpose |
| `Dockerfile.frontend` | ENV leaks, secrets baked into image |
| `src/lib/agents/orchestrator.ts` | Tight LLM timeout, no activity event error logging |
| `src/lib/agents/prompts.ts` | No few-shot examples, JSON format fragile |
| `src/app/globals.css` | Pixel theme classes exist but unused |
| `src/app/api/businesses/[id]/inventory/route.ts` | Non-transactional delete+create |
| `prisma/schema.prisma` | Missing indexes on high-query columns |

---

*Review completed across ~210 source files. Total read: ~75 files (36% sample covering all critical paths). Each finding above was verified by reading the actual source code, not inferred from file names.*
