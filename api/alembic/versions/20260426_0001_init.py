"""initial schema

Revision ID: 20260426_0001
Revises:
Create Date: 2026-04-26 23:50:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260426_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    user_role = sa.Enum("USER", "ADMIN", name="userrole")
    task_status = sa.Enum("PENDING", "PROCESSING", "SUCCESS", "FAILED", name="taskstatus")
    image_size = sa.Enum("1024x1024", "1024x1536", "1536x1024", name="imagesize")
    image_quality = sa.Enum("low", "medium", "high", name="imagequality")
    image_format = sa.Enum("webp", "png", "jpeg", name="imageformat")
    ledger_type = sa.Enum("TOPUP", "FREEZE", "CAPTURE", "RELEASE", "REFUND", name="ledgertype")

    bind = op.get_bind()
    user_role.create(bind, checkfirst=True)
    task_status.create(bind, checkfirst=True)
    image_size.create(bind, checkfirst=True)
    image_quality.create(bind, checkfirst=True)
    image_format.create(bind, checkfirst=True)
    ledger_type.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, nullable=False, server_default="USER"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "wallets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("balance", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("frozen", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_wallets_user_id", "wallets", ["user_id"], unique=True)

    op.create_table(
        "generation_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("size", image_size, nullable=False),
        sa.Column("quality", image_quality, nullable=False),
        sa.Column("output_format", image_format, nullable=False),
        sa.Column("status", task_status, nullable=False, server_default="PENDING"),
        sa.Column("price_points", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.String(length=500)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_generation_tasks_user_id", "generation_tasks", ["user_id"])
    op.create_index("ix_generation_tasks_status", "generation_tasks", ["status"])
    op.create_index("ix_generation_tasks_created_at", "generation_tasks", ["created_at"])

    op.create_table(
        "wallet_holds",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("wallet_id", sa.Integer(), sa.ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "generation_task_id",
            sa.Integer(),
            sa.ForeignKey("generation_tasks.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="FROZEN"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("released_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_wallet_holds_user_id", "wallet_holds", ["user_id"])
    op.create_index("ix_wallet_holds_wallet_id", "wallet_holds", ["wallet_id"])

    op.create_table(
        "wallet_ledger",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("wallet_id", sa.Integer(), sa.ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", ledger_type, nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("balance_after", sa.Integer(), nullable=False),
        sa.Column("reference", sa.String(length=120)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_wallet_ledger_user_id", "wallet_ledger", ["user_id"])
    op.create_index("ix_wallet_ledger_type", "wallet_ledger", ["type"])
    op.create_index("ix_wallet_ledger_created_at", "wallet_ledger", ["created_at"])

    op.create_table(
        "generated_images",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "generation_task_id",
            sa.Integer(),
            sa.ForeignKey("generation_tasks.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("output_format", sa.String(length=16), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_generated_images_user_id", "generated_images", ["user_id"])

    op.create_table(
        "uploaded_assets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("generation_task_id", sa.Integer(), sa.ForeignKey("generation_tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("mime_type", sa.String(length=50), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_uploaded_assets_user_id", "uploaded_assets", ["user_id"])
    op.create_index("ix_uploaded_assets_generation_task_id", "uploaded_assets", ["generation_task_id"])

    op.create_table(
        "prompt_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("variable_desc", sa.Text()),
        sa.Column("default_size", sa.String(length=20), nullable=False, server_default="1024x1024"),
        sa.Column("default_quality", sa.String(length=20), nullable=False, server_default="medium"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_prompt_templates_category", "prompt_templates", ["category"])

    op.create_table(
        "prompt_template_variables",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("template_id", sa.Integer(), sa.ForeignKey("prompt_templates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("example_value", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_prompt_template_variables_template_id", "prompt_template_variables", ["template_id"])

    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="COMPLETED"),
        sa.Column("reference", sa.String(length=120)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_orders_user_id", "orders", ["user_id"])
    op.create_index("ix_orders_status", "orders", ["status"])
    op.create_index("ix_orders_created_at", "orders", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_orders_created_at", table_name="orders")
    op.drop_index("ix_orders_status", table_name="orders")
    op.drop_index("ix_orders_user_id", table_name="orders")
    op.drop_table("orders")

    op.drop_index("ix_prompt_template_variables_template_id", table_name="prompt_template_variables")
    op.drop_table("prompt_template_variables")

    op.drop_index("ix_prompt_templates_category", table_name="prompt_templates")
    op.drop_table("prompt_templates")

    op.drop_index("ix_uploaded_assets_generation_task_id", table_name="uploaded_assets")
    op.drop_index("ix_uploaded_assets_user_id", table_name="uploaded_assets")
    op.drop_table("uploaded_assets")

    op.drop_index("ix_generated_images_user_id", table_name="generated_images")
    op.drop_table("generated_images")

    op.drop_index("ix_wallet_ledger_created_at", table_name="wallet_ledger")
    op.drop_index("ix_wallet_ledger_type", table_name="wallet_ledger")
    op.drop_index("ix_wallet_ledger_user_id", table_name="wallet_ledger")
    op.drop_table("wallet_ledger")

    op.drop_index("ix_wallet_holds_wallet_id", table_name="wallet_holds")
    op.drop_index("ix_wallet_holds_user_id", table_name="wallet_holds")
    op.drop_table("wallet_holds")

    op.drop_index("ix_generation_tasks_created_at", table_name="generation_tasks")
    op.drop_index("ix_generation_tasks_status", table_name="generation_tasks")
    op.drop_index("ix_generation_tasks_user_id", table_name="generation_tasks")
    op.drop_table("generation_tasks")

    op.drop_index("ix_wallets_user_id", table_name="wallets")
    op.drop_table("wallets")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    bind = op.get_bind()
    sa.Enum(name="ledgertype").drop(bind, checkfirst=True)
    sa.Enum(name="imageformat").drop(bind, checkfirst=True)
    sa.Enum(name="imagequality").drop(bind, checkfirst=True)
    sa.Enum(name="imagesize").drop(bind, checkfirst=True)
    sa.Enum(name="taskstatus").drop(bind, checkfirst=True)
    sa.Enum(name="userrole").drop(bind, checkfirst=True)
