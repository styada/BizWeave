# Wing 2 — Decision Log: LLM Infrastructure & Integrations

## Decisions Made During Audit

### 1. Scope boundaries
- **Decision**: Excluded `src/lib/agents/` (orchestrator, fallback templates) — that's Wing 1's domain. Focused strictly on infrastructure layers that LLM calls pass through.
- **Rationale**: Agent pipeline orchestration is about business logic composition, not LLM infrastructure. The `fallback.ts` templates are business-level fallbacks, not infrastructure.

### 2. Severity classification criteria
- **CRITICAL**: Leads to data exposure (key leak, crypto weakness) or makes the system fundamentally unreliable (no retry)
- **MAJOR**: Significant design flaw that will cause problems at scale or under load; security hardening needed before production
- **MINOR**: Notable but low immediate risk; should be addressed as part of normal technical debt

### 3. No-duplicate dedup with Wing 1
- **Decision**: Did NOT flag LLM prompt injection or orchestration security — that belongs under Wing 1 (Agent Architecture).
- **Compensating control**: Wing 1 is expected to cover prompt injection via the Safeguard agent and contracts.

### 4. Key-related findings
- **Decision**: Flagged `client.ts` error body leak and `crypto.ts` static salt as CRITICAL rather than MAJOR because both involve secrets exposure.
- **Considered**: Whether the error body leak is overblown (OpenAI doesn't always echo the key). Decision stands because the risk is real and the fix is trivial (redact before logging).

### 5. Platform key isolation
- **Decision**: Rated the shared platform key as MAJOR rather than CRITICAL because BYOK is the intended production path. The platform key is a development convenience / startup fallback. Production deployments are expected to have BYOK per customer.
- **Note**: If the product ships with platform key as the default for paying customers, escalate to CRITICAL.

### 6. Memory privacy
- **Decision**: Flagged as MAJOR. In single-user businesses (the primary Bizweave use case), this is low impact. But the architecture is designed for multi-user business accounts (seats in entitlements), so it will become a problem.
- **Mitigation**: Current usage is operator-chat memories which are relatively low sensitivity, but this is an accident of scope, not design.

### 7. Temporal auth
- **Decision**: Flagged as MAJOR despite being a "configure later" concern because Temporal connections in the wild often stay unauthenticated in staging that becomes production. Adding TLS later is harder (requires infra change). Call it out now.

### 8. Files audited count: 14 source files + 6 test files = 20 files total
- Exceeds the "5 directories" minimum (7 directories covered).

## Cross-Wing Coordination Notes
- **Wing 1 (Agent Pipelines)**: The `answerQuestion` and `handleOperatorMessage` functions call LLM with system prompts incorporating user text — review prompt injection protections.
- **Wing 3 (Data Layer)**: The usage meter's check-then-act race condition could extend into billing correctness — coordinate on atomic meter integration.
- **Wing 4 (Deployment)**: Temporal TLS and rate-limiter distribution are infra-level concerns that need deployment context.
