"""测试配置和 fixture"""

from collections.abc import AsyncGenerator
from datetime import date, timedelta
from typing import Any

import numpy as np
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.models.daily_bar import DailyBar  # noqa: F401 — 确保模型已导入 Base
from app.models.news import NewsArticle  # noqa: F401 — 确保模型已导入 Base
from app.models.strategy import Strategy, StrategyRun  # noqa: F401 — 确保模型已导入 Base
from app.models.user import User  # noqa: F401 — 确保模型已导入 Base
from app.models.watchlist import WatchlistItem  # noqa: F401 — 确保模型已导入 Base

# 测试环境禁用速率限制，避免 429 干扰
settings.rate_limit_enabled = False


def make_bars(
    closes: list[float],
    volumes: list[int] | None = None,
    highs: list[float] | None = None,
    lows: list[float] | None = None,
    opens: list[float] | None = None,
    start_date: date = date(2025, 1, 1),
) -> list[DailyBar]:
    """从价格序列构造 DailyBar 列表，自动计算均线"""
    n = len(closes)
    if volumes is None:
        volumes = [100000] * n
    if highs is None:
        highs = [c * 1.01 for c in closes]
    if lows is None:
        lows = [c * 0.99 for c in closes]
    if opens is None:
        opens = [c * 0.99 for c in closes]

    bars = []
    for i in range(n):
        bar = DailyBar(
            code="000001",
            date=start_date + timedelta(days=i),
            open=opens[i],
            high=highs[i],
            low=lows[i],
            close=closes[i],
            volume=volumes[i],
            amount=closes[i] * volumes[i],
        )
        if i >= 4:
            bar.ma5 = float(round(np.mean(closes[i - 4 : i + 1]), 3))
        if i >= 19:
            bar.ma20 = float(round(np.mean(closes[i - 19 : i + 1]), 3))
        if i >= 59:
            bar.ma60 = float(round(np.mean(closes[i - 59 : i + 1]), 3))
        if i >= 119:
            bar.ma120 = float(round(np.mean(closes[i - 119 : i + 1]), 3))
        bars.append(bar)
    return bars


@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, Any]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    TestingSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_get_db():
        async with TestingSessionLocal() as session:
            try:
                yield session
            finally:
                await session.close()

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
    await engine.dispose()


async def register_user(client: AsyncClient, email: str = "test@example.com") -> str:
    """注册用户并返回 access_token"""
    r = await client.post("/api/auth/register", json={
        "email": email,
        "password": "password123",
    })
    assert r.status_code == 201
    return r.json()["access_token"]


async def seed_strategy(client: AsyncClient, token: str, name: str = "测试策略", conditions: list[dict] | None = None) -> dict:
    """创建自定义策略并返回完整对象"""
    if conditions is None:
        conditions = [{"field": "ma5", "operator": "cross_above", "field2": "ma20"}]
    r = await client.post(
        "/api/strategies",
        json={"name": name, "description": "测试用", "conditions": conditions},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.text
    return r.json()
