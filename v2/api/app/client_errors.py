"""Erreurs du jeu remontées par les appareils (autoload `ErrorReport` côté jeu).

Le jeu envoie, par lots, chaque erreur de script ou du moteur : message, endroit du code,
écran, version du jeu, type d'appareil. Jamais de donnée d'enfant. Une même erreur (même
version, même endroit, même message) n'occupe qu'une ligne par famille, avec un compteur.
L'exploitant les lit dans l'espace parent (Exploitation → Erreurs du jeu) ; elles s'effacent
après 30 jours.
"""

from __future__ import annotations

import hashlib
from datetime import timedelta
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ClientError, Device, Family, utcnow

KEEP_DAYS = 30
MAX_ROWS_PER_FAMILY = 300  # au-delà, seules les erreurs déjà connues sont comptées
MAX_PER_BATCH = 20


class ErrorIn(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    location: str = Field("", max_length=200)
    scene: str = Field("", max_length=120)
    count: int = Field(1, ge=1, le=1000)


class ErrorsIn(BaseModel):
    version: str = Field(min_length=1, max_length=40)
    platform: str = Field("", max_length=80)
    errors: list[ErrorIn] = Field(min_length=1, max_length=MAX_PER_BATCH)


def fingerprint(version: str, location: str, message: str) -> str:
    return hashlib.sha256("|".join((version, location, message)).encode()).hexdigest()


async def record(db: AsyncSession, device: Device, batch: ErrorsIn) -> int:
    """Range un lot d'erreurs ; renvoie le nombre de lignes nouvelles."""
    now = utcnow()
    old = now - timedelta(days=KEEP_DAYS)
    await db.execute(delete(ClientError).where(ClientError.last_seen < old))
    mine = ClientError.family_id == device.family_id
    stored = await db.scalar(select(func.count()).select_from(ClientError).where(mine)) or 0
    created = 0
    for error in batch.errors:
        key = fingerprint(batch.version, error.location, error.message)
        row = await db.scalar(
            select(ClientError).where(
                ClientError.family_id == device.family_id, ClientError.fingerprint == key
            )
        )
        if row is not None:
            row.count += error.count
            row.last_seen = now
            row.device_id = device.id
            row.platform = batch.platform
            row.scene = error.scene or row.scene
        elif stored < MAX_ROWS_PER_FAMILY:
            db.add(
                ClientError(
                    family_id=device.family_id,
                    device_id=device.id,
                    fingerprint=key,
                    version=batch.version,
                    platform=batch.platform,
                    scene=error.scene,
                    location=error.location,
                    message=error.message,
                    count=error.count,
                    first_seen=now,
                    last_seen=now,
                )
            )
            stored += 1
            created += 1
    await db.commit()
    return created


async def recent(db: AsyncSession, limit: int = 200) -> list[dict[str, Any]]:
    """Erreurs des 30 derniers jours, les plus récentes d'abord (toutes familles : exploitant)."""
    since = utcnow() - timedelta(days=KEEP_DAYS)
    rows = await db.execute(
        select(ClientError, Family.name, Device.name)
        .join(Family, Family.id == ClientError.family_id)
        .outerjoin(Device, Device.id == ClientError.device_id)
        .where(ClientError.last_seen >= since)
        .order_by(ClientError.last_seen.desc())
        .limit(limit)
    )
    return [
        {
            "id": error.id,
            "family": family,
            "device": device or "",
            "version": error.version,
            "platform": error.platform,
            "scene": error.scene,
            "location": error.location,
            "message": error.message,
            "count": error.count,
            "first_seen": error.first_seen,
            "last_seen": error.last_seen,
        }
        for error, family, device in rows
    ]


async def clear(db: AsyncSession) -> int:
    result = await db.execute(delete(ClientError))
    await db.commit()
    return result.rowcount or 0
