"""股票 API 测试"""
from httpx import AsyncClient


class TestSearch:
    async def test_search_no_query_returns_422(self, async_client: AsyncClient):
        response = await async_client.get("/api/stocks/search")
        assert response.status_code == 422

    async def test_search_returns_list(self, async_client: AsyncClient):
        response = await async_client.get("/api/stocks/search?q=平安")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for item in data:
            assert "code" in item
            assert "name" in item
            assert "market" in item


class TestGetStockOverview:
    async def test_invalid_code_letters_returns_404(self, async_client: AsyncClient):
        response = await async_client.get("/api/stocks/ABC/overview")
        assert response.status_code == 404
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == "NOT_FOUND"
        assert "6位数字" in data["error"]["detail"]

    async def test_invalid_code_too_short_returns_404(self, async_client: AsyncClient):
        response = await async_client.get("/api/stocks/123/overview")
        assert response.status_code == 404
        data = response.json()
        assert "error" in data
        assert "6位数字" in data["error"]["detail"]

    async def test_valid_code_no_data_returns_404(self, async_client: AsyncClient):
        response = await async_client.get("/api/stocks/999999/overview")
        assert response.status_code == 404
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == "NOT_FOUND"


class TestGetStockKline:
    async def test_invalid_code_returns_404(self, async_client: AsyncClient):
        response = await async_client.get("/api/stocks/ABC/kline")
        assert response.status_code == 404
        data = response.json()
        assert "error" in data


class TestHealth:
    async def test_health_returns_200(self, async_client: AsyncClient):
        response = await async_client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
