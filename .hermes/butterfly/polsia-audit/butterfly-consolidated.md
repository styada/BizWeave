# 🦋 Butterfly Result: Bizweave Codebase Audit

**Date:** 2026-07-02  
**Big Picture:** Audit the Polsai-competitor (Bizweave) codebase for 10 critical improvement areas  
**Wings:** 3 parallel subagents, 28+12+14 = **54 findings total**  
**Files analyzed:** ~80+ source files across the entire stack

---

## Executive Summary

Bizweave is an ambitious Next.js 16 + FastAPI platform with real architectural strengths — guard system, BYOK pattern, Zod validation, scheduler with dead-lettering. But this audit found **10 critical issues** that need attention before production deployment. The biggest problems cluster around three themes:

1. **The billing system is wired up but doesn't charge anyone** — wallet debits are hardcoded to $0, pipeline LLM calls aren't metered, and costs can be bypassed entirely.
2. **Security is inconsistent** — hardcoded encryption keys in Docker, API key fragments leak into logs, webhooks accept unauthenticated requests, encryption uses a static salt.
3. **The core differentiator (6-agent pipeline) has multiple failure modes** — orchestrator output is ignored, fallback mode auto-approves template garbage as "live", and all pipeline side effects bypass the guard system entirely.

---

## Critical Issues (10)

These block production use or will cause data loss, revenue leakage, or security breaches.

### 1. 🔴 Wallet Debit is $0 — PAYG Billing is a No-Op
**Wing 1 · `src/lib/guard/guard.ts:134`**

`debitWallet(businessId, 0, ...)` passes `0` instead of `estCostUsd`. Every single wallet debit charges nothing. The entire PAYG billing system is silently broken — businesses are never billed for LLM tokens, ad spend, or metered usage. The `.catch(() => undefined)` makes this invisible in production.

**Fix:** Change `0` → `estCostUsd`.

### 2. 🔴 Fallback Auto-Approves Template Output as "Live"
**Wing 1 · `src/lib/agents/fallback.ts:164-181`, `orchestrator.ts:540-543`**

When no LLM key is configured (or all providers fail), the fallback safeguard returns `approved: true, reliabilityIndex: 86, scores.safety: 90`. A business with zero LLM setup gets their template-generated site pushed "live" with fabricated quality scores — no human review, no warning.

**Fix:** Never auto-approve safeguard output with `fallback=true`. Require explicit config to publish when the pipeline ran without a real LLM.

### 3. 🔴 Hardcoded Encryption Key & Auth Secret in Docker Stack
**Wing 3 · `docker-compose.yml:49`, `Dockerfile.frontend:9-10`**

```yaml
ENCRYPTION_KEY=0123456789abcdef...   # Same for every deployment
AUTH_SECRET=change-me-in-local-env     # Bake into image layers
```

Every deployment shares the same AES key (decrypts all stored API keys) and JWT signing secret. Anyone with the docker-compose or the built image can forge sessions and decrypt credentials.

**Fix:** Remove from Dockerfile; inject at runtime via Docker Secrets or mandatory `.env`. Add startup check that refuses defaults in production.

### 4. 🔴 No Retry/Backoff in LLM Client — Transient Failures Are Fatal
**Wing 2 · `src/lib/llm/client.ts:38-121`**

Single `fetch()` call with zero retry logic. HTTP 429 or 5xx immediately throws. Caller wraps in bare `catch {}` returning a generic error. Any rate-limit spike or network blip = user-facing failure with no recovery.

**Fix:** Add exponential backoff + jitter (max 3 attempts). Distinguish retryable (429/5xx) from permanent (401/403) errors.

### 5. 🔴 API Key Fragments Leak into Logs
**Wing 2 · `src/lib/llm/client.ts:56-58`**

```typescript
const err = await res.text();
throw new Error(`OpenAI error: ${res.status} ${err}`);
```

OpenAI error responses echo back your API key prefix. This propagates unredacted into logs, monitoring dashboards, and error tracking.

**Fix:** Strip/redact API key patterns from error bodies before logging.

### 6. 🔴 Orphaned Supabase Middleware — Token Refresh Never Runs
**Wing 3 · `src/middleware.ts`, `src/lib/supabase/middleware.ts`**

The `updateSession()` function that performs Supabase auth cookie rotation and token refresh is **never imported or called**. Users get no transparent session refresh — sessions expire after 7 days with no renewal mechanism.

**Fix:** Wire `updateSession()` into the main middleware before the cookie check.

### 7. 🔴 Unauthenticated Webhook Handlers
**Wing 3 · `vapi/route.ts`, `twilio/route.ts`, `whatsapp/route.ts`**

Vapi: No auth at all (accepts arbitrary JSON, creates CallLog records).  
Twilio/WhatsApp: No signature verification (X-Twilio-Signature never validated).  
Stripe: Falls back to unauthenticated when `STRIPE_WEBHOOK_SECRET` isn't set.

**Fix:** Add HMAC verification for Vapi, X-Twilio-Signature validation for Twilio, require Stripe webhook secret in production.

### 8. 🔴 Pipeline Side Effects Bypass guardAction Entirely
**Wing 1 · `src/lib/agents/orchestrator.ts:311,348,597-600`**

The core pipeline writes directly to the database (`generatedSite.upsert`, `marketingPlan.upsert`, `business.update`) — none of these go through `guardAction()`. The guard system (spending caps, budget checks, audit logging, approval policies) is only invoked for tool calls via MCP. The pipeline has a partial reimplementation that misses audit logging, spend caps, wallet checks, and procurement policy.

**Fix:** Route all pipeline side effects through `guardAction` as the single choke point.

### 9. 🔴 Encryption Key Derivation Uses Static Salt
**Wing 2 · `src/lib/crypto.ts:16`**

```typescript
return scryptSync(raw, "bizweave-salt", KEY_LENGTH);  // Static salt!
```

When `ENCRYPTION_KEY` isn't a hex string, the code falls back to `scryptSync` with a hardcoded salt `"bizweave-salt"`. All derived keys share the same salt — rainbow table vulnerability if the derived key ever leaks.

**Fix:** Use a random 16-byte salt per encryption (prepend to output), or enforce hex-encoded 256-bit keys only.

### 10. 🔴 Orchestrator Output Is Completely Ignored
**Wing 1 · `src/lib/agents/orchestrator.ts:403`**

The orchestrator is the first agent in the pipeline but its output (`artifacts.orchestrator`) is **never read** by any downstream logic. Every pipeline run wastes one LLM call + 45s timeout on dead code.

**Fix:** Either use orchestrator output to reorder agents, or remove the orchestrator call.

---

## Critical Recurring Themes

Reading across all wings, three meta-patterns emerge:

### Theme A: "Wired Up but Not Working" (3 issues)
The system has the right architecture but key parts are intentionally or accidentally disabled:
- Wallet debit = $0 (C1)
- Orchestrator runs but output discarded (C10)
- Supabase `updateSession` never called (C6)
- Rate limiter exists but not imported by any route (M-1)

### Theme B: "Security Theater" (4 issues)
Defense mechanisms that give the illusion of security:
- Guard system bypassed by pipeline side effects (C8)
- Fallback auto-approves (C2)
- Static encryption salt (C9)
- In-memory rate limiter not wired anywhere (M-1)

### Theme C: "No Revenue" (3 issues)
The billing/metering system has multiple independent failures:
- Wallet debit = $0 (C1)
- Pipeline LLM calls not cost-metered (M5)
- Race condition in usage metering allows overconsumption (F5)
- Read-only MCP tools bypass all cost checks (M8)

---

## Major Issues (23)

| ID | Wing | Area | Issue | Fix Priority |
|----|------|------|-------|:---:|
| M1 | 1 | agents | No prompt injection defense on business fields in prompts | High |
| M2 | 1 | agents | Silent error swallowing in retry loop | High |
| M3 | 1 | agents | AgentLog always says "complete" even on fallback | Medium |
| M4 | 1 | executor | Task idempotency window too narrow (5 min) | Medium |
| M5 | 1 | agents | Pipeline LLM calls not cost-metered | High |
| M6 | 1 | agents | Fallback safeguard auto-approves (overlaps C2) | High |
| M7 | 1 | dreaming | Chat persistence hardcoded to "web" channel | Low |
| M8 | 1 | mcp | Read-only MCP tools bypass rate/cost limits | Medium |
| M9 | 1 | pipeline | Duplicated pipeline code paths | Medium |
| M10 | 1 | mcp | Raw OAuth token passed to integration client | High |
| M11 | 1 | agents/llm | API keys without trace protection | High |
| F4 | 2 | llm | No rate limiting on LLM API calls | High |
| F5 | 2 | usage | Race condition in usage metering | High |
| F6 | 2 | memory | No per-user privacy scoping | Medium |
| F7 | 2 | temporal | Temporal client no auth/TLS | Medium |
| F8 | 2 | infra | Rate limiter process-local, ineffective multi-instance | Medium |
| F9 | 2 | infra | No structured logging | Medium |
| F10 | 2 | llm | Platform fallback key has no per-user isolation | High |
| M-1 | 3 | infra | In-memory rate limiter not wired to any route | High |
| M-2 | 3 | auth | Weak password policy (min 8, no complexity) | Medium |
| M-3 | 3 | infra | Silent error swallowing (`.catch(() => undefined)` × 8+) | High |
| M-4 | 3 | backend | FastAPI has no auth, CORS, or error handlers | High |
| M-5 | 3 | testing | Zero tests for crypto, auth, rate-limit, middleware, webhooks | High |

---

## Minor Issues (18)

- Wing 1 (10): Schema drift, missing caps on budgets, no MCP reset, inventory capping at 50, volume-reward over quality-reward, fire-and-forget learning, UTF-8 truncation, etc.
- Wing 2 (2): Integration credential handling inconsistency, module-load-time env flag evaluation
- Wing 3 (6): No CSRF, unsanitized webhook storage, Stripe returns 200 on errors, inconsistent password hash generation, missing Prisma indexes, no TLS in Docker stack

---

## Top 10 Things to Fix First (Ranked)

| # | What | Why | Wing Est. |
|---|------|-----|:---------:|
| 1 | **Fix wallet debit** → `debitWallet(businessId, estCostUsd, ...)` | You're not charging anyone | 5 min |
| 2 | **Remove hardcoded keys from Docker** → runtime injection only | Every deploy shares the same crypto key | 30 min |
| 3 | **Gate auto-approval on fallback** → require explicit config | Template garbage goes "live" with fake scores | 30 min |
| 4 | **Add retry+backoff to LLM client** | Every transient failure is user-visible | 1 hr |
| 5 | **Wire updateSession into middleware** | Users get randomly logged out | 30 min |
| 6 | **Redact API keys from error messages** | Key fragments leaking into logs | 30 min |
| 7 | **Route pipeline through guardAction** | Guard system is security theater | 2 hr |
| 8 | **Fix static salt in crypto.ts** | All derived keys share the same salt | 30 min |
| 9 | **Add webhook signature verification** | Vapi/Twilio accept unauthenticated POSTs | 1 hr |
| 10 | **Kill dead orchestrator or wire it up** | Wasting LLM call + 45s every pipeline run | 30 min |

**Estimated total: ~7 hours of work** for the top 10.

---

## Positive Signals (What Bizweave Does Well)

Despite the issues, several architectural choices are strong:

1. **Guard system pattern** — The `guardAction` abstraction for authorization + audit logging + dry-run is well-designed. It just needs to be the *only* path for side effects.
2. **BYOK architecture** — Clean separation between key storage, resolution, and client. User-owned vs platform keys clearly distinguished.
3. **AES-256-GCM for API keys** — Strong encryption choice (just needs proper salt handling).
4. **Zod validation everywhere** — Consistent schema-based input validation.
5. **Scheduler with dead-lettering** — `queueDueScheduledTasks` + `processQueuedExecutions` with exponential backoff is production quality.
6. **Fallback templates** — Graceful degradation when LLM is unavailable (just needs gate on auto-approval).
7. **OAuth callback logic** — Three-case provisioning (link, email-match, new user) is complete and well-documented.
8. **Existing tests** — Guard, provision, providers, and idempotency tests are well-structured.

---

## Files Created During Audit

| File | Description |
|------|-------------|
| `wings/wing-1-agent-pipeline.md` | Full Wing 1 report (28 files, 25 issues) |
| `wings/wing-1-decisions.md` | Wing 1 decision log |
| `wings/wing-2-llm-infra.md` | Full Wing 2 report (20 files, 12 issues) |
| `wings/wing-2-decisions.md` | Wing 2 decision log |
| `wings/wing-3-frontend-backend-sec.md` | Full Wing 3 report (35+ files, 14 issues) |
| `wings/wing-3-decisions.md` | Wing 3 decision log |
| `butterfly-consolidated.md` | **This file** — cross-wing synthesis |
| `wing-defs.json` | Wing definitions for traceability |
