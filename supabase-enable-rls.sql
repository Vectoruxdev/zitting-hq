-- Zitting Finance — enable Row Level Security on every public table (security).
--
-- WHY: Supabase exposes the `public` schema through its auto-generated PostgREST
-- REST API, reachable with the project's public `anon` key. Without RLS those
-- tables are readable/writable through that API (the linter's
-- `rls_disabled_in_public` ERROR).
--
-- This app does NOT use the Supabase JS client / anon key at all — it talks to
-- Postgres directly (postgres.js + Drizzle, see src/db/index.ts) over the
-- pooler `POSTGRES_URL` as the `postgres` role, which OWNS these tables and has
-- BYPASSRLS. So enabling RLS with NO policies:
--   • DENIES all access through the anon/authenticated PostgREST API (deny-by-default), and
--   • leaves the app UNAFFECTED — its `postgres` connection bypasses RLS.
--
-- Idempotent: ENABLE ROW LEVEL SECURITY is a no-op on tables that already have it,
-- so this is safe to run repeatedly. It also covers tables not in the linter's
-- pasted subset and is the one-shot fix for the whole schema.
--
-- Do NOT use FORCE ROW LEVEL SECURITY: that would subject the table OWNER (the
-- app's own connection) to RLS and break every query.
--
-- Expected afterward: Supabase may show an INFO-level lint "RLS enabled, no
-- policy" on these tables. That is CORRECT here — they are intentionally not
-- reachable through the public API; only the server's direct connection uses them.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;

-- Verify: every public table should now report rowsecurity = true.
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;
-- Rollback (only if ever needed):
--   SELECT 'ALTER TABLE public.' || quote_ident(tablename) || ' DISABLE ROW LEVEL SECURITY;'
--   FROM pg_tables WHERE schemaname = 'public';
