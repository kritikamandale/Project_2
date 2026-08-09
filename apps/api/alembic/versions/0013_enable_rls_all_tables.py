"""Phase 13 — Enable Row Level Security (RLS) on all public schema tables.

Enables RLS and FORCE RLS on all remaining public tables to resolve Supabase security
warnings and enforce database-level isolation across the entire platform.

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-09
"""

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None

# User-isolated tables having a direct `user_id` column
_USER_DIRECT_TABLES = [
    "user_profiles",
    "refresh_tokens",
    "audit_logs",
    "environment_profiles",
    "skincare_routine_current",
    "progress_scans",
    "routine_checkins",
    "product_feedback",
    "in_app_notifications",
]

# Read-only public catalog tables
_PUBLIC_READ_TABLES = [
    "products",
    "product_embeddings",
    "platform_settings",
]


def upgrade() -> None:
    # Ensure app_current_user_id helper function exists
    op.execute("""CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid AS $$
        BEGIN
            RETURN current_setting('app.current_user_id', true)::uuid;
        EXCEPTION WHEN OTHERS THEN
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql STABLE SECURITY DEFINER""")

    # 1. User Table (users)
    op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE users FORCE ROW LEVEL SECURITY")
    op.execute("""DROP POLICY IF EXISTS users_isolation ON users""")
    op.execute("""CREATE POLICY users_isolation ON users
        USING (id = app_current_user_id())
        WITH CHECK (id = app_current_user_id())""")
    op.execute("""DROP POLICY IF EXISTS users_service_bypass ON users""")
    op.execute("""CREATE POLICY users_service_bypass ON users
        USING (current_setting('app.rls_bypass', true) = 'on')
        WITH CHECK (current_setting('app.rls_bypass', true) = 'on')""")

    # 2. Tables with direct user_id
    for table in _USER_DIRECT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"""DROP POLICY IF EXISTS {table}_user_isolation ON {table}""")
        op.execute(f"""CREATE POLICY {table}_user_isolation ON {table}
            USING (user_id = app_current_user_id())
            WITH CHECK (user_id = app_current_user_id())""")
        op.execute(f"""DROP POLICY IF EXISTS {table}_service_bypass ON {table}""")
        op.execute(f"""CREATE POLICY {table}_service_bypass ON {table}
            USING (current_setting('app.rls_bypass', true) = 'on')
            WITH CHECK (current_setting('app.rls_bypass', true) = 'on')""")

    # 3. Dermatologist Profiles (user_id PK/FK)
    op.execute("ALTER TABLE dermatologist_profiles ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE dermatologist_profiles FORCE ROW LEVEL SECURITY")
    op.execute("""DROP POLICY IF EXISTS dermatologist_profiles_user_isolation ON dermatologist_profiles""")
    op.execute("""CREATE POLICY dermatologist_profiles_user_isolation ON dermatologist_profiles
        USING (user_id = app_current_user_id())
        WITH CHECK (user_id = app_current_user_id())""")
    op.execute("""DROP POLICY IF EXISTS dermatologist_profiles_service_bypass ON dermatologist_profiles""")
    op.execute("""CREATE POLICY dermatologist_profiles_service_bypass ON dermatologist_profiles
        USING (current_setting('app.rls_bypass', true) = 'on')
        WITH CHECK (current_setting('app.rls_bypass', true) = 'on')""")

    # 4. Product Suggestions (suggested_by column)
    op.execute("ALTER TABLE product_suggestions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE product_suggestions FORCE ROW LEVEL SECURITY")
    op.execute("""DROP POLICY IF EXISTS product_suggestions_user_isolation ON product_suggestions""")
    op.execute("""CREATE POLICY product_suggestions_user_isolation ON product_suggestions
        USING (suggested_by = app_current_user_id())
        WITH CHECK (suggested_by = app_current_user_id())""")
    op.execute("""DROP POLICY IF EXISTS product_suggestions_service_bypass ON product_suggestions""")
    op.execute("""CREATE POLICY product_suggestions_service_bypass ON product_suggestions
        USING (current_setting('app.rls_bypass', true) = 'on')
        WITH CHECK (current_setting('app.rls_bypass', true) = 'on')""")

    # 5. Skin Conditions (linked to skin_scans)
    op.execute("ALTER TABLE skin_conditions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE skin_conditions FORCE ROW LEVEL SECURITY")
    op.execute("""DROP POLICY IF EXISTS skin_conditions_user_isolation ON skin_conditions""")
    op.execute("""CREATE POLICY skin_conditions_user_isolation ON skin_conditions
        USING (EXISTS (SELECT 1 FROM skin_scans WHERE skin_scans.id = skin_conditions.scan_id AND skin_scans.user_id = app_current_user_id()))
        WITH CHECK (EXISTS (SELECT 1 FROM skin_scans WHERE skin_scans.id = skin_conditions.scan_id AND skin_scans.user_id = app_current_user_id()))""")
    op.execute("""DROP POLICY IF EXISTS skin_conditions_service_bypass ON skin_conditions""")
    op.execute("""CREATE POLICY skin_conditions_service_bypass ON skin_conditions
        USING (current_setting('app.rls_bypass', true) = 'on')
        WITH CHECK (current_setting('app.rls_bypass', true) = 'on')""")

    # 6. Recommendation Products (linked to recommendations)
    op.execute("ALTER TABLE recommendation_products ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE recommendation_products FORCE ROW LEVEL SECURITY")
    op.execute("""DROP POLICY IF EXISTS recommendation_products_user_isolation ON recommendation_products""")
    op.execute("""CREATE POLICY recommendation_products_user_isolation ON recommendation_products
        USING (EXISTS (SELECT 1 FROM recommendations WHERE recommendations.id = recommendation_products.recommendation_id AND recommendations.user_id = app_current_user_id()))
        WITH CHECK (EXISTS (SELECT 1 FROM recommendations WHERE recommendations.id = recommendation_products.recommendation_id AND recommendations.user_id = app_current_user_id()))""")
    op.execute("""DROP POLICY IF EXISTS recommendation_products_service_bypass ON recommendation_products""")
    op.execute("""CREATE POLICY recommendation_products_service_bypass ON recommendation_products
        USING (current_setting('app.rls_bypass', true) = 'on')
        WITH CHECK (current_setting('app.rls_bypass', true) = 'on')""")

    # 7. Progress Metrics (linked to progress_scans)
    op.execute("ALTER TABLE progress_metrics ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE progress_metrics FORCE ROW LEVEL SECURITY")
    op.execute("""DROP POLICY IF EXISTS progress_metrics_user_isolation ON progress_metrics""")
    op.execute("""CREATE POLICY progress_metrics_user_isolation ON progress_metrics
        USING (EXISTS (SELECT 1 FROM progress_scans WHERE progress_scans.id = progress_metrics.progress_scan_id AND progress_scans.user_id = app_current_user_id()))
        WITH CHECK (EXISTS (SELECT 1 FROM progress_scans WHERE progress_scans.id = progress_metrics.progress_scan_id AND progress_scans.user_id = app_current_user_id()))""")
    op.execute("""DROP POLICY IF EXISTS progress_metrics_service_bypass ON progress_metrics""")
    op.execute("""CREATE POLICY progress_metrics_service_bypass ON progress_metrics
        USING (current_setting('app.rls_bypass', true) = 'on')
        WITH CHECK (current_setting('app.rls_bypass', true) = 'on')""")

    # 8. Review Queue (assigned_to)
    op.execute("ALTER TABLE review_queue ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE review_queue FORCE ROW LEVEL SECURITY")
    op.execute("""DROP POLICY IF EXISTS review_queue_assigned_isolation ON review_queue""")
    op.execute("""CREATE POLICY review_queue_assigned_isolation ON review_queue
        USING (assigned_to = app_current_user_id())
        WITH CHECK (assigned_to = app_current_user_id())""")
    op.execute("""DROP POLICY IF EXISTS review_queue_service_bypass ON review_queue""")
    op.execute("""CREATE POLICY review_queue_service_bypass ON review_queue
        USING (current_setting('app.rls_bypass', true) = 'on')
        WITH CHECK (current_setting('app.rls_bypass', true) = 'on')""")

    # 9. Public Catalog / Reference Tables
    for table in _PUBLIC_READ_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"""DROP POLICY IF EXISTS {table}_read_all ON {table}""")
        op.execute(f"""CREATE POLICY {table}_read_all ON {table} FOR SELECT USING (true)""")
        op.execute(f"""DROP POLICY IF EXISTS {table}_service_bypass ON {table}""")
        op.execute(f"""CREATE POLICY {table}_service_bypass ON {table} FOR ALL
            USING (current_setting('app.rls_bypass', true) = 'on')
            WITH CHECK (current_setting('app.rls_bypass', true) = 'on')""")


def downgrade() -> None:
    for table in _PUBLIC_READ_TABLES:
        op.execute(f"DROP POLICY IF EXISTS {table}_service_bypass ON {table}")
        op.execute(f"DROP POLICY IF EXISTS {table}_read_all ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS review_queue_service_bypass ON review_queue")
    op.execute("DROP POLICY IF EXISTS review_queue_assigned_isolation ON review_queue")
    op.execute("ALTER TABLE review_queue DISABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS progress_metrics_service_bypass ON progress_metrics")
    op.execute("DROP POLICY IF EXISTS progress_metrics_user_isolation ON progress_metrics")
    op.execute("ALTER TABLE progress_metrics DISABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS recommendation_products_service_bypass ON recommendation_products")
    op.execute("DROP POLICY IF EXISTS recommendation_products_user_isolation ON recommendation_products")
    op.execute("ALTER TABLE recommendation_products DISABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS skin_conditions_service_bypass ON skin_conditions")
    op.execute("DROP POLICY IF EXISTS skin_conditions_user_isolation ON skin_conditions")
    op.execute("ALTER TABLE skin_conditions DISABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS product_suggestions_service_bypass ON product_suggestions")
    op.execute("DROP POLICY IF EXISTS product_suggestions_user_isolation ON product_suggestions")
    op.execute("ALTER TABLE product_suggestions DISABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS dermatologist_profiles_service_bypass ON dermatologist_profiles")
    op.execute("DROP POLICY IF EXISTS dermatologist_profiles_user_isolation ON dermatologist_profiles")
    op.execute("ALTER TABLE dermatologist_profiles DISABLE ROW LEVEL SECURITY")

    for table in _USER_DIRECT_TABLES:
        op.execute(f"DROP POLICY IF EXISTS {table}_service_bypass ON {table}")
        op.execute(f"DROP POLICY IF EXISTS {table}_user_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS users_service_bypass ON users")
    op.execute("DROP POLICY IF EXISTS users_isolation ON users")
    op.execute("ALTER TABLE users DISABLE ROW LEVEL SECURITY")
