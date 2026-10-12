from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app import accounts
from app.auth import hash_pin
from app.db import get_db
from app.engine.tracking import seed_curriculum
from app.main import app
from app.models import Adult, AdultSession, Base, Device, Family, Profile

# Famille n° 1 du banc : un appareil relié (jeton envoyé par défaut par `client`) et un
# parent connecté (session `PARENT_SESSION`, voir tests/test_admin.py::parent).
DEVICE_TOKEN = "appareil-de-test"
PARENT_SESSION = "session-de-test"
PARENT_EMAIL = "parent@example.org"
PARENT_PASSWORD = "mot de passe du parent"
# Une seule empreinte Argon2 pour toute la suite (le calcul est volontairement lent).
PARENT_HASH = accounts.hash_password(PARENT_PASSWORD)


@pytest.fixture
async def sessionmaker():
    engine = create_async_engine("sqlite+aiosqlite://", poolclass=StaticPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as db:
        db.add(Family(id=1, name="Famille test"))
        await db.flush()
        db.add(Device(family_id=1, name="Tablette", token_hash=accounts.digest(DEVICE_TOKEN)))
        db.add(
            Adult(
                id=1, family_id=1, email=PARENT_EMAIL, name="Le parent", password_hash=PARENT_HASH
            )
        )
        await db.flush()
        db.add(
            AdultSession(
                id=accounts.digest(PARENT_SESSION),
                adult_id=1,
                expires_at=datetime.now(UTC) + timedelta(days=1),
            )
        )
        await db.commit()
    yield maker
    await engine.dispose()


@pytest.fixture
async def profiles(sessionmaker):
    async with sessionmaker() as db:
        jules = Profile(
            family_id=1,
            name="Jules",
            avatar="renard",
            level="6e",
            world="jules",
            pin_hash=hash_pin("1234"),
        )
        tom = Profile(
            family_id=1,
            name="Tom",
            avatar="loup",
            level="2nde",
            world="tom",
            pin_hash=hash_pin("9876"),
        )
        db.add_all([jules, tom])
        await db.commit()
        return {"jules": jules.id, "tom": tom.id}


@pytest.fixture
async def client(sessionmaker):
    async def _db():
        async with sessionmaker() as session:
            yield session

    app.dependency_overrides[get_db] = _db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={accounts.DEVICE_HEADER: DEVICE_TOKEN},
    ) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
async def login(client, profiles):
    async def _login(name: str, pin: str) -> dict:
        response = await client.post(
            "/api/v1/play/login", json={"profile_id": profiles[name], "pin": pin}
        )
        assert response.status_code == 200, response.text
        return {"Authorization": f"Bearer {response.json()['token']}"}

    return _login


@pytest.fixture
async def curriculum(sessionmaker):
    async with sessionmaker() as db:
        return await seed_curriculum(db)
