# Supabase Database Tests

These tests follow Supabase's database testing approach with pgTAP and are executed by the Supabase CLI.

## Layout

- `supabase/tests/database/*.sql` contains pgTAP tests.

## Run

1. Ensure Supabase CLI is installed.
2. Ensure `pgtap` extension is enabled in the target database.
3. Run:

```bash
supabase test db
```

You can also run the npm wrapper from project root:

```bash
npm run test:supabase:db
```
