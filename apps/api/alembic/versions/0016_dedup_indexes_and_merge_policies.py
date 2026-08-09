"""Phase 16 — Remove duplicate indexes and consolidate RLS policies into single policy per table.

Resolves Supabase Performance Advisor warnings:
  1. Duplicate Index (removes redundant ix_* indexes where PK/UNIQUE constraints already indexed the columns).
  2. Multiple Permissive Policies (consolidates isolation + service_bypass into a single policy per table).

Revision ID: 0016
Revises: 0015
Create Date: 2026-08-09
"""

from alembic import op

revision = "0016"
down_revision = "0015"
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
    # -------------------------------------------------------------------------
    # 1. Drop Duplicate Redundant Indexes
    # -------------------------------------------------------------------------
    op.execute("DROP INDEX IF EXISTS ix_users_id;")
    op.execute("DROP INDEX IF EXISTS ix_users_email;")
    op.execute("DROP INDEX IF EXISTS ix_user_profiles_user_id;")
    op.execute("DROP INDEX IF EXISTS ix_environment_profiles_user_id;")
    op.execute("DROP INDEX IF EXISTS ix_skincare_routine_current_user_id;")
    op.execute("DROP INDEX IF EXISTS ix_review_queue_recommendation_id;")

    # -------------------------------------------------------------------------
    # 2. Consolidate RLS Policies (1 policy per table)
    # -------------------------------------------------------------------------

    # users
    op.execute("""
        DROP POLICY IF EXISTS users_isolation ON users;
        DROP POLICY IF EXISTS users_service_bypass ON users;
        DROP POLICY IF EXISTS users_policy ON users;

        CREATE POLICY users_policy ON users FOR ALL
        USING (
            (SELECT current_setting('app.rls_bypass', true)) = 'on'
            OR id = (SELECT app_current_user_id())
        )
        WITH CHECK (
            (SELECT current_setting('app.rls_bypass', true)) = 'on'
            OR id = (SELECT app_current_user_id())
        );
    """)

    # Direct user_id tables
    for table in _USER_DIRECT_TABLES:
        op.execute(f"""
            DROP POLICY IF EXISTS {table}_user_isolation ON {table};
            DROP POLICY IF EXISTS {table}_service_bypass ON {table};
            DROP POLICY IF EXISTS {table}_policy ON {table};

            CREATE POLICY {table}_policy ON {table} FOR ALL
            USING (
                (SELECT current_setting('app.rls_bypass', true)) = 'on'
                OR user_id = (SELECT app_current_user_id())
            )
            WITH CHECK (
                (SELECT current_setting('app.rls_bypass', true)) = 'on'
                OR user_id = (SELECT app_current_user_id())
            );
        """)

    # Dermatologist profiles
    op.execute("""
        DROP POLICY IF EXISTS dermatologist_profiles_user_isolation ON dermatologist_profiles;
        DROP POLICY IF EXISTS dermatologist_profiles_service_bypass ON dermatologist_profiles;
        DROP POLICY IF EXISTS dermatologist_profiles_policy ON dermatologist_profiles;

        CREATE POLICY dermatologist_profiles_policy ON dermatologist_profiles FOR ALL
        USING (
            (SELECT current_setting('app.rls_bypass', true)) = 'on'
            OR user_id = (SELECT app_current_user_id())
        )
        WITH CHECK (
            (SELECT current_setting('app.rls_bypass', true)) = 'on'
            OR user_id = (SELECT app_current_user_id())
        );
    """)

    # Product suggestions
    op.execute("""
        DROP POLICY IF EXISTS product_suggestions_user_isolation ON product_suggestions;
        DROP POLICY IF EXISTS product_suggestions_service_bypass ON product_suggestions;
        DROP POLICY IF EXISTS product_suggestions_policy ON product_suggestions;

        CREATE POLICY product_suggestions_policy ON product_suggestions FOR ALL
        USING (
            (SELECT current_setting('app.rls_bypass', true)) = 'on'
            OR suggested_by = (SELECT app_current_user_id())
        )
        WITH CHECK (
            (SELECT current_setting('app.rls_bypass', true)) = 'on'
            OR suggested_by = (SELECT app_current_user_id())
        );
    """)

    # Skin conditions
    op.execute("""
        DROP POLICY IF EXISTS skin_conditions_user_isolation ON skin_conditions;
        DROP POLICY IF EXISTS skin_conditions_service_bypass ON skin_conditions;
        DROP POLICY IF EXISTS skin_conditions_policy ON skin_conditions;

        CREATE POLICY skin_conditions_policy ON skin_conditions FOR ALL
        USING (
            (SELECT current_setting('app.rls_bypass', true)) = 'on'
            OR EXISTS (SELECT 1 FROM skin_scans WHERE skin_scans.id = skin_conditions.scan_id AND skin_scans.user_id = (SELECT app_current_user_id()))
        )
        WITH CHECK (
            (SELECT current_setting('app.rls_bypass', true)) = 'on'
            OR EXISTS (SELECT 1 FROM skin_scans WHERE skin_scans.id = skin_conditions.scan_id AND skin_scans.user_id = (SELECT app_current_user_id()))
        );
    """)

    # Recommendation products
    op.execute("""
        DROP POLICY IF EXISTS recommendation_products_user_isolation ON recommendation_products;
        DROP POLICY IF EXISTS recommendation_products_service_bypass ON recommendation_products;
        DROP POLICY IF EXISTS recommendation_products_policy ON recommendation_products;

        CREATE POLICY recommendation_products_policy ON recommendation_products FOR ALL
        USING (
            (SELECT current_setting('app.rls_bypass', true)) = 'on'
            OR EXISTS (SELECT 1 FROM recommendations WHERE recommendations.id = recommendation_products.recommendation_id AND recommendations.user_id = (SELECT app_current_user_id()))
        )
        WITH CHECK (
            (SELECT current_setting('app.rls_bypass', true)) = 'on'
            OR EXISTS (SELECT 1 FROM recommendations WHERE recommendations.id = recommendation_products.recommendation_id AND recommendations.user_id = (SELECT app_current_user_id()))
        );
    """)

    # Progress metrics
    op.execute("""
        DROP POLICY IF EXISTS progress_metrics_user_isolation ON progress_metrics;
        DROP POLICY IF EXISTS progress_metrics_service_bypass ON progress_metrics;
        DROP POLICY IF EXISTS progress_metrics_policy ON progress_metrics;

        CREATE POLICY progress_metrics_policy ON progress_metrics FOR ALL
        USING (
            (SELECT current_setting('app.rls_bypass', true)) = 'on'
            OR EXISTS (SELECT 1 FROM progress_scans WHERE progress_scans.id = progress_metrics.progress_scan_id AND progress_scans.user_id = (SELECT app_current_user_id()))
        )
        WITH CHECK (
            (SELECT current_setting('app.rls_bypass', true)) = 'on'
            OR EXISTS (SELECT 1 FROM progress_scans WHERE progress_scans.id = progress_metrics.progress_scan_id AND progress_scans.user_id = (SELECT app_current_user_id()))
        );
    """)

    # Review queue
    op.execute("""
        DROP POLICY IF EXISTS review_queue_assigned_isolation ON review_queue;
        DROP POLICY IF EXISTS review_queue_service_bypass ON review_queue;
        DROP POLICY IF EXISTS review_queue_policy ON review_queue;

        CREATE POLICY review_queue_policy ON review_queue FOR ALL
        USING (
            (SELECT current_setting('app.rls_bypass', true)) = 'on'
            OR assigned_to = (SELECT app_current_user_id())
        )
        WITH CHECK (
            (SELECT current_setting('app.rls_bypass', true)) = 'on'
            OR assigned_to = (SELECT app_current_user_id())
        );
    """)

    # Public catalog tables
    for table in _PUBLIC_READ_TABLES:
        op.execute(f"""
            DROP POLICY IF EXISTS {table}_read_all ON {table};
            DROP POLICY IF EXISTS {table}_service_bypass ON {table};
            DROP POLICY IF EXISTS {table}_policy ON {table};

            CREATE POLICY {table}_policy ON {table} FOR ALL
            USING (
                true
            )
            WITH CHECK (
                (SELECT current_setting('app.rls_bypass', true)) = 'on'
            );
        """)


def downgrade() -> None:
    pass
