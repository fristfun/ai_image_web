"""add user active status and last login time

Revision ID: 20260428_0007
Revises: 20260428_0006
Create Date: 2026-04-28 21:33:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260428_0007"
down_revision = "20260428_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "is_active")
