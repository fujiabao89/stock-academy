"""新闻相关 Schema"""

from datetime import datetime

from pydantic import BaseModel, Field


class NewsArticleOut(BaseModel):
    id: int
    title: str
    url: str
    source: str
    content_summary: str
    published_at: datetime
    stock_codes: list[str] = Field(default_factory=list)
    stock_names: list[str] = Field(default_factory=list)
    ai_summary: str | None = None
    sentiment: str | None = None


class NewsListResponse(BaseModel):
    items: list[NewsArticleOut]
    next_cursor: str | None = None
    has_more: bool = False
