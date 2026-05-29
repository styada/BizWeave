# Technical Execution Plan: Parity + Reliability Upgrade

Date: 2026-05-28

## Objective

Bring Bizweave to Polsia-style feature parity in core agent workflows while improving reliability, observability, and deployment reproducibility.

## Guiding Principles

- Reliability before novelty: every new capability must include tests and fallback behavior.
- Explainability by default: every major run must produce human-readable diagnostics.
- Reproducibility first: local environments should be one-command startup.

## Workstreams

## 1) Agent Runtime and Contracts

Deliverables:
- Contract schemas for Intake, Planner, Builder, Marketing, Support, Safeguard
- Contract-safe JSON extraction/parsing utility
- Step runtime envelope:
  - bounded retries
  - bounded timeout
  - deterministic fallback if LLM fails or schema invalid
- Structured run logging for each step

Acceptance:
- Any invalid/garbled model output never crashes the full run unexpectedly.
- Final run always resolves to complete/review/failed with clear reason.

## 2) Reliability USP (“Trust Index”)

Deliverables:
- Safeguard output extended with:
  - reliabilityIndex (0-100)
  - score categories (safety, consistency, channelReadiness)
  - top operational risks and remediation actions
- UI card in business details to expose index and actionables

Acceptance:
- Every run exposes a reliability index, even in fallback mode.

## 3) Test Architecture

Deliverables:
- Unit tests:
  - JSON extraction + schema parsing
  - fallback contract validity
- Integration tests:
  - orchestrator path with mocked LLM/DB boundaries
  - run state and artifact persistence behavior
- Playwright e2e:
  - landing page smoke
  - auth page interactions
  - onboarding happy path structure checks

Acceptance:
- CI-compatible test commands pass locally.

## 4) Runtime Infra (Docker + Postgres)

Deliverables:
- Dockerfile for app runtime
- docker-compose with app + postgres
- env template for postgres-first setup

Acceptance:
- `docker compose up --build` boots complete stack.

## 5) Developer Experience and Automation

Deliverables:
- Makefile targets for:
  - install/setup
  - db push/generate
  - lint/test/e2e
  - compose up/down/logs

Acceptance:
- Team can onboard and verify app in under 10 minutes.

## 6) UI Refinement

Deliverables:
- Dashboard detail improvements for reliability outputs
- Clean, fluid, futuristic but minimal visual language preserved

Acceptance:
- Reliability signals are prominent without cluttering workflow.

## Execution Order

1. Contracts + orchestrator reliability
2. Reliability USP surfacing
3. Test framework and tests
4. Docker + Postgres + Makefile
5. UI polish and docs alignment
6. Full verification run and fixes

## Progress Update (2026-05-28)

Completed in code:
- Activity event foundation added (schema + event emission during run lifecycle)
- Approval policy and pending action foundation added (schema + API + dashboard actions)
- Safeguard-driven publish gating added (runs can enter `needs_approval` before publish)
- Diagnostic enrichment added to agent logs (duration, fallback marker, error codes)
- New API endpoints added for approvals and activity feed

Validation completed:
- Prisma client generation: pass
- Lint: pass
- Build: pass
- Unit tests: pass
- Integration tests: pass (updated for new orchestration dependencies)

Immediate next slice:
- Add real scheduler worker runtime on top of `ScheduledTask` and `TaskExecution`
- Move run route from direct execution to enqueue-first flow
- Add dead-letter handling and retry policy metrics for scheduled jobs

## Progress Update (2026-05-28, Slice 2)

Completed in code:
- Scheduler service layer implemented in app runtime:
  - queue due scheduled tasks
  - process queued executions
  - process execution by id for deterministic manual runs
- Business automation bootstrap now creates default schedule and approval policy
- Run endpoint changed to enqueue-first, then deterministic processing for manual trigger compatibility
- Schedule APIs added:
  - list/update schedule tasks
  - per-business scheduler tick
  - internal scheduler tick endpoint with secret support
- Dashboard now includes schedule controls (enable/disable + run scheduler now)

Validation completed:
- Lint: pass
- Build: pass
- Unit tests: pass
- Integration tests: pass

Next focused increment:
- Add retry/dead-letter policy to task executions
- Add scheduler worker process (separate long-running process) for production
- Add schedule and queue integration tests

## Progress Update (2026-05-28, Slice 3)

Completed in code:
- TaskExecution now supports retry/backoff and dead-letter lifecycle fields
- Scheduler runtime now performs exponential retry scheduling and dead-letter transitions
- Dedicated scheduler resilience tests added (retry, dead-letter, success path)
- Long-running scheduler worker script added (`worker:scheduler`)
- Queue health surfaced in dashboard with attempts and dead-letter reasons

Validation completed:
- Prisma generate: pass
- Lint: pass
- Build: pass
- Unit tests: pass
- Integration tests: pass
- Scheduler tests: pass

Next focused increment:
- Persist dead-letter replay actions (requeue from dashboard/API)
- Add external integration execution adapters (GitHub/Email/Stripe first)
- Add schedule/queue e2e-style API tests

## Exit Criteria

- Build/lint pass
- Unit/integration/e2e pass
- Compose stack boots with Postgres
- Reliability index visible in app and emitted by pipeline
- Documentation updated with exact local run commands
