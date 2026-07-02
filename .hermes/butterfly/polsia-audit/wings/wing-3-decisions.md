# Wing 3: Decision Log — Frontend, Backend, Security & Infrastructure

## Audit Session: 2026-07-02

### Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Report structure**: Issue-severity format (Critical/Major/Minor) | Matches standard security audit conventions; enables clear prioritization for the parent orchestrator and eventual remediation tracking |
| 2 | **Scope boundaries**: Included webhook handlers under "Security" (they process untrusted input) and infrastructure files under "Infrastructure" | Webhooks are external attack surface; Docker/Dockerfile secrets are infrastructure-level security concerns |
| 3 | **Rating C-2 as Critical**: Orphaned Supabase middleware | Token refresh is the backbone of session persistence in Supabase SSR. Without it, users get randomly logged out (functional impact) and the auth system appears unreliable. Dead code also signals process gaps |
| 4 | **Rating C-3 as Critical**: Webhook auth gaps | Even though Bizweave is in early stage, unauthenticated webhooks are a class of vulnerability that directly enables data poisoning, DoS, and business logic bypass. Stripe standalone is already exploitable |
| 5 | **Not filing a "DUAL AUTH SYSTEM" finding**: While we have Bizweave JWT + Supabase auth, this is a deliberate architecture (dual session management) and the code handles both paths | The dual-auth design is intentional per the docs and handled correctly in `getSession()` with proper fallback. Not a bug, though it adds complexity |
| 6 | **Test coverage assessment**: Rated M-5 as Major (not Critical) because the codebase has some tests and the untested modules are not yet exercised in production | Lack of tests is a quality and regression risk but not an active exploit. If crypto or auth had known bugs with tests absent, that would be Critical |
| 7 | **Not filing a finding on NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY being committed**: The key shown in docker-compose is clearly a placeholder (`eyJhbG...n_I0`) | The value is truncated/placeholder in the committed file, not a real publishable key |
| 8 | **Output path**: Written to `.hermes/butterfly/polsia-audit/wings/` | Matches the Butterfly convention established in the parent task; enables the parent to consume and merge findings from all wings |
| 9 | **Reading approach**: Batch reads of 6-8 files per turn, 15+ separate read operations | Maximized throughput while maintaining context depth; coverage exceeded the 8-area minimum |
| 10 | **Files not read**: Some component files in `src/components/ui/`, marketing pages, and agent pipeline files | These are lower security risk (no backend interaction, no data processing) and were scoped out by the wing definition; the agent and pipeline architecture is covered by Wings 1-2 |

### Key Observations During Audit

- The codebase is structurally sound with good TypeScript patterns, Zod validation, and modern React
- Most critical issues are configuration/ops problems (not code logic bugs) — suggesting the dev phase prioritized feature velocity over hardening
- The guard module and scheduler are impressively well-architected for an early-stage codebase
- FastAPI backend is clearly placeholder/early-stage — minimal endpoints, no real logic yet
- Multiple `.catch(() => undefined)` patterns suggest awareness that background ops can fail, but the silent handling is too aggressive

### Methodology

1. Explored project structure via `search_files` + AGENTS.md
2. Read 35+ source files across 12 directories
3. Identified issues by: code review patterns (OWASP-inspired), comparison against best practices, dependency analysis
4. Rated each issue using: exploitability × impact × prevalence
5. Cross-referenced findings against the 10 focus areas specified in the task
