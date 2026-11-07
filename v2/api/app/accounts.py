"""Comptes adultes de l'espace parent et appareils reliés à une famille.

- Adulte : e-mail + mot de passe (Argon2id), blocage après MAX_FAILED erreurs.
- Session : jeton aléatoire dans un cookie HttpOnly / Secure / SameSite=Strict limité
  à l'API parent ; seule son empreinte SHA-256 est en base (une fuite de la base ne
  donne pas de session utilisable).
- Toute requête parent porte aussi le secret posé par Traefik sur l'hôte admin
  (`X-Aldoria-Admin-Key`, séparation des hôtes) et, pour une modification, l'en-tête
  `X-Requested-With: aldoria` (protection CSRF en plus de SameSite).
- Appareil : jeton durable (`X-Aldoria-Device`) obtenu contre un code de liaison à
  8 chiffres créé par un parent.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_db
from app.errors import ApiError
from app.models import Adult, AdultSession, Device, Invitation, PairingCode

COOKIE = "aldoria_parent"
COOKIE_PATH = "/api/v1/admin"
SESSION_DAYS = 30
PASSWORD_MIN = 10
MAX_FAILED = 5
LOCK_MINUTES = 15
CSRF_HEADER = "x-requested-with"
CSRF_VALUE = "aldoria"
DEVICE_HEADER = "x-aldoria-device"
INVITATION_DAYS = {"adulte": 7, "famille": 7, "mot_de_passe": 2}
PAIRING_MINUTES = 30
TOUCH_EVERY = timedelta(minutes=5)  # « vu le » : une écriture toutes les 5 min au plus

_hasher = PasswordHasher()


def utcnow() -> datetime:
    return datetime.now(UTC)


def aware(value: datetime | None) -> datetime | None:
    """SQLite (tests) rend des dates sans fuseau : elles sont en UTC."""
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


def digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_token() -> str:
    return secrets.token_urlsafe(32)


def new_pairing_code() -> str:
    return f"{secrets.randbelow(10**8):08d}"


def check_password_rules(password: str) -> None:
    if len(password) < PASSWORD_MIN:
        raise ApiError(
            422, "weak_password", f"Le mot de passe doit faire au moins {PASSWORD_MIN} caractères."
        )
    if len(password) > 200:
        raise ApiError(422, "weak_password", "Mot de passe trop long.")


def hash_password(password: str) -> str:
    check_password_rules(password)
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    if not password_hash:
        return False
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


# Empreinte de référence : même durée de calcul quand l'e-mail est inconnu (on ne
# révèle pas quels e-mails ont un compte).
_DUMMY_HASH = _hasher.hash("pas-un-vrai-mot-de-passe")


def burn_time(password: str) -> None:
    verify_password(_DUMMY_HASH, password)


def invitation_link(token: str) -> str:
    # Fragment (#) : jamais envoyé au serveur, donc absent des journaux.
    return f"{get_settings().admin_url.rstrip('/')}/#invitation={token}"


async def create_invitation(
    db: AsyncSession,
    kind: str,
    *,
    family_id: int | None = None,
    adult_id: int | None = None,
    created_by: int | None = None,
    note: str = "",
    operator: bool = False,
) -> tuple[str, Invitation]:
    """Lien à usage unique ; seule l'empreinte du jeton est gardée."""
    token = new_token()
    now = utcnow()
    invitation = Invitation(
        id=digest(token),
        kind=kind,
        family_id=family_id,
        adult_id=adult_id,
        created_by=created_by,
        note=note[:80],
        operator=operator,
        created_at=now,
        expires_at=now + timedelta(days=INVITATION_DAYS[kind]),
    )
    db.add(invitation)
    await db.commit()
    return token, invitation


async def create_pairing_code(
    db: AsyncSession, family_id: int, device_name: str
) -> tuple[str, PairingCode]:
    """Code de liaison d'un appareil : 8 chiffres, 30 minutes, usage unique."""
    now = utcnow()
    while True:
        code = new_pairing_code()
        if await db.get(PairingCode, digest(code)) is None:
            break
    pairing = PairingCode(
        id=digest(code),
        family_id=family_id,
        device_name=device_name[:60],
        created_at=now,
        expires_at=now + timedelta(minutes=PAIRING_MINUTES),
    )
    db.add(pairing)
    await db.commit()
    return code, pairing


async def open_session(db: AsyncSession, adult: Adult, response: Response, label: str) -> None:
    token = new_token()
    now = utcnow()
    db.add(
        AdultSession(
            id=digest(token),
            adult_id=adult.id,
            label=label[:120],
            created_at=now,
            expires_at=now + timedelta(days=SESSION_DAYS),
            last_seen_at=now,
        )
    )
    adult.last_login_at = now
    await db.commit()
    response.set_cookie(
        COOKIE,
        token,
        max_age=SESSION_DAYS * 86400,
        path=COOKIE_PATH,
        httponly=True,
        secure=True,
        samesite="strict",
    )


def close_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE, path=COOKIE_PATH, httponly=True, secure=True, samesite="strict")


def check_admin_host(request: Request) -> None:
    """Secret ajouté par le seul routeur Traefik de l'hôte admin : sans lui, l'API
    parent n'existe pas (404), même pour qui forge des en-têtes sur l'hôte public."""
    settings = get_settings()
    key = request.headers.get("x-aldoria-admin-key", "")
    if not settings.admin_key or not hmac.compare_digest(key.encode(), settings.admin_key.encode()):
        raise ApiError(404, "not_found", "Ressource introuvable.")
    if request.method not in ("GET", "HEAD") and request.headers.get(CSRF_HEADER) != CSRF_VALUE:
        raise ApiError(403, "csrf", "Requête refusée.")


AdminHost = Annotated[None, Depends(check_admin_host)]


async def current_adult(
    request: Request,
    _host: AdminHost,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Adult:
    token = request.cookies.get(COOKIE, "")
    session = await db.get(AdultSession, digest(token)) if token else None
    now = utcnow()
    if session is None or aware(session.expires_at) <= now:
        raise ApiError(401, "not_logged_in", "Connexion requise.")
    adult = await db.get(Adult, session.adult_id)
    if adult is None:
        raise ApiError(401, "not_logged_in", "Connexion requise.")
    if now - aware(session.last_seen_at) > TOUCH_EVERY:
        session.last_seen_at = now
        await db.commit()
    request.state.session_id = session.id
    return adult


CurrentAdult = Annotated[Adult, Depends(current_adult)]


async def current_operator(adult: CurrentAdult) -> Adult:
    if not adult.is_operator:
        raise ApiError(403, "forbidden", "Réservé à l'exploitant du serveur.")
    return adult


CurrentOperator = Annotated[Adult, Depends(current_operator)]


async def current_device(request: Request, db: Annotated[AsyncSession, Depends(get_db)]) -> Device:
    token = request.headers.get(DEVICE_HEADER, "")
    device = None
    if token:
        device = await db.scalar(select(Device).where(Device.token_hash == digest(token)))
    if device is None:
        raise ApiError(401, "device_unknown", "Cet appareil n'est pas relié à une famille.")
    now = utcnow()
    if device.last_seen_at is None or now - aware(device.last_seen_at) > TOUCH_EVERY:
        device.last_seen_at = now
        await db.commit()
    return device


CurrentDevice = Annotated[Device, Depends(current_device)]
