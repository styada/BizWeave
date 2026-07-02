# Supabase Managed Postgres + RLS Migration Checklist

This checklist is tailored to the current Bizweave schema and Supabase auth rollout.

## 1) Environment and project wiring

- Keep these env vars set in local and deployment environments:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `DATABASE_URL` (point this to Supabase Postgres connection string for staging/prod)
- Keep `service_role` key server-only and never expose it with `NEXT_PUBLIC_`.

## 2) Data model strategy

- Current app schema uses `public."User"` as the ownership root and links all business data by `userId`.
- Supabase Auth user identity is mapped by immutable UUID in `public."User"."supabaseAuthId"`.
- Avoid email-based authorization in RLS policies.

## 3) Apply RLS baseline

1. Run [docs/supabase/uuid-mapping-migration.sql](docs/supabase/uuid-mapping-migration.sql) in Supabase SQL Editor.
2. Backfill `supabaseAuthId` values by signing in users once (app auto-links by email), or by admin SQL if needed.
3. Run [docs/supabase/rls-baseline.sql](docs/supabase/rls-baseline.sql).
4. Verify each table in `public` has RLS enabled.
5. Verify authenticated user can only read/write their own business graph.

## 4) Auth dashboard configuration

- In Supabase Auth URL config:
  - Site URL = your app base URL.
  - Redirect URLs include:
    - `/auth/forgot-password`
    - `/auth/confirm`
- In Auth email templates, use links with:
  - `token_hash`
  - `type`
  - `next`

## 5) Data API and grants

- If Data API is enabled with explicit grants mode, ensure `authenticated` has required table privileges.
- Keep `anon` access minimal or disabled for private app tables.

## 6) Verification pass

Run these checks after rollout:

1. Sign up, confirm email, and land on authenticated route.
2. Login/logout and password reset flow complete.
3. User A cannot read/update User B data through API.
4. Dashboard, onboarding, and business CRUD still work.
5. Background/scheduler jobs still function using server-side credentials.

## 7) Production hardening

- Keep short JWT expiry if you require fast revocation semantics.
- Add monitoring for RLS denied queries and unexpected policy misses.
- Run Supabase advisors before each schema/security migration.
