# Wing 3: Frontend Architecture, Backend, Security & Infrastructure Audit

**Date:** 2026-07-02  
**Auditor:** Hermes Agent (Butterfly Wing 3)  
**Scope:** Bizweave — Frontend (Next.js 16), Backend (FastAPI), Security, Infrastructure, Testing

---

## Executive Summary

Bizweave is a well-structured codebase with clear separation of concerns and modern patterns (Next.js 16 App Router, Prisma 7, React 19, Zod validation, Supabase SSR auth). However, this audit uncovered **3 critical issues**, **5 major issues**, and **6 minor issues** spanning security, infrastructure, testing, and architecture.

The most urgent problems are: (1) hardcoded encryption keys and auth secrets committed in docker-compose.yml and Dockerfiles, (2) a compromised or orphaned Supabase middleware that skips session refresh, and (3) webhook handlers with no authentication making them trivially exploitable. Testing coverage is thin for security-critical modules — zero tests exist for crypto, auth, rate-limiting, or middleware.

---

## Critical Issues

### C-1: Hardcoded Encryption Key & Auth Secret in Docker Stack (CRITICAL)

**Rating:** CRITICAL  
**Files:** `docker-compose.yml` (lines 49, 49, 125-126), `Dockerfile.frontend` (lines 9-10)

**Problem:** The AES-256-GCM encryption key is hardcoded as:
```
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```
And the AUTH_SECRET is:
```
AUTH_SECRET=change-me-in-local-env
```

These are set in `docker-compose.yml` across **four services** (frontend-db-init, frontend, backend, scheduler-worker) and also baked into the `Dockerfile.frontend` build-time environment. The Dockerfile embeds them permanently in image layers.

**Impact:** Every deployment using these defaults shares the same encryption key. Anyone with access to the docker-compose.yml or the built image can decrypt all stored API keys, encrypted credentials, and forge JWT tokens. Since `AUTH_SECRET` is used by `jose` for JWT signing (HS256), a default secret enables trivial session forgery.

**Fix:** Remove ENCRYPTION_KEY and AUTH_SECRET from Dockerfile; inject them at runtime via Docker Secrets or a `.env` file read at startup. The `docker-compose.yml` should reference `${ENCRYPTION_KEY}` and `${AUTH_SECRET}` mandatory variables instead of providing defaults. Add a startup check that refuses to boot with default values in production mode.

---

### C-2: Orphaned Supabase Middleware — Token Refresh Never Runs (CRITICAL)

**Rating:** CRITICAL  
**Files:** `src/middleware.ts`, `src/lib/supabase/middleware.ts`

**Problem:** The project has **two** middleware implementations:
1. `src/middleware.ts` — the Next.js auth guard. Checks for session cookies, handles wildcard subdomain routing.
2. `src/lib/supabase/middleware.ts` — contains `updateSession()` which calls `supabase.auth.getClaims()` to verify the Supabase session and refresh tokens.

The `updateSession()` function is **never imported or called** from anywhere. `src/middleware.ts` does its own minimal cookie check (looking for `bizweave_session` or any `sb-*-auth-token` cookie) but never invokes the Supabase session refresh logic.

**Impact:** Without `getClaims()` being called in middleware:
- Supabase auth cookie rotation (refresh token exchange) never happens
- Users whose Supabase session expires mid-browsing get no transparent token refresh
- The separate `updateSession` function is dead code
- The Bizweave JWT (bizweave_session cookie) also gets no automatic renewal — sessions expire after 7 days with no refresh mechanism

**Fix:** Wire `updateSession` into `src/middleware.ts` by calling it before the cookie check. Or migrate the Supabase session refresh logic into the main middleware function. Follow the Supabase SSR pattern where `updateSession` wraps the response and handles cookie refresh.

---

### C-3: Unauthenticated Webhook Handlers — No Signature Verification (CRITICAL)

**Rating:** CRITICAL  
**Files:** `src/app/api/webhooks/vapi/route.ts`, `src/app/api/webhooks/twilio/route.ts`, `src/app/api/webhooks/whatsapp/route.ts`

**Problem:** Multiple webhook endpoints accept unauthenticated POST requests:

| Webhook | Auth Mechanism | Status |
|---------|--------------|--------|
| Vapi | None | **No auth at all** |
| Twilio SMS | None | **No signature verification** |
| WhatsApp (Twilio) | None | **No signature verification** |
| Telegram | `x-telegram-bot-api-secret-token` | ✅ Secure |
| Stripe | Conditional on `STRIPE_WEBHOOK_SECRET` | ⚠️ Falls back to unauthenticated |

**Vapi webhook** (`route.ts` line 8-46): Accepts arbitrary JSON, creates CallLog rows with attacker-controlled fields (transcript, recordingUrl, fromNumber, durationSec). No authentication header checked. An attacker could poison call logs, inject XSS through stored content, or create unlimited database records (denial of wallet).

**Twilio webhook** (`route.ts`): Does not validate `X-Twilio-Signature` header. Twilio documents this as required for production. An attacker who knows a business phone number can spoof STOP/START commands and manipulate SMS consent records across all contacts.

**WhatsApp webhook** (`route.ts`): Same Twilio origin — no signature verification.

**Stripe webhook** (`route.ts` line 15): Signature check is conditional — if `STRIPE_WEBHOOK_SECRET` is not configured (local dev default), ANY request can falsify subscription events, changing tiers and statuses.

**Fix:** 
- Vapi: Verify HMAC signature using `VAPI_API_KEY` and the raw request body.
- Twilio/WhatsApp: Validate `X-Twilio-Signature` using `TWILIO_AUTH_TOKEN` (standard Twilio middleware pattern).
- Stripe: Either require `STRIPE_WEBHOOK_SECRET` in production or add a separate auth check. Never silently degrade to unauthenticated.

---

## Major Issues

### M-1: In-Memory Rate Limiter — Single-Process, No Persistence (MAJOR)

**Rating:** MAJOR  
**Files:** `src/lib/rate-limit.ts`

**Problem:** The rate limiter uses a plain JavaScript `Map<string, { count, resetTime }>` with:
- 10 requests/minute per IP default
- No persistence (lost on server restart/process crash)
- No shared state across instances (breaks in multi-container deployments)
- The rate limit function is **not imported or used by any API route** in the audited files — it exists but is dead code

**Impact:** Rate limiting is effectively not operational. This is a brute-force login vector. Standard production rate limiting requires a shared store (Redis/Memcached) with appropriate sliding-window or token-bucket algorithms, especially for auth endpoints.

**Fix:** 
1. Wire rate limiting into all auth routes (login, signup, OAuth, password reset)
2. Use Redis-backed rate limiting (e.g., `@upstash/ratelimit` or custom ioredis implementation)
3. Apply progressive penalties (5 req/min for auth, 100 req/min for API, etc.)
4. Write unit tests for the rate limiter

---

### M-2: Weak Password Policy — No Complexity Requirements (MAJOR)

**Rating:** MAJOR  
**Files:** `src/lib/validations.ts` (line 6), `supabase/config.toml` (line 182)

**Problem:** The Zod `signUpSchema` only requires `min(8)` for passwords:
```typescript
password: z.string().min(8, "Password must be at least 8 characters")
```
Supabase config has `minimum_password_length = 6`, which is even weaker. Neither requires mixed case, digits, or special characters.

**Impact:** Business owners using Bizweave's email/password auth are vulnerable to credential-stuffing and dictionary attacks. Since Bizweave controls API keys and financial operations, a compromised password can have severe downstream consequences.

**Fix:** Enforce at minimum: 8+ characters, at least one uppercase, one lowercase, one digit. Use a password strength estimator (zxcvbn). Update Supabase config to match or exceed the Zod minimum.

---

### M-3: Silent Error Swallowing Throughout Onboarding (MAJOR)

**Rating:** MAJOR  
**Files:** `src/app/api/onboarding/route.ts` (lines 96, 109, 125, 129, 134, 139), `src/app/api/businesses/route.ts` (line 100), `src/app/api/businesses/[id]/deploy/route.ts` (line 79)

**Problem:** Critical operations use `.catch(() => undefined)` which silently discards errors:
```typescript
await db.subscription.create({...}).catch(() => undefined);
import("@/lib/sites/launch-free").then(...).catch(() => undefined);
await db.creditWallet.create({...}).catch(() => undefined);
```

**Impact:** Failures in subscription creation, free-tier site launch, workspace setup, wallet seeding, competitor refresh, and audit logging all disappear without any logging or alerting. A failed subscription creation during onboarding means the user has no billing but gets no error. A failed audit log write means compliance gaps go undetected.

**Fix:** Replace `.catch(() => undefined)` with proper error handling that:
1. Logs the error with enough context to debug
2. Reports to an error monitoring service
3. Only degrades gracefully for truly non-critical paths
4. At minimum, `console.error()` with operation context

---

### M-4: FastAPI Backend Has No Auth, CORS, or Error Handlers (MAJOR)

**Rating:** MAJOR  
**Files:** `backend/app/main.py`, `backend/app/database.py`, `backend/app/settings.py`

**Problem:** The FastAPI backend:
- Has no authentication on any endpoint (`/health`, `/storage/version`)
- No CORS middleware configured
- No exception handlers
- No request validation
- `database.py` creates a standalone engine with no connection pooling limits
- No rate limiting
- Session management is manual (no context manager, bare `session.close()` in `finally`)

**Impact:** Any network-accessible deployment of the backend is an open information leak. The `/storage/version` endpoint runs raw SQL queries. The direct DB engine creation without pooling limits could exhaust Postgres connections.

**Fix:** 
1. Add FastAPI middleware: CORS, trusted hosts, rate limiting
2. Add API key or JWT validation middleware for all endpoints
3. Use dependency injection for DB sessions (FastAPI `Depends`) instead of manual create/close
4. Add proper exception handlers returning RFC 7807 problem details
5. Add connection pooling configuration

---

### M-5: No Tests for Security-Critical Modules (MAJOR)

**Rating:** MAJOR  
**Files:** All `__tests__/` directories

**Problem:** The following modules have **zero test coverage**:

| Module | Risk | Tests Exist? |
|--------|------|-------------|
| `src/lib/crypto.ts` | AES-256-GCM encryption for API keys | ❌ |
| `src/lib/auth.ts` | JWT session management, password hashing | ❌ |
| `src/lib/rate-limit.ts` | Brute force protection | ❌ |
| `src/middleware.ts` | Auth guard, subdomain routing | ❌ |
| `src/lib/supabase/middleware.ts` | Supabase SSR middleware | ❌ |
| All webhook handlers | External input processing | ❌ |
| All API route handlers | Business CRUD, onboarding, deploy | ❌ |
| `src/lib/validations.ts` | Zod schemas used by API routes | ❌ |

Tests that **do exist** are well-structured:
- `guard.test.ts` — good coverage of guardAction scenarios ✅
- `provision.test.ts` — real DB integration test ✅
- `providers.test.ts` — unit tests for OAuth provider list ✅
- `idempotency.test.ts` — good idempotency logic ✅

**Fix:** Add tests for all security-critical modules. Priority order: crypto → auth → middleware → rate-limit → API routes → webhooks.

---

## Minor Issues

### m-1: No CSRF Protection on State-Changing Endpoints
**Rating:** Minor  
**Files:** `src/app/api/businesses/route.ts`, onboarding, deploy, etc.

`src/middleware.ts` sets `sameSite: "lax"` on cookies but there's no CSRF token mechanism or Origin/Referer validation on API routes. For a platform handling financial operations (deployments, purchases, billing), same-site cookies alone are insufficient against cross-site attacks.

### m-2: Vapi Webhook Stores Unsanitized External Content
**Rating:** Minor  
**Files:** `src/app/api/webhooks/vapi/route.ts`

The `transcript` and `recordingUrl` fields from the POST body are stored directly into `callLog.transcript` and `callLog.recordingUrl` without sanitization. A stored XSS risk if these are rendered in a dashboard.

### m-3: Stripe Webhook Swallows Processing Errors
**Rating:** Minor  
**Files:** `src/app/api/webhooks/stripe/route.ts`

The outer try/catch returns `{ ok: false }` with HTTP 200 for all internal errors. Stripe expects 5xx responses for transient failures so it can retry. This means a temporary DB failure could cause a permanent subscription sync loss.

### m-4: Password Hash for OAuth Users Uses synchronous API Correctly, but `crypto.randomUUID()` in `auth.ts` Is Suspicious
**Rating:** Minor  
**Files:** `src/lib/auth.ts` (line 146)

In `getSession()`, when creating a new user from a Supabase session, the password hash is generated as `await hashPassword(crypto.randomUUID())`. This is correct (bcrypt hash of random value) but differs from the `randomBytes(32).toString("hex")` approach used in `provision.ts` and `oauth/callback/route.ts`. Inconsistency, not a vulnerability — but should be unified.

### m-5: Prisma Schema Missing Indexes on High-Query Columns
**Rating:** Minor  
**Files:** `prisma/schema.prisma`

Several models lack indexes on frequently filtered columns:
- `AgentLog.agent` — filtered by agent name
- `ActivityEvent.agent` and `ActivityEvent.eventType` — used in event queries
- `ApiKey.userId` — only covered by compound unique `[userId, provider]`
- `Business.userId` — only implicitly indexed via FK

### m-6: No TLS/HTTPS in Docker Stack
**Rating:** Minor  
**Files:** `docker-compose.yml`, `supabase/config.toml`

The entire Docker stack runs over HTTP. No reverse proxy with TLS termination. The Supabase config has `[api.tls] enabled = false`. Cookies with `secure: process.env.NODE_ENV === "production"` would be sent over unencrypted connections in any non-production context.

---

## Positive Findings

Despite the above issues, several aspects of the codebase are well-designed:

1. **Prisma schema design** — Comprehensive relationships, use of composite unique constraints, sensible defaults, and index coverage on key query patterns.

2. **Zod validation** — Consistent use of Zod schemas for input validation across API routes and forms.

3. **Guard action system** — The `guardAction` module provides a well-abstracted authorization layer with approval policies, dry-run mode, and audit logging.

4. **Scheduler architecture** — The `queueDueScheduledTasks` + `processQueuedExecutions` pattern with exponential backoff and dead-lettering is production-quality design.

5. **OAuth callback handling** — The three-case provisioning logic (linked, email-match, new user) with proper password-less fallback is complete and well-documented.

6. **API route structure** — Consistent auth check pattern (`getSession() → return 401`), Zod parsing, and error response format across routes.

7. **Context provider** — `SheetNavigationContext` follows React best practices with proper memoization and error boundary pattern.

8. **Testing quality** — Existing tests (guard, provision, providers, idempotency) are well-structured with proper mocking and focused assertions.

---

## Recommendations by Priority

### Immediate (fix before deployment):
1. [C-1] Remove hardcoded ENCRYPTION_KEY and AUTH_SECRET from Dockerfile/docker-compose; use runtime injection
2. [C-2] Wire `updateSession()` into `src/middleware.ts` so Supabase token refresh actually runs
3. [C-3] Add signature verification to all webhook handlers (Vapi, Twilio, WhatsApp, Stripe)

### Short-term (next sprint):
4. [M-1] Implement Redis-backed rate limiting and wire into auth routes
5. [M-2] Strengthen password policy with complexity requirements
6. [M-4] Add auth, CORS, and error handling to FastAPI backend
7. [M-5] Add tests for crypto.ts, auth.ts, rate-limit.ts, middleware.ts

### Medium-term:
8. [M-3] Replace `.catch(() => undefined)` patterns with proper error logging
9. [m-1] Add CSRF protection for state-changing endpoints
10. [m-5] Add missing Prisma indexes
11. [m-6] Add TLS termination layer (reverse proxy)

---

## Files Audited

| Area | Files Read |
|------|-----------|
| Security | `src/lib/crypto.ts`, `src/lib/auth.ts`, `src/lib/auth-constants.ts`, `src/lib/rate-limit.ts`, `src/middleware.ts` |
| Frontend | `src/app/api/businesses/route.ts`, `src/app/api/onboarding/route.ts`, `src/app/api/businesses/[id]/brand/route.ts`, `src/app/api/businesses/[id]/deploy/route.ts`, `src/app/api/auth/oauth/start/route.ts`, `src/app/api/auth/oauth/callback/route.ts` |
| Webhooks | `vapi/route.ts`, `twilio/route.ts`, `whatsapp/route.ts`, `telegram/route.ts`, `stripe/route.ts` |
| Internal | `scheduler/tick/route.ts`, `push/register/route.ts` |
| Supabase | `client.ts`, `server.ts`, `middleware.ts`, `provision.ts`, `providers.ts` |
| Hooks | `use-auth.ts`, `use-secrets.ts`, `use-logs.ts` |
| Contexts | `SheetNavigationContext.tsx` |
| Backend | `main.py`, `database.py`, `settings.py` |
| Schema | `prisma/schema.prisma` (full, 814 lines) |
| Validations | `src/lib/validations.ts` |
| Infrastructure | `docker-compose.yml`, `Dockerfile.frontend`, `Dockerfile.backend`, `Makefile`, `package.json`, `supabase/config.toml` |
| Tests | `guard/__tests__/guard.test.ts`, `supabase/__tests__/provision.test.ts`, `supabase/__tests__/providers.test.ts`, `executor/__tests__/idempotency.test.ts` |
| Env | `src/lib/env.ts`, `src/lib/db.ts`, `src/lib/scheduler.ts` |
