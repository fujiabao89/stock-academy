"""新闻 API 端点 — 游标分页、个股筛选、自选股专属"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import get_current_user, get_optional_user
from ..database import get_db
from ..models.news import NewsArticle
from ..models.user import User
from ..models.watchlist import WatchlistItem
from ..schemas.news import NewsArticleOut, NewsListResponse
from ..stock_names import stock_info

router = APIRouter(prefix="/news", tags=["news"])
watchlist_news_router = APIRouter(prefix="/watchlist/news", tags=["news"])

_PAGE_SIZE = 20


def _article_to_out(article: NewsArticle) -> NewsArticleOut:
    names: list[str] = []
    for code in article.stock_codes:
        info = stock_info(code)
        names.append(info[0] if info else code)

    return NewsArticleOut(
        id=article.id,
        title=article.title,
        url=article.url,
        source=article.source,
        content_summary=article.content_summary,
        published_at=article.published_at,
        stock_codes=article.stock_codes,
        stock_names=names,
        ai_summary=article.ai_summary,
        sentiment=article.sentiment,
    )


@router.get("", response_model=NewsListResponse)
async def list_news(
    cursor: str | None = Query(None, description="游标 (published_at ISO 字符串)"),
    limit: int = Query(_PAGE_SIZE, ge=1, le=50),
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(NewsArticle).order_by(NewsArticle.published_at.desc())

    if cursor:
        try:
            cursor_dt = datetime.fromisoformat(cursor)
            query = query.where(NewsArticle.published_at < cursor_dt)
        except (ValueError, TypeError):
            pass

    query = query.limit(limit + 1)
    result = await db.execute(query)
    rows = list(result.scalars().all())

    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]

    items = [_article_to_out(r) for r in rows]
    next_cursor = items[-1].published_at.isoformat() if items and has_more else None

    return NewsListResponse(items=items, next_cursor=next_cursor, has_more=has_more)


@router.get("/{code}", response_model=NewsListResponse)
async def list_stock_news(
    code: str,
    cursor: str | None = Query(None),
    limit: int = Query(_PAGE_SIZE, ge=1, le=50),
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    # 使用 Python 端过滤以兼容 SQLite (不支持 JSONB @> 操作符)
    query = select(NewsArticle).order_by(NewsArticle.published_at.desc())

    if cursor:
        try:
            cursor_dt = datetime.fromisoformat(cursor)
            query = query.where(NewsArticle.published_at < cursor_dt)
        except (ValueError, TypeError):
            pass

    query = query.limit(limit * 3 + 1)
    result = await db.execute(query)
    rows = list(result.scalars().all())

    filtered = [r for r in rows if code in r.stock_codes]

    has_more = len(filtered) > limit
    if has_more:
        filtered = filtered[:limit]

    items = [_article_to_out(r) for r in filtered]
    next_cursor = items[-1].published_at.isoformat() if items and has_more else None

    return NewsListResponse(items=items, next_cursor=next_cursor, has_more=has_more)


@watchlist_news_router.get("", response_model=NewsListResponse)
async def list_watchlist_news(
    cursor: str | None = Query(None),
    limit: int = Query(_PAGE_SIZE, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    watchlist_result = await db.execute(
        select(WatchlistItem.stock_code).where(WatchlistItem.user_id == current_user.id)
    )
    codes = [row[0] for row in watchlist_result.all()]

    if not codes:
        return NewsListResponse(items=[], next_cursor=None, has_more=False)

    query = (
        select(NewsArticle)
        .order_by(NewsArticle.published_at.desc())
    )

    if cursor:
        try:
            cursor_dt = datetime.fromisoformat(cursor)
            query = query.where(NewsArticle.published_at < cursor_dt)
        except (ValueError, TypeError):
            pass

    query = query.limit(limit * 3 + 1)
    result = await db.execute(query)
    rows = list(result.scalars().all())

    filtered = [r for r in rows if any(c in r.stock_codes for c in codes)]

    has_more = len(filtered) > limit
    if has_more:
        filtered = filtered[:limit]

    items = [_article_to_out(r) for r in filtered]
    next_cursor = items[-1].published_at.isoformat() if items and has_more else None

    return NewsListResponse(items=items, next_cursor=next_cursor, has_more=has_more)
