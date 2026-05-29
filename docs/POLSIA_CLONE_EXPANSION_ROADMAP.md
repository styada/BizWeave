# Polsia Clone Expansion Roadmap (What to Add Next + How to Do It Better)

Date: 2026-05-28
Source Inputs:
- polsia_technical_deep_dive.md
- Current repo implementation (routes, schema, orchestrator, UI)

## Goal

Close feature parity gaps with Polsia while intentionally improving reliability, governance, and portability so Bizweave is safer and more trustworthy.

## Current Baseline (Already Strong)

- Multi-step agent pipeline with contract validation and fallback support
- Reliability-focused safeguard output (Trust Index)
- Business onboarding and multi-business data model foundations
- Unit and integration tests for core agent paths
- Containerization and local development automation

## High-Value Features Still Missing for Parity

## 1) Autonomous Scheduling Engine (Core Parity)

What to clone:
- Fixed cadence execution per agent (2h/3h/6h/daily/twice-daily)
- Central scheduler with run state transitions

Current gap:
- Runs are still manually triggered over HTTP

Implementation:
- Add Redis + BullMQ worker service
- Add Job tables: `ScheduledTask`, `TaskExecution`
- Add scheduler loop and worker processors
- Convert route trigger to enqueue-only behavior

Do better than Polsia:
- Add global pause switch per business
- Add spend-sensitive action freeze windows (nights/weekends)

## 2) Persistent Agent Memory Threads (Core Parity)

What to clone:
- Shared memory layer across agent cycles
- Context carry-forward (competitor findings -> strategy -> outreach)

Current gap:
- Runs are mostly stateless across cycles

Implementation:
- Add memory tables: `MemoryThread`, `MemoryEntry`, `MemorySnapshot`
- Add retrieval utility with recency + relevance weighting
- Inject memory context into each agent prompt step

Do better than Polsia:
- Memory TTL and pruning policy
- Explainable memory citations in outputs (which memory items affected decisions)

## 3) Real Integrations Layer (Core Parity)

What to clone:
- GitHub actions (commit/PR)
- Email send and inbox handling
- Stripe revenue sync
- Ads platform sync and optimization
- Social posting

Current gap:
- Only LLM API key integration is implemented

Implementation:
- Create `src/lib/integrations/` providers for GitHub, email, Stripe, ads, social
- Add OAuth token storage + refresh flow
- Add integration health checks and webhook receivers

Do better than Polsia:
- Dry-run mode for every integration action
- Provider-level circuit breakers and automatic retry backoff

## 4) Action Approval and Risk Controls (Parity + Improvement)

What to clone:
- Autonomous execution of operational tasks

Current gap:
- No pre-execution approval policy layer for risky actions

Implementation:
- Add `ApprovalPolicy` and `PendingAction` models
- Add preflight policy engine for actions tagged high-risk
- Add dashboard review queue

Do better than Polsia:
- Mandatory approval for:
  - sending investor/press emails
  - ad budget increases above threshold
  - changes to pricing/offers
- Two-step confirmation for irreversible actions

## 5) Live Activity Stream (Parity)

What to clone:
- Public/private feed of agent actions and outcomes

Current gap:
- No event stream surface today

Implementation:
- Add `ActivityEvent` model
- Emit typed events from orchestrator and integrations
- Build stream endpoint + dashboard panel

Do better than Polsia:
- Include failure and rollback events, not only success events
- Redaction rules for sensitive content before display

## 6) Credits, Billing, and Metering (Parity)

What to clone:
- Credit-based on-demand tasks + recurring plan model

Current gap:
- No subscription/credit ledger implemented

Implementation:
- Stripe Billing integration
- `Subscription`, `CreditLedger`, `UsageEvent` tables
- Enforce credit checks on on-demand runs

Do better than Polsia:
- Auto-refund credits for failed tasks by policy
- Explicit cost estimate before run for high-compute workflows

## 7) Multi-Company Operations Console (Parity)

What to clone:
- Run multiple companies under one account

Current gap:
- Data model supports this, but no control plane exists

Implementation:
- Add cross-company dashboard with health, spend, and run status
- Add per-company quotas and budget caps

Do better than Polsia:
- Portfolio-level budget guardrails and anomaly alerts

## 8) Data Portability and Exit Safety (Improvement Differentiator)

What to clone:
- Polsia users report lock-in risk; this is where we should be better

Implementation:
- Add export endpoint per business and global export per user
- Export package includes: inventory, runs, artifacts, logs, integration config metadata
- Provide signed downloadable archive

Why this matters:
- Trust and enterprise readiness
- Strong product differentiation versus lock-in concerns

## 9) Demand Validation Gate Before Spend (Major Improvement)

What to improve beyond Polsia:
- Add mandatory hypothesis checks before ad spend/outreach at scale

Implementation:
- Add pre-launch validation workflow:
  - ICP definition
  - value proposition tests
  - landing conversion threshold
- Require pass criteria before enabling autonomous paid acquisition

Outcome:
- Prevents fast execution of weak business assumptions

## 10) Audit, Compliance, and Rollback Framework (Major Improvement)

What to improve beyond Polsia:
- Strong governance for real-world autonomous actions

Implementation:
- Immutable action log with actor, policy, and decision trace
- Rollback playbooks per integration type
- Sensitive communication templates with compliance checks

Outcome:
- Safer autonomy and clearer accountability

## Prioritized Build Order

## Phase 1 (2-3 weeks): Reliability Foundation
- Scheduler + queue backbone
- Structured activity events
- Pre-execution approval policy

## Phase 2 (3-5 weeks): Execution Depth
- GitHub + Email + Stripe integrations
- Multi-company operations console v1
- Credit ledger + usage metering

## Phase 3 (4-6 weeks): Intelligence Layer
- Persistent memory threads
- Competitor/finance/research specialized agents
- Memory-aware orchestrator planning

## Phase 4 (2-3 weeks): Differentiation and Trust
- Data export and portability workflows
- Demand validation gate
- Compliance and rollback framework

## New Agent Roles to Add for Better Parity

- Outreach Agent (cold + warm outbound)
- Ads Agent (budget and campaign optimizer)
- Finance Agent (revenue/spend snapshots + anomalies)
- Competitor Research Agent (daily market updates)
- Orchestrator Agent (top-level planner with conflict resolution)

## Acceptance Criteria for "Polsia Clone, But Better"

- Autonomous schedules run reliably with retries and dead-letter handling
- High-risk actions require policy-driven approvals
- Integrations execute real actions with audit trails and rollback paths
- Cross-company control center exists with quotas and portfolio metrics
- Export and portability are first-class and tested
- Validation gates prevent autonomous spend on unproven assumptions

## Success Metrics

- 95%+ scheduled runs complete without manual intervention
- <1% irreversible action error rate
- 100% high-risk actions pass through approval policy
- 100% failed billable tasks auto-credit refunded
- Time to export full business data package <2 minutes
