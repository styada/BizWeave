# Bizweave — Implementation Plan

> North Star document for the Polsia-competitive buildout (June 7, 2026)

---

## Guiding Principles

1. **Tests first, then code** — Every feature requires unit + integration + e2e passing before next step
2. **Minimal lines, maximal impact** — No bloated abstractions; prefer direct, readable code
3. **Supabase-first UI** — Use Supabase/shadcn primitives wherever components exist
4. **Retro pixel theme** — Gamified loading states, pixel-perfect transitions, CRT glow effects
5. **Progressive delivery** — Ship working slices; perfect is the enemy of shipped

---

## Implementation Order

```
E (Activity Feed UI)  →  D (Agent Roles)  →  B (Scheduler)  →  C (Site Hosting)  →  A (Integrations)
```

**Why this order:** Feed gives visibility into everything else working. Agent roles are just data + placeholders. Scheduler makes them run automatically. Hosting shows output. Integrations make it real.

---

## Option E — Live Activity Feed UI

### Goal
Surface the existing `ActivityEvent` data as a beautiful, retro-pixel real-time feed — first per-business, then global.

### Files to Modify

| File | Action |
|------|--------|
| `src/components/agents/activity-feed.tsx` | **Create** — Core feed component with pixel-themed event cards |
| `src/app/dashboard/[id]/page.tsx` | **Modify** — Replace raw activity event list with new component |
| `src/app/dashboard/activity/page.tsx` | **Create** — Global activity feed page (polsia.com/live equivalent) |
| `src/app/api/activity/route.ts` | **Create** — SSE or polling endpoint for activity events |
| `src/components/ui/pixel-loader.tsx` | **Create** — Retro pixel loading animation |
| `src/app/globals.css` | **Modify** — Add pixel-theme CSS classes |

### Data Flow
```
ActivityEvent (DB)  →  API route  →  Client component (polling or SSE)  →  Pixel-animated feed
```

### Tests
- **Unit**: ActivityEvent schema parsing, event type classification
- **Integration**: Feed API returns correct events, pagination works
- **E2E**: Activity feed renders on business detail page, shows real events

### Acceptance
- Business detail page shows pixel-themed activity feed
- `/dashboard/activity` shows global feed across all businesses
- New events animate in with pixel-scanline effect
- Feed auto-refreshes every 10 seconds

---

## Option D — New Agent Roles

### Goal
Add all missing agent roles from Polsia parity: Outreach, Ads, Finance, Competitor Research, Orchestrator.

### Architecture Decision
New agents exist **outside** the linear pipeline. They run on their own schedules (handled by Option B). The orchestrator agent becomes a meta-planner that coordinates them.

### Files to Modify

| File | Action |
|------|--------|
| `src/lib/agents/types.ts` | **Modify** — Add new AgentIds, output types |
| `src/lib/agents/contracts.ts` | **Modify** — Add Zod schemas for new agents |
| `src/lib/agents/prompts.ts` | **Modify** — Add prompts for new agents (with "TODO: implement real prompt" comments) |
| `src/lib/agents/fallback.ts` | **Modify** — Add fallback templates for new agents |
| `src/lib/agents/orchestrator.ts` | **Modify** — Add cases for new agents (placeholder execution) |
| `src/lib/agents/agent-runner.ts` | **Create** — Standalone agent execution function (used by scheduler) |
| `prisma/schema.prisma` | **Verify** — MemoryThread/MemoryEntry tables exist |

### New Agents

| Agent | ID | Function | Placeholder Behavior |
|-------|-----|----------|---------------------|
| Outreach | `outreach` | Prospect research + cold email | Returns empty prospect list |
| Ads | `ads` | Google/Meta ad campaign management | Returns empty campaign status |
| Finance | `finance` | Stripe revenue sync + spend tracking | Returns zeroed metrics |
| Competitor Research | `competitor-research` | Web search + competitor profiling | Returns empty competitor list |
| Orchestrator | `orchestrator` | Cross-agent planning + summary | Returns basic plan from pipeline artifacts |

### Tests
- **Unit**: Each new agent contract schema validates correctly
- **Unit**: Each new agent fallback returns valid output
- **Integration**: Orchestrator can run all new agents in sequence
- **E2E**: N/A (no UI surface yet)

### Acceptance
- All 5 new agent types exist in `AgentId` union
- Each has a Zod schema, prompt (with placeholder), and fallback
- Orchestrator pipeline can execute them all without error
- Outputs are stored in AgentLog

---

## Option B — Autonomous Scheduler

### Goal
Make agents run on their own without manual triggering. Wire up the auto-tick loop.

### Current State
- `ScheduledTask` and `TaskExecution` models exist ✓
- `queueDueScheduledTasks()` and `processQueuedExecutions()` exist ✓
- Retry/backoff/dead-letter logic exists ✓
- Scheduler worker script exists (`scripts/scheduler-worker.mjs`) ✓
- **Missing**: Auto-tick loop running in production, proper cron heartbeat

### Files to Modify

| File | Action |
|------|--------|
| `scripts/scheduler-worker.mjs` | **Modify** — Add setInterval heartbeat (every 60s) |
| `src/lib/scheduler.ts` | **Verify** — All functions are correct |
| `src/app/api/internal/scheduler/tick/route.ts` | **Verify/Modify** — Protected tick endpoint |
| `src/components/dashboard/schedule-controls.tsx` | **Modify** — Add pixel-theme styling, better UX |
| `src/app/dashboard/[id]/page.tsx` | **Verify** — Schedule controls render correctly |

### Scheduler Architecture
```
[NODE] setInterval(60s)
    └─ queueDueScheduledTasks()
        └─ For each due task: create TaskExecution (queued)
    └─ processQueuedExecutions(5)
        └─ For each queued execution: runAgentPipeline(exec)
            ├─ Success → mark completed
            ├─ Retryable fail → schedule retry with backoff
            └─ Max retries → dead letter
```

### Tests
- **Integration**: Worker loop queues + processes due tasks
- **Integration**: Retry/backoff works correctly
- **Integration**: Dead letter triggers after max attempts
- **E2E**: Clicking "Run scheduler now" processes queued tasks

### Acceptance
- `queueDueScheduledTasks()` runs every 60s via worker
- Due tasks automatically create executions
- Executions are processed with retry/backoff
- Dead-lettered tasks are visible in dashboard

---

## Option C — Site Hosting

### Goal
Deploy generated HTML/CSS sites to live, publicly accessible URLs.

### Approach
Two-phase:
1. **Phase C1**: Serve generated sites at `bizweave.app/sites/[business-slug]` using a Next.js route handler
2. **Phase C2**: Deploy to Vercel/Cloudflare with wildcard subdomains

### Files to Modify

| File | Action |
|------|--------|
| `src/app/sites/\[slug\]/route.ts` | **Create** — Serve generated site HTML+CSS at a live URL |
| `src/app/dashboard/[id]/page.tsx` | **Modify** — Add "View live site" button with the URL |
| `src/components/site/site-preview.tsx` | **Enhance** — Add pixel-frame border around preview |

### Test
- **Integration**: Site route returns correct HTML/CSS for a business
- **Integration**: 404 for non-existent business
- **E2E**: Navigate to live site URL, see rendered page

### Acceptance
- Generated site is served at `/sites/[slug]`
- Dashboard shows "Live site" link
- Site renders with correct HTML + CSS + meta tags

---

## Option A — Real Integrations

### Goal
Build the framework for external integrations, starting with Twitter/X posting as the first real integration.

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/integrations/types.ts` | **Create** — Integration types (Twitter, Email, etc.) |
| `src/lib/integrations/twitter.ts` | **Create** — Twitter/X API client (post tweet) |
| `src/lib/integrations/registry.ts` | **Create** — Integration registry + health checks |
| `src/lib/integrations/__tests__/twitter.test.ts` | **Create** — Twitter integration tests |
| `prisma/schema.prisma` | **Modify** — Add IntegrationToken model |
| `src/app/api/integrations/route.ts` | **Create** — Integration management API |
| `src/components/integrations/integration-card.tsx` | **Create** — UI for managing integrations |
| `src/components/integrations/integration-form.tsx` | **Create** — OAuth/API key entry form |
| `src/app/dashboard/settings/integrations/page.tsx` | **Create** — Integrations settings page |

### Integration Architecture
```
IntegrationToken (DB)  →  Registry (config)  →  Integration Client  →  External API
                                                                  ↕
                                                        Health check endpoint
```

### First Integration: Twitter/X
- Store OAuth tokens or API keys in `IntegrationToken` table
- Implement `postTweet(text: string)` function
- Add dry-run mode (log instead of post)
- Add health check (verify credentials are valid)
- Wire into Social/Outreach agent prompts

### Tests
- **Unit**: Twitter client builds correct request
- **Unit**: Integration registry registers/unregisters correctly
- **Integration**: Health check returns valid/invalid status
- **E2E**: User can connect Twitter account from settings page

### Acceptance
- Twitter integration connects with API keys
- Agents can post tweets via integration (dry-run logs them)
- Health check shows connection status
- Settings page shows connected integrations

---

## Retro Pixel Theme

### Design Language
- CRT screen glow on active elements
- Pixel-perfect borders (no anti-aliased corners on retro elements)
- Scanline overlay on loading states
- 8-bit style loading spinners (replacing framer-motion with CSS keyframes)
- Gold (#e8b84a) as primary, with CRT phosphor glow
- Terminal-style monospace for agent logs and activity feed
- "Level up" animation on Safeguard approval (confetti of gold pixels)

### CSS Additions

```css
/* Pixel scanline overlay */
.pixel-scanline {
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.03) 2px,
    rgba(0, 0, 0, 0.03) 4px
  );
}

/* CRT glow */
.crt-glow {
  box-shadow: 0 0 20px rgba(232, 184, 74, 0.15),
              0 0 40px rgba(232, 184, 74, 0.05);
}

/* Pixel border */
.pixel-border {
  border: 2px solid var(--accent-primary);
  box-shadow: inset -2px -2px 0 rgba(0,0,0,0.3),
              inset 2px 2px 0 rgba(255,255,255,0.1);
}

/* Loading bar */
.pixel-loading-bar {
  height: 4px;
  background: var(--bg-muted);
  position: relative;
  overflow: hidden;
}
.pixel-loading-bar::after {
  content: '';
  position: absolute;
  top: 0; left: -100%;
  width: 100%; height: 100%;
  background: var(--accent-primary);
  animation: pixel-loading 2s ease-in-out infinite;
}

/* Level up burst */
@keyframes level-up {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0.5; }
  100% { transform: scale(1); opacity: 0; }
}
```

### Components to Theme
- `AgentPipeline` — Scanline overlay on running step, pixel border on active
- `ActivityFeed` — CRT monitor frame, terminal-style text, pixel loading dots
- `ScheduleControls` — Toggle switches as pixel buttons
- `PendingApprovals` — Urgent red pixel border (danger alert style)
- `RunAgentsButton` — Pixel "START" button with glow
- `DashboardSidebar` — Pixel accents on active nav items
- Loading states — 8-bit spinner instead of framer-motion

---

## File Inventory — Complete List of Changes

### New Files
```
src/components/agents/activity-feed.tsx
src/components/ui/pixel-loader.tsx
src/app/dashboard/activity/page.tsx
src/app/api/activity/route.ts
src/lib/agents/agent-runner.ts
src/lib/integrations/types.ts
src/lib/integrations/twitter.ts
src/lib/integrations/registry.ts
src/lib/integrations/__tests__/twitter.test.ts
src/app/sites/[slug]/route.ts
src/app/api/integrations/route.ts
src/components/integrations/integration-card.tsx
src/components/integrations/integration-form.tsx
src/app/dashboard/settings/integrations/page.tsx
```

### Modified Files
```
src/app/globals.css            — Pixel theme classes + animations
src/lib/agents/types.ts        — New AgentIds + output types
src/lib/agents/contracts.ts    — New agent Zod schemas
src/lib/agents/prompts.ts      — New agent prompts
src/lib/agents/fallback.ts     — New agent fallbacks
src/lib/agents/orchestrator.ts — New agent cases
src/app/dashboard/[id]/page.tsx — Activity feed integration, live site link, pixel theme
prisma/schema.prisma           — IntegrationToken model
scripts/scheduler-worker.mjs   — Auto-tick heartbeat
src/components/agents/agent-pipeline.tsx — Pixel theme
src/components/dashboard/run-agents-button.tsx — Pixel theme
src/components/dashboard/schedule-controls.tsx — Pixel theme
src/components/dashboard/pending-approvals.tsx — Pixel theme
src/components/dashboard/sidebar.tsx — Pixel accents
```

---

## Test Strategy

Each option has its own test suite. All tests must pass before proceeding to next option.

### Running Tests
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Scheduler tests
npm run test:scheduler

# All vitest
npm test

# E2E (requires dev server running)
npm run test:e2e
```

### Test File Mapping
```
src/lib/agents/__tests__/
  contracts.test.ts        — Unit: schema validation for all agents
  orchestrator.integration.test.ts — Integration: full pipeline
  scheduler.test.ts        — Integration: scheduler retry/dead-letter
  activity-feed.test.ts    — NEW: Activity feed API + rendering
  
tests/e2e/
  app.smoke.spec.ts        — Existing: landing, signup
  activity-feed.spec.ts    — NEW: Feed renders, auto-refresh
  scheduler.spec.ts        — NEW: Schedule controls work
  site-hosting.spec.ts     — NEW: Generated site serves at URL
  integrations.spec.ts     — NEW: Integration settings UI
```

---

## Exit Criteria

- [ ] Option E: Activity feed shows real-time agent events with pixel theme
- [ ] Option D: All 5 new agent roles exist with schemas, prompts, fallbacks
- [ ] Option B: Scheduler runs autonomously with retry/dead-letter
- [ ] Option C: Generated sites served at live URLs
- [ ] Option A: Twitter integration works with health checks
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All e2e tests pass
- [ ] Retro pixel theme applied consistently across dashboard
- [ ] No build errors or lint warnings
