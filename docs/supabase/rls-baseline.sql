-- Bizweave Supabase RLS baseline for Prisma tables in schema public.
-- Assumptions:
-- 1) `public."User"."supabaseAuthId"` exists and stores `auth.users.id` UUID.
-- 2) Client JWTs contain a valid authenticated user id via `auth.uid()`.
-- 3) Client traffic uses `authenticated` role.
--
-- Notes:
-- - Service role bypasses RLS; keep it server-only.
-- - Run in Supabase SQL editor (or migration) and adjust for your app-level exceptions.

begin;

-- Enable RLS on all application tables.
alter table public."User" enable row level security;
alter table public."ApiKey" enable row level security;
alter table public."Business" enable row level security;
alter table public."InventoryItem" enable row level security;
alter table public."AgentRun" enable row level security;
alter table public."AgentLog" enable row level security;
alter table public."GeneratedSite" enable row level security;
alter table public."MarketingPlan" enable row level security;
alter table public."ApprovalPolicy" enable row level security;
alter table public."PendingAction" enable row level security;
alter table public."ScheduledTask" enable row level security;
alter table public."TaskExecution" enable row level security;
alter table public."ActivityEvent" enable row level security;

-- Drop existing policies to keep this script idempotent.
drop policy if exists user_select_self on public."User";
drop policy if exists user_update_self on public."User";

drop policy if exists apikey_owner_all on public."ApiKey";
drop policy if exists business_owner_all on public."Business";
drop policy if exists inventory_owner_all on public."InventoryItem";
drop policy if exists run_owner_all on public."AgentRun";
drop policy if exists log_owner_all on public."AgentLog";
drop policy if exists generated_site_owner_all on public."GeneratedSite";
drop policy if exists marketing_plan_owner_all on public."MarketingPlan";
drop policy if exists approval_policy_owner_all on public."ApprovalPolicy";
drop policy if exists pending_action_owner_all on public."PendingAction";
drop policy if exists scheduled_task_owner_all on public."ScheduledTask";
drop policy if exists task_execution_owner_all on public."TaskExecution";
drop policy if exists activity_event_owner_all on public."ActivityEvent";

-- User table: user can read/update own row by immutable auth UUID.
create policy user_select_self
on public."User"
for select
to authenticated
using (
  "supabaseAuthId" = (select auth.uid())
);

create policy user_update_self
on public."User"
for update
to authenticated
using (
  "supabaseAuthId" = (select auth.uid())
)
with check (
  "supabaseAuthId" = (select auth.uid())
);

-- Helper owner predicate for tables directly owned by User.userId.
create policy apikey_owner_all
on public."ApiKey"
for all
to authenticated
using (
  exists (
    select 1
    from public."User" u
    where u."id" = "ApiKey"."userId"
      and u."supabaseAuthId" = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public."User" u
    where u."id" = "ApiKey"."userId"
      and u."supabaseAuthId" = (select auth.uid())
  )
);

create policy business_owner_all
on public."Business"
for all
to authenticated
using (
  exists (
    select 1
    from public."User" u
    where u."id" = "Business"."userId"
      and u."supabaseAuthId" = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public."User" u
    where u."id" = "Business"."userId"
      and u."supabaseAuthId" = (select auth.uid())
  )
);

-- Child tables owned via Business.
create policy inventory_owner_all
on public."InventoryItem"
for all
to authenticated
using (
  exists (
    select 1
    from public."Business" b
    join public."User" u on u."id" = b."userId"
    where b."id" = "InventoryItem"."businessId"
      and u."supabaseAuthId" = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public."Business" b
    join public."User" u on u."id" = b."userId"
    where b."id" = "InventoryItem"."businessId"
      and u."supabaseAuthId" = (select auth.uid())
  )
);

create policy run_owner_all
on public."AgentRun"
for all
to authenticated
using (
  exists (
    select 1
    from public."Business" b
    join public."User" u on u."id" = b."userId"
    where b."id" = "AgentRun"."businessId"
      and u."supabaseAuthId" = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public."Business" b
    join public."User" u on u."id" = b."userId"
    where b."id" = "AgentRun"."businessId"
      and u."supabaseAuthId" = (select auth.uid())
  )
);

create policy log_owner_all
on public."AgentLog"
for all
to authenticated
using (
  exists (
    select 1
    from public."AgentRun" r
    join public."Business" b on b."id" = r."businessId"
    join public."User" u on u."id" = b."userId"
    where r."id" = "AgentLog"."runId"
      and u."supabaseAuthId" = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public."AgentRun" r
    join public."Business" b on b."id" = r."businessId"
    join public."User" u on u."id" = b."userId"
    where r."id" = "AgentLog"."runId"
      and u."supabaseAuthId" = (select auth.uid())
  )
);

create policy generated_site_owner_all
on public."GeneratedSite"
for all
to authenticated
using (
  exists (
    select 1
    from public."Business" b
    join public."User" u on u."id" = b."userId"
    where b."id" = "GeneratedSite"."businessId"
      and u."supabaseAuthId" = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public."Business" b
    join public."User" u on u."id" = b."userId"
    where b."id" = "GeneratedSite"."businessId"
      and u."supabaseAuthId" = (select auth.uid())
  )
);

create policy marketing_plan_owner_all
on public."MarketingPlan"
for all
to authenticated
using (
  exists (
    select 1
    from public."Business" b
    join public."User" u on u."id" = b."userId"
    where b."id" = "MarketingPlan"."businessId"
      and u."supabaseAuthId" = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public."Business" b
    join public."User" u on u."id" = b."userId"
    where b."id" = "MarketingPlan"."businessId"
      and u."supabaseAuthId" = (select auth.uid())
  )
);

create policy approval_policy_owner_all
on public."ApprovalPolicy"
for all
to authenticated
using (
  exists (
    select 1
    from public."Business" b
    join public."User" u on u."id" = b."userId"
    where b."id" = "ApprovalPolicy"."businessId"
      and u."supabaseAuthId" = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public."Business" b
    join public."User" u on u."id" = b."userId"
    where b."id" = "ApprovalPolicy"."businessId"
      and u."supabaseAuthId" = (select auth.uid())
  )
);

create policy pending_action_owner_all
on public."PendingAction"
for all
to authenticated
using (
  exists (
    select 1
    from public."Business" b
    join public."User" u on u."id" = b."userId"
    where b."id" = "PendingAction"."businessId"
      and u."supabaseAuthId" = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public."Business" b
    join public."User" u on u."id" = b."userId"
    where b."id" = "PendingAction"."businessId"
      and u."supabaseAuthId" = (select auth.uid())
  )
);

create policy scheduled_task_owner_all
on public."ScheduledTask"
for all
to authenticated
using (
  exists (
    select 1
    from public."Business" b
    join public."User" u on u."id" = b."userId"
    where b."id" = "ScheduledTask"."businessId"
      and u."supabaseAuthId" = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public."Business" b
    join public."User" u on u."id" = b."userId"
    where b."id" = "ScheduledTask"."businessId"
      and u."supabaseAuthId" = (select auth.uid())
  )
);

create policy task_execution_owner_all
on public."TaskExecution"
for all
to authenticated
using (
  exists (
    select 1
    from public."ScheduledTask" st
    join public."Business" b on b."id" = st."businessId"
    join public."User" u on u."id" = b."userId"
    where st."id" = "TaskExecution"."scheduledTaskId"
      and u."supabaseAuthId" = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public."ScheduledTask" st
    join public."Business" b on b."id" = st."businessId"
    join public."User" u on u."id" = b."userId"
    where st."id" = "TaskExecution"."scheduledTaskId"
      and u."supabaseAuthId" = (select auth.uid())
  )
);

create policy activity_event_owner_all
on public."ActivityEvent"
for all
to authenticated
using (
  exists (
    select 1
    from public."Business" b
    join public."User" u on u."id" = b."userId"
    where b."id" = "ActivityEvent"."businessId"
      and u."supabaseAuthId" = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public."Business" b
    join public."User" u on u."id" = b."userId"
    where b."id" = "ActivityEvent"."businessId"
      and u."supabaseAuthId" = (select auth.uid())
  )
);

commit;
