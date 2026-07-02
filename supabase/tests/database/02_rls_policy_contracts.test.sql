begin;

select plan(16);

select results_eq(
  $$select policyname from pg_policies where schemaname = 'public' and tablename = 'User' order by policyname$$,
  $$values ('user_select_self'::text), ('user_update_self'::text)$$,
  'public."User" has expected policy names'
);

select results_eq($$select policyname from pg_policies where schemaname = 'public' and tablename = 'ApiKey' order by policyname$$, $$values ('apikey_owner_all'::text)$$, 'public."ApiKey" policy name matches baseline');
select results_eq($$select policyname from pg_policies where schemaname = 'public' and tablename = 'Business' order by policyname$$, $$values ('business_owner_all'::text)$$, 'public."Business" policy name matches baseline');
select results_eq($$select policyname from pg_policies where schemaname = 'public' and tablename = 'InventoryItem' order by policyname$$, $$values ('inventory_owner_all'::text)$$, 'public."InventoryItem" policy name matches baseline');
select results_eq($$select policyname from pg_policies where schemaname = 'public' and tablename = 'AgentRun' order by policyname$$, $$values ('run_owner_all'::text)$$, 'public."AgentRun" policy name matches baseline');
select results_eq($$select policyname from pg_policies where schemaname = 'public' and tablename = 'AgentLog' order by policyname$$, $$values ('log_owner_all'::text)$$, 'public."AgentLog" policy name matches baseline');
select results_eq($$select policyname from pg_policies where schemaname = 'public' and tablename = 'GeneratedSite' order by policyname$$, $$values ('generated_site_owner_all'::text)$$, 'public."GeneratedSite" policy name matches baseline');
select results_eq($$select policyname from pg_policies where schemaname = 'public' and tablename = 'MarketingPlan' order by policyname$$, $$values ('marketing_plan_owner_all'::text)$$, 'public."MarketingPlan" policy name matches baseline');
select results_eq($$select policyname from pg_policies where schemaname = 'public' and tablename = 'ApprovalPolicy' order by policyname$$, $$values ('approval_policy_owner_all'::text)$$, 'public."ApprovalPolicy" policy name matches baseline');
select results_eq($$select policyname from pg_policies where schemaname = 'public' and tablename = 'PendingAction' order by policyname$$, $$values ('pending_action_owner_all'::text)$$, 'public."PendingAction" policy name matches baseline');
select results_eq($$select policyname from pg_policies where schemaname = 'public' and tablename = 'ScheduledTask' order by policyname$$, $$values ('scheduled_task_owner_all'::text)$$, 'public."ScheduledTask" policy name matches baseline');
select results_eq($$select policyname from pg_policies where schemaname = 'public' and tablename = 'TaskExecution' order by policyname$$, $$values ('task_execution_owner_all'::text)$$, 'public."TaskExecution" policy name matches baseline');
select results_eq($$select policyname from pg_policies where schemaname = 'public' and tablename = 'ActivityEvent' order by policyname$$, $$values ('activity_event_owner_all'::text)$$, 'public."ActivityEvent" policy name matches baseline');

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename = any (
        array[
          'User',
          'ApiKey',
          'Business',
          'InventoryItem',
          'AgentRun',
          'AgentLog',
          'GeneratedSite',
          'MarketingPlan',
          'ApprovalPolicy',
          'PendingAction',
          'ScheduledTask',
          'TaskExecution',
          'ActivityEvent'
        ]
      )
      and not (roles @> array['authenticated'])
  ),
  0,
  'All policies apply to authenticated role'
);

select is(
  (
    select count(*)::int
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any (
        array[
          'User',
          'ApiKey',
          'Business',
          'InventoryItem',
          'AgentRun',
          'AgentLog',
          'GeneratedSite',
          'MarketingPlan',
          'ApprovalPolicy',
          'PendingAction',
          'ScheduledTask',
          'TaskExecution',
          'ActivityEvent'
        ]
      )
      and (
        coalesce(pg_get_expr(p.polqual, p.polrelid), '') ilike '%auth.role(%'
        or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ilike '%auth.role(%'
      )
  ),
  0,
  'Policies avoid deprecated auth.role() checks'
);

select * from finish();
rollback;
