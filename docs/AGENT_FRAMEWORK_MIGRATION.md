# Agent Framework Migration: DIY → LangGraph + LangSmith

> **Status:** Draft for review  
> **Target:** Replace `src/lib/agents/orchestrator.ts` and `src/lib/scheduler.ts` with LangGraph JS  
> **Estimated effort:** 3-5 days  
> **Risk:** Medium — pipeline logic is isolated, no external API contract changes

---

## Why Migrate

| Concern | DIY Cost | LangGraph Benefit |
|---|---|---|
| **Observability** | Manual `emitActivity()` + `AgentLog` table — no traces, no latency breakdowns, no token tracking | LangSmith gives automatic traces, token counts, latency histograms, failure analysis |
| **Durable execution** | Pipeline lost on server crash — no checkpointing | Built-in checkpointing — resumes exactly where it left off |
| **Retry / backoff** | Manual `STEP_MAX_ATTEMPTS` loop + hand-rolled exponential backoff | Automatic configurable retry with jitter |
| **Human-in-the-loop** | `PendingAction` table + manual approval endpoints | `interrupt()` / `Command(resume=true)` — framework-managed pauses |
| **Scheduler** | Custom `queueDueScheduledTasks` + `processExecution` + worker loop | `@langchain/langgraph-sdk` cron triggers + durable scheduled execution |
| **Maintenance burden** | ~700 lines of bespoke orchestration we own | Zero — LangChain Inc maintains it |
| **Edge cases** | We discover them in production | Battle-tested at Replit, Uber, LinkedIn, GitLab |

---

## What Stays the Same

These are **product logic**, not infrastructure — they survive the migration unchanged:

| File | Why It Stays |
|---|---|
| `src/lib/agents/prompts.ts` | Agent system prompts are product IP |
| `src/lib/agents/contracts.ts` | Zod schemas for agent output validation — used inside LangGraph nodes |
| `src/lib/agents/fallback.ts` | Fallback templates for demo mode — critical BYOK differentiator |
| `src/lib/agents/types.ts` | Type definitions shared across the system |
| `src/lib/llm/client.ts` | `complete()` + `testConnection()` — our BYOK LLM abstraction |
| `src/lib/llm/keys.ts` | `getPreferredProvider()` — BYOK key management |
| `src/lib/crypto.ts` | API key encryption |
| `src/lib/db.ts` | Prisma client — LangGraph reads/writes state via our DB |
| `src/app/api/` route handlers | API contracts don't change — only the internal implementation they call |
| ActivityEvent table | Still written to for dashboard visibility (in addition to LangSmith traces) |

---

## What Changes

### Files to Create

| New File | Purpose |
|---|---|
| `src/lib/agents/langgraph.ts` | LangGraph `StateGraph` definition — the new pipeline |
| `src/lib/agents/nodes/` | One file per agent node (intake, planner, builder, marketing, support, safeguard) |
| `src/lib/agents/scheduler-v2.ts` | LangGraph-based scheduler replacing `scheduler.ts` |

### Files to Modify

| File | Change |
|---|---|
| `src/lib/agents/orchestrator.ts` | Gut the pipeline logic; keep only a thin `runAgentPipeline()` wrapper that invokes the LangGraph graph |
| `src/lib/scheduler.ts` | Replace `processExecution()` body with LangGraph invocation; keep `bootstrapBusinessAutomation()` and `enqueueBusinessRun()` as thin wrappers |
| `package.json` | Add `@langchain/langgraph`, `@langchain/core`, `@langchain/langgraph-sdk` |
| `src/lib/agents/__tests__/*` | Rewrite integration tests to exercise the graph instead of the old pipeline |

### Files to Delete

| File | Lines Removed | Reason |
|---|---|---|
| `src/lib/agents/orchestrator.ts` (~250 lines) | ~200 | Pipeline logic replaced by LangGraph; only thin wrapper remains |
| `src/lib/scheduler.ts` (~200 lines) | ~150 | `processExecution()`, `processExecutionById()`, `processQueuedExecutions()` replaced |
| `scripts/scheduler-worker.mjs` (~50 lines) | ~50 | Replaced by LangGraph cron triggers |

**Net deletion: ~400 lines of bespoke orchestration.**

---

## Migration Phases

### Phase 0 — Foundation (½ day)

**Goal:** Install deps, define the graph skeleton, verify it compiles and runs in isolation.

```bash
npm install @langchain/langgraph @langchain/core @langchain/langgraph-sdk
```

**Steps:**

1. Install new npm packages
2. Create `src/lib/agents/nodes/` directory
3. Create `src/lib/agents/langgraph.ts` with a minimal `StateGraph` definition
4. Define the shared graph state type (mirrors current `artifacts` object)
5. Verify `npx tsc --noEmit` passes

**Graph state type** (lives in `langgraph.ts`):

```typescript
import { type AgentId, type IntakeOutput, type PlannerOutput, 
         type SiteOutput, type MarketingOutput, type SupportOutput, 
         type SafeguardVerdict } from "./types";

export type AgentState = {
  businessId: string;
  userId: string;
  useLlm: boolean;
  intake?: IntakeOutput;
  plan?: PlannerOutput;
  site?: SiteOutput;
  marketing?: MarketingOutput;
  support?: SupportOutput;
  safeguard?: SafeguardVerdict;
  errors: { agent: AgentId; message: string }[];
};
```

---

### Phase 1 — Agent Nodes (1 day)

**Goal:** One LangGraph `NodeFunction` per agent. Each node wraps the existing prompt + LLM call + Zod validation + fallback logic.

**Pattern for each node:**

```typescript
// src/lib/agents/nodes/intake.node.ts
import { RunnableConfig } from "@langchain/core/runnables";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { complete } from "@/lib/llm/client";
import { getPreferredProvider } from "@/lib/llm/keys";
import { intakePrompt } from "../prompts";
import { intakeSchema, parseWithSchema } from "../contracts";
import { fallbackIntake } from "../fallback";
import type { AgentState } from "../langgraph";

export async function intakeNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const ctx = await loadBusinessContext(state.businessId); // moved from orchestrator
  const prompt = intakePrompt(ctx);
  
  if (!state.useLlm) {
    const fallback = fallbackIntake(ctx);
    return { intake: fallback };
  }

  const creds = await getPreferredProvider(state.userId);
  if (!creds) {
    return { intake: fallbackIntake(ctx) };
  }

  const raw = await complete(
    [{ role: "system", content: "You are a specialized AI agent for Bizweave." },
     { role: "user", content: prompt }],
    { provider: creds.provider, apiKey: creds.apiKey, temperature: 0.6 }
  );

  const result = parseWithSchema(raw.content, intakeSchema, fallbackIntake(ctx));
  return { intake: result.value };
}
```

**6 nodes to create:**

| File | Wraps |
|---|---|
| `nodes/intake.node.ts` | `intakePrompt` + `intakeSchema` + `fallbackIntake` |
| `nodes/planner.node.ts` | `plannerPrompt` + `plannerSchema` + `fallbackPlan` |
| `nodes/builder.node.ts` | `builderPrompt` + `siteSchema` + `fallbackSite` + `GeneratedSite` upsert |
| `nodes/marketing.node.ts` | `marketingPrompt` + `marketingSchema` + `fallbackMarketing` + `MarketingPlan` upsert |
| `nodes/support.node.ts` | `supportPrompt` + `supportSchema` + `fallbackSupport` |
| `nodes/safeguard.node.ts` | `safeguardPrompt` + `safeguardSchema` + `fallbackSafeguard` + approval logic |

**Key detail:** The `builder` and `marketing` nodes perform DB upserts (writing `GeneratedSite` and `MarketingPlan`). Keep that logic inside the node — it's product behavior, not infrastructure.

---

### Phase 2 — Wire the Graph (½ day)

**Goal:** Connect nodes into a sequential graph in `langgraph.ts`.

```typescript
// src/lib/agents/langgraph.ts
import { StateGraph, END } from "@langchain/langgraph";
import { intakeNode } from "./nodes/intake.node";
import { plannerNode } from "./nodes/planner.node";
import { builderNode } from "./nodes/builder.node";
import { marketingNode } from "./nodes/marketing.node";
import { supportNode } from "./nodes/support.node";
import { safeguardNode } from "./nodes/safeguard.node";
import type { AgentState } from "./types";

const workflow = new StateGraph<AgentState>({
  channels: {
    // Define state channels per LangGraph convention
  }
})
  .addNode("intake", intakeNode)
  .addNode("planner", plannerNode)
  .addNode("builder", builderNode)
  .addNode("marketing", marketingNode)
  .addNode("support", supportNode)
  .addNode("safeguard", safeguardNode)
  .addEdge("intake", "planner")
  .addEdge("planner", "builder")
  .addEdge("builder", "marketing")
  .addEdge("marketing", "support")
  .addEdge("support", "safeguard")
  .addConditionalEdges("safeguard", (state) => {
    // Route to END, or to a human_interrupt node
    if (state.safeguard?.approved === false) {
      return "needs_approval";
    }
    return END;
  })
  .setEntryPoint("intake");

export const agentGraph = workflow.compile();
```

**Update `orchestrator.ts`** to a thin wrapper:

```typescript
export async function runAgentPipeline(businessId: string, userId: string, options?: { taskExecutionId?: string }) {
  const business = await loadBusinessContext(businessId);
  const creds = await getPreferredProvider(userId);
  
  const run = await db.agentRun.create({ data: { businessId, status: "running", taskExecutionId: options?.taskExecutionId } });

  const result = await agentGraph.invoke({
    businessId,
    userId,
    useLlm: !!creds,
    errors: [],
  });

  // Map LangGraph result back to our DB models (status updates, AgentLog entries)
  await finalizeRun(run.id, result);

  return { runId: run.id, ...result.safeguard };
}
```

---

### Phase 3 — Human-in-the-Loop (½ day)

**Goal:** Replace `PendingAction` approval flow with LangGraph `interrupt()`.

```typescript
// In safeguard.node.ts, instead of writing to PendingAction:
import { interrupt } from "@langchain/langgraph";

if (needsApproval) {
  const decision = await interrupt({
    actionType: "publish_artifacts",
    riskLevel,
    payload: { reliabilityIndex, issues, revisions },
  });
  
  if (decision !== "approve") {
    return { safeguard: { ...result, approved: false } };
  }
}
```

Keep the `PendingAction` table for dashboard visibility, but the **source of truth** for flow control moves to LangGraph's interrupt mechanism.

**API changes:** The approval endpoints (`POST /api/businesses/:id/approvals`) now call `graph.resume()` instead of directly updating `PendingAction`.

---

### Phase 4 — Scheduler Migration (1 day)

**Goal:** Replace custom scheduler with LangGraph's cron + durable execution.

**New approach:**

```typescript
// src/lib/agents/scheduler-v2.ts
import { scheduledCron } from "@langchain/langgraph-sdk";

export function registerScheduledTasks(businessId: string) {
  return scheduledCron({
    agentGraph,                    // our compiled graph
    cronExpression: "0 */12 * * *", // twice daily
    input: { businessId, useLlm: true },
    name: `biz-${businessId}-orchestrator`,
    onError: "RETRY",              // LangGraph handles retries
  });
}
```

**What this eliminates:**
- `queueDueScheduledTasks()` — LangGraph cron handles scheduling
- `processExecution()` — LangGraph durable execution handles retry
- `processExecutionById()` — LangGraph SDK handles manual triggers
- `scheduler-worker.mjs` — no worker needed
- `TaskExecution` table — LangGraph's own checkpoint store replaces it

**What we keep:**
- `bootstrapBusinessAutomation()` — still creates `ScheduledTask` rows for dashboard visibility
- `enqueueBusinessRun()` — still creates an immediate run record

---

### Phase 5 — LangSmith Observability (½ day)

**Goal:** Get full trace visibility with zero custom logging.

```typescript
// In langgraph.ts, when compiling the graph:
import { LangSmithTracer } from "@langchain/langgraph-sdk";

export const agentGraph = workflow.compile({
  tracer: new LangSmithTracer({
    projectName: "bizweave",
    // LANGCHAIN_API_KEY and LANGCHAIN_ENDPOINT from env
  }),
});
```

**What you get automatically:**
- Trace per pipeline run with span per agent step
- Token counts per LLM call (model, input tokens, output tokens)
- Latency per step (p50/p95/p99)
- Failure rates with stack traces
- Cost tracking by pipeline run
- Search/filter by business ID, user ID, or agent

**What happens to `ActivityEvent`:** Keep writing to it for the dashboard UI — but now it's a **consumer** of the pipeline, not a **producer** of observability. The observability source of truth is LangSmith.

---

### Phase 6 — Cleanup (½ day)

Delete dead code:

| File | Action |
|---|---|
| `scripts/scheduler-worker.mjs` | Delete — replaced by LangGraph cron |
| `src/lib/scheduler.ts` | Gut — remove `processExecution()`, `processExecutionById()`, `processQueuedExecutions()`, `queueDueScheduledTasks()` |
| `src/lib/agents/orchestrator.ts` | Gut — remove the pipeline switch statement, keep thin wrapper |
| `@prisma/adapter-pg` | Optionally remove if no longer needed (LangGraph uses its own checkpoint store) |

Update tests:

- `orchestrator.integration.test.ts` → Replace `runAgentPipeline()` mock with graph invocation
- `scheduler.test.ts` → Replace `runAgentPipeline` mock with LangGraph SDK mocks
- Add new test: `langgraph.test.ts` — test the graph compiles and nodes produce valid output

---

## Rollback Plan

If the migration causes issues, the rollback is straightforward:

1. **Feature flag** — Add `USE_LANGGRAPH` env var (default `false` during migration, flip to `true` when ready)
2. **Side-by-side** — Run both pipelines for a transition period, compare outputs
3. **Rollback** — Set `USE_LANGGRAPH=false`, restart. The old `orchestrator.ts` and `scheduler.ts` are still present during the migration window

```typescript
// In the thin wrapper:
export async function runAgentPipeline(...args) {
  if (process.env.USE_LANGGRAPH === "true") {
    return runLangGraph(...args);
  }
  return runLegacyPipeline(...args);  // old code still there
}
```

---

## Timeline

| Phase | Effort | Depends On |
|---|---|---|
| 0 — Foundation | ½ day | Nothing |
| 1 — Agent Nodes | 1 day | Phase 0 |
| 2 — Wire the Graph | ½ day | Phase 1 |
| 3 — Human-in-the-Loop | ½ day | Phase 2 |
| 4 — Scheduler | 1 day | Phase 2 |
| 5 — LangSmith | ½ day | Phase 2 |
| 6 — Cleanup | ½ day | Phase 3-5 |
| **Total** | **4-5 days** | |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LangGraph API changes during migration | Low | Medium | Pin exact version in `package.json` |
| BYOK compatibility — LangGraph expects provider API key at init, not per-call | Medium | High | Our `complete()` abstraction wraps the LLM call — LangGraph only orchestrates; the actual LLM call still goes through our BYOK layer |
| Checkpoint store migration (Prisma → LangGraph store) | Medium | Medium | LangGraph supports custom checkpointers; can implement a Prisma-backed checkpointer if needed |
| Existing in-flight `AgentRun` records break | Low | High | All in-flight runs complete before cutover. Feature flag prevents new runs on old path after switch |
| LangSmith cost | Low | Low | Pay-as-you-go; monitor and cap monthly spend |

---

## Decision Checklist

Before giving the go-ahead, verify:

- [ ] `@langchain/langgraph` and `@langchain/core` added to `package.json`
- [ ] Phase 0 compiles with `npx tsc --noEmit`
- [ ] Phase 1-2 produces identical output to legacy pipeline for a test business
- [ ] Phase 3 approval flow works in dashboard
- [ ] Phase 4 scheduler triggers runs on cron
- [ ] Phase 5 traces appear in LangSmith dashboard
- [ ] `USE_LANGGRAPH` feature flag works (can flip back and forth)
- [ ] All existing tests pass
- [ ] New tests added for graph nodes

---

## Appendix: Key LangGraph Concepts for This Migration

| Concept | What It Maps To |
|---|---|
| `StateGraph` | The pipeline — holds shared state across all agents |
| `Node` | One agent step (Intake, Planner, etc.) |
| `Channel` | A field in the state that nodes read/write |
| `Edge` | The sequential flow between nodes |
| `ConditionalEdge` | Safeguard's approve/deny routing |
| `interrupt()` | Human-in-the-loop pause for approvals |
| `Checkpointer` | Durable execution — saves state after each node |
| `LangSmithTracer` | Automatic observability |
| `scheduledCron()` | Replaces our custom scheduler |
