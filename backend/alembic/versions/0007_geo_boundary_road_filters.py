"""add road_name_filters to geo boundaries

Revision ID: 0007_geo_boundary_road_filters
Revises: 0006_exclusion_tables
Create Date: 2025-11-29
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0007_geo_boundary_road_filters"
down_revision = "0006_exclusion_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "geo_boundaries",
        sa.Column(
            "road_name_filters",
            sa.JSON(),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("geo_boundaries", "road_name_filters")

