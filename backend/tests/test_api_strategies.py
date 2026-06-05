"""策略 API 测试"""

from datetime import date

import pytest

from app.database import get_db
from app.main import app
from .conftest import make_bars, register_user, seed_strategy


@pytest.mark.anyio
async def test_list_strategies_no_seed(async_client):
    """未播种时返回空列表"""
    r = await async_client.get("/api/strategies")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert data["total"] == 0


@pytest.mark.anyio
async def test_create_strategy_requires_auth(async_client):
    """未登录无法创建策略"""
    r = await async_client.post("/api/strategies", json={
        "name": "test",
        "conditions": [],
    })
    assert r.status_code == 401


@pytest.mark.anyio
async def test_create_and_get_strategy(async_client):
    """创建自定义策略并获取详情"""
    token = await register_user(async_client)
    s = await seed_strategy(async_client, token, name="我的策略")

    r = await async_client.get(f"/api/strategies/{s['id']}")
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "我的策略"
    assert data["is_builtin"] is False
    assert len(data["conditions"]) == 1


@pytest.mark.anyio
async def test_list_strategies_with_custom(async_client):
    """列表返回所有策略"""
    token = await register_user(async_client)

    await seed_strategy(async_client, token, name="A")
    await seed_strategy(async_client, token, name="B")

    r = await async_client.get("/api/strategies")
    assert r.status_code == 200
    data = r.json()
    assert data["total"] >= 2


@pytest.mark.anyio
async def test_update_custom_strategy(async_client):
    """更新自定义策略"""
    token = await register_user(async_client)
    s = await seed_strategy(async_client, token)

    r = await async_client.put(
        f"/api/strategies/{s['id']}",
        json={"name": "改名后的策略", "enabled": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "改名后的策略"
    assert data["enabled"] is False


@pytest.mark.anyio
async def test_delete_custom_strategy(async_client):
    """删除自定义策略"""
    token = await register_user(async_client)
    s = await seed_strategy(async_client, token)

    r = await async_client.delete(
        f"/api/strategies/{s['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 204

    r = await async_client.get(f"/api/strategies/{s['id']}")
    assert r.status_code == 404


@pytest.mark.anyio
async def test_cannot_delete_builtin(async_client):
    """内置策略不可删除"""
    token = await register_user(async_client)

    from app.models.strategy import Strategy

    async for db in app.dependency_overrides[get_db]():
        builtin = Strategy(name="内置", description="", conditions=[], is_builtin=True)
        db.add(builtin)
        await db.commit()
        await db.refresh(builtin)
        bid = builtin.id
        break

    r = await async_client.delete(
        f"/api/strategies/{bid}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


@pytest.mark.anyio
async def test_get_strategy_404(async_client):
    """不存在的策略返回 404"""
    r = await async_client.get("/api/strategies/99999")
    assert r.status_code == 404


@pytest.mark.anyio
async def test_scan_returns_results(async_client):
    """有 K 线数据时扫描返回正确结构"""
    token = await register_user(async_client)
    s = await seed_strategy(
        async_client, token,
        name="金叉测试",
        conditions=[{"field": "ma5", "operator": "cross_above", "field2": "ma20"}],
    )

    async for db in app.dependency_overrides[get_db]():
        # 构造金叉数据: 前20天=10, 3天=9, 1天=11, 最后1天=13
        # bar[-2]: MA5=9.6 <= MA20=9.9 ✓, bar[-1]: MA5=10.2 > MA20=10.05 ✓
        closes = [10.0] * 20 + [9.0] * 3 + [11.0] + [13.0]
        bars = make_bars(closes, start_date=date(2025, 1, 1))
        for b in bars:
            db.add(b)
        await db.commit()
        break

    r = await async_client.post(f"/api/strategies/{s['id']}/scan")
    assert r.status_code == 200
    data = r.json()
    assert data["total_scanned"] > 0
    assert data["strategy_id"] == s["id"]
    assert "results" in data
    # 金叉条件应匹配
    assert data["total_matched"] >= 1


@pytest.mark.anyio
async def test_get_runs_after_scan(async_client):
    """扫描后可通过 runs 端点查看记录"""
    token = await register_user(async_client)
    s = await seed_strategy(
        async_client, token,
        conditions=[{"field": "ma5", "operator": "cross_above", "field2": "ma20"}],
    )

    async for db in app.dependency_overrides[get_db]():
        closes = [10.0] * 20 + [9.0] * 3 + [11.0] + [13.0]
        bars = make_bars(closes, start_date=date(2025, 1, 1))
        for b in bars:
            db.add(b)
        await db.commit()
        break

    await async_client.post(f"/api/strategies/{s['id']}/scan")

    r = await async_client.get(f"/api/strategies/{s['id']}/runs")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert data["total"] >= 1
    assert data["items"][0]["stock_code"] == "000001"


@pytest.mark.anyio
async def test_scan_404(async_client):
    """扫描不存在的策略返回 404"""
    r = await async_client.post("/api/strategies/99999/scan")
    assert r.status_code == 404


@pytest.mark.anyio
async def test_create_strategy_validation(async_client):
    """空名称被拒绝"""
    token = await register_user(async_client)
    r = await async_client.post(
        "/api/strategies",
        json={"name": "", "conditions": []},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 422
