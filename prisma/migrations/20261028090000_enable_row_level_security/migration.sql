-- Hosted Postgres such as Supabase publishes every table in the public schema through
-- an HTTP Data API that anyone holding the project's anon key can call. Row level
-- security with no policies denies those roles everything. The app connects as the
-- tables' owner, which RLS does not apply to, so its own queries are unaffected.
-- Plain Postgres has no such API; there this is defence in depth and changes nothing.
DO $$
DECLARE
    t record;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = current_schema() LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
    END LOOP;
END
$$;
