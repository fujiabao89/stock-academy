"""新增 user_stocks 和 news_articles 表

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-05 17:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'news_articles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('url', sa.String(length=1024), nullable=False),
        sa.Column('source', sa.String(length=50), nullable=False),
        sa.Column('content_summary', sa.Text(), nullable=False, server_default=''),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('fetched_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('stock_codes', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('ai_summary', sa.Text(), nullable=True),
        sa.Column('sentiment', sa.String(length=10), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_news_articles_published_at'), 'news_articles', ['published_at'])
    op.create_index(op.f('ix_news_articles_url'), 'news_articles', ['url'], unique=True)

    op.create_table(
        'user_stocks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('stock_code', sa.String(length=6), nullable=False),
        sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'stock_code', name='uq_user_stocks_user_stock'),
    )
    op.create_index(op.f('ix_user_stocks_stock_code'), 'user_stocks', ['stock_code'])
    op.create_index(op.f('ix_user_stocks_user_id'), 'user_stocks', ['user_id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_user_stocks_user_id'), table_name='user_stocks')
    op.drop_index(op.f('ix_user_stocks_stock_code'), table_name='user_stocks')
    op.drop_table('user_stocks')
    op.drop_index(op.f('ix_news_articles_url'), table_name='news_articles')
    op.drop_index(op.f('ix_news_articles_published_at'), table_name='news_articles')
    op.drop_table('news_articles')
