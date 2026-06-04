"""形态 API 测试"""
from httpx import AsyncClient


class TestListPatterns:
    async def test_returns_8_patterns(self, async_client: AsyncClient):
        response = await async_client.get("/api/patterns")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 8
        for p in data:
            assert "pattern_id" in p
            assert "pattern_name" in p
            assert "category" in p
            assert "direction" in p

    async def test_contains_known_patterns(self, async_client: AsyncClient):
        response = await async_client.get("/api/patterns")
        data = response.json()
        ids = {p["pattern_id"] for p in data}
        assert "golden-cross" in ids
        assert "death-cross" in ids
        assert "ma-bullish-alignment" in ids
        assert "ma-bearish-alignment" in ids
        assert "volume-up-price-up" in ids
        assert "volume-up-price-down" in ids
        assert "ma-convergence-breakout" in ids
        assert "volume-price-divergence" in ids


class TestGetPatternDetail:
    async def test_golden_cross_detail(self, async_client: AsyncClient):
        response = await async_client.get("/api/patterns/golden-cross")
        assert response.status_code == 200
        data = response.json()
        assert data["pattern_id"] == "golden-cross"
        assert data["pattern_name"] == "金叉"
        assert data["direction"] == "bullish"
        assert "backtest" in data
        assert "determination" in data
        assert "limitations" in data
        assert "related_patterns" in data

    async def test_death_cross_detail(self, async_client: AsyncClient):
        response = await async_client.get("/api/patterns/death-cross")
        assert response.status_code == 200
        data = response.json()
        assert data["pattern_id"] == "death-cross"
        assert data["direction"] == "bearish"

    async def test_nonexistent_returns_404_error_format(self, async_client: AsyncClient):
        response = await async_client.get("/api/patterns/nonexistent")
        assert response.status_code == 404
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == "NOT_FOUND"
        assert "未知形态" in data["error"]["detail"]


class TestGetPatternStocks:
    async def test_returns_empty_list_for_empty_db(self, async_client: AsyncClient):
        response = await async_client.get("/api/patterns/golden-cross/stocks")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_nonexistent_pattern_returns_404(self, async_client: AsyncClient):
        response = await async_client.get("/api/patterns/nonexistent/stocks")
        assert response.status_code == 404
        assert "error" in response.json()
