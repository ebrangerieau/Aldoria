from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from app.config import get_settings
from app.db import database_revision

router = APIRouter()

DatabaseCheck = Callable[[], Awaitable[str | None]]


def get_database_check() -> DatabaseCheck:
    return database_revision


@router.get("/health")
async def health(
    response: Response,
    check_database: Annotated[DatabaseCheck, Depends(get_database_check)],
) -> dict[str, str]:
    """Utilisé par le healthcheck Docker (TRD §10.5) et, après une mise en ligne, par la CI :
    commit en service (`version`) et migration appliquée (`migration`)."""
    revision = await check_database()
    if revision is None:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "status": "ok" if revision is not None else "degraded",
        "db": "ok" if revision is not None else "error",
        "version": get_settings().version,
        "migration": revision or "",
    }
