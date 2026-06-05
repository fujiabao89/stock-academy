"""新闻 API 测试"""
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from .conftest import register_user


def _make_article(code: str = "600519", hours_ago: int = 1) -> dict:
    """通过 API 直接插入测试新闻到数据库（需要先通过注入的方式）。

    由于测试使用内存 SQLite，我们通过 API 测试端到端行为。
    这里只测 API 行为，新闻数据通过 api 无法直接创建，
    所以测试聚焦于认证、分页参数校验、空数据集行为。
    """
    return {}


class TestNewsPagination:
    async def test_empty_news_returns_empty_items(self, async_client: AsyncClient):
        r = await async_client.get("/api/news")
        assert r.status_code == 200
        data = r.json()
        assert data["items"] == []
        assert data["has_more"] is False
        assert data["next_cursor"] is None

    async def test_news_invalid_cursor_still_returns_200(self, async_client: AsyncClient):
        r = await async_client.get("/api/news?cursor=not-a-date")
        assert r.status_code == 200

    async def test_news_limit_bounds(self, async_client: AsyncClient):
        r = await async_client.get("/api/news?limit=1")
        assert r.status_code == 200
        r2 = await async_client.get("/api/news?limit=0")
        assert r2.status_code == 422
        r3 = await async_client.get("/api/news?limit=51")
        assert r3.status_code == 422


class TestStockNews:
    async def test_stock_news_without_data_returns_empty(self, async_client: AsyncClient):
        r = await async_client.get("/api/news/600519")
        assert r.status_code == 200
        data = r.json()
        assert data["items"] == []

    async def test_stock_news_invalid_cursor_still_returns_200(self, async_client: AsyncClient):
        r = await async_client.get("/api/news/600519?cursor=bad")
        assert r.status_code == 200


class TestWatchlistNews:
    async def test_watchlist_news_without_token_returns_401(self, async_client: AsyncClient):
        r = await async_client.get("/api/watchlist/news")
        assert r.status_code == 401

    async def test_watchlist_news_empty_watchlist_returns_empty(self, async_client: AsyncClient):
        token = await register_user(async_client)
        r = await async_client.get(
            "/api/watchlist/news",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["items"] == []
        assert data["has_more"] is False
