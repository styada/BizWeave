# Bizweave Operator — Honest Plan, Phase by Phase

> **Status: real, not aspirational.** Most of the code this plan describes already exists in the repo. This plan is the *integration + ship* roadmap, not a "build it all from scratch" roadmap.
>
> **The product:** an autonomous AI operator that runs the online presence of a physical, owner-operated local business (liquor store, salon, cafe, gym, clinic, trades) for $400–$1,500/mo. The operator builds the website, monitors reviews, drafts social/email, runs ads, handles a phone receptionist, researches competitors, and proposes improvements daily. The owner approves high-risk actions via a chat-first dashboard.

---

## 0a. Two Non-Negotiable Principles

### Principle 1: Minimum viable lines of code

**AI bloat is real.** The repo currently has **~22k lines of hand-written TypeScript** across ~250 files. Some of that is necessary, but a lot is over-engineered. From this plan forward:

- **One file = one job.** If a file is over ~300 lines, it's probably doing too much. Split it.
- **No "framework within a framework."** Don't write a 200-line abstraction for what could be 30 lines of direct code with one helper.
- **No premature generalization.** Three is a pattern. One is a one-off. Write the one-off.
- **Delete before you refactor.** If something is dead, remove it. Don't leave "for later" code.
- **Generated code is not your problem.** `src/generated/prisma/*` (~90k LOC) and `src/lib/management-api-schema.d.ts` (~7.5k LOC) are generated; they don't count.
- **Target for the next 90 days:** hand-written TS shrinks to **<15k LOC** while shipping Phases A–I. That means roughly **-7k LOC** in this period, even as we add new features.

**How we enforce this:** every PR's description answers "what lines did this remove?" If the answer is "none, but I added X," a reviewer pushes back. If a phase ships with net-positive LOC, the next phase has to pay it back.

### Principle 2: The developer experience must not suck

**Today the local dev story is broken.** Symptoms:

- `make start` takes 3–5 minutes. Most of that is **`make docker-up`** waiting for `supabase start` to spin up 10+ containers (180s `start_period` healthcheck), then `frontend-db-init` waiting for Supabase to be healthy, then `prisma db push` over `host.docker.internal`.
- "Nothing works" locally is the typical state, because:
  - `dev.db` is a **SQLite** file (94k bytes, last written May 25) that the schema (Postgres) doesn't match. It's an orphan artifact from before the Prisma migration.
  - The `.env` requires `DATABASE_URL` to point at a running Postgres on `localhost:5432`, but nothing starts one unless you run `make local-setup` (Homebrew PostgreSQL) or `make docker-up` (full Supabase stack).
  - Supabase auth isn't running unless `supabase start` has been run, so even if Postgres is up, every page that needs session is 500.
- The dev server itself is fast: I measured **Next.js ready in 270ms**, first page response in **700ms**. The pain is everything *around* the dev server.

**What "good" looks like:**

```bash
git clone && cd bizweave
npm install              # one-time, ~30s with cache
cp .env.example .env
make dev                 # <10s to a working localhost:3000
```

That's it. No Docker. No Supabase CLI. No `prisma db push`. The default `DATABASE_URL` should point at a working local DB that the dev command boots itself (SQLite, in-memory, or a managed local proxy). All Supabase calls degrade gracefully when `NEXT_PUBLIC_SUPABASE_URL` is unreachable. Every page renders in demo mode without external services.

**This is Phase 0 of this plan.** It blocks everything else. You can't iterate on the operator loop if local dev is hostile.

---

## 0. What Is Actually Built (the honest inventory)

I read the repo. The plan doc [`plans/bizweave-plan.md`](../plans/bizweave-plan.md) and the docs in `docs/` describe features, but the *code* is much further along than the docs admit. Here's what's real:

| Capability | Status | File(s) |
|---|---|---|
| 11-agent pipeline (Intake → Orchestrator → CompetitorResearch → Finance → Ads → Outreach → Planner → Builder → Marketing → Support → Safeguard) | ✅ Built, contracts + fallbacks + prompts | `src/lib/agents/{types,contracts,prompts,fallback,orchestrator}.ts` (1,800 LOC) |
| LangGraph + LangSmith pipeline with feature flag | ✅ Built, gated by `FEATURE_LANGGRAPH` | `src/lib/pipeline/{index,graph,steps,tracing}.ts` |
| Operator Chat with intent classification (build_website / run_ads / create_receptionist / outreach / competitor_intel) | ✅ Built | `src/lib/chat/operator.ts` |
| Deep Executor + router (harness dispatch) | ✅ Built (inline harness; Claude/opencode placeholders) | `src/lib/executor/{router,context,verify,sandbox}.ts` + `harness/inline.ts` |
| Per-business memory + embeddings | ✅ Built | `src/lib/memory/{store,embeddings}.ts` |
| RAG context builder | ✅ Built | `src/lib/rag/context.ts` |
| MCP tool bus (registry, toggles, voice server) | ✅ Built | `src/lib/mcp/{registry,toggles,index}.ts` + `servers/voice.ts` |
| Integrations: email, sms, twitter, linkedin, email-send, sms-send | ✅ Built (thin clients) | `src/lib/integrations/{index,email,email-send,sms-send,twitter,linkedin}.ts` |
| Geocoding | ✅ Built (Google Maps w/ OSM fallback) | `src/lib/geo/geocode.ts` |
| Vercel deploy + GBP wiring | ✅ Built (thin clients) | `src/lib/hosting/{vercel,gbp}.ts` |
| Sites: template engine, free-tier launcher, backlink component | ✅ Built | `src/lib/sites/{templates,launch-free,backlink}.ts` |
| Ads engine | ✅ Built (plan + budget guardrails) | `src/lib/ads/engine.ts` |
| Voice receptionist (Vapi) | ✅ Built (config + setup) | `src/lib/voice/receptionist.ts` |
| Compliance: CAN-SPAM/TCPA basics, sanitize, security scrub | ✅ Built | `src/lib/compliance/index.ts`, `src/lib/security/sanitize.ts` |
| Dreaming cycle (nightly reflection) | ✅ Built | `src/lib/dreaming/cycle.ts` |
| Learning: distill, evaluate, promote skills | ✅ Built | `src/lib/learning/{distill,evaluate,promote}.ts` |
| Billing: Stripe + tier entitlements | ✅ Built | `src/lib/billing/{stripe,entitlements}.ts` |
| Approval / PendingAction / ApprovalPolicy tables + UI | ✅ Built | `prisma/schema.prisma` + `src/components/dashboard/pending-approvals.tsx` |
| Operator Chat UI (streamed, inline approvals) | ✅ Built | `src/components/agents/operator-chat.tsx` |
| Activity feed + pipeline visualization | ✅ Built | `src/components/agents/{activity-feed,agent-pipeline}.tsx` |
| Schedule controls + run agents button | ✅ Built | `src/components/dashboard/{schedule-controls,run-agents-button}.tsx` |
| Scheduler worker + tick endpoint | ✅ Built | `scripts/scheduler-worker.mjs` + `src/app/api/internal/scheduler/` |
| Maintenance agent (uptime/links/SSL/expire) | ✅ Built | `src/lib/maintenance/check.ts` |
| External scheduler ticks (competitors/dreaming/learning/maintenance) | ✅ Built | `src/app/api/internal/{competitors,dreaming,learning,maintenance}/` |
| Tests (unit + integration + e2e) | ⚠️ Partial | `npm test:unit` covers many modules; e2e limited |
| Once UI Pro dashboard | ❌ Not installed | — |
| Mobile app (Expo) | ⚠️ Scaffold only | `mobile/` directory exists, not wired |
| Real OAuth integrations (Stripe Connect, Meta, Google, Twilio sub-accounts) | ❌ Mostly stubs | integration files are dry-run-first |
| Sandboxed execution (Vercel Sandbox / Firecracker) | ⚠️ `sandbox.ts` is a thin shell | not actually executing code |

**The gap is not "what to build." The gap is: nothing is wired into a single end-to-end owner journey that you can demo and ship.**

That's the plan below.

---

## 1. The Operator Loop (the product)

Every phase below is judged against: *does this let an owner say one thing, have the agent do the right thing, approve when needed, and see the result?*

```
Owner signs up
   ↓
Onboarding: address, hours, description, POS, goals, guardrails
   ↓
AGENT: geocode → seed competitors → build v1 site → publish on subdomain
   ↓
Daily cycle (cron, every business, in parallel):
   • Monitor: reviews, mentions, sales
   • Draft: 2-3 social posts, 1 email to dormant customers, 1 outreach lead
   • Research: 1 competitor movement, 1 local market signal
   • Suggest: 1 improvement (new collection, hours change, FAQ update)
   ↓
Morning digest lands in owner's chat:
   "3 posts ready, 1 campaign draft, 1 new lead, sales +12%"
   ↓
Owner reviews in chat → approve/edit/reject (one click)
   ↓
AGENT: executes (with approval gates for high-risk)
   ↓
Activity feed shows what happened, what was sent, what was spent
   ↓
Weekly reflection (dreaming) → "while you slept" report + skill updates
```

If a phase doesn't serve this loop, it doesn't ship.

---

## 2. Honest Phase Plan (11 phases, ~15 weeks to private beta)

I replaced the 28-phase plan with 11 phases that each deliver a **demoable, testable slice of the operator loop.** Every phase has: what works after, what's tested, and what's deliberately not in scope. **Phase 0 is a precondition for everything else** — without it, you can't even run the project locally without a 5-minute Docker dance.

### Phase 0 — Local dev must work in under 30 seconds (3 days, BLOCKING)

**Goal:** `git clone && npm install && npm run dev` gets you a working site at `http://localhost:3000` in under 30 seconds, with no Docker, no Supabase CLI, no external services required.

**What I confirmed by reading and running the code today (2026-07-02):**

| Symptom | Root cause |
|---|---|
| `make start` takes 3-5 min | `make start` → `npm run dev` is fast (Next.js ready in 283ms). The pain is the **implicit dependency on `make docker-up`** (or `supabase start`) before you can hit a page that touches the DB or auth. The "ready in 69s" message you saw is **the first `/signup` page compiling**, not the dev server starting. |
| `dev.db` is a stale SQLite file | Orphan from before the Prisma migration. Schema is Postgres. Delete it. |
| `.env` requires running Postgres | Homebrew `postgresql@16` is already running on your machine (verified). The DB `bizweave` exists with 13 tables (verified). You just need to use it. |
| `.env` requires Supabase for auth | `NEXT_PUBLIC_SUPABASE_URL` points at a remote project. For local dev, that adds a network dependency. We can stub the auth client when `NODE_ENV=development` and `SUPABASE_REQUIRED` is unset. |
| `localhost:54321` (Supabase) isn't running | The `supabase-manager/*` components try to call it. They should not block dev startup. |

**Work:**

1. **Stop the dev server from trying to reach Supabase on first paint.** Audit every page that calls `createClient()` from `@/lib/supabase/server`. If the env var is missing, return a "demo mode" user from `getSession()` instead of throwing.
2. **Delete `dev.db`.** It's a footgun. The Makefile should not generate it.
3. **Make `supabase start` opt-in, not required.** The `supabase-manager/*` components (SQL editor, table viewer, logs viewer) — these are admin tooling, not the product. **Move them behind `/admin` route and lazy-load**, so they only spin up when you actually visit. The owner dashboard should never touch them.
4. **Add a single `make dev` target that just works.** Sequence:
   - Verify `DATABASE_URL` is set; if not, point at the Homebrew Postgres.
   - Verify Postgres is reachable; if not, start it via `brew services start postgresql@16`.
   - Verify the `bizweave` DB exists; if not, `createdb bizweave`.
   - Run `prisma db push` if tables are missing.
   - Run `npm run dev`.
   - Print: `✓ ready at http://localhost:3000 (no Docker, no Supabase)`.
5. **Add a one-line `.env.development` that pre-fills the safe defaults** so you don't have to copy `.env.example` and edit.
6. **Document in README the 30-second path** as the primary one. Keep Docker as a fallback for testing Supabase features.

**LOC budget for Phase 0: net -200 LOC.** We're removing broken paths and adding a small launcher. We are not adding infrastructure.

**Done when:** a fresh `git clone` → `npm install` → `make dev` produces a working site in under 30 seconds, with no Docker, no Supabase CLI, no network calls.

### Phase A — Make the existing chat actually demo (1 week)

**Goal:** an owner can talk to the agent and the agent does real things in the DB.

What's broken today (I read the code):
- [`src/lib/chat/operator.ts:100-140`](../src/lib/chat/operator.ts) has a `reply = out.result.summary` that assumes the LLM/SDK produced a `summary` — the inline harness returns one, but a real Claude SDK run may not. Needs normalization.
- The intent classifier is regex — works but doesn't handle "what should I post today?" (question) vs "post something today" (outreach). Add a few regexes, log misclassifications.
- The chat UI is built but the streaming wire-up needs verification.
- Conversations and messages are persisted (`Conversation`, `Message` in schema) but the API route that bridges them needs to be checked end-to-end.

**Work:**
1. Read the actual `POST /api/chat` route and `operator-chat.tsx` UI. Trace user message → DB → reply. Fix any breakage.
2. Add a `GenericReply` fallback for `intent === "question"` — today it falls through to `runTask` which is wrong. A "what are my hours?" should hit memory, not the executor.
3. Stream LLM tokens to the UI. Use `ai-sdk` or `eventsource-parser` — pick one and wire it.
4. End-to-end test: sign up → create business → open chat → "build my website" → site row created → chat shows "drafted, awaiting approval" → approve → status flips to "live."

**Done when:** one owner can sign up, have the agent build and deploy a v1 site via chat, and approve the launch. No scheduler, no email, no ads. Just chat + site.

---

### Phase B — Real site launch with subdomain (1.5 weeks)

**Goal:** when an owner approves, the site goes live at `{slug}.bizweave.site` (or a public route for now).

What's built:
- [`src/lib/sites/templates.ts`](../src/lib/sites/templates.ts) — template engine
- [`src/lib/sites/launch-free.ts`](../src/lib/sites/launch-free.ts) — free-tier launcher
- [`src/lib/sites/backlink.ts`](../src/lib/sites/backlink.ts) — attribution component
- `Deployment` model in schema
- `src/lib/hosting/vercel.ts` (stub)

What's missing:
- A real route that serves the generated site publicly. Today: nothing.
- The Vercel deploy stub doesn't actually deploy.
- The "publish" status transition isn't enforced — the schema has `status: "draft"|"live"` but I don't see the gate that flips it.

**Work:**
1. **Build the public site route first** (cheapest, proves the loop):
   - `src/app/sites/[slug]/page.tsx` reads `GeneratedSite` by `businessId.slug` (need to add `slug` to `Business` if not there), renders HTML/CSS.
   - Gate by `status === "live"`. Drafts return 404.
2. **Add a real `Business.slug` field** + uniqueness constraint + auto-generate on create.
3. **Wire the "Approve & Publish" button** in the operator chat to flip `status`, write an `ActivityEvent`, and return the live URL.
4. **Vercel deploy as a Phase B.5 stretch** (only if the local route works). For MVP, the local route is fine.

**Done when:** an owner can click "publish" and visit `/sites/{slug}` and see the site they approved. Activity feed shows the event.

---

### Phase C — The approval queue (1 week)

**Goal:** every side-effectful agent action lands in an approval queue, gets gated by `ApprovalPolicy`, and is executed only on owner approval.

What's built:
- `ApprovalPolicy` + `PendingAction` models
- `src/components/dashboard/pending-approvals.tsx`
- Schema-level gates

What's missing (probably):
- The *trigger* for creating `PendingAction`s. The pipeline writes `ActivityEvent` but I don't see where it creates a `PendingAction` for high-risk operations.
- The *policy* check. `ApprovalPolicy.requiresApproval` and `minRiskLevel` exist but who reads them?
- The *executor* on approval. Approving a `PendingAction` should run the action; today I bet it just marks it approved.

**Work:**
1. Trace the current path: agent decides to do X → does it just do it, or does it create a `PendingAction`? Read `orchestrator.ts` carefully. Likely the answer is "it just does it" for some actions, and that's a bug.
2. Add a `requestApproval(businessId, actionType, payload, riskLevel)` helper in `src/lib/guard/` or similar. Every high-risk action calls this instead of executing.
3. Add `executeApprovedAction(actionId)` — flips status, runs the side effect, records outcome.
4. The `pending-approvals.tsx` UI needs to call this on click. Verify the wire-up.
5. Add unit tests for: "approve an email send → message goes out", "approve a draft post → post created", "reject → no side effect".

**Done when:** the agent cannot post to social, send email, start ads, change pricing, or modify the site without the owner clicking approve. The pipeline still works (no-op for low-risk reads).

---

### Phase D — Daily digest + scheduler heartbeat (1.5 weeks)

**Goal:** the agent proactively does work, summarizes it, and the owner sees a morning brief.

What's built:
- `src/lib/scheduler.ts` (369 LOC — real)
- `scripts/scheduler-worker.mjs` (heartbeat worker)
- `src/lib/dreaming/cycle.ts` (reflection)
- `src/app/api/internal/{scheduler,dreaming}/tick` endpoints
- `ScheduledTask`, `TaskExecution` models
- `ActivityEvent` model

What's missing:
- **The actual scheduler tick loop running continuously.** The endpoint exists, the worker exists — is there a 60s heartbeat? I see `setInterval` referenced in the implementation plan but I should verify the worker actually runs.
- **The digest generation.** `dreaming/cycle.ts` exists but the question is: does it produce a real "while you slept" brief that lands in the chat? Or is it just logging?
- **The cron schedule per business.** `ScheduledTask.cronExpr` exists but who creates them on business signup? Need a "seed default schedule" hook.
- **The morning brief delivery.** The digest needs to land in the operator chat as a `Message` from the agent, with deep links back to approvals.

**Work:**
1. Verify `scripts/scheduler-worker.mjs` runs and ticks. If `setInterval` is missing, add it.
2. On `Business` create, seed default `ScheduledTask`s:
   - `competitor-research` daily at 6am
   - `social-draft` daily at 7am
   - `dreaming` daily at 3am
   - `maintenance` weekly on Sunday
3. The `dreaming` cycle needs to:
   - Aggregate last 24h of `ActivityEvent` per business
   - Generate a brief via LLM
   - Insert as a `Message` in the business's conversation with role=`agent`, channel=`digest`
4. The chat UI needs to show digest messages distinctly (collapsed by default, expandable). Or surface in a "Today" card at the top of the dashboard.
5. Add end-to-end test: seed a business with 3 days of fake `ActivityEvent` rows → run dreaming cycle manually → assert a `Message` is created with the right content.

**Done when:** an owner logs in and sees a "today" summary. The summary is real data, not a stub.

---

### Phase E — Memory + RAG actually improve responses (1.5 weeks)

**Goal:** when the owner asks "what's our best-selling product?" the agent answers from memory, not a hallucination.

What's built:
- `src/lib/memory/store.ts` (add, retrieve, prompt-block)
- `src/lib/memory/embeddings.ts`
- `src/lib/rag/context.ts` (RAG context builder)

What's missing (probably):
- **Seed data.** When does memory get written? The store has `addMemory` but who calls it on a new business?
- **The "memory nudge" job.** The plan mentions periodic consolidation. Is there a cron that consolidates raw `ActivityEvent` → `MemoryEntry`? Check `dreaming/cycle.ts` and the memory module.
- **Cross-session recall.** The memory retrieval is per-query. Does the chat thread the memory across turns, or does each turn re-retrieve? Probably the latter, which is fine for now.
- **BrandKit, FAQ, catalog as memory sources.** The RAG module exists but the ingestion path for "this business is vegan-friendly, kid-friendly, has a patio" is unclear.

**Work:**
1. On `Business` create, seed initial `MemoryEntry` rows from the onboarding form: name, address, hours, description, categories, POS system, key facts.
2. On every `ActivityEvent` that contains a business-relevant fact, write a `MemoryEntry` (async, best-effort, never blocks).
3. The `dreaming` cycle should consolidate last 7 days of `ActivityEvent` into 1-3 `MemoryEntry` summaries per business.
4. Wire `buildRagContext` into the operator chat prompt. Read `chat/operator.ts` — does it already? If not, add it before the LLM call.
5. Test: "what's our return policy?" with no memory → generic fallback. "what's our return policy?" with `MemoryEntry` containing the answer → cites it.

**Done when:** the agent can answer specific questions about the business correctly from memory, and references the source memory in the reply.

---

### Phase F — One real integration: email send (1.5 weeks)

**Goal:** the agent can draft and send a real email, with approval.

What's built:
- `src/lib/integrations/{email,email-send}.ts`
- Resend key check in `env.ts`
- Dry-run mode (probably)

What's missing:
- **The actual Resend client wired to the API.** The file is 47 LOC — is it real or stub?
- **Inbound webhook handling.** Resend can receive replies. No handler in `src/app/api/webhooks/`.
- **List management.** No subscriber table, no list-add/list-remove.
- **Templates.** No template registry.
- **Compliance.** `compliance/index.ts` is 80 LOC — does it cover unsubscribe handling? List-Unsubscribe header?

**Work:**
1. Read `integrations/email-send.ts`. If it's a stub, write the real Resend client (it's 30 lines).
2. Add `Subscriber` model + migrations: `email`, `businessId`, `source` (signup/checkout/manual), `optedOutAt?`, `tags[]`, `createdAt`.
3. Add `EmailTemplate` model: `businessId`, `name`, `subject`, `bodyMjml`, `updatedAt`.
4. Add `POST /api/webhooks/resend` for inbound + delivery events.
5. Add `sendEmail(businessId, templateId, recipientIds, dryRun)` to the integration layer. Respects `ApprovalPolicy` for first send to a new recipient.
6. Add an email channel tile to the operator chat: "draft a campaign" → agent creates `EmailTemplate` → creates `PendingAction` → owner approves → emails go out.
7. Compliance: every send includes List-Unsubscribe, physical address footer, opt-out link.

**Done when:** an owner can ask the agent to "send a 10% off email to lapsed customers" → agent drafts → owner approves → emails go out via Resend → delivery events land in `ActivityEvent`.

---

### Phase G — Operator chat becomes the front door (1 week)

**Goal:** the dashboard is a chat. Everything else is a sub-view reached from the chat.

What's built:
- `src/components/agents/operator-chat.tsx` (real)
- `src/app/dashboard/[id]/page.tsx` (real)

What's missing:
- The chat is probably one panel of a multi-panel layout. The plan wants chat-first. Currently the layout is probably traditional sidebar + content.
- The chat needs to be able to *do* things inline: show an approval card, show a draft post, show a campaign summary, all clickable.
- The "Ask your operator anything" rail should be persistent on every page.

**Work:**
1. Restructure `dashboard/[id]/page.tsx` so the operator chat is the primary view. Other panels (tasks, activity, channels) are tabs or side-rails, not the default.
2. Add inline approval cards to the chat stream: `PendingAction` rendered as a clickable card with approve/reject buttons.
3. Add inline previews: "Here's the draft post" rendered as a mock tweet card, not raw text.
4. The "today" digest is the first message in the chat each day.
5. Make sure the chat works on mobile (it probably does, but verify).

**Done when:** the dashboard's home page is the chat. The owner can do everything (approve a draft, kick off a task, ask a question) without leaving the chat.

---

### Phase H — Real social: one platform, dry-run + live (1.5 weeks)

**Goal:** the agent drafts and posts a real tweet (or LinkedIn or X) with approval.

This is the same pattern as Phase F (email), but for one social platform. Pick X/Twitter because the OAuth is the simplest.

**Work:**
1. Read `integrations/twitter.ts`. If stub, write the real client (OAuth 1.0a or API key + OAuth 2.0).
2. Add `SocialPost` model: `businessId`, `platform`, `content`, `mediaIds[]`, `scheduledFor?`, `status` (draft/scheduled/published/failed), `externalId?`, `publishedAt?`.
3. Add `POST /api/oauth/twitter/callback` for OAuth.
4. Wire the "draft a post" agent intent → creates `SocialPost` (status=draft) → `PendingAction` → on approve, post via API.
5. Add the "Social" channel tile: shows recent drafts, scheduled posts, published posts.
6. Add a "Post now" override (skip scheduling).

**Done when:** an owner can ask "post something about our new cocktail menu" → agent drafts a tweet → owner approves → it's live on X → activity feed shows the post URL and engagement.

---

### Phase I — The "while you slept" digest + skill promotion (1.5 weeks)

**Goal:** the agent gets smarter every week. Successful patterns get promoted into the skill library.

What's built:
- `src/lib/learning/{distill,evaluate,promote}.ts`
- `src/lib/dreaming/cycle.ts`
- `Skill`, `Evaluation` models in schema (probably)

What's missing:
- **The reward signal.** Every `Evaluation` needs to be scored against a real KPI. Which KPIs? Pick 3:
  - **Bookings/calls** (Phase 11 needs the receptionist before this is real)
  - **Review count/rating delta** (needs review monitoring)
  - **Email open/click rate** (Phase F gives us this)
  - **Ad ROAS** (later)
- **The skill promotion loop.** `promote.ts` exists — but does it actually write to `SkillLibrary`? Or is it a stub?
- **The "while you slept" report.** Distinct from the daily digest. The weekly one should say "this worked, this didn't, here's what I'm changing next week."

**Work:**
1. Define the 3 reward KPIs for v1: email reply rate, review rating delta, draft → approval rate.
2. Add `Evaluation` writes: every `ActivityEvent` of type `email_sent` / `review_received` / `pending_action_resolved` gets an `Evaluation` row.
3. The dreaming cycle (weekly) reads 4 weeks of `Evaluation` per business → calls `learning/distill.ts` → produces 1-3 `Skill` candidates.
4. `promote.ts` writes validated skills to `SkillLibrary` (per business + opt-in global).
5. The weekly digest in the chat summarizes: "Wins: X, Losses: Y, New skills: Z, Trying next week: W."

**Done when:** after 4 weeks of activity, the agent has produced 3+ skills and the weekly digest cites them.

---

### Phase J — Hardening + private beta (2 weeks)

**Goal:** a real owner can use this daily for a month without us being paged.

**Work:**
1. **Rate limiting → Redis.** Replace in-memory `rate-limit.ts` with Upstash/Redis. Apply to: signup, chat send, approval click, integration send.
2. **Multi-tenant isolation tests.** RLS already configured. Add tests that assert cross-tenant reads fail. Hit every table.
3. **Idempotency on agent tasks.** `AgentTask` should have an idempotency key so a re-run doesn't double-send an email or double-post.
4. **Audit log.** Every approval, every send, every publish → `AuditLog` (model exists, verify it's actually written).
5. **Cost metering.** `UsageEvent` for LLM tokens, email sends, social posts, sandbox minutes. Surface in a usage widget.
6. **Spend caps.** Per business per month. Hard stop at cap.
7. **Error budget.** Sentry (or similar). Define SLOs.
8. **Backup / restore.** Verify Supabase PITR works. Test restore on a copy.
9. **Documentation.** One runbook per integration ("if Resend is down, do X"). One per failure mode.
10. **Load test.** k6 against the chat endpoint, the approval endpoint, the scheduler tick. Target: 100 concurrent businesses, 1 chat msg/sec/business.

**Done when:** 5 owner-design partners use the system daily for 30 days. Zero data loss. Zero double-sends. Approval SLA < 2 hours.

---

## 3. What This Plan Deliberately Skips (and why)

These are in `plans/bizweave-plan.md` and `docs/POLSIA_CLONE_EXPANSION_ROADMAP.md`. They are not in this plan because they are not the loop. Park them for after private beta.

| Deferred | Why |
|---|---|
| Once UI Pro dashboard | The chat is the front door. Polish later. The `phase-24` in the plan is correctly last. |
| Mobile app (Expo) | Web chat first. The `mobile/` scaffold exists. Wrap as PWA for now. |
| Real Vercel Sandbox execution | `src/lib/executor/sandbox.ts` is a 45-line shell. The inline harness covers 80% of cases. Real sandbox is for long-running, code-execution jobs (rare in v1). |
| LangGraph migration | Pipeline works. The LangGraph path is feature-flagged. Flip it on once a customer has run 100+ pipelines. |
| Multi-harness routing (Claude SDK / opencode / deepagents) | The router exists but only inline is wired. The plan's "deep executor tier" solves a problem we don't have yet. |
| Multi-business workspace | `Workspace` model in schema. Build the UI after private beta. |
| Brand RAG (per-business pgvector over brand/docs) | Memory + RAG v1 in Phase E covers the use case. Brand RAG is when we have a real brand kit to ingest. |
| Procurement / Stripe Issuing | This is a "Full Operator" tier feature ($1,500/mo). Way past MVP. |
| Public `/live` feed | Marketing feature, post-launch. |
| Firecracker isolation per task | Vercel sandbox adds cost + complexity. Defer until we have one customer that needs it. |
| Dreaming at scale | The cycle exists. Run it for one business. Optimize later. |
| Self-learning skill consolidation → global | After private beta, with opt-in only, PII-scrubbed. |
| MCP server marketplace | We ship 4 MCP servers (places, deploy, comms, voice). Don't expose the platform until we know what owners want. |
| Per-tenant KMS envelope keys | Critical for SOC 2. Pre-SOC 2 right now. |
| SOC 2 / pen test | Post-PMF, pre-enterprise sales. |

---

## 4. Pricing & Packaging (carried from the existing plan, but simpler)

The existing plan has 4 tiers (Free / $400 / $600 / $1,500). For MVP, ship **2 tiers + 1 enterprise** to keep billing simple:

| Tier | Price | Includes |
|---|---|---|
| **Listing** | Free | Template site on `*.bizweave.site` subdomain, backlink to us, operator chat with 25 messages/mo, no integrations |
| **Operator** | $400/mo | Custom AI-built site (deep executor), custom domain, operator chat (unlimited), 1 integration (email OR social), daily digest, weekly reflection |
| **Operator+** | $1,000/mo | Everything in Operator + 3 integrations + ads (with $500/mo ad spend cap) + AI receptionist (Vapi, 200 min/mo) + priority support |

Add-ons:
- Additional social channel: $50/mo
- Additional email sends beyond 5,000/mo: $0.0008/email
- AI receptionist overage: $0.15/min
- Ad spend over cap: pass-through + 5% (transparent, no hidden take)

Pricing fits the plan. Trim the middle tiers to keep operations simple until you have customers asking for more.

---

## 5. The 11-Phase Schedule

| Phase | Weeks | Outcome | Demoable to a customer? | LOC delta |
|---|---|---|---|---|
| **0** | 0.5 (3 days) | Local dev works in <30s, no Docker | Internal only | **-200** |
| A | 1 | Chat drives the existing pipeline | Yes — "build my site" via chat | +200 / -200 |
| B | 1.5 | Approve → site is live at `/sites/{slug}` | Yes — show the live site | +300 / -100 |
| C | 1 | Approval queue gates every side effect | Yes — "nothing happens without your click" | +200 / -300 |
| D | 1.5 | Daily digest lands in chat every morning | Yes — "here's what your operator did while you slept" | +300 / -100 |
| E | 1.5 | Memory + RAG improve answers | Yes — ask about your business, get a real answer | +200 / -200 |
| F | 1.5 | Real email send with approval | Yes — "send a campaign to lapsed customers" | +400 / -100 |
| G | 1 | Chat is the dashboard | Yes — UX reveal | +100 / -800 |
| H | 1.5 | Real social post with approval | Yes — "post about our new menu" | +400 / -100 |
| I | 1.5 | Weekly reflection + skill promotion | Yes — "we got smarter this week" | +200 / -200 |
| J | 2 | Hardening + private beta | Internal — 5 design partners, 30 days | +300 / -200 |

**Total: ~15 weeks to private beta.** Net hand-written LOC target: **22k → ~15k** by J (i.e., we ship the loop and shrink the code at the same time). Then iterate with real customers.

The **G phase** (-800 LOC) is where the dashboard restructure happens — replacing multi-panel pages with a chat-first layout deletes more code than it adds.

---

## 6. What I Got Wrong Before (and right now)

I said earlier "the 6-step pipeline is a website generator, not an agent." That was wrong. The pipeline is one of *eleven* agents. There *is* an operator chat, an executor, a planner, memory, RAG, dreaming, learning, voice, ads, sites, integrations. The work is mostly done.

What I had right: **the system was not wired into a single owner journey you could demo.** The integration story is the work. Once it's wired, you have an operator.

What I want to be honest about: I am judging this plan against my reading of ~50 files and a few thousand lines of code. There will be things I missed — particularly around which integrations are real vs dry-run, which UIs are polished vs placeholder, and which cron jobs actually run. **Before starting Phase A, spend 2 days validating my inventory against the actual state.** If a row in the "What's built" table above is wrong, adjust the phase.

---

## 7. Definition of Done (Private Beta Launch)

- [ ] 5 design-partner businesses onboarded
- [ ] Each one has a live, on-brand site
- [ ] Each one is getting a daily digest
- [ ] Each one has approved at least 3 real actions (email, social, or ad)
- [ ] Each one has the agent in their chat, answering business questions from memory
- [ ] Zero data loss over 30 days
- [ ] Zero double-sends
- [ ] Approval SLA < 2 hours
- [ ] Cost per business per month < $40 (LLM + sandbox + email + Resend)
- [ ] Two of the five partners willing to be a case study

When that list is checked, raise prices, hire a part-time ops person, start the sales motion.
