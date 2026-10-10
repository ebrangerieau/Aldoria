import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.routers.health import get_database_check


def _check_returning(value: bool):
    async def check() -> bool:
        return value

    return lambda: check


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def test_health_ok_when_database_up(client):
    app.dependency_overrides[get_database_check] = _check_returning(True)
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": "ok"}


async def test_health_503_when_database_down(client):
    app.dependency_overrides[get_database_check] = _check_returning(False)
    response = await client.get("/api/v1/health")
    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "db": "error"}


async def test_openapi_not_exposed_publicly(client):
    response = await client.get("/openapi.json")
    assert response.status_code == 404
