# Wing 2 — LLM Infrastructure & Integrations Audit

**Target**: `src/lib/llm/`, `src/lib/chat/`, `src/lib/usage/`, `src/lib/integrations/`, `src/lib/memory/`, `src/lib/temporal/`, `src/lib/env.ts`, `src/lib/crypto.ts`, `src/lib/rate-limit.ts`

**Date**: 2026-07-02  
**Auditor**: Wing 2 (Butterfly parallel audit)

---

## Files Read

| Directory | Files |
|-----------|-------|
| `src/lib/llm/` | `client.ts`, `resolve.ts`, `types.ts`, `keys.ts`, `__tests__/resolve.test.ts` |
| `src/lib/chat/` | `operator.ts`, `__tests__/operator.test.ts`, `__tests__/operator-publish.test.ts` |
| `src/lib/usage/` | `meter.ts`, `__tests__/meter.test.ts` |
| `src/lib/integrations/` | `index.ts`, `email-send.ts`, `sms-send.ts`, `twitter.ts`, `linkedin.ts`, `__tests__/integrations.test.ts`, `__tests__/email-send.test.ts` |
| `src/lib/memory/` | `store.ts`, `embeddings.ts`, `__tests__/seed-onboarding.test.ts` |
| `src/lib/temporal/` | `client.ts`, `__tests__/client.test.ts` |
| `src/lib/env/` | `__tests__/flags.test.ts` |
| Root lib | `env.ts`, `crypto.ts`, `rate-limit.ts` |

---

## Finding 1: No retry or backoff in LLM client — every transient failure is final

**Severity**: CRITICAL  
**File**: `src/lib/llm/client.ts` (lines 38–121)  
**Category**: Reliability, Resilience

### Description
`completeOpenAI()` and `completeAnthropic()` make a single `fetch()` call with zero retry logic. HTTP 429 (rate limit), 5xx (server error), and transient network failures immediately throw an exception. There is no exponential backoff, jitter, or retry budget.

The caller `answerQuestion()` in `operator.ts` (line 277) wraps the call in a bare `catch {}` that returns a generic message. This means:
- A brief rate-limit spike causes a user-facing failure with no recovery.
- Temporary network blips (e.g., Lambda cold-start, DNS hiccup) are non-recoverable.
- No differentiation between 429 (retryable) and 401 (permanent) errors — they all hit the same catch-all.

### Evidence
```typescript
// client.ts — no retry at all
async function completeOpenAI(...): Promise<LLMResponse> {
  const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    ...
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${err}`);  // immediate throw
  }
  ...
}
```

```typescript
// operator.ts — bare catch swallows all
} catch {
  return "I hit an error reaching the model. Try again in a moment.";
}
```

### Impact
Every transient failure is user-visible. In a multi-tenant system sharing API keys (platform key), concurrent requests from multiple businesses will frequently trigger 429 errors, resulting in degraded UX. No SLA can be met without retry logic.

### Recommendation
Add a retry wrapper with exponential backoff + jitter (max 3 attempts, 1s/2s/4s backoff). Distinguish 429/5xx (retryable) from 4xx (permanent). Consider a token-bucket rate limiter per API key to stay under provider limits proactively.

---

## Finding 2: API key fragments leak into error messages that propagate to logs

**Severity**: CRITICAL  
**File**: `src/lib/llm/client.ts` (lines 56–58, 101–103)  
**Category**: Security, Secret Management

### Description
When an OpenAI or Anthropic API call fails, the response body is concatenated into the error message:
```typescript
const err = await res.text();
throw new Error(`OpenAI error: ${res.status} ${err}`);
```
OpenAI's error response for invalid keys includes the key prefix in the message body (e.g., `"Incorrect API key provided: sk-proj-...aBcD"`). This error message propagates unredacted. While not the full key, the prefix (or in some cases an echoed-back portion) leaks into:
- `console.error` calls in callers
- Error tracking / monitoring systems
- Potentially user-facing responses if not caught

### Evidence
Confirmed pattern — OpenAI docs show auth errors return:
```json
{
  "error": {
    "message": "Incorrect API key provided: sk-proj-...XyZ",
    "type": "invalid_request_error"
  }
}
```

### Impact
Partial API key exposure in logs and monitoring dashboards. An attacker with read access to log aggregators (DataDog, Sentry, CloudWatch) can learn key prefixes and narrow brute-force attacks. This violates common security guidelines for secret management.

### Recommendation
Sanitize error bodies before including them in error messages. Strip or redact anything matching the API key pattern (`sk-...`, `sk-ant-...`) from the error text. Log the status code and error type only, not the raw body, or redact sensitive patterns server-side.

---

## Finding 3: Encryption key derivation uses hardcoded static salt

**Severity**: CRITICAL  
**File**: `src/lib/crypto.ts` (line 16)  
**Category**: Security, Cryptography

### Description
When the `ENCRYPTION_KEY` environment variable is not a 64-character hex string, the code falls back to deriving a key via `scryptSync(raw, "bizweave-salt", 32)`. The salt `"bizweave-salt"` is a static string hardcoded in source control. Per cryptographic best practices, salts must be unique per derived key to prevent:
- Rainbow table precomputation
- Multi-target attacks (deriving one master key makes all users' encrypted data vulnerable)

An attacker with source code access (any insider, supply-chain compromise) and the derived key output can precompute the key derivation offline.

### Evidence
```typescript
function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY is not set");
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");    // hex path is ok
  }
  return scryptSync(raw, "bizweave-salt", KEY_LENGTH);  // static salt!
}
```

### Impact
All API keys encrypted with a password-derived key (non-hex ENCRYPTION_KEY) share the same static salt, reducing the effective security of scrypt to a simple hash. If the derived key is ever leaked (e.g., via memory dump, side-channel), all stored secrets are compromised with no per-user re-derivation cost.

### Recommendation
- **Strong**: Require the hex-encoded key format (64 hex chars = 256-bit key) and reject password-mode entirely in production.
- **Alternative**: Use a random 16-byte salt per encryption operation, stored alongside the ciphertext (prepend to output). Derive key from `scryptSync(raw, per-record-salt, ...)` for each encrypt/decrypt.
- Add a validation warning at startup if `ENCRYPTION_KEY` is not hex-encoded.

---

## Finding 4: No rate limiting or concurrency control on LLM API calls

**Severity**: MAJOR  
**File**: `src/lib/llm/client.ts` (entire file)  
**Category**: Resilience, Multi-tenancy

### Description
The LLM client has zero concurrency control. Multiple concurrent requests can hit the same API key simultaneously, especially when the platform key is shared across all users without BYOK. OpenAI's `gpt-4o-mini` has published rate limits (e.g., 500 RPM for Tier 1, 5000 RPM for Tier 5) — exceeding them causes 429 errors that are (see Finding 1) non-recoverable.

The existing `rate-limit.ts` is an in-memory HTTP-route rate limiter (10 req/min per IP), **not** applied to LLM API calls. It's also process-local and unsuitable for serverless/multi-instance deployments.

### Evidence
```typescript
// client.ts — direct fetch, no rate limiter between the key and the provider
return fetch(url, { ...init, signal: controller.signal });
```

### Impact
Without rate limiting, a burst of concurrent user requests (e.g., several "build website" commands at once) will hit provider rate limits and all fail. The platform key is particularly vulnerable since it's shared across all users without BYOK.

### Recommendation
Implement a token-bucket or leaky-bucket rate limiter per API key. For production, use a distributed store (Redis) rather than in-memory. Set conservative per-key RPM limits based on the provider's published tier.

---

## Finding 5: Race condition in usage metering — check-then-act without atomicity

**Severity**: MAJOR  
**File**: `src/lib/usage/meter.ts` (lines 99–133)  
**Category**: Accuracy, Scalability

### Description
`checkCap()` queries current-period usage, computes a projected total against the allowance, and returns a decision. The caller then performs the action and calls `recordUsage()` separately. Between `checkCap` and `recordUsage`, any number of concurrent requests can also consume from the same allowance, leading to over-consumption.

There is no database transaction, pessimistic/optimistic lock, or atomic increment. For `llm_tokens` and `ad_spend` (tracked by USD cost), the `consumed()` helper sums all `usageEvent` rows — a non-atomic read during concurrent writes.

### Evidence
```typescript
// meter.ts — separate check then act
const used = await consumed(params.businessId, params.kind);   // read
const projected = used + add;
if (projected <= allowance) {                                   // check
  return { allowed: true, ...};                                 // approve
}
// ... caller uses resource, then:
await recordUsage({ businessId, kind, quantity, costUsd });     // record (separate)
```

### Impact
Businesses can exceed their plan allowances during concurrent usage spikes. The PAYG wallet circuit breaker (lines 123–132) provides some protection but only for the overage check — the consumption itself is never rolled back. For LLM tokens, this could result in unbilled usage.

### Recommendation
Use an atomic increment pattern: `INSERT INTO usageEvent` with a pre-query checking the allowance in the same transaction, or use a PostgreSQL advisory lock for the check-and-consume sequence. For serverless deployments, consider a counter table with atomic `UPDATE ... SET count = count + add RETURNING count` that enforces the cap at the DB level.

---

## Finding 6: Memory system has no per-user privacy scoping

**Severity**: MAJOR  
**File**: `src/lib/memory/store.ts` (lines 26–59, 66–117)  
**Category**: Privacy, Data Isolation

### Description
`addMemory()` accepts a `userId` parameter but does **not** store it in the database — only `businessId` and `kind` are persisted. `retrieveMemory()` only filters by `businessId`, with an optional `k` limit. Every user who shares a business sees all memories for that business, regardless of who created them.

There is no concept of memory ownership, privacy level, or access control. Personal preferences, internal notes, and sensitive decisions from one user are visible to all other users of the same business.

### Evidence
```typescript
// addMemory — userId is accepted but NOT stored
const row = await db.memoryEntry.create({
  data: {
    businessId: params.businessId,
    kind: params.kind,
    content: params.content,
    salience: params.salience ?? 0.5,
    source: params.source ?? null,
    // userId is never written!
  },
});

// retrieveMemory — only filters by businessId
const rows = await db.memoryEntry.findMany({
  where: {
    businessId: params.businessId,
    ...
  },
});
```

### Impact
In a multi-seat business subscription (e.g., 2+ employees), one user's private memory (e.g., "Considering firing the store manager") could leak to other users via the operator chat's memory retrieval. This is a data isolation and compliance concern.

### Recommendation
Store `userId` on memory entries. Add an optional `scope` field (`business` | `user`). Modify `retrieveMemory()` to filter by `scope` and `userId` appropriately, with `business`-scoped memories visible to all users and `user`-scoped ones visible only to the owning user.

---

## Finding 7: Temporal client connection has no authentication or TLS

**Severity**: MAJOR  
**File**: `src/lib/temporal/client.ts` (lines 30–34)  
**Category**: Security

### Description
The Temporal client connects with `Connection.connect({ address })` with no TLS, mTLS, or API key options. In production, this means:
- Workflow payloads (including business data) transit in plaintext
- No server identity verification
- Any process on the network can impersonate the Temporal server

### Evidence
```typescript
const connection = await Connection.connect({ address });
globalThis.__temporalNextClient = new TClient({ connection, namespace });
```

### Impact
For a platform handling business websites, customer data, and marketing plans, unencrypted Temporal traffic is a data-in-transit exposure. An attacker with network access (same VPC, compromised pod, LAN) can read all workflow inputs and outputs.

### Recommendation
Implement TLS: set `tls` option on `Connection.connect()` (or `Connection.tls`). For production, use mTLS with client certificates. Store Temporal credentials (cert, key) in environment variables, not hardcoded.

---

## Finding 8: Rate limiter is process-local — ineffective in serverless/multi-instance deployments

**Severity**: MAJOR  
**File**: `src/lib/rate-limit.ts` (lines 4–8)  
**Category**: Resilience, Scalability

### Description
The HTTP rate limiter uses a module-level `Map<string, { count, resetTime }>`. This is purely in-memory and process-local. In serverless environments (Vercel, Lambda) or multi-container deployments, each instance has its own counter. A user hitting 10 req/min across 3 instances effectively gets 30 req/min.

The code has a TODO acknowledging this: `// Simple in-memory rate limiter (for production, use Redis)`.

### Evidence
```typescript
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
```

### Impact
The 10 req/min rate limit is easily bypassed by load balancer round-robin. Only a single-instance deployment provides any rate-limiting protection.

### Recommendation
Replace with a distributed rate limiter: Redis-based sliding window, or use the DB (advisory lock + counter table). For serverless, consider Upstash or Vercel KV.

---

## Finding 9: No structured logging — sensitive data may leak via console.error

**Severity**: MAJOR  
**File**: Multiple (`usage/meter.ts:45`, `memory/store.ts:56`, `integrations/index.ts:52`, `email-send.ts:29`, `sms-send.ts:26`)  
**Category**: Observability, Security

### Description
The codebase uses `console.error`, `console.log`, and `console.warn` throughout with no structured logging framework. Error objects (which may contain request payloads, partial API keys, or business data) are logged directly:
```typescript
// meter.ts
console.error("[meter] recordUsage failed:", err);

// memory/store.ts
console.error("[memory] addMemory failed:", err);

// integrations/index.ts
console.warn(`[integrations] Overwriting existing integration: ${integration.type}`);
```

There is no log-level control, no structured fields (correlation IDs, request IDs), no filtering of sensitive data, and no centralized log routing.

### Impact
Security-sensitive data in logs. Operational difficulty: without correlation IDs, tracing a user's request across the LLM call → memory retrieval → usage metering → Temporal workflow requires manual correlation. In production, `console.*` output goes to stdout/stderr and may be ingested by logging systems verbatim.

### Recommendation
Adopt a structured logger (pino, winston, or a lightweight alternative). Add a redaction mechanism for known sensitive fields (apiKey, token, secret). Include correlation IDs (from request headers or generated) in every log line.

---

## Finding 10: Platform fallback API key has no per-user isolation or rate limiting

**Severity**: MAJOR  
**File**: `src/lib/llm/resolve.ts` (lines 18–28)  
**Category**: Security, Multi-tenancy

### Description
When a user has no BYOK key, `resolveLlm()` falls back to the platform-managed API key from `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` environment variables. This single platform key is shared across all non-BYOK users:
```typescript
const openai = optionalEnv("OPENAI_API_KEY");
if (openai) return { provider: "openai", apiKey: *** managed: true };
```

There is no per-user spend cap, no per-user rate limit, and no key rotation mechanism. A single user's burst of requests can exhaust the platform key's rate limit for everyone. If the platform key is revoked or rotated, every non-BYOK user loses LLM access simultaneously. Additionally, `embeddings.ts` uses the same platform key for embedding generation, tying embedding availability to the same fallback key.

### Impact
- Single point of failure: one revoked key breaks LLM access for all non-BYOK users
- No cost attribution: all platform-backed calls are billed to the same account with no per-business breakdown
- No abuse isolation: a malicious user can degrade service for other users sharing the key

### Recommendation
For production, provision a dedicated platform key per tier or per customer, or enforce BYOK for all users. Failing that, implement per-user rate limiting (distributed) and daily spend caps on the platform key path.

---

## Finding 11: Integration credentials are plaintext in memory with no encryption at rest story

**Severity**: MINOR (with escalation to MAJOR for stored credentials)  
**File**: `src/lib/integrations/index.ts` (lines 15–21), `twitter.ts`, `linkedin.ts`  
**Category**: Security

### Description
The `ChannelCredentials` interface holds API keys, secrets, and access tokens as plain `string` properties. The `IntegrationRegistry` stores these in memory with no encryption or masking. While in-memory plaintext is common, the code has no mechanism for encrypting these credentials at rest if they are persisted (which the current codebase doesn't show — they appear to be passed in at runtime from the user's stored settings).

The Twitter integration's `validateCredentials` accepts either `accessToken` or `apiKey` (line 20), but `isConfigured` (line 23) only checks `accessToken`, creating a confusing discrepancy.

### Impact
Low for current code (credentials are passed per-request). Would become critical if credentials are persisted without encryption.

### Recommendation
Document credential handling. If credentials are stored in the DB, use the existing AES-256-GCM encryption from `crypto.ts`. Align `validateCredentials` and `isConfigured` logic.

---

## Finding 12: Environment flags evaluated at module load time

**Severity**: MINOR  
**File**: `src/lib/env.ts` (lines 15–21)  
**Category**: Operability

### Description
The `flags` object is computed at module import time via eagerly evaluated `process.env` reads:
```typescript
export const flags = {
  langgraph: bool(process.env.FEATURE_LANGGRAPH),
  deepExecutor: bool(process.env.FEATURE_DEEP_EXECUTOR),
  ...
} as const;
```
In Next.js serverless functions (warm starts), the module is cached and flags reflect the environment at first load. If env vars are changed between cold starts (K8s ConfigMap update) without restarting all instances, some instances may serve stale flag values.

### Impact
Low — flag changes between deploys are normal. However, during gradual rollouts, some instances could evaluate different flags, leading to inconsistent behavior across requests.

### Recommendation
For dynamic flags, use a function-return pattern (`flags.deepExecutor()` instead of `flags.deepExecutor`). For Next.js, consider using the `runtimeEnv` pattern or reading flags from a central config service.

---

## Summary

| # | Severity | Finding | File |
|---|----------|---------|------|
| 1 | **CRITICAL** | No retry/backoff in LLM client — transient failures are final | `client.ts` |
| 2 | **CRITICAL** | API key fragments leak into error messages that propagate to logs | `client.ts` |
| 3 | **CRITICAL** | Encryption key derivation uses hardcoded static salt | `crypto.ts` |
| 4 | MAJOR | No rate limiting or concurrency control on LLM API calls | `client.ts` |
| 5 | MAJOR | Race condition in usage metering — check-then-act without atomicity | `meter.ts` |
| 6 | MAJOR | Memory system has no per-user privacy scoping | `store.ts` |
| 7 | MAJOR | Temporal client connection has no authentication or TLS | `temporal/client.ts` |
| 8 | MAJOR | Rate limiter is process-local, ineffective in multi-instance | `rate-limit.ts` |
| 9 | MAJOR | No structured logging — sensitive data may leak via console.error | Multiple |
| 10 | MAJOR | Platform fallback API key has no per-user isolation | `resolve.ts` |
| 11 | MINOR | Integration credentials plaintext in memory, validation inconsistency | `integrations/` |
| 12 | MINOR | Environment flags evaluated at module load time | `env.ts` |

**3 Critical**, **7 Major**, **2 Minor**

### Strengths Observed
- BYOK architecture is well-separated (keys → resolve → client) with clear managed vs. user-owned key distinctions
- AES-256-GCM encryption for stored API keys is a strong choice
- Usage metering has a PAYG wallet circuit-breaker pattern for overages
- Memory system degrades gracefully (vector → keyword → empty) without throwing
- Integrations have a clean `ChannelIntegration` interface with dry-run degradation
- `resolveLlm` correctly treats empty string keys as absent (avoiding hang bug)

### Top 3 Recommendations (immediate action)
1. **Add retry with exponential backoff** to the LLM client — the single most impactful reliability fix
2. **Redact API keys from error messages** before they reach logs
3. **Fix the static salt in `crypto.ts`** — use a random per-record salt or enforce hex-encoded 256-bit keys only
