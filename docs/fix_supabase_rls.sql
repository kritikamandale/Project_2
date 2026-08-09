-- =============================================================================
-- Supabase Complete Security & Performance Hardening Script (Final Unified)
-- Resolves ALL Supabase Security and Performance Advisor warnings:
--   1. RLS Disabled in Public (Security)
--   2. Extension in Public (public.vector) (Security)
--   3. Function Search Path Mutable (Security)
--   4. Public / Signed-In Users Can Execute SECURITY DEFINER Functions (Security)
--   5. RLS Policy Always True (Security: Catalog write policies restricted)
--   6. Auth RLS Initialization Plan (Performance: InitPlan subqueries)
--   7. Duplicate Index (Performance: Drops redundant duplicate indexes)
--   8. Multiple Permissive Policies (Performance: Strict 1-policy-per-command mapping)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1: Extension Hardening (Move pgvector from public to extensions schema)
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension e 
        JOIN pg_namespace n ON e.extnamespace = n.oid 
        WHERE e.extname = 'vector' AND n.nspname = 'public'
    ) THEN
        ALTER EXTENSION vector SET SCHEMA extensions;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- SECTION 2: Function Security Hardening (Search path + Invoker/Definer permissions)
-- -----------------------------------------------------------------------------

-- Helper function used by RLS policies (SECURITY INVOKER with explicit search_path)
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid AS $$
BEGIN
    RETURN current_setting('app.current_user_id', true)::uuid;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp;

-- Audit trigger function (SECURITY DEFINER with explicit search_path)
CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
    _user_id UUID;
    _metadata JSONB;
BEGIN
    BEGIN
        _user_id := current_setting('app.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        _user_id := NULL;
    END;

    IF TG_OP = 'DELETE' THEN
        _metadata := to_jsonb(OLD);
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, timestamp, metadata)
        VALUES (gen_random_uuid(), _user_id, 'DELETE', TG_TABLE_NAME, OLD.id, NOW(), _metadata);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        _metadata := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, timestamp, metadata)
        VALUES (gen_random_uuid(), _user_id, 'UPDATE', TG_TABLE_NAME, NEW.id, NOW(), _metadata);
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        _metadata := to_jsonb(NEW);
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, timestamp, metadata)
        VALUES (gen_random_uuid(), _user_id, 'INSERT', TG_TABLE_NAME, NEW.id, NOW(), _metadata);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Revoke direct execution permissions from public & API roles
REVOKE EXECUTE ON FUNCTION audit_trigger_fn() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION app_current_user_id() FROM PUBLIC, anon;

-- -----------------------------------------------------------------------------
-- SECTION 3: Remove Duplicate Redundant Indexes
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS ix_users_id;
DROP INDEX IF EXISTS ix_users_email;
DROP INDEX IF EXISTS ix_user_profiles_user_id;
DROP INDEX IF EXISTS ix_environment_profiles_user_id;
DROP INDEX IF EXISTS ix_skincare_routine_current_user_id;
DROP INDEX IF EXISTS ix_review_queue_recommendation_id;

-- -----------------------------------------------------------------------------
-- SECTION 4: Enable RLS & FORCE RLS on ALL public schema tables
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', r.tablename);
    END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- SECTION 5: Clean Up ALL Existing Policies Across All Public Tables
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
    END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- SECTION 6: Create Strictly Scanned, Non-Overlapping RLS Policies
-- -----------------------------------------------------------------------------

-- 6A. USER TABLES (Strictly 1 policy FOR ALL per table)

-- users
CREATE POLICY users_policy ON users FOR ALL
USING ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR id = (SELECT app_current_user_id()))
WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR id = (SELECT app_current_user_id()));

-- user_profiles
CREATE POLICY user_profiles_policy ON user_profiles FOR ALL
USING ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()))
WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()));

-- refresh_tokens
CREATE POLICY refresh_tokens_policy ON refresh_tokens FOR ALL
USING ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()))
WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()));

-- audit_logs
CREATE POLICY audit_logs_policy ON audit_logs FOR ALL
USING ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()))
WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()));

-- environment_profiles
CREATE POLICY environment_profiles_policy ON environment_profiles FOR ALL
USING ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()))
WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()));

-- skincare_routine_current
CREATE POLICY skincare_routine_current_policy ON skincare_routine_current FOR ALL
USING ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()))
WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()));

-- progress_scans
CREATE POLICY progress_scans_policy ON progress_scans FOR ALL
USING ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()))
WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()));

-- routine_checkins
CREATE POLICY routine_checkins_policy ON routine_checkins FOR ALL
USING ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()))
WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()));

-- product_feedback
CREATE POLICY product_feedback_policy ON product_feedback FOR ALL
USING ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()))
WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()));

-- in_app_notifications
CREATE POLICY in_app_notifications_policy ON in_app_notifications FOR ALL
USING ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()))
WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()));

-- skin_scans
CREATE POLICY skin_scans_policy ON skin_scans FOR ALL
USING ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()))
WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()));

-- questionnaire_responses
CREATE POLICY questionnaire_responses_policy ON questionnaire_responses FOR ALL
USING ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()))
WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()));

-- recommendations
CREATE POLICY recommendations_policy ON recommendations FOR ALL
USING ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()))
WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()));

-- dermatologist_profiles
CREATE POLICY dermatologist_profiles_policy ON dermatologist_profiles FOR ALL
USING ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()))
WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR user_id = (SELECT app_current_user_id()));

-- product_suggestions
CREATE POLICY product_suggestions_policy ON product_suggestions FOR ALL
USING ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR suggested_by = (SELECT app_current_user_id()))
WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR suggested_by = (SELECT app_current_user_id()));

-- skin_conditions
CREATE POLICY skin_conditions_policy ON skin_conditions FOR ALL
USING ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR EXISTS (SELECT 1 FROM skin_scans WHERE skin_scans.id = skin_conditions.scan_id AND skin_scans.user_id = (SELECT app_current_user_id())))
WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR EXISTS (SELECT 1 FROM skin_scans WHERE skin_scans.id = skin_conditions.scan_id AND skin_scans.user_id = (SELECT app_current_user_id())));

-- recommendation_products
CREATE POLICY recommendation_products_policy ON recommendation_products FOR ALL
USING ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR EXISTS (SELECT 1 FROM recommendations WHERE recommendations.id = recommendation_products.recommendation_id AND recommendations.user_id = (SELECT app_current_user_id())))
WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR EXISTS (SELECT 1 FROM recommendations WHERE recommendations.id = recommendation_products.recommendation_id AND recommendations.user_id = (SELECT app_current_user_id())));

-- progress_metrics
CREATE POLICY progress_metrics_policy ON progress_metrics FOR ALL
USING ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR EXISTS (SELECT 1 FROM progress_scans WHERE progress_scans.id = progress_metrics.progress_scan_id AND progress_scans.user_id = (SELECT app_current_user_id())))
WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR EXISTS (SELECT 1 FROM progress_scans WHERE progress_scans.id = progress_metrics.progress_scan_id AND progress_scans.user_id = (SELECT app_current_user_id())));

-- review_queue
CREATE POLICY review_queue_policy ON review_queue FOR ALL
USING ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR assigned_to = (SELECT app_current_user_id()))
WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on' OR assigned_to = (SELECT app_current_user_id()));

-- 6B. PUBLIC CATALOG TABLES (Non-Overlapping Command Scoping)

-- products
CREATE POLICY products_select_policy ON products FOR SELECT USING (true);
CREATE POLICY products_insert_policy ON products FOR INSERT WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on');
CREATE POLICY products_update_policy ON products FOR UPDATE USING ((SELECT current_setting('app.rls_bypass', true)) = 'on') WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on');
CREATE POLICY products_delete_policy ON products FOR DELETE USING ((SELECT current_setting('app.rls_bypass', true)) = 'on');

-- product_embeddings
CREATE POLICY product_embeddings_select_policy ON product_embeddings FOR SELECT USING (true);
CREATE POLICY product_embeddings_insert_policy ON product_embeddings FOR INSERT WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on');
CREATE POLICY product_embeddings_update_policy ON product_embeddings FOR UPDATE USING ((SELECT current_setting('app.rls_bypass', true)) = 'on') WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on');
CREATE POLICY product_embeddings_delete_policy ON product_embeddings FOR DELETE USING ((SELECT current_setting('app.rls_bypass', true)) = 'on');

-- platform_settings
CREATE POLICY platform_settings_select_policy ON platform_settings FOR SELECT USING (true);
CREATE POLICY platform_settings_insert_policy ON platform_settings FOR INSERT WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on');
CREATE POLICY platform_settings_update_policy ON platform_settings FOR UPDATE USING ((SELECT current_setting('app.rls_bypass', true)) = 'on') WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on');
CREATE POLICY platform_settings_delete_policy ON platform_settings FOR DELETE USING ((SELECT current_setting('app.rls_bypass', true)) = 'on');
