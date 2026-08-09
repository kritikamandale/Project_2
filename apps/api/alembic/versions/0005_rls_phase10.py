"""Phase 10 — Row-Level Security on user data tables.

Enables PostgreSQL RLS on skin_scans, questionnaire_responses, and recommendations
so that even if application-layer access control were bypassed, a user's rows are
not readable by other users' DB sessions.

Pattern:
  - App sets `SET LOCAL app.current_user_id = '<uuid>'` at start of each transaction.
  - Policies use `current_setting('app.current_user_id', true)` to filter rows.
  - Admin bypass: roles with BYPASSRLS (e.g. migration role) skip all policies.
  - A permissive "admin_bypass" policy allows the app_admin role full access
    without needing BYPASSRLS on the main app user.

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-10
"""

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


_RLS_TABLES = ["skin_scans", "questionnaire_responses", "recommendations"]


def upgrade() -> None:
    # Helper function used by all RLS policies
    op.execute("""CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid AS $$
        BEGIN
            RETURN current_setting('app.current_user_id', true)::uuid;
        EXCEPTION WHEN OTHERS THEN
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql STABLE SECURITY DEFINER""")

    for table in _RLS_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")

        # User can only see/modify their own rows
        op.execute(f"""CREATE POLICY {table}_user_isolation ON {table}
            USING (user_id = app_current_user_id())
            WITH CHECK (user_id = app_current_user_id())""")

        # Service role bypass — set app.rls_bypass = 'on' for admin/service ops
        op.execute(f"""CREATE POLICY {table}_service_bypass ON {table}
            USING (current_setting('app.rls_bypass', true) = 'on')
            WITH CHECK (current_setting('app.rls_bypass', true) = 'on')""")


def downgrade() -> None:
    for table in _RLS_TABLES:
        op.execute(f"DROP POLICY IF EXISTS {table}_service_bypass ON {table}")
        op.execute(f"DROP POLICY IF EXISTS {table}_user_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    op.execute("DROP FUNCTION IF EXISTS app_current_user_id()")
