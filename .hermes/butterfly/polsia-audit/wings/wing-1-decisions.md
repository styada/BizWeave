# Wing 1: Decision Log — Agent Pipeline & Business Logic

## Scope Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Included `pipeline/` and `scheduler.ts` as extensions of the agent pipeline | The pipeline DAG engine (`pipeline/index.ts`, `graph.ts`, `steps.ts`) is a second execution path for agents; the scheduler is the trigger. Auditing them together catches the dual-code-path issue (M9). |
| 2 | Included `llm/client.ts` and `llm/resolve.ts` | These are the actual LLM execution layer the pipeline depends on. API key handling (M11) and timeout logic (M2) manifest here. |
| 3 | Excluded `pipeline/tracing.ts` | Tracing is observability infrastructure, not business logic. No critical findings expected in a wrapper around LangSmith spans. |
| 4 | Excluded `usage/meter.ts`, `notify/push.ts`, `compliance/index.ts` | These are supporting modules called BY the guard/executor, not the core pipeline. Their impact is visible through the findings above. |
| 5 | Flagged C2 (fallback cascade) as CRITICAL not MAJOR | Because a demo/sandbox without API keys produces production-grade output marked "live" with fabricated scores, which would be shipped to real businesses. The harm potential (misleading the business owner into trusting template content) is high. |

## Severity Calibration Notes

- **C1** (wallet debit = 0) is CRITICAL because it causes perpetual revenue loss. Only possible mitigations in some business models (free tier, flat subscription) might downgrade it to Major, but the code explicitly tries to debit and fails silently.
- **C3** (dead orchestrator) is CRITICAL because it wastes money on every single pipeline run. For a platform running thousands of businesses daily, this is a material cost.
- **M1** (prompt injection) is MAJOR not CRITICAL because the attacker needs edit access to their own business profile, making it a privilege-escalation vector rather than an unauthenticated one. Still severe.
- **M2** (error swallowing) is MAJOR not CRITICAL because the pipeline still produces output (fallback). The harm is in observability, not correctness.
- **M9** (duplicated code paths) is MAJOR not CRITICAL because both paths currently work. The risk is divergence over time.

## Methodology

- All files listed in the task scope were read in full.
- The `runAgentPipeline` function was traced end-to-end through imports to verify data flow.
- Each Zod schema in `contracts.ts` was checked against its corresponding TypeScript type in `types.ts` for drift.
- The `guardAction` function's callers were searched to verify the choke-point claim.
- Fallback templates were checked for whether their output could trigger auto-publish.
