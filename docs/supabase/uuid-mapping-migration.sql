-- One-time migration to add immutable Supabase auth UUID mapping.
-- Run this before applying UUID-based RLS policies.

begin;

alter table public."User"
  add column if not exists "supabaseAuthId" uuid;

create unique index if not exists "User_supabaseAuthId_key"
  on public."User"("supabaseAuthId");

-- Optional but recommended if all active users are now Supabase-backed:
-- alter table public."User" alter column "supabaseAuthId" set not null;

commit;
