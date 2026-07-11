-- =============================================================================
-- Least-privilege application role for RLS enforcement (resolves audit RLS #2)
--
-- The app currently connects as `postgres`, which has BYPASSRLS and therefore
-- skips every Row-Level Security policy. This creates a dedicated login role
-- WITHOUT BYPASSRLS so the `_user_isolation` / `_service_bypass` policies on
-- skin_scans, questionnaire_responses and recommendations actually take effect.
--
-- HOW TO RUN
--   Supabase Dashboard -> SQL Editor -> paste -> Run.
--   1. Replace <STRONG_PASSWORD> below with a strong random value
--      (e.g. `openssl rand -hex 24`). Do NOT reuse the postgres password.
--   2. After it succeeds, update apps/api/.env DATABASE_URL (see bottom).
-- =============================================================================

-- 1) Create the role (NOBYPASSRLS is the whole point). Re-runnable.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'skinest_app') THEN
    ALTER ROLE skinest_app WITH LOGIN PASSWORD '<STRONG_PASSWORD>'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  ELSE
    CREATE ROLE skinest_app WITH LOGIN PASSWORD '<STRONG_PASSWORD>'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

-- 2) Grant exactly what the app needs on the public schema.
GRANT USAGE ON SCHEMA public TO skinest_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO skinest_app;
GRANT USAGE, SELECT, UPDATE         ON ALL SEQUENCES  IN SCHEMA public TO skinest_app;
GRANT EXECUTE                       ON ALL FUNCTIONS  IN SCHEMA public TO skinest_app;

-- 3) Same grants for objects created by FUTURE migrations.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO skinest_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE          ON SEQUENCES TO skinest_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE                        ON FUNCTIONS TO skinest_app;

-- 4) Verify (expect rolbypassrls = false, rolcanlogin = true).
SELECT rolname, rolsuper, rolbypassrls, rolcanlogin
FROM pg_roles WHERE rolname = 'skinest_app';

-- =============================================================================
-- THEN update apps/api/.env — keep migrations/seed on the postgres URL, but run
-- the *app* as skinest_app. Through the Supabase transaction pooler the username
-- is "<role>.<project-ref>", i.e.:
--
--   DATABASE_URL=postgresql://skinest_app.qskkiyrufzbrorjiujdm:<STRONG_PASSWORD>@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
--
-- If the password contains reserved URL characters, percent-encode them
-- (@ -> %40, # -> %23, etc.). A hex password avoids this entirely.
--
-- ROLLBACK (if anything misbehaves): set DATABASE_URL back to the postgres URL.
-- To remove the role: REASSIGN OWNED BY skinest_app TO postgres; DROP OWNED BY
-- skinest_app; DROP ROLE skinest_app;
-- =============================================================================
