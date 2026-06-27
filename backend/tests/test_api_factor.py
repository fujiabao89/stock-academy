"""因子 API 测试 — parse + backtest 端点"""

import pytest


@pytest.mark.anyio
async def test_parse_empty_input(async_client):
    """空输入返回 422"""
    r = await async_client.post("/api/strategies/parse", json={"text": ""})
    assert r.status_code == 422


@pytest.mark.anyio
async def test_parse_missing_field(async_client):
    """缺少必填字段返回 422"""
    r = await async_client.post("/api/strategies/parse", json={})
    assert r.status_code == 422


@pytest.mark.anyio
async def test_backtest_invalid_conditions(async_client):
    """无效条件返回 422"""
    r = await async_client.post("/api/strategies/backtest", json={
        "conditions": [{"field": "made_up_field", "operator": "gt", "value": 1}],
    })
    assert r.status_code == 422


@pytest.mark.anyio
async def test_backtest_empty_conditions(async_client):
    """空条件返回 422"""
    r = await async_client.post("/api/strategies/backtest", json={
        "conditions": [],
    })
    assert r.status_code == 422


@pytest.mark.anyio
async def test_backtest_valid_conditions(async_client):
    """有效条件返回 202 + task_id"""
    r = await async_client.post("/api/strategies/backtest", json={
        "conditions": [{"field": "ma5", "operator": "gt", "field2": "ma20"}],
    })
    assert r.status_code == 202
    data = r.json()
    assert "task_id" in data
    assert data["status"] == "pending"


@pytest.mark.anyio
async def test_poll_backtest_not_found(async_client):
    """轮询不存在的任务返回 404"""
    r = await async_client.get("/api/strategies/backtest/99999")
    assert r.status_code == 404


@pytest.mark.skip(reason="后台异步任务在测试事件循环中不稳定")
@pytest.mark.anyio
async def test_poll_backtest_progress(async_client):
    """提交回测后可以轮询状态"""
    import asyncio
    # 提交
    r = await async_client.post("/api/strategies/backtest", json={
        "conditions": [{"field": "ma5", "operator": "gt", "field2": "ma20"}],
    })
    assert r.status_code == 202
    task_id = r.json()["task_id"]

    # 轮询（可能 pending/running/done/error）
    for _ in range(3):
        await asyncio.sleep(0.5)
        r2 = await async_client.get(f"/api/strategies/backtest/{task_id}")
        if r2.status_code == 200:
            status = r2.json()
            assert status["status"] in ("pending", "running", "done", "error")
            break
