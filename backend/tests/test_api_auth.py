"""认证 API 测试"""
import pytest
from httpx import AsyncClient


class TestRegister:
    async def test_register_creates_user_and_returns_tokens(self, async_client: AsyncClient):
        response = await async_client.post("/api/auth/register", json={
            "email": "test@example.com",
            "password": "password123",
        })
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_register_duplicate_email_returns_error(self, async_client: AsyncClient):
        payload = {"email": "dup@example.com", "password": "password123"}
        r1 = await async_client.post("/api/auth/register", json=payload)
        assert r1.status_code == 201
        r2 = await async_client.post("/api/auth/register", json=payload)
        assert r2.status_code == 401
        assert r2.json()["error"]["code"] == "AUTH_ERROR"

    async def test_register_short_password_returns_422(self, async_client: AsyncClient):
        response = await async_client.post("/api/auth/register", json={
            "email": "test@example.com",
            "password": "1234567",
        })
        assert response.status_code == 422

    async def test_register_invalid_email_returns_422(self, async_client: AsyncClient):
        response = await async_client.post("/api/auth/register", json={
            "email": "not-an-email",
            "password": "password123",
        })
        assert response.status_code == 422


class TestLogin:
    @pytest.fixture(autouse=True)
    async def setup_user(self, async_client: AsyncClient):
        await async_client.post("/api/auth/register", json={
            "email": "login@example.com",
            "password": "correctpassword",
        })

    async def test_login_correct_credentials_returns_tokens(self, async_client: AsyncClient):
        response = await async_client.post("/api/auth/login", json={
            "email": "login@example.com",
            "password": "correctpassword",
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data

    async def test_login_wrong_password_returns_401(self, async_client: AsyncClient):
        response = await async_client.post("/api/auth/login", json={
            "email": "login@example.com",
            "password": "wrongpassword",
        })
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "AUTH_ERROR"

    async def test_login_nonexistent_user_returns_401(self, async_client: AsyncClient):
        response = await async_client.post("/api/auth/login", json={
            "email": "nobody@example.com",
            "password": "whatever",
        })
        assert response.status_code == 401


class TestRefresh:
    @pytest.fixture(autouse=True)
    async def setup_user(self, async_client: AsyncClient):
        r = await async_client.post("/api/auth/register", json={
            "email": "refresh@example.com",
            "password": "password123",
        })
        self.refresh_token = r.json()["refresh_token"]

    async def test_refresh_with_valid_token_returns_new_tokens(self, async_client: AsyncClient):
        response = await async_client.post(
            "/api/auth/refresh",
            headers={"Authorization": f"Bearer {self.refresh_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data

    async def test_refresh_with_access_token_returns_401(self, async_client: AsyncClient):
        r = await async_client.post("/api/auth/login", json={
            "email": "refresh@example.com",
            "password": "password123",
        })
        access_token = r.json()["access_token"]
        response = await async_client.post(
            "/api/auth/refresh",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert response.status_code == 401


class TestMe:
    async def test_me_with_valid_token_returns_user(self, async_client: AsyncClient):
        r = await async_client.post("/api/auth/register", json={
            "email": "me@example.com",
            "password": "password123",
        })
        token = r.json()["access_token"]
        response = await async_client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "me@example.com"
        assert "id" in data

    async def test_me_without_token_returns_401(self, async_client: AsyncClient):
        response = await async_client.get("/api/auth/me")
        assert response.status_code == 401

    async def test_me_with_invalid_token_returns_401(self, async_client: AsyncClient):
        response = await async_client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code == 401
