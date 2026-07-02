# 🦋 Audit Fix Plan — Bizweave Codebase Hardening

**Source:** `.hermes/butterfly/polsia-audit/butterfly-consolidated.md`  
**Date:** 2026-07-02  
**Estimated Total:** ~7–10 hours for all critical + high-priority major items

---

## How to Use This Plan

Each round is independently executable. Start with **Round 1** (highest ROI, lowest risk) and proceed sequentially. Each round lists files to modify, the exact change needed, and the risk of the change.

---

## Round 1: "Stop the Revenue Leak" (Critical — ~15 min)

Fix the two bugs that make the billing/metering system a no-op.

### 1.1 Fix Wallet Debit — `src/lib/guard/guard.ts`

**Problem:** `debitWallet(businessId, 0, ...)` passes `0` instead of `estCostUsd`.

**Change (line 134):**
```ts
// Before:
await debitWallet(businessId, 0, `${actionType}`).catch(() => undefined);
// After:
await debitWallet(businessId, estCostUsd, `${actionType}`).catch(() => undefined);
```

**Risk:** Low. `estCostUsd` is already validated `> 0` on line 132. This change activates billing where it was intended.

### 1.2 Kill the Dead Orchestrator — `src/lib/agents/orchestrator.ts`

**Problem:** The `orchestrator` agent runs first in the pipeline but its output is never read. Every run wastes one LLM call + 45s timeout.

**Option A (Recommended):** Remove the orchestrator from `AGENT_PIPELINE` in `src/lib/agents/types.ts`. This eliminates the wasted call entirely.

**Option B:** Actually use orchestrator output to reorder the pipeline. Higher effort, more value long-term.

**Change (types.ts — remove `"orchestrator"` from `AGENT_PIPELINE`):**
```ts
export const AGENT_PIPELINE: AgentId[] = [
  // "orchestrator",  // REMOVED — output was never consumed
  "intake",
  "planner",
  "builder",
  "marketing",
  "support",
  "safeguard",
  // optional extras (require explicit enable)
  // "outreach", "ads", "finance", "competitor-research"
];
```

Also remove the `case "orchestrator"` block from the switch statement in `orchestrator.ts` (lines ~395-415) and clean up related imports/types.

**Risk:** Low. The orchestrator output was dead code. Removing it saves cost and latency.

---

## Round 2: "Secure the Stack" (Critical — ~1 hr)

### 2.1 Remove Hardcoded Encryption Keys — `docker-compose.yml` & `Dockerfile.frontend`

**Problem:** `ENCRYPTION_KEY` and `AUTH_SECRET` are hardcoded in docker-compose.yml (4 services) and baked into Dockerfile.frontend image layers.

**Changes:**

**`Dockerfile.frontend`** — Remove hardcoded ENV lines for secrets (keep only non-sensitive defaults):
```
- ENV AUTH_SECRET=change-me-in-local-env
- ENV ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```
(The runtime container doesn't need build-time defaults for these — they're injected at container start.)

**`docker-compose.yml`** — Replace hardcoded values with variable references:
```yaml
environment:
  AUTH_SECRET: ${AUTH_SECRET?required}     # Fail if not set
  ENCRYPTION_KEY: ${ENCRYPTION_KEY?required}
```
Apply to all 4 services: `frontend-db-init`, `frontend`, `scheduler-worker`.

Also remove the `SCHEDULER_SECRET: change-me-in-local-env` default — make it required.

**Risk:** Low. Local dev needs `.env` file updated, but `make docker-up` and `npm run dev` already have `.env` patterns. Breaking change only if someone relied on the hardcoded defaults.

### 2.2 Fix Static Salt in Encryption — `src/lib/crypto.ts`

**Problem:** When `ENCRYPTION_KEY` isn't a 64-char hex string, scrypt derivation uses hardcoded salt `"bizweave-salt"`.

**Option A (Recommended):** Require hex-encoded 256-bit keys only. Add a startup warning if the key isn't hex.

```ts
function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY is not set");
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  // Remove scrypt fallback entirely — enforce hex keys
  if (process.env.NODE_ENV === "production") {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string in production");
  }
  // Dev-only fallback with warning
  console.warn("[crypto] WARNING: ENCRYPTION_KEY is not a 64-char hex string. " +
    "Using scrypt derivation with random salt. Set a proper ENCRYPTION_KEY for production.");
  const salt = randomBytes(16).toString("hex");
  return scryptSync(raw, salt, KEY_LENGTH);
}
```

**Option B (More robust):** Generate a random salt per encryption, prepend to output. But Option A is simpler and sufficient since the hex path is already correct.

**Risk:** Low. Anyone using hex keys (the intended path) is unaffected.

### 2.3 Wire `updateSession` into Middleware — `src/middleware.ts`

**Problem:** `src/lib/supabase/middleware.ts` contains `updateSession()` for Supabase token refresh, but it's never imported or called.

**Change (`src/middleware.ts`):**
```ts
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Run Supabase session refresh first
  const supabaseResponse = await updateSession(request);
  // ... rest of existing logic
}
```

Note: The existing middleware is synchronous (`export function middleware`) — needs to be made `async` to call `updateSession`. This is safe because Next.js supports async middleware.

**Risk:** Medium. The Supabase SSR `updateSession` pattern is tightly coupled to response cookie handling. The current middleware returns `NextResponse.next()` or redirects — need to ensure the `supabaseResponse` cookies are preserved in all branches.

### 2.4 Redact API Keys from Error Messages — `src/lib/llm/client.ts`

**Problem:** OpenAI/Anthropic error responses may contain API key fragments. These propagate unredacted into logs.

**Change:** Add a redaction helper and use it in both `completeOpenAI` and `completeAnthropic`:

```ts
function redactApiKey(text: string): string {
  return text.replace(/(sk-[A-Za-z0-9]{5,})[A-Za-z0-9]+/g, "$1…[REDACTED]")
    .replace(/(sk-ant-[A-Za-z0-9]{5,})[A-Za-z0-9]+/g, "$1…[REDACTED]");
}

// In completeOpenAI error handler:
throw new Error(
  `OpenAI-compatible error (${options.def.id}, ${res.status}): ${redactApiKey(await res.text())}`
);
```

**Risk:** Low. Pure additive change.

---

## Round 3: "Make the Pipeline Honest" (Critical — ~2 hr)

### 3.1 Gate Fallback Auto-Approval — `src/lib/agents/fallback.ts` & `orchestrator.ts`

**Problem:** When no LLM is available, `fallbackSafeguard(true)` returns `approved: true, reliabilityIndex: 86, scores.safety: 90` — fabricated quality scores that can push template-generated content "live."

**Change 1 (`fallback.ts`):** Make the fallback safeguard return honest values:
```ts
export function fallbackSafeguard(): SafeguardVerdict {
  return {
    approved: false,
    issues: [
      "No LLM API key configured — all outputs are template-based",
      "Manual review required before publishing",
      "Connect a BYOK API key in Settings for full agent pipeline",
    ],
    revisions: ["Connect an API key and re-run the pipeline"],
    summary: "Pipeline ran in demo mode (no LLM). All outputs are templates and require manual review.",
    reliabilityIndex: 15,       // Honest: near-zero
    scores: {
      safety: 20,
      consistency: 15,
      channelReadiness: 10,
    },
    differentiatorInsight: "",
  };
}
```

**Change 2 (`orchestrator.ts`):** Add a check that prevents auto-publishing when the entire pipeline ran without LLM:
```ts
// After pipeline loop, before setting finalStatus:
if (!useLlm) {
  finalStatus = "review";
  // Add activity event warning
  await emitActivity({
    businessId,
    runId: run.id,
    agent: "system",
    eventType: "pipeline.demo-mode",
    level: "warn",
    message: "Pipeline ran without LLM — all outputs are templates. Manual review required.",
  });
}
```

**Risk:** Low. Makes the system honest about template mode. Any business that was auto-publishing template sites will now need manual approval — which is the correct behavior.

### 3.2 Route Pipeline Side Effects Through `guardAction` — `orchestrator.ts`

**Problem:** The pipeline writes directly to DB (`generatedSite.upsert`, `marketingPlan.upsert`, `business.update`) bypassing the guard system entirely.

**Change:** Wrap all pipeline DB writes in `guardAction` calls. The guard already supports:
- Approval policies
- Audit logging
- Usage metering
- Dry-run mode

```ts
// Before (line ~311):
await db.generatedSite.upsert({ where: { businessId }, create: {...}, update: {...} });

// After:
await guardAction({
  businessId,
  userId,
  actionType: "save_generated_site",
  riskLevel: "low",
  payload: { html: site.html, css: site.css, meta: site.meta },
  estCostUsd: 0,
  execute: async () => {
    await db.generatedSite.upsert({ where: { businessId }, create: {...}, update: {...} });
    return { status: "saved" };
  },
});
```

Same pattern for `marketingPlan.upsert` and `business.update`.

**Risk:** Medium. Wraps existing DB writes with additional guard checks. If an approval policy requires approval for these actions, the pipeline may block until approved. Need to ensure the `riskLevel` is appropriate (low for save, higher for publish).

**Note:** The `publish_artifacts` gate at the end of the pipeline (lines 540-600) already partially implements this. The fix is to consolidate all side effects through `guardAction`.

### 3.3 Fix AgentLog Always Reporting "complete" — `orchestrator.ts`

**Problem:** `logStatus` is hardcoded `"complete"` at line 246. When fallback is used, the log still says `complete` with `errorCode: "FALLBACK_USED"` — inconsistent state.

**Change:**
```ts
// Replace hardcoded:
const logStatus = "complete";
// With dynamic:
const logStatus = usedFallback ? "degraded" : "complete";
```

**Risk:** Low. Changes a log field only; no functional impact.

---

## Round 4: "Resilience & Observability" (Major — ~2 hr)

### 4.1 Add Retry/Backoff to LLM Client — `src/lib/llm/client.ts`

**Problem:** Single `fetch()` call with no retry. HTTP 429/5xx are fatal.

**Change:** Add a retry wrapper:
```ts
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: { timeoutMs?: number; maxRetries?: number } = {}
): Promise<Response> {
  const maxRetries = options.maxRetries ?? 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        if (!res.ok && attempt < maxRetries && (res.status === 429 || res.status >= 500)) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 1000, 10_000);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        return res;
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 1000, 10_000);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError ?? new Error("fetchWithRetry exhausted");
}
```

Replace `fetchWithTimeout` calls with `fetchWithRetry` in `completeOpenAI` and `completeAnthropic`.

**Risk:** Low. Adds latency tolerance. Backoff jitter prevents thundering herd.

### 4.2 Add Structured Logging — Multiple Files

**Problem:** `console.error` and `console.log` used throughout with no structure, no correlation IDs.

**Change:** Create a lightweight logging utility at `src/lib/logger.ts`:
```ts
export type LogLevel = "debug" | "info" | "warn" | "error";

export function log(level: LogLevel, module: string, message: string, meta?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    ...(meta ? { meta } : {}),
  };
  const formatted = JSON.stringify(entry);
  if (level === "error") console.error(formatted);
  else console.log(formatted);
}
```

Then replace `console.error("[module] ...", err)` with:
```ts
log("error", "module", "Operation failed", { error: err?.message });
```

Start with security-critical modules: `meter.ts`, `crypto.ts`, `guard.ts`, `orchestrator.ts`, webhook handlers.

**Risk:** Low. Changes log format but not behavior.

### 4.3 Fix Silent Error Swallowing — Multiple Files

**Problem:** `.catch(() => undefined)` used 8+ times, silently discarding failures in subscription creation, site launch, wallet seeding, etc.

**Change:** Replace each `.catch(() => undefined)` with at minimum:
```ts
.catch((err) => {
  log("error", "module", "Operation failed", { error: err?.message });
})
```

Prioritize files: `onboarding/route.ts`, `businesses/route.ts`, `businesses/[id]/deploy/route.ts`.

**Risk:** Low. Errors become visible instead of invisible.

---

## Round 5: "Webhook Security" (Critical — ~1 hr)

### 5.1 Add Vapi HMAC Verification — `src/app/api/webhooks/vapi/route.ts`

**Problem:** Vapi webhook accepts arbitrary JSON with no auth.

**Changes needed:**
- Read `VAPI_API_KEY` from env (or use the configured key from DB)
- Verify HMAC signature from the `x-vapi-signature` header against the raw request body
- Reject unauthenticated requests with 401

### 5.2 Add Twilio Signature Verification — `src/app/api/webhooks/twilio/route.ts` & `whatsapp/route.ts`

**Problem:** No `X-Twilio-Signature` validation.

**Changes needed:**
- Import `twilio` npm package (or implement HMAC-SHA1 verification manually)
- Validate `X-Twilio-Signature` against the URL + POST body using `TWILIO_AUTH_TOKEN`
- Reject invalid signatures with 401

### 5.3 Enforce Stripe Webhook Secret in Production — `stripe/route.ts`

**Problem:** When `STRIPE_WEBHOOK_SECRET` isn't set, Stripe events are accepted without verification.

**Change:** Require the webhook secret in production:
```ts
if (!process.env.STRIPE_WEBHOOK_SECRET) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 500 });
  }
  // In dev, log warning and skip signature check
  console.warn("[stripe-webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification");
}
```

---

## Round 6: "Missing Tests" (Major — ~3 hr)

### 6.1 Add Tests for `crypto.ts`

Test: encrypt/decrypt roundtrip, wrong key fails, hex key vs scrypt fallback, keyHint masking.

### 6.2 Add Tests for `auth.ts`

Test: `getSession()` with valid/invalid JWT, `hashPassword`/`verifyPassword`, session expiry.

### 6.3 Add Tests for `rate-limit.ts`

Test: within limit, exceeded limit, reset after window, per-business throttle.

### 6.4 Add Tests for `middleware.ts`

Test: protected route with/without cookie, wildcard subdomain rewrite, redirect path preservation.

### 6.5 Add Tests for Webhook Handlers

Test: Vapi HMAC verification (valid + invalid), Twilio signature validation, Stripe event parsing.

---

## Round 7: "Hardening & Polish" (Medium Priority)

### 7.1 Prompt Injection Defense — `src/lib/agents/prompts.ts`

Wrap all business-supplied fields in structured delimiters:
```ts
`<business_data>
Name: ${escapePrompt(ctx.name)}
Type: ${escapePrompt(ctx.type)}
Description: ${escapePrompt(ctx.description ?? "Not provided")}
</business_data>`
```

Where `escapePrompt()` strips delimiters and control characters.

### 7.2 Wire Rate Limiter into Routes — `src/lib/rate-limit.ts`

Import and call `rateLimit(request)` in auth routes (login, signup, password reset).

### 7.3 Strengthen Password Policy — `src/lib/validations.ts`

Add complexity requirements:
```ts
password: z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one digit"),
```

### 7.4 Meter Pipeline LLM Calls — `src/lib/agents/orchestrator.ts`

Call `recordUsage()` after each successful (non-fallback) agent step to track LLM token consumption per business.

### 7.5 Add Auth/CORS/Error Handling to FastAPI — `backend/app/main.py`

```python
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origins],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
```

---

## Round 8: "Minor Fixes" (Low Priority)

- M1 (Wing 1): No prompt injection defense — handled in Round 7.1
- M4 (Wing 1): Extend idempotency window from 5min to 30min
- M7 (Wing 1): Fix dream cycle hardcoded `"web"` channel
- M8 (Wing 1): Add rate limiting to read-only MCP tools
- M10 (Wing 1): Redact OAuth tokens from integration traces
- M11 (Wing 1): API key trace protection in agent calls
- F6 (Wing 2): Add per-user privacy scoping to memory system
- F7 (Wing 2): Add TLS to Temporal client
- F8 (Wing 2): Redis-backed rate limiter (future)
- F10 (Wing 2): Platform key per-user isolation
- M-2 (Wing 3): Password policy — handled in Round 7.3
- m-1 to m-6 (Wing 3): CSRF, Prisma indexes, TLS, etc.

---

## Summary Table

| Round | Focus | Items | Est. Time | Risk |
|-------|-------|-------|-----------|------|
| 1 | Revenue Leak | Wallet debit fix, kill dead orchestrator | 15 min | Low |
| 2 | Stack Security | Hardcoded keys, static salt, middleware wiring, key redaction | 1 hr | Low-Med |
| 3 | Pipeline Honesty | Fallback gate, guardAction routing, log status | 2 hr | Med |
| 4 | Resilience | Retry/backoff, structured logging, fix silent swallowing | 2 hr | Low |
| 5 | Webhook Security | Vapi HMAC, Twilio signature, Stripe enforcement | 1 hr | Low |
| 6 | Missing Tests | crypto, auth, rate-limit, middleware, webhooks | 3 hr | Low |
| 7 | Hardening | Prompt injection, rate limiter wiring, password policy, metering, FastAPI auth | 2 hr | Low-Med |
| 8 | Polish | Idempotency, dream channel, MCP limits, OAuth tokens, memory scoping | 3 hr | Low |

**Total:** ~14 hours for all rounds. **Priority path (Rounds 1-5): ~6 hours** to fix all critical issues.
