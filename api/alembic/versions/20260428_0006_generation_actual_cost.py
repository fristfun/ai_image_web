"""add actual_cost_usd to generation tasks

Revision ID: 20260428_0006
Revises: 20260428_0005
Create Date: 2026-04-28 16:12:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260428_0006"
down_revision = "20260428_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "generation_tasks",
        sa.Column("actual_cost_usd", sa.Float(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("generation_tasks", "actual_cost_usd")
