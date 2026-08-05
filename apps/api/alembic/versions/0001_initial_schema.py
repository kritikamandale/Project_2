"""Initial schema — all tables, indexes, enums, audit triggers

Revision ID: 0001
Revises:
Create Date: 2026-06-10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

# ---------------------------------------------------------------------------
# ENUM type definitions (reusable helpers)
# ---------------------------------------------------------------------------

def _create_enums():
    op.execute("CREATE TYPE user_role_enum AS ENUM ('USER', 'DERMATOLOGIST', 'ADMIN')")
    op.execute("CREATE TYPE fitzpatrick_scale_enum AS ENUM ('I', 'II', 'III', 'IV', 'V', 'VI')")
    op.execute("CREATE TYPE skin_type_enum AS ENUM ('oily', 'dry', 'combination', 'normal', 'sensitive')")
    op.execute("CREATE TYPE condition_name_enum AS ENUM ('acne', 'dark_spots', 'pigmentation', 'wrinkles', 'dryness', 'redness', 'pores', 'texture', 'uneven_tone')")
    op.execute("CREATE TYPE severity_enum AS ENUM ('none', 'mild', 'moderate', 'severe')")
    op.execute("CREATE TYPE affected_zone_enum AS ENUM ('forehead', 'nose', 'cheeks', 'chin', 'under_eye', 'full_face')")
    op.execute("CREATE TYPE diet_type_enum AS ENUM ('veg', 'non_veg', 'vegan', 'mixed')")
    op.execute("CREATE TYPE exercise_frequency_enum AS ENUM ('none', 'light', 'moderate', 'active')")
    op.execute("CREATE TYPE routine_frequency_enum AS ENUM ('daily', 'alternate', 'weekly', 'none')")
    op.execute("CREATE TYPE water_hardness_enum AS ENUM ('soft', 'moderate', 'hard', 'very_hard')")
    op.execute("CREATE TYPE climate_zone_enum AS ENUM ('tropical', 'arid', 'semi_arid', 'temperate', 'coastal')")
    op.execute("CREATE TYPE product_brand_enum AS ENUM ('nykaa', 'minimalist', 'dermaco', 'others')")
    op.execute("CREATE TYPE product_category_enum AS ENUM ('cleanser', 'toner', 'serum', 'moisturiser', 'sunscreen', 'treatment', 'mask')")
    op.execute("CREATE TYPE review_priority_enum AS ENUM ('high', 'normal', 'low')")
    op.execute("CREATE TYPE review_status_enum AS ENUM ('pending', 'in_review', 'approved', 'rejected', 'escalated')")


def _drop_enums():
    for enum_name in [
        "user_role_enum", "fitzpatrick_scale_enum", "skin_type_enum",
        "condition_name_enum", "severity_enum", "affected_zone_enum",
        "diet_type_enum", "exercise_frequency_enum", "routine_frequency_enum",
        "water_hardness_enum", "climate_zone_enum", "product_brand_enum",
        "product_category_enum", "review_priority_enum", "review_status_enum",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")


# ---------------------------------------------------------------------------
# Audit trigger (fires on users, skin_scans, recommendations)
# ---------------------------------------------------------------------------

AUDIT_TRIGGER_FN = """
CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
    _user_id UUID;
    _metadata JSONB;
BEGIN
    -- Attempt to extract user context set by the application layer
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
"""

DROP_AUDIT_TRIGGER_FN = "DROP FUNCTION IF EXISTS audit_trigger_fn() CASCADE;"


def _create_audit_triggers():
    op.execute(AUDIT_TRIGGER_FN)
    for table in ("users", "skin_scans", "recommendations"):
        op.execute(f"""
            CREATE TRIGGER audit_{table}
            AFTER INSERT OR UPDATE OR DELETE ON {table}
            FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
        """)


def _drop_audit_triggers():
    for table in ("users", "skin_scans", "recommendations"):
        op.execute(f"DROP TRIGGER IF EXISTS audit_{table} ON {table};")
    op.execute(DROP_AUDIT_TRIGGER_FN)


# ---------------------------------------------------------------------------
# upgrade / downgrade
# ---------------------------------------------------------------------------

def upgrade() -> None:
    # pgvector extension — optional (requires pgvector installed in PostgreSQL)
    conn = op.get_bind()
    has_vector = conn.execute(
        sa.text("SELECT 1 FROM pg_available_extensions WHERE name = 'vector'")
    ).scalar()
    if has_vector:
        op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    _create_enums()

    # ------------------------------------------------------------------
    # users
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255)),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("role", postgresql.ENUM("USER", "DERMATOLOGIST", "ADMIN", name="user_role_enum", create_type=False), nullable=False, server_default="USER"),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_login", sa.DateTime(timezone=True)),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_role", "users", ["role"])

    # ------------------------------------------------------------------
    # audit_logs (created before triggers are added)
    # ------------------------------------------------------------------
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(100), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True)),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("metadata", postgresql.JSONB),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_entity", "audit_logs", ["entity_type", "entity_id"])
    op.create_index("ix_audit_logs_timestamp", "audit_logs", ["timestamp"])

    # ------------------------------------------------------------------
    # user_profiles
    # ------------------------------------------------------------------
    op.create_table(
        "user_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date_of_birth", sa.Date()),
        sa.Column("gender", sa.String(20)),
        sa.Column("city", sa.String(100)),
        sa.Column("state", sa.String(100)),
        sa.Column("country", sa.String(100), server_default="India"),
        sa.Column("skin_tone_category", postgresql.ENUM("I", "II", "III", "IV", "V", "VI", name="fitzpatrick_scale_enum", create_type=False)),
        sa.Column("profile_photo_url", sa.String(500)),
        sa.Column("consent_given_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", name="uq_user_profiles_user_id"),
    )
    op.create_index("ix_user_profiles_user_id", "user_profiles", ["user_id"], unique=True)
    op.create_index("ix_user_profiles_city", "user_profiles", ["city"])

    # ------------------------------------------------------------------
    # refresh_tokens
    # ------------------------------------------------------------------
    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("user_agent", sa.Text()),
        sa.UniqueConstraint("token_hash", name="uq_refresh_tokens_hash"),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_user_revoked", "refresh_tokens", ["user_id", "revoked"])

    # ------------------------------------------------------------------
    # skin_scans
    # ------------------------------------------------------------------
    op.create_table(
        "skin_scans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scan_timestamp", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("image_deleted_at", sa.DateTime(timezone=True)),
        sa.Column("lighting_quality_score", sa.Float()),
        sa.Column("skin_type", postgresql.ENUM("oily", "dry", "combination", "normal", "sensitive", name="skin_type_enum", create_type=False)),
        sa.Column("analysis_confidence_score", sa.Float()),
        sa.Column("raw_analysis_json", postgresql.JSONB()),
        sa.Column("image_was_processed_locally", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("image_permanently_deleted", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_skin_scans_user_id", "skin_scans", ["user_id"])
    op.create_index("ix_skin_scans_scan_timestamp", "skin_scans", ["scan_timestamp"])
    op.create_index("ix_skin_scans_user_timestamp", "skin_scans", ["user_id", "scan_timestamp"])

    # ------------------------------------------------------------------
    # skin_conditions
    # ------------------------------------------------------------------
    op.create_table(
        "skin_conditions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("scan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("skin_scans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("condition_name", postgresql.ENUM("acne", "dark_spots", "pigmentation", "wrinkles", "dryness", "redness", "pores", "texture", "uneven_tone", name="condition_name_enum", create_type=False), nullable=False),
        sa.Column("severity", postgresql.ENUM("none", "mild", "moderate", "severe", name="severity_enum", create_type=False), nullable=False),
        sa.Column("affected_zone", postgresql.ENUM("forehead", "nose", "cheeks", "chin", "under_eye", "full_face", name="affected_zone_enum", create_type=False), nullable=False),
        sa.Column("confidence_score", sa.Float()),
    )
    op.create_index("ix_skin_conditions_scan_id", "skin_conditions", ["scan_id"])
    op.create_index("ix_skin_conditions_name_severity", "skin_conditions", ["condition_name", "severity"])

    # ------------------------------------------------------------------
    # questionnaire_responses
    # ------------------------------------------------------------------
    op.create_table(
        "questionnaire_responses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("sleep_hours_avg", sa.Float()),
        sa.Column("sleep_quality", sa.Integer()),
        sa.Column("water_intake_liters", sa.Float()),
        sa.Column("diet_type", postgresql.ENUM("veg", "non_veg", "vegan", "mixed", name="diet_type_enum", create_type=False)),
        sa.Column("stress_level", sa.Integer()),
        sa.Column("exercise_frequency", postgresql.ENUM("none", "light", "moderate", "active", name="exercise_frequency_enum", create_type=False)),
        sa.Column("screen_time_hours", sa.Float()),
        sa.Column("alcohol_consumption", sa.String(50)),
        sa.Column("smoking_status", sa.String(50)),
        sa.Column("current_medications_text", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_questionnaire_responses_user_id", "questionnaire_responses", ["user_id"])

    # ------------------------------------------------------------------
    # environment_profiles
    # ------------------------------------------------------------------
    op.create_table(
        "environment_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("city", sa.String(100)),
        sa.Column("state", sa.String(100)),
        sa.Column("avg_temperature_c", sa.Float()),
        sa.Column("avg_humidity_pct", sa.Float()),
        sa.Column("pollution_index", sa.Float()),
        sa.Column("water_hardness", postgresql.ENUM("soft", "moderate", "hard", "very_hard", name="water_hardness_enum", create_type=False)),
        sa.Column("uv_index", sa.Float()),
        sa.Column("climate_zone", postgresql.ENUM("tropical", "arid", "semi_arid", "temperate", "coastal", name="climate_zone_enum", create_type=False)),
        sa.Column("last_updated", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", name="uq_environment_profiles_user_id"),
    )
    op.create_index("ix_environment_profiles_user_id", "environment_profiles", ["user_id"], unique=True)
    op.create_index("ix_environment_profiles_city_state", "environment_profiles", ["city", "state"])

    # ------------------------------------------------------------------
    # skincare_routine_current
    # ------------------------------------------------------------------
    op.create_table(
        "skincare_routine_current",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("uses_cleanser", sa.Boolean(), server_default="false"),
        sa.Column("uses_toner", sa.Boolean(), server_default="false"),
        sa.Column("uses_moisturiser", sa.Boolean(), server_default="false"),
        sa.Column("uses_sunscreen", sa.Boolean(), server_default="false"),
        sa.Column("uses_serum", sa.Boolean(), server_default="false"),
        sa.Column("uses_exfoliant", sa.Boolean(), server_default="false"),
        sa.Column("routine_frequency", postgresql.ENUM("daily", "alternate", "weekly", "none", name="routine_frequency_enum", create_type=False)),
        sa.Column("known_allergens_text", sa.Text()),
        sa.Column("products_currently_using", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", name="uq_skincare_routine_user_id"),
    )
    op.create_index("ix_skincare_routine_current_user_id", "skincare_routine_current", ["user_id"], unique=True)

    # ------------------------------------------------------------------
    # products
    # ------------------------------------------------------------------
    op.create_table(
        "products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("brand", postgresql.ENUM("nykaa", "minimalist", "dermaco", "others", name="product_brand_enum", create_type=False), nullable=False),
        sa.Column("product_name", sa.String(255), nullable=False),
        sa.Column("product_url", sa.String(1000)),
        sa.Column("price_inr", sa.Float()),
        sa.Column("category", postgresql.ENUM("cleanser", "toner", "serum", "moisturiser", "sunscreen", "treatment", "mask", name="product_category_enum", create_type=False), nullable=False),
        sa.Column("key_ingredients", postgresql.ARRAY(sa.Text())),
        sa.Column("targets_conditions", postgresql.ARRAY(sa.Text())),
        sa.Column("skin_types_suitable", postgresql.ARRAY(sa.Text())),
        sa.Column("fitzpatrick_suitable", postgresql.ARRAY(sa.Text())),
        sa.Column("climate_zones_suitable", postgresql.ARRAY(sa.Text())),
        sa.Column("is_dermatologist_approved", sa.Boolean(), server_default="false"),
        sa.Column("approval_dermatologist_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("rating_avg", sa.Float(), server_default="0.0"),
        sa.Column("review_count", sa.Integer(), server_default="0"),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_products_brand", "products", ["brand"])
    op.create_index("ix_products_category", "products", ["category"])
    op.create_index("ix_products_brand_category", "products", ["brand", "category"])
    op.create_index("ix_products_active", "products", ["is_active"])

    # ------------------------------------------------------------------
    # product_embeddings  (requires pgvector extension)
    # ------------------------------------------------------------------
    op.create_table(
        "product_embeddings",
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("embedding_vector", sa.Text()),  # replaced by VECTOR(1536) post-migration
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    # Convert column to proper pgvector type after table creation (if vector extension available)
    if has_vector:
        try:
            op.execute("ALTER TABLE product_embeddings ALTER COLUMN embedding_vector TYPE vector(1536) USING NULL;")
        except Exception:
            pass

    # ------------------------------------------------------------------
    # recommendations
    # ------------------------------------------------------------------
    op.create_table(
        "recommendations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("skin_scans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("questionnaire_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("questionnaire_responses.id", ondelete="SET NULL")),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("recommendation_engine_version", sa.String(50), server_default="1.0"),
        sa.Column("ai_reasoning", sa.Text()),
        sa.Column("roadmap_weeks", sa.Integer(), server_default="20"),
        sa.Column("is_dermatologist_reviewed", sa.Boolean(), server_default="false"),
        sa.Column("reviewer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_recommendations_user_id", "recommendations", ["user_id"])
    op.create_index("ix_recommendations_scan_id", "recommendations", ["scan_id"])
    op.create_index("ix_recommendations_user_scan", "recommendations", ["user_id", "scan_id"])

    # ------------------------------------------------------------------
    # recommendation_products
    # ------------------------------------------------------------------
    op.create_table(
        "recommendation_products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("recommendation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recommendations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order_in_routine", sa.Integer(), server_default="0"),
        sa.Column("start_week", sa.Integer(), server_default="1"),
        sa.Column("reason_text", sa.Text()),
        sa.Column("is_mandatory", sa.Boolean(), server_default="true"),
        sa.Column("phase", sa.Integer(), server_default="1"),
    )
    op.create_index("ix_recommendation_products_recommendation_id", "recommendation_products", ["recommendation_id"])
    op.create_index("ix_recommendation_products_product_id", "recommendation_products", ["product_id"])

    # ------------------------------------------------------------------
    # progress_scans
    # ------------------------------------------------------------------
    op.create_table(
        "progress_scans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recommendation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recommendations.id", ondelete="SET NULL")),
        sa.Column("scan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("skin_scans.id", ondelete="SET NULL")),
        sa.Column("scan_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("scanned_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("overall_skin_score", sa.Float()),
        sa.Column("delta_from_baseline", sa.Float()),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_progress_scans_user_id", "progress_scans", ["user_id"])
    op.create_index("ix_progress_scans_user_number", "progress_scans", ["user_id", "scan_number"])

    # ------------------------------------------------------------------
    # progress_metrics
    # ------------------------------------------------------------------
    op.create_table(
        "progress_metrics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("progress_scan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("progress_scans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("metric_name", sa.String(100), nullable=False),
        sa.Column("previous_value", sa.Float()),
        sa.Column("current_value", sa.Float()),
        sa.Column("improvement_pct", sa.Float()),
    )
    op.create_index("ix_progress_metrics_progress_scan_id", "progress_metrics", ["progress_scan_id"])

    # ------------------------------------------------------------------
    # dermatologist_profiles
    # ------------------------------------------------------------------
    op.create_table(
        "dermatologist_profiles",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("medical_license_number", sa.String(100), nullable=False),
        sa.Column("specialization", sa.String(200)),
        sa.Column("hospital_affiliation", sa.String(300)),
        sa.Column("verified_at", sa.DateTime(timezone=True)),
        sa.Column("verification_document_url", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("medical_license_number", name="uq_derm_license"),
    )

    # ------------------------------------------------------------------
    # review_queue
    # ------------------------------------------------------------------
    op.create_table(
        "review_queue",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("recommendation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recommendations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assigned_to", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("priority", postgresql.ENUM("high", "normal", "low", name="review_priority_enum", create_type=False), nullable=False, server_default="normal"),
        sa.Column("status", postgresql.ENUM("pending", "in_review", "approved", "rejected", "escalated", name="review_status_enum", create_type=False), nullable=False, server_default="pending"),
        sa.Column("reviewer_notes", sa.Text()),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("recommendation_id", name="uq_review_queue_recommendation"),
    )
    op.create_index("ix_review_queue_recommendation_id", "review_queue", ["recommendation_id"], unique=True)
    op.create_index("ix_review_queue_status_priority", "review_queue", ["status", "priority"])
    op.create_index("ix_review_queue_assigned_to", "review_queue", ["assigned_to"])

    # ------------------------------------------------------------------
    # platform_settings
    # ------------------------------------------------------------------
    op.create_table(
        "platform_settings",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", postgresql.JSONB()),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ------------------------------------------------------------------
    # Audit triggers (must be last — all tables must exist)
    # ------------------------------------------------------------------
    _create_audit_triggers()

    # ------------------------------------------------------------------
    # Default platform settings
    # ------------------------------------------------------------------
    op.execute("""
        INSERT INTO platform_settings (key, value) VALUES
        ('enable_dermatologist_review', 'true'),
        ('enable_waitlist', 'false'),
        ('max_scans_per_user_per_day', '3'),
        ('enable_analytics', 'true'),
        ('recommendation_engine_version', '"1.0"')
        ON CONFLICT (key) DO NOTHING;
    """)


def downgrade() -> None:
    _drop_audit_triggers()

    for table in [
        "platform_settings", "review_queue", "dermatologist_profiles",
        "progress_metrics", "progress_scans",
        "recommendation_products", "recommendations",
        "product_embeddings", "products",
        "skincare_routine_current", "environment_profiles",
        "questionnaire_responses", "skin_conditions", "skin_scans",
        "user_profiles", "refresh_tokens", "audit_logs", "users",
    ]:
        op.drop_table(table)

    _drop_enums()
    op.execute("DROP EXTENSION IF EXISTS vector;")
