from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from app.db import database_is_up

router = APIRouter()

DatabaseCheck = Callable[[], Awaitable[bool]]


def get_database_check() -> DatabaseCheck:
    return database_is_up


@router.get("/health")
async def health(
    response: Response,
    check_database: Annotated[DatabaseCheck, Depends(get_database_check)],
) -> dict[str, str]:
    """Utilisé par le healthcheck Docker (TRD §10.5)."""
    db_ok = await check_database()
    if not db_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "ok" if db_ok else "degraded", "db": "ok" if db_ok else "error"}
