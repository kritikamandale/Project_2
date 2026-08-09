"""Phase 17 — Scope catalog table RLS policies to non-overlapping SELECT/INSERT/UPDATE/DELETE policies.

Eliminates Supabase Performance Advisor warning "Multiple Permissive Policies" by ensuring
each SQL action (SELECT, INSERT, UPDATE, DELETE) has exactly ONE active policy per table.

Revision ID: 0017
Revises: 0016
Create Date: 2026-08-09
"""

from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None

_PUBLIC_CATALOG_TABLES = [
    "products",
    "product_embeddings",
    "platform_settings",
]


def upgrade() -> None:
    for table in _PUBLIC_CATALOG_TABLES:
        # Drop all existing policies — each in a separate op.execute() call.
        # asyncpg does not allow multiple SQL statements in a single prepared statement.
        op.execute(f"DROP POLICY IF EXISTS {table}_policy ON {table};")
        op.execute(f"DROP POLICY IF EXISTS {table}_read_all ON {table};")
        op.execute(f"DROP POLICY IF EXISTS {table}_service_bypass ON {table};")
        op.execute(f"DROP POLICY IF EXISTS {table}_select_policy ON {table};")
        op.execute(f"DROP POLICY IF EXISTS {table}_write_policy ON {table};")
        op.execute(f"DROP POLICY IF EXISTS {table}_insert_policy ON {table};")
        op.execute(f"DROP POLICY IF EXISTS {table}_update_policy ON {table};")
        op.execute(f"DROP POLICY IF EXISTS {table}_delete_policy ON {table};")

        # 1. Read-only for all (FOR SELECT only)
        op.execute(f"""CREATE POLICY {table}_select_policy ON {table} FOR SELECT
            USING (true)""")

        # 2. Insert restricted to service role
        op.execute(f"""CREATE POLICY {table}_insert_policy ON {table} FOR INSERT
            WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on')""")

        # 3. Update restricted to service role
        op.execute(f"""CREATE POLICY {table}_update_policy ON {table} FOR UPDATE
            USING ((SELECT current_setting('app.rls_bypass', true)) = 'on')
            WITH CHECK ((SELECT current_setting('app.rls_bypass', true)) = 'on')""")

        # 4. Delete restricted to service role
        op.execute(f"""CREATE POLICY {table}_delete_policy ON {table} FOR DELETE
            USING ((SELECT current_setting('app.rls_bypass', true)) = 'on')""")


def downgrade() -> None:
    pass
