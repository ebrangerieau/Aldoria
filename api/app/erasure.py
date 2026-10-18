"""Effacement (droit à l'effacement, RGPD) : un enfant ou une famille entière.

Les suppressions sont faites table par table plutôt que confiées aux clés étrangères
(`ON DELETE CASCADE`) : même résultat sous SQLite (tests) et PostgreSQL, et la liste
de ce qui est effacé reste lisible ici.
"""

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Adult,
    AdultSession,
    AiUsage,
    Attempt,
    BankItem,
    ChapterStatus,
    ClientError,
    Device,
    Family,
    FamilyNotion,
    GameSession,
    Invitation,
    NotionAside,
    NotionState,
    PairingCode,
    Profile,
    Report,
    SaveRevision,
)

# Données d'un enfant, dans l'ordre (les réponses avant les sessions qu'elles citent).
PROFILE_DATA = (
    Attempt, Report, NotionState, NotionAside, SaveRevision, ChapterStatus, GameSession
)


async def delete_profile_data(db: AsyncSession, profile_id: int) -> dict[str, int]:
    counts = {}
    for model in PROFILE_DATA:
        result = await db.execute(delete(model).where(model.profile_id == profile_id))
        counts[model.__tablename__] = result.rowcount or 0
    return counts


async def delete_profile(db: AsyncSession, profile: Profile) -> None:
    await delete_profile_data(db, profile.id)
    await db.delete(profile)


async def delete_family(db: AsyncSession, family_id: int) -> None:
    for profile in await db.scalars(select(Profile).where(Profile.family_id == family_id)):
        await delete_profile(db, profile)
    adults = select(Adult.id).where(Adult.family_id == family_id)
    await db.execute(delete(AdultSession).where(AdultSession.adult_id.in_(adults)))
    await db.execute(
        delete(Invitation).where(
            (Invitation.family_id == family_id) | Invitation.adult_id.in_(adults)
        )
    )
    for model in (Adult, BankItem, ClientError, Device, PairingCode, FamilyNotion, AiUsage):
        await db.execute(delete(model).where(model.family_id == family_id))
    await db.execute(delete(Family).where(Family.id == family_id))
