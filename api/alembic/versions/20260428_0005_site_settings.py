"""add site settings table

Revision ID: 20260428_0005
Revises: 20260428_0004
Create Date: 2026-04-28 15:47:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260428_0005"
down_revision = "20260428_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "site_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("setting_key", sa.String(length=100), nullable=False, unique=True),
        sa.Column("setting_value", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_site_settings_setting_key", "site_settings", ["setting_key"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_site_settings_setting_key", table_name="site_settings")
    op.drop_table("site_settings")
