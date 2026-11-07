import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.routers.health import get_database_check


def _check_returning(value: str | None):
    async def check() -> str | None:
        return value

    return lambda: check


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def test_health_ok_when_database_up(client):
    app.dependency_overrides[get_database_check] = _check_returning("0011")
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": "ok", "version": "dev", "migration": "0011"}


async def test_health_503_when_database_down(client):
    app.dependency_overrides[get_database_check] = _check_returning(None)
    response = await client.get("/api/v1/health")
    assert response.status_code == 503
    assert response.json() == {
        "status": "degraded", "db": "error", "version": "dev", "migration": ""
    }


async def test_health_gives_the_version_in_service(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("ALDORIA_VERSION", "abc1234")
    get_settings.cache_clear()
    app.dependency_overrides[get_database_check] = _check_returning("0011")
    try:
        response = await client.get("/api/v1/health")
    finally:
        get_settings.cache_clear()
    assert response.json()["version"] == "abc1234"



async def test_openapi_not_exposed_publicly(client):
    response = await client.get("/openapi.json")
    assert response.status_code == 404
