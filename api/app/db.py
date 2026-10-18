from collections.abc import AsyncIterator
from functools import lru_cache

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import get_settings


@lru_cache
def get_engine() -> AsyncEngine:
    return create_async_engine(get_settings().database_url, pool_pre_ping=True)


@lru_cache
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with get_sessionmaker()() as session:
        yield session


async def database_revision() -> str | None:
    """Migration appliquée à la base (table d'Alembic), « » si aucune ;
    None si la base ne répond pas."""
    try:
        async with get_engine().connect() as conn:
            rows = await conn.execute(text("SELECT version_num FROM alembic_version"))
            return ",".join(sorted(str(r[0]) for r in rows))
    except Exception:
        try:
            async with get_engine().connect() as conn:
                await conn.execute(text("SELECT 1"))
            return ""  # base joignable, pas encore migrée
        except Exception:
            return None
