"""API côté joueur (TRD §3.2), phase 1 : profils, connexion, session, tentatives."""

from __future__ import annotations

import random
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import Integer, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentProfile, create_token, verify_pin
from app.config import get_settings
from app.db import get_db
from app.engine import session_pack
from app.errors import ApiError
from app.models import Attempt, GameSession, Profile

router = APIRouter(prefix="/play", tags=["play"])
Db = Annotated[AsyncSession, Depends(get_db)]


# --- Schémas ----------------------------------------------------------------------


class ProfileOut(BaseModel):
    id: int
    name: str
    avatar: str
    level: str
    world: str


class LoginIn(BaseModel):
    profile_id: int
    pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")


class LoginOut(BaseModel):
    token: str
    expires_at: datetime
    profile: ProfileOut


class SessionStartOut(BaseModel):
    session_id: str
    items: list[dict[str, Any]]
    formulas: dict[str, str]
    settings: dict[str, Any]


class AttemptIn(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID | None = None
    item_id: str = Field(max_length=120)
    generator: str | None = Field(default=None, max_length=80)
    difficulty: int = Field(ge=1, le=5)
    notion_ids: list[str] = Field(max_length=10)
    correct: bool
    time_ms: int = Field(ge=0, le=3_600_000)
    hint_used: bool = False
    game_mode: str = Field(default="combat", max_length=20)
    answered_at: datetime


class AttemptsIn(BaseModel):
    attempts: list[AttemptIn] = Field(max_length=500)


class AttemptsOut(BaseModel):
    accepted: int
    duplicates: int


class SessionEndIn(BaseModel):
    session_id: uuid.UUID
    active_seconds: int = Field(ge=0, le=24 * 3600)


# --- Routes -----------------------------------------------------------------------


def _profile_out(p: Profile) -> ProfileOut:
    return ProfileOut(id=p.id, name=p.name, avatar=p.avatar, level=p.level, world=p.world)


@router.get("/profiles", response_model=list[ProfileOut])
async def list_profiles(db: Db) -> list[ProfileOut]:
    rows = await db.scalars(select(Profile).order_by(Profile.id))
    return [_profile_out(p) for p in rows]


@router.post("/login", response_model=LoginOut)
async def login(body: LoginIn, db: Db) -> LoginOut:
    settings = get_settings()
    profile = await db.get(Profile, body.profile_id)
    if profile is None:
        raise ApiError(404, "unknown_profile", "Profil inconnu.")
    now = datetime.now(UTC)
    locked_until = _aware(profile.locked_until)
    if locked_until and locked_until > now:
        raise ApiError(
            423,
            "locked",
            "Trop d'essais. Attends un peu avant de réessayer.",
            retry_after_s=int((locked_until - now).total_seconds()) + 1,
        )
    if not verify_pin(profile.pin_hash, body.pin):
        profile.failed_logins += 1
        remaining = settings.max_failed_logins - profile.failed_logins
        if remaining <= 0:
            profile.failed_logins = 0
            profile.locked_until = now + timedelta(minutes=settings.lock_minutes)
            await db.commit()
            raise ApiError(
                423,
                "locked",
                "Trop d'essais. Attends un peu avant de réessayer.",
                retry_after_s=settings.lock_minutes * 60,
            )
        await db.commit()
        raise ApiError(401, "wrong_pin", "Code incorrect.", remaining_attempts=remaining)
    profile.failed_logins = 0
    profile.locked_until = None
    await db.commit()
    token, expires = create_token(profile.id)
    return LoginOut(token=token, expires_at=expires, profile=_profile_out(profile))


@router.post("/session/start", response_model=SessionStartOut)
async def start_session(profile: CurrentProfile, db: Db) -> SessionStartOut:
    session = GameSession(id=str(uuid.uuid4()), profile_id=profile.id)
    db.add(session)
    await db.commit()
    pack = session_pack.build(profile.level, random.Random())
    return SessionStartOut(
        session_id=session.id,
        items=pack["items"],
        formulas=pack["formulas"],
        settings={"session_max_minutes": profile.session_max_minutes},
    )


@router.post("/attempts", response_model=AttemptsOut)
async def post_attempts(body: AttemptsIn, profile: CurrentProfile, db: Db) -> AttemptsOut:
    """Idempotent : une tentative déjà reçue (même UUID) est ignorée (TRD §2.7)."""
    ids = [str(a.id) for a in body.attempts]
    existing = set(await db.scalars(select(Attempt.id).where(Attempt.id.in_(ids))))
    session_ids = {str(a.session_id) for a in body.attempts if a.session_id}
    if session_ids:
        owned = set(
            await db.scalars(
                select(GameSession.id).where(
                    GameSession.id.in_(session_ids), GameSession.profile_id == profile.id
                )
            )
        )
        if session_ids - owned:
            raise ApiError(403, "foreign_session", "Session inconnue pour ce profil.")
    accepted = 0
    seen: set[str] = set()
    for a in body.attempts:
        key = str(a.id)
        if key in existing or key in seen:
            continue
        seen.add(key)
        db.add(
            Attempt(
                id=key,
                profile_id=profile.id,
                session_id=str(a.session_id) if a.session_id else None,
                item_id=a.item_id,
                generator=a.generator,
                difficulty=a.difficulty,
                notion_ids=a.notion_ids,
                correct=a.correct,
                time_ms=a.time_ms,
                hint_used=a.hint_used,
                game_mode=a.game_mode,
                answered_at=a.answered_at,
            )
        )
        accepted += 1
    await db.commit()
    return AttemptsOut(accepted=accepted, duplicates=len(body.attempts) - accepted)


@router.post("/session/end")
async def end_session(body: SessionEndIn, profile: CurrentProfile, db: Db) -> dict[str, int]:
    session = await db.get(GameSession, str(body.session_id))
    if session is None or session.profile_id != profile.id:
        raise ApiError(404, "unknown_session", "Session inconnue.")
    total, correct = (
        await db.execute(
            select(func.count(), func.coalesce(func.sum(cast(Attempt.correct, Integer)), 0)).where(
                Attempt.session_id == session.id
            )
        )
    ).one()
    session.ended_at = datetime.now(UTC)
    session.active_seconds = body.active_seconds
    session.nb_questions = int(total)
    session.nb_correct = int(correct)
    await db.commit()
    return {"nb_questions": session.nb_questions, "nb_correct": session.nb_correct}


def _aware(value: datetime | None) -> datetime | None:
    """SQLite rend des dates sans fuseau : on les considère en UTC."""
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value
