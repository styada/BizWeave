begin;

select plan(20);

select has_column(
  'public',
  'User',
  'supabaseAuthId',
  'public."User" has supabaseAuthId'
);

select col_type_is(
  'public',
  'User',
  'supabaseAuthId',
  'uuid',
  'public."User".supabaseAuthId is uuid'
);

select has_index(
  'public',
  'User',
  'User_supabaseAuthId_key',
  'public."User" has unique index on supabaseAuthId'
);

select is(
  (
    select count(*)::int
    from pg_class c
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
      and c.relkind = 'r'
      and c.relrowsecurity
  ),
  13,
  'RLS is enabled on all expected public application tables'
);

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'User'),
  2,
  'public."User" has two policies'
);

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'ApiKey'), 1, 'public."ApiKey" has one policy');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'Business'), 1, 'public."Business" has one policy');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'InventoryItem'), 1, 'public."InventoryItem" has one policy');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'AgentRun'), 1, 'public."AgentRun" has one policy');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'AgentLog'), 1, 'public."AgentLog" has one policy');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'GeneratedSite'), 1, 'public."GeneratedSite" has one policy');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'MarketingPlan'), 1, 'public."MarketingPlan" has one policy');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'ApprovalPolicy'), 1, 'public."ApprovalPolicy" has one policy');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'PendingAction'), 1, 'public."PendingAction" has one policy');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'ScheduledTask'), 1, 'public."ScheduledTask" has one policy');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'TaskExecution'), 1, 'public."TaskExecution" has one policy');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'ActivityEvent'), 1, 'public."ActivityEvent" has one policy');

select * from finish();
rollback;
