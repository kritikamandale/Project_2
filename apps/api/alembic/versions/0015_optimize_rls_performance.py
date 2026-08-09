"""Phase 15 — Optimize RLS performance with InitPlan scalar subqueries.

Wraps function calls (app_current_user_id and current_setting) in (SELECT ...)
within RLS policies to prevent per-row function evaluation. This forces PostgreSQL
to evaluate the function ONCE per query (InitPlan) instead of N times per row scanned.

Resolves Supabase Performance Advisor warning: "Auth RLS Initialization Plan".

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-09
"""

from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None

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
    "skin_scans",
    "questionnaire_responses",
    "recommendations",
]

_PUBLIC_READ_TABLES = [
    "products",
    "product_embeddings",
    "platform_settings",
]


def upgrade() -> None:
    # 1. users table
    op.execute("""DROP POLICY IF EXISTS users_isolation ON users""")
    op.execute("""CREATE POLICY users_isolation ON users
        USING (id = (SELECT app_current_user_id()))
        WITH CHECK (id = (SELECT app_current_user_id()))""")
    op.execute("""DROP POLICY IF EXISTS users_service_bypass ON users""")
    op.execute("""CREATE POLICY users_service_bypass ON users
        USING ((SELECT current_setting('app.rls_bypass', true)) = 'on')
        WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on')""")

    # 2. Direct user_id tables
    for table in _USER_DIRECT_TABLES:
        op.execute(f"""DROP POLICY IF EXISTS {table}_user_isolation ON {table}""")
        op.execute(f"""CREATE POLICY {table}_user_isolation ON {table}
            USING (user_id = (SELECT app_current_user_id()))
            WITH CHECK (user_id = (SELECT app_current_user_id()))""")
        op.execute(f"""DROP POLICY IF EXISTS {table}_service_bypass ON {table}""")
        op.execute(f"""CREATE POLICY {table}_service_bypass ON {table}
            USING ((SELECT current_setting('app.rls_bypass', true)) = 'on')
            WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on')""")

    # 3. Dermatologist profiles
    op.execute("""DROP POLICY IF EXISTS dermatologist_profiles_user_isolation ON dermatologist_profiles""")
    op.execute("""CREATE POLICY dermatologist_profiles_user_isolation ON dermatologist_profiles
        USING (user_id = (SELECT app_current_user_id()))
        WITH CHECK (user_id = (SELECT app_current_user_id()))""")
    op.execute("""DROP POLICY IF EXISTS dermatologist_profiles_service_bypass ON dermatologist_profiles""")
    op.execute("""CREATE POLICY dermatologist_profiles_service_bypass ON dermatologist_profiles
        USING ((SELECT current_setting('app.rls_bypass', true)) = 'on')
        WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on')""")

    # 4. Product suggestions
    op.execute("""DROP POLICY IF EXISTS product_suggestions_user_isolation ON product_suggestions""")
    op.execute("""CREATE POLICY product_suggestions_user_isolation ON product_suggestions
        USING (suggested_by = (SELECT app_current_user_id()))
        WITH CHECK (suggested_by = (SELECT app_current_user_id()))""")
    op.execute("""DROP POLICY IF EXISTS product_suggestions_service_bypass ON product_suggestions""")
    op.execute("""CREATE POLICY product_suggestions_service_bypass ON product_suggestions
        USING ((SELECT current_setting('app.rls_bypass', true)) = 'on')
        WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on')""")

    # 5. Skin conditions
    op.execute("""DROP POLICY IF EXISTS skin_conditions_user_isolation ON skin_conditions""")
    op.execute("""CREATE POLICY skin_conditions_user_isolation ON skin_conditions
        USING (EXISTS (SELECT 1 FROM skin_scans WHERE skin_scans.id = skin_conditions.scan_id AND skin_scans.user_id = (SELECT app_current_user_id())))
        WITH CHECK (EXISTS (SELECT 1 FROM skin_scans WHERE skin_scans.id = skin_conditions.scan_id AND skin_scans.user_id = (SELECT app_current_user_id())))""")
    op.execute("""DROP POLICY IF EXISTS skin_conditions_service_bypass ON skin_conditions""")
    op.execute("""CREATE POLICY skin_conditions_service_bypass ON skin_conditions
        USING ((SELECT current_setting('app.rls_bypass', true)) = 'on')
        WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on')""")

    # 6. Recommendation products
    op.execute("""DROP POLICY IF EXISTS recommendation_products_user_isolation ON recommendation_products""")
    op.execute("""CREATE POLICY recommendation_products_user_isolation ON recommendation_products
        USING (EXISTS (SELECT 1 FROM recommendations WHERE recommendations.id = recommendation_products.recommendation_id AND recommendations.user_id = (SELECT app_current_user_id())))
        WITH CHECK (EXISTS (SELECT 1 FROM recommendations WHERE recommendations.id = recommendation_products.recommendation_id AND recommendations.user_id = (SELECT app_current_user_id())))""")
    op.execute("""DROP POLICY IF EXISTS recommendation_products_service_bypass ON recommendation_products""")
    op.execute("""CREATE POLICY recommendation_products_service_bypass ON recommendation_products
        USING ((SELECT current_setting('app.rls_bypass', true)) = 'on')
        WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on')""")

    # 7. Progress metrics
    op.execute("""DROP POLICY IF EXISTS progress_metrics_user_isolation ON progress_metrics""")
    op.execute("""CREATE POLICY progress_metrics_user_isolation ON progress_metrics
        USING (EXISTS (SELECT 1 FROM progress_scans WHERE progress_scans.id = progress_metrics.progress_scan_id AND progress_scans.user_id = (SELECT app_current_user_id())))
        WITH CHECK (EXISTS (SELECT 1 FROM progress_scans WHERE progress_scans.id = progress_metrics.progress_scan_id AND progress_scans.user_id = (SELECT app_current_user_id())))""")
    op.execute("""DROP POLICY IF EXISTS progress_metrics_service_bypass ON progress_metrics""")
    op.execute("""CREATE POLICY progress_metrics_service_bypass ON progress_metrics
        USING ((SELECT current_setting('app.rls_bypass', true)) = 'on')
        WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on')""")

    # 8. Review queue
    op.execute("""DROP POLICY IF EXISTS review_queue_assigned_isolation ON review_queue""")
    op.execute("""CREATE POLICY review_queue_assigned_isolation ON review_queue
        USING (assigned_to = (SELECT app_current_user_id()))
        WITH CHECK (assigned_to = (SELECT app_current_user_id()))""")
    op.execute("""DROP POLICY IF EXISTS review_queue_service_bypass ON review_queue""")
    op.execute("""CREATE POLICY review_queue_service_bypass ON review_queue
        USING ((SELECT current_setting('app.rls_bypass', true)) = 'on')
        WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on')""")

    # 9. Public catalog tables
    for table in _PUBLIC_READ_TABLES:
        op.execute(f"""DROP POLICY IF EXISTS {table}_service_bypass ON {table}""")
        op.execute(f"""CREATE POLICY {table}_service_bypass ON {table} FOR ALL
            USING ((SELECT current_setting('app.rls_bypass', true)) = 'on')
            WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on')""")


def downgrade() -> None:
    pass
