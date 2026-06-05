"""自选股 API 测试"""
import pytest
from httpx import AsyncClient

from .conftest import register_user


class TestWatchlistCRUD:
    @pytest.fixture(autouse=True)
    async def setup_user(self, async_client: AsyncClient):
        self.token = await register_user(async_client)

    async def test_empty_watchlist_returns_empty_items(self, async_client: AsyncClient):
        r = await async_client.get(
            "/api/user/watchlist",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["items"] == []
        assert data["count"] == 0

    async def test_add_and_list_watchlist(self, async_client: AsyncClient):
        r = await async_client.post(
            "/api/user/watchlist/600519",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        assert r.status_code == 201
        data = r.json()
        assert data["code"] == "600519"
        assert data["name"] == "贵州茅台"
        assert data["market"] == "sh"

        r2 = await async_client.get(
            "/api/user/watchlist",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        assert r2.status_code == 200
        assert r2.json()["count"] == 1
        assert r2.json()["items"][0]["code"] == "600519"

    async def test_add_duplicate_stock_returns_409(self, async_client: AsyncClient):
        await async_client.post(
            "/api/user/watchlist/000001",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        r = await async_client.post(
            "/api/user/watchlist/000001",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        assert r.status_code == 409

    async def test_add_unknown_stock_returns_404(self, async_client: AsyncClient):
        r = await async_client.post(
            "/api/user/watchlist/999999",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        assert r.status_code == 404

    async def test_remove_watchlist(self, async_client: AsyncClient):
        await async_client.post(
            "/api/user/watchlist/000001",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        r = await async_client.delete(
            "/api/user/watchlist/000001",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        assert r.status_code == 204

        r2 = await async_client.get(
            "/api/user/watchlist",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        assert r2.json()["count"] == 0

    async def test_remove_nonexistent_returns_404(self, async_client: AsyncClient):
        r = await async_client.delete(
            "/api/user/watchlist/000001",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        assert r.status_code == 404

    async def test_watchlist_without_token_returns_401(self, async_client: AsyncClient):
        r = await async_client.get("/api/user/watchlist")
        assert r.status_code == 401
