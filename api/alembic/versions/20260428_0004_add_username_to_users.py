"""add username to users

Revision ID: 20260428_0004
Revises: 20260428_0003
Create Date: 2026-04-28 15:38:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260428_0004"
down_revision = "20260428_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("username", sa.String(length=50), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("users", "username")
