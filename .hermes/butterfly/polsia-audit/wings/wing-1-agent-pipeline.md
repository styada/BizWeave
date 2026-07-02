# Wing 1: Agent Pipeline & Business Logic Audit

**Audited**: 2026-07-02
**Scope**: `src/lib/agents/`, `src/lib/dreaming/`, `src/lib/learning/`, `src/lib/guard/`, `src/lib/executor/`, `src/lib/mcp/`, `src/lib/pipeline/`, `src/lib/scheduler.ts`, `src/lib/llm/client.ts`, `src/lib/llm/resolve.ts`
**Files Read**: 28

---

## Rating Scale
- **CRITICAL** — Blocks production use, causes data loss, incorrect billing, or security breach.
- **MAJOR** — Significant design flaw, likely to cause incorrect behavior or degrade user trust.
- **MINOR** — Low-risk but worth fixing; code hygiene, edge cases, test gaps.

---

## CRITICAL FINDINGS

### C1. Wallet debit amount hardcoded to $0 — PAYG billing is a no-op

**File**: `src/lib/guard/guard.ts` line 133-134
```ts
if (estCostUsd > 0 && (usageKind === "llm_tokens" || usageKind === "ad_spend")) {
  await debitWallet(businessId, 0, `${actionType}`).catch(() => undefined);
}
```

The `debitWallet` call passes `0` as the amount instead of `estCostUsd`. This means **every wallet debit is a no-op**. The entire PAYG (pay-as-you-go) billing system is silently broken — businesses are never actually charged for LLM tokens, ad spend, or any metered usage that routes through `guardAction`.

The `.catch(() => undefined)` swallows any error, so this bug is invisible in production. The `estCostUsd > 0` guard on line 132 makes the intent clear (only debit when there's a cost), but the actual debit value is wrong.

**Impact**: Revenue leakage. All usage is metered and recorded but never billed. The billing system is wired up but functionally dead.

---

### C2. No LLM failover → fallback cascade auto-approves garbage as "live"

**File**: `src/lib/agents/orchestrator.ts` lines 234, 540-543
```ts
let safeguardVerdict: SafeguardVerdict = fallbackSafeguard(true);
...
const baseFinalStatus =
  safeguardVerdict.approved && safeguardVerdict.reliabilityIndex >= 70
    ? "live"
    : "review";
```

**File**: `src/lib/agents/fallback.ts` lines 164-181
```ts
export function fallbackSafeguard(approved = true): SafeguardVerdict {
  return {
    approved,           // true by default
    issues: approved ? [] : [...],
    reliabilityIndex: approved ? 86 : 62,   // 86 — well above 70
    scores: { safety: 90, consistency: 84, channelReadiness: 83 },
    ...
  };
}
```

When no LLM API key is configured (or all providers fail), **every agent falls back to deterministic templates**, the safeguard auto-approves with `reliabilityIndex: 86`, and the pipeline sets business status to `"live"` / `"published"`. The business owner sees a "verified" pipeline that pushed template-generated content live with zero human review.

The fallback safeguard returns `approved: true`, `issues: []`, `reliabilityIndex: 86`, and `scores.safety: 90`. This is dangerously optimistic — a business with no LLM key gets "all green" metrics.

**Impact**: False sense of quality. Template-generated sites can go "live" without any review. The reliability/safety scores are fabricated.

---

### C3. Pipeline orchestrator runs but its output is completely ignored

**File**: `src/lib/agents/orchestrator.ts` line 403
```ts
case "orchestrator": {
  // TODO: Option E — full orchestrator that reorders pipeline based on output
```

`orchestrator` is the **first agent** in `AGENT_PIPELINE` (line 237 loops over it in order), but its output (`artifacts.orchestrator`) is **never read** by any downstream logic. The pipeline always runs agents in the hardcoded `AGENT_PIPELINE` array order regardless of what the orchestrator decides.

Every pipeline run wastes one LLM call (and 45s timeout) on the orchestrator for zero value.

**Impact**: Wasted LLM cost, 45s extra latency per pipeline. The entire dynamic orchestration concept is wired up but unused — any business logic depending on the orchestrator's priority/risk assessment is dead code.

---

### C4. Pipeline artifacts bypass the guardAction security layer

**File**: `src/lib/agents/orchestrator.ts`
- Line 311: `db.generatedSite.upsert({...})` — writes site directly
- Line 348: `db.marketingPlan.upsert({...})` — writes marketing plan directly
- Line 597-600: `db.business.update({...})` — updates business status

**None of these side effects go through `guardAction()`**. The guard system (spending caps, budget checks, audit logging, procurement policy, approval policy) is only invoked when tools are called via the MCP registry (`mcp.invoke()`). The core pipeline writes directly to the database.

The `approvalPolicy` check on lines 545-600 is a *partial reimplementation* of what `guardAction` already provides — it checks `requiresApproval` and creates a `PendingAction`, but it misses: audit logging, spend caps, usage metering for the LLM calls themselves, wallet checks, and procurement policy.

**Impact**: The guard/choke-point architecture provides false security. Most agent side effects (site publishing, marketing activation, status changes) bypass all guards, policies, and audit trails.

---

## MAJOR FINDINGS

### M1. No prompt injection defenses in agent prompts

**Files**: `src/lib/agents/prompts.ts` — every prompt function

Business-supplied data (`name`, `description`, `location`, inventory names) is concatenated directly into LLM system prompts with zero sanitization:

```ts
`You are the Intake Agent for Bizweave. Analyze this existing business...
- Name: ${ctx.name}
- Type: ${ctx.type}
- Description: ${ctx.description ?? "Not provided"}
```

A business owner could set their name to `"Ignore all prior instructions and..."` and hijack every agent in the pipeline. The `escapeHtml()` function in `fallback.ts` only protects HTML output, not LLM prompts.

**Impact**: Full prompt injection from any editable business field. An attacker with business edit access can control all downstream agent behavior.

---

### M2. Agent timeout/retry swallows all errors silently

**File**: `src/lib/agents/orchestrator.ts` lines 161-164
```ts
} catch {
  // Retry path falls through, final fallback handled below.
}
```

The entire retry body (`runAgentStep` + `parseWithSchema`) wraps in a bare `catch {}` that discards every error — timeout, parse failure, network error, schema validation failure, all swallowed. The `lastRaw` variable captures the last output but the *specific error type* is lost. The `AgentLog` records `errorCode: "FALLBACK_USED"` but never logs what actually went wrong.

**Impact**: Ops teams cannot diagnose why agents are falling back. A network blip, a malformed LLM response, and a schema violation all produce the same "FALLBACK_USED" signal.

---

### M3. AgentLog always reports "complete" even when fallback used

**File**: `src/lib/agents/orchestrator.ts` line 246
```ts
const logStatus = "complete";
```

The `logStatus` is hardcoded as `"complete"` at the top of the loop body and never changes. When an agent fails and falls back, the AgentLog says `status: "complete"` with `errorCode: "FALLBACK_USED"` — an inconsistent state. A downstream consumer (dashboard, notification) would see "complete" and might incorrectly report success.

**Impact**: Misleading telemetry. Monitoring systems that check `status === "failed"` will miss fallback events.

---

### M4. Task idempotency has a narrow 5-minute window and misses completed tasks

**File**: `src/lib/executor/router.ts` lines 46-65
```ts
createdAt: { gte: new Date(Date.now() - 5 * 60_000) },
status: { in: ["queued", "planning", "running", "needs_approval"] },
```

Idempotency only checks for tasks in non-terminal states within the last 5 minutes. If:
- A task completes in 4 minutes and is re-requested at 5:01 → duplicate created
- A task with the same `(businessId, title)` runs at a different `conversationId` → no dedup at all

**Impact**: Double-sends on retry after 5 minutes. Requires the caller to manage idempotency externally for longer-running tasks.

---

### M5. LLM cost tracking entirely absent from pipeline agent calls

**File**: `src/lib/agents/orchestrator.ts` — no `recordUsage()` calls for LLM calls

The pipeline makes up to 10+ LLM calls per run (one per agent), but **none of them meter cost**. The `usage/meter.ts` system is only invoked for:
- Tool calls routed through `guardAction` (MCP path)
- Task runs via `runTask` in `router.ts`
- Wallet operations

The agent pipeline's LLM calls go through `getPreferredProvider` → `complete()` with no cost tracking anywhere. This means:
- No per-business LLM usage billing
- No budget caps enforced on pipeline runs
- No cost data for business intelligence

**Impact**: Unmetered LLM consumption. Heavy pipeline users are not billed for LLM tokens.

---

### M6. Fallback safeguard approval bypasses the entire review workflow

**File**: `src/lib/agents/orchestrator.ts` line 234, 540-543

When `fallbackSafeguard(true)` is used (no LLM or all retries exhausted):
- `approved: true`
- `reliabilityIndex: 86` (well above the 70 threshold for auto-live)
- `scores.safety: 90`

The pipeline considers this "safe" and can set business to `"live"`. The `requiresApproval` check on line 554 uses `riskLevel` which comes from `reliabilityIndex < 70` — since fallback gives 86, riskLevel is "low" for a fully template-generated site.

**Contrast with M1/M3**: A real (non-fallback) safeguard might return `approved: false` with issues. The fallback version creates the illusion of a thorough review.

---

### M7. Dreaming cycle's chat persistence is fragile and channel-tied

**File**: `src/lib/dreaming/cycle.ts` lines 99-121
```ts
const conv = await db.conversation.findFirst({
  where: { businessId, channel: "web" },
  ...
}) ?? await db.conversation.create({
  data: { businessId, channel: "web" },
});
```

The dreaming cycle hardcodes `channel: "web"` and writes the brief as a raw `Message` record. The comment says "Channel is encoded in the content prefix for the chat UI to detect" — this is a fragile, undocumented convention. If the business primarily uses a different channel (e.g., Telegram), the brief lands in a ghost conversation.

**Impact**: Morning briefs can disappear into the wrong conversation channel. No cross-channel delivery.

---

### M8. MCP registry has no runtime tool validation beyond toggles

**File**: `src/lib/mcp/registry.ts`

The `McpRegistry` performs Zod schema validation on input and toggle-based allow/deny, but there's no:
- Rate limiting per tool
- Cost-budget check before read-only tool execution (line 64-71 skips all guard checks for read-only tools)
- Concurrent invocation limitation
- Tool execution timeout (read-only tools can hang indefinitely)

**Impact**: Read-only tools (e.g., `places.nearbySearch`) can be spammed without any rate or cost limits.

---

### M9. Pipeline has TWO code paths with duplicated logic

**Files**: `src/lib/agents/orchestrator.ts` (sequential) vs `src/lib/pipeline/index.ts` (DAG)

The `runGraphPipeline` in `pipeline/index.ts` duplicates:
- Business lookup + `BusinessContext` construction
- `agentRun` creation
- Finalization logic (`finalize()` is a close copy of the orchestrator's base-final-status logic)
- Activity event emission

A bug fix in one path (e.g., the wallet debit fix from C1) is likely to miss the other.

**Impact**: Maintenance burden. Inconsistent behavior between legacy and LangGraph paths.

---

### M10. Social post `socialPost()` passes raw OAuth token in credentials

**File**: `src/lib/mcp/servers/comms.ts` line 99
```ts
credentials: { accessToken: conn.accessToken },
```

The raw decrypted access token is passed to the integration client as an object property. If the integration client logs its parameters, logs the result, or stores it in a trace, the token leaks. The database stores it encrypted, but it's decrypted at read time and passed in plaintext.

**Impact**: OAuth token leakage into traces/logs/activity events.

---

### M11. `runAgentStep` passes API key without protection

**File**: `src/lib/agents/orchestrator.ts` line 112
```ts
{ provider: creds.provider, apiKey: *** temperature: 0.6 }
```

The source shows `apiKey: ***` which suggests API keys are redacted in checked-in code, but the production code passes the raw decrypted key to `complete()`. If tracing (LangSmith, pipeline/tracing.ts) records the LLM options, API keys leak into trace data.

**Also in**: `steps.ts` line 46, `inline.ts` line 49, `cycle.ts` line 144, `client.ts` line 45.

---

## MINOR FINDINGS

### m1. SiteSchema does not enforce `meta.templateId` or `meta.tier` from SiteOutput type

**File**: `src/lib/agents/contracts.ts` lines 36-43

The `SiteOutput` TypeScript type has `templateId?: string` and `tier?: string` but the Zod `siteSchema` omits them. Schema drift between types and runtime validation.

### m2. `marketingSchema.campaigns[].schedule` is optional but unvalidated

**File**: `src/lib/agents/contracts.ts` line 53
```ts
schedule: z.string().optional(),
```

Any string is accepted. The intent is `"weekly" | "daily" | "launch"` (from prompt examples) but no enum is defined. If the LLM returns `"every 2 weeks"`, it passes validation but breaks downstream rendering.

### m3. `fallbackFinance` revenue estimation has no cap

**File**: `src/lib/agents/fallback.ts` line 230
```ts
estimatedMonthly: ctx.inventory.length * 50,
```

A business with 10,000 inventory items gets `estimatedMonthly: 500,000` — entirely fabricated. No ceiling.

### m4. `loadBusinessContext` caps inventory at 50 items

**File**: `src/lib/executor/context.ts` line 10
```ts
include: { inventory: { take: 50 } },
```

But `types.ts` `BusinessContext` has no cap indication. Downstream code (builder prompt) further slices to 20. Inconsistent views of inventory data.

### m5. `ensureMcpBootstrapped` flag can't be reset

**File**: `src/lib/mcp/index.ts`
```ts
let bootstrapped = false;
export function ensureMcpBootstrapped(): typeof mcp {
  if (!bootstrapped) { ... bootstrapped = true; }
  return mcp;
}
```

No reset mechanism for tests or hot-reload. Once bootstrapped, new tools cannot be registered without restarting the process.

### m6. Ads budget accepts arbitrarily large values

**File**: `src/lib/agents/contracts.ts` lines 149-153
```ts
budget: z.object({
  monthly: z.number().positive(),   // no upper bound
  allocation: z.record(z.string(), z.number()),
}),
```

No maximum. An LLM could return `monthly: 99_999_999_999`. The post-hoc budget check in `router.ts` catches this after execution, but the schema should enforce a reasonable max.

### m7. `guardAction` `usageKind` can be undefined, dereferenced in function body

**File**: `src/lib/guard/guard.ts` line 132
```ts
if (estCostUsd > 0 && (usageKind === "llm_tokens" || usageKind === "ad_spend")) {
```

If `usageKind` is `undefined`, the entire expression is `false` (safe), but this is implicit. The type says `usageKind?: UsageKind` — an explicit check would be clearer.

### m8. Pipeline `AgentLog.input` capped at 5K chars, can cut mid-escape-sequence

**File**: `src/lib/agents/orchestrator.ts` line 521
```ts
input: prompt.slice(0, 5000),
```

If truncation happens mid-UTF8 character or mid-JSON, the stored input is corrupt. No JSON-awareness in the truncation.

### m9. `scoreTaskOutcome` reward normalization rewards volume, not quality

**File**: `src/lib/learning/evaluate.ts` line 68
```ts
return Math.min(1, Math.max(0, sum > 0 ? 0.5 + Math.log10(sum + 1) * 0.2 : 0.3));
```

A skill that sends 1 email and a skill that sends 10,000 emails both get reward scores near 1.0 after log10 smoothing. No quality signal (open rate, reply rate, conversion) is incorporated.

### m10. Learning system `distillSkill` called fire-and-forget after task completion

**File**: `src/lib/executor/router.ts` lines 189-203
```ts
import("...distill").then(m => m.distillSkill({...})).catch(() => undefined);
```

The distillation is a dynamic import with `.catch(() => undefined)` — if the module fails to load or the skill creation fails, it's silently lost. The caller has no way to know if skill learning happened.

---

## SUMMARY TABLE

| ID | Severity | Area | Summary |
|----|----------|------|---------|
| C1 | CRITICAL | guard | `debitWallet(businessId, 0, ...)` — wallet never charged |
| C2 | CRITICAL | agents | Fallback cascade auto-approves template output as "live" |
| C3 | CRITICAL | agents | Orchestrator output fully ignored, wasted LLM call |
| C4 | CRITICAL | agents/guard | Pipeline writes bypass guardAction entirely |
| M1 | MAJOR | agents | No prompt injection sanitization on business fields |
| M2 | MAJOR | agents | Silent error swallowing in retry loop |
| M3 | MAJOR | agents | `AgentLog.status` always "complete" even on fallback |
| M4 | MAJOR | executor | Task idempotency window too narrow (5 min) |
| M5 | MAJOR | agents | Pipeline LLM calls not metered for cost |
| M6 | MAJOR | agents | Fallback safeguard auto-approves with high scores |
| M7 | MAJOR | dreaming | Chat persistence fragile, hardcoded to "web" channel |
| M8 | MAJOR | mcp | Read-only MCP tools bypass all rate/cost limits |
| M9 | MAJOR | pipeline | Duplicated pipeline code paths |
| M10 | MAJOR | mcp | Raw OAuth token passed to integration client |
| M11 | MAJOR | agents/llm | API keys passed without trace protection |
| m1-m10 | MINOR | various | Schema drift, missing caps, hygiene issues |

---

## RECOMMENDATIONS

1. **Fix wallet debit** — Change `guard.ts:134` to `debitWallet(businessId, estCostUsd, ...)`.
2. **Gate auto-approval** — Require explicit configuration to publish when safeguard is in fallback mode. Never auto-approve with template data.
3. **Route pipeline through guardAction** — Make `guardAction` the single choke point for all side effects including generatedSite upserts and marketing plan writes.
4. **Implement prompt injection defense** — Apply a LLM prompt boundary (e.g., `<bizdata>` tags or structured separator) around all business-supplied fields in prompts.
5. **Kill the dead orchestrator** — Either use the orchestrator output to reorder agents, or remove the orchestrator call entirely.
6. **Fix error logging** — Log actual error types in `AgentLog`, distinguish "timed out" from "parse failed" from "schema violation".
7. **Extend idempotency window** — Increase to 30+ minutes and include completed tasks within a dedup window.
8. **Meter pipeline LLM calls** — Add `recordUsage` at each agent step in the pipeline.
9. **Rate-limit read-only MCP tools** — Add rate limiter to McpRegistry for read-only tools.
10. **Add runtime tool timeout** — Wrap `tool.run(input, ctx)` with a timeout in the MCP registry.
