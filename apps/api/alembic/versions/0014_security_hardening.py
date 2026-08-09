"""Phase 14 — Security hardening for functions and vector extension.

Fixes Supabase Linter Security Advisories:
  1. Relocates pgvector extension from `public` to `extensions` schema.
  2. Sets immutable search_path (`SET search_path = public, pg_temp`) on SECURITY DEFINER functions to prevent search_path hijacking.
  3. Changes `app_current_user_id()` to SECURITY INVOKER (since it only reads transaction setting).
  4. Revokes PUBLIC & authenticated EXECUTE privileges on trigger function `audit_trigger_fn()`.

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-09
"""

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Relocate pgvector extension to extensions schema if in public
    op.execute("""CREATE SCHEMA IF NOT EXISTS extensions;
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_extension e 
                JOIN pg_namespace n ON e.extnamespace = n.oid 
                WHERE e.extname = 'vector' AND n.nspname = 'public') THEN
                ALTER EXTENSION vector SET SCHEMA extensions;
            END IF;
        END $$;""")

    # 2. Update app_current_user_id() function to SECURITY INVOKER with explicit search_path
    op.execute("""CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid AS $$
        BEGIN
            RETURN current_setting('app.current_user_id', true)::uuid;
        EXCEPTION WHEN OTHERS THEN
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp""")

    # 3. Update audit_trigger_fn() to SECURITY DEFINER with explicit search_path
    op.execute("""CREATE OR REPLACE FUNCTION audit_trigger_fn()
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
        $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp""")

    # 4. Revoke EXECUTE from PUBLIC/anon/authenticated on SECURITY DEFINER / internal functions
    op.execute("""REVOKE EXECUTE ON FUNCTION audit_trigger_fn() FROM PUBLIC, anon, authenticated""")
    op.execute("""REVOKE EXECUTE ON FUNCTION app_current_user_id() FROM PUBLIC, anon""")


def downgrade() -> None:
    # Revert app_current_user_id
    op.execute("""CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid AS $$
        BEGIN
            RETURN current_setting('app.current_user_id', true)::uuid;
        EXCEPTION WHEN OTHERS THEN
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql STABLE SECURITY DEFINER""")

    # Revert audit_trigger_fn
    op.execute("""CREATE OR REPLACE FUNCTION audit_trigger_fn()
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
        $$ LANGUAGE plpgsql SECURITY DEFINER""")
