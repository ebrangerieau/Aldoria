"""Authentification des enfants : profil + PIN à 4 chiffres → jeton JWT (TRD §8)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_db
from app.errors import ApiError
from app.models import Profile

_hasher = PasswordHasher()
_bearer = HTTPBearer(auto_error=False)


def hash_pin(pin: str) -> str:
    if not (len(pin) == 4 and pin.isdigit()):
        raise ValueError("Le PIN doit comporter exactement 4 chiffres.")
    return _hasher.hash(pin)


def verify_pin(pin_hash: str | None, pin: str) -> bool:
    if not pin_hash:
        return False
    try:
        return _hasher.verify(pin_hash, pin)
    except (VerifyMismatchError, InvalidHashError):
        return False


def create_token(profile_id: int) -> tuple[str, datetime]:
    settings = get_settings()
    expires = datetime.now(UTC) + timedelta(hours=settings.token_hours)
    token = jwt.encode(
        {"sub": str(profile_id), "exp": expires, "scope": "play"},
        settings.jwt_secret,
        algorithm="HS256",
    )
    return token, expires


async def current_profile(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Profile:
    if credentials is None:
        raise ApiError(401, "missing_token", "Connexion requise.")
    try:
        payload = jwt.decode(
            credentials.credentials, get_settings().jwt_secret, algorithms=["HS256"]
        )
    except jwt.ExpiredSignatureError as exc:
        raise ApiError(401, "token_expired", "Session expirée, reconnecte-toi.") from exc
    except jwt.InvalidTokenError as exc:
        raise ApiError(401, "invalid_token", "Jeton invalide.") from exc
    if payload.get("scope") != "play":
        raise ApiError(401, "invalid_token", "Jeton invalide.")
    profile = await db.get(Profile, int(payload["sub"]))
    if profile is None:
        raise ApiError(401, "invalid_token", "Profil introuvable.")
    return profile


CurrentProfile = Annotated[Profile, Depends(current_profile)]
