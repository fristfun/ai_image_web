"""add effect image url to prompt templates

Revision ID: 20260428_0002
Revises: 20260426_0001
Create Date: 2026-04-28 14:47:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260428_0002"
down_revision = "20260426_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("prompt_templates", sa.Column("effect_image_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("prompt_templates", "effect_image_url")
