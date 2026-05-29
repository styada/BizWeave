# Bizweave vs Polsia-Style Platform: Feature Gap Analysis

Date: 2026-05-28
Scope: Current repository state, core product parity, reliability, and operations readiness.

## Summary

Bizweave already has a solid baseline:
- Authentication and multi-business dashboard
- Business onboarding and inventory ingest
- BYOK key storage (encrypted) and provider selection
- A six-step pipeline with fallback mode
- Generated site + marketing artifacts persisted in database

However, for true Polsia-like parity and stronger reliability, critical gaps remain in four areas:
- Agent capability depth and output contracts
- Operational reliability and observability
- Product completeness around business operations loops
- Delivery rigor (tests, local infra, reproducible runs)

## Feature Comparison Matrix

Legend:
- `Present`: implemented and functional
- `Partial`: baseline present, not production-robust
- `Missing`: not implemented

| Capability | Status | Gap |
|---|---|---|
| Multi-agent orchestrated pipeline | Partial | Pipeline exists but limited schema guarantees, retries, and runtime diagnostics |
| Specialized agent roles | Partial | Roles exist but outputs are loosely validated and can degrade silently |
| Human-safe final gate | Partial | Safeguard exists but lacks explicit scoring model + explainable pass/fail breakdown |
| Artifact lifecycle (draft/review/live) | Partial | Basic statuses exist; no richer release controls/rollbacks/versioning |
| Structured run telemetry | Missing | No run-level quality score, weak step-level diagnostics for incident triage |
| Deterministic fallback resilience | Partial | Fallback exists, but no standardized reliability envelope per step |
| Unit testing | Missing | No test framework/scripts currently wired |
| Integration testing | Missing | No integration harness for orchestration/API interactions |
| E2E browser validation | Missing | No Playwright tests proving user-critical flows |
| Containerized local stack | Missing | No Dockerfile / compose stack for reproducible local environment |
| Postgres local runtime | Missing | Current implementation is SQLite-centric |
| Makefile automation | Missing | No single-command dev/test/build flows |
| Reliability-focused USP | Missing | No differentiated trust/reliability score surfaced to operators |

## What “Parity + Better Reliability” Requires

### 1. Agent Runtime Hardening
- Strong typed contracts for each agent output
- Structured parse/repair path with deterministic fallback behavior
- Retry + timeout policy per step
- Explicit reason codes for failures and degradations

### 2. Explainable Reliability Layer (USP)
- Add a reliability index emitted by final review
- Include category scores (factual consistency, policy safety, channel readiness)
- Persist and surface index in dashboard to support operator trust

### 3. Verification Pipeline
- Unit tests for parsing/contracts/fallback behavior
- Integration tests for orchestrator execution and persistence effects
- Playwright e2e tests for key user journeys

### 4. Reproducible Runtime
- Dockerized Next.js runtime
- Docker Compose with local Postgres service
- Make targets for setup, test, run, and e2e

## Risk Register

- LLM nondeterminism can break strict JSON formats
  - Mitigation: schema validation, extraction heuristics, fallback-safe path

- Long synchronous pipeline execution can cause poor UX/timeout issues
  - Mitigation: explicit run statuses and reliability logs now; async worker evolution planned

- Migration from SQLite to Postgres can break local setup
  - Mitigation: compose-first local workflow + explicit make targets

## Acceptance Criteria for This Upgrade

- Agent pipeline outputs are schema validated at every step
- Safeguard returns explainable reliability index with category scoring
- Unit + integration + Playwright suites are present and passing
- App runs locally via Docker Compose with Postgres
- Makefile provides one-command setup and verification
