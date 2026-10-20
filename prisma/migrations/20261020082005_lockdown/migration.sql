-- The browser's Supabase key must read and write nothing in `public`. Prisma connects as the owner
-- and bypasses RLS; the app authorizes every request itself (src/lib/auth/scope.ts).
--
-- Driven from the catalog, not a hand-kept list, so it covers every table that exists. Per-table
-- REVOKE, not ALTER DEFAULT PRIVILEGES: default privileges have silently not applied on the
-- product database before. Any later migration that adds a table must re-run this block.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- Realtime: only team members may receive broadcasts on private channels.
CREATE OR REPLACE FUNCTION public.is_team_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()))
$$;

REVOKE ALL ON FUNCTION public.is_team_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_member() TO authenticated;

DROP POLICY IF EXISTS "team_receives_broadcasts" ON realtime.messages;
CREATE POLICY "team_receives_broadcasts" ON realtime.messages
  FOR SELECT TO authenticated
  USING (public.is_team_member());
