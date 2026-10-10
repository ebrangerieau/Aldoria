"""Tables (TRD §4). Phase 1 : profils, sessions de jeu, tentatives."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# JSONB sur PostgreSQL, JSON ailleurs (SQLite des tests).
JSONType = JSON().with_variant(JSONB(), "postgresql")


def utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class Profile(Base):
    __tablename__ = "profile"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(40), unique=True)
    avatar: Mapped[str] = mapped_column(String(40))
    level: Mapped[str] = mapped_column(String(8))  # « 6e » ou « 2nde »
    world: Mapped[str] = mapped_column(String(16))  # « jules » ou « tom »
    pin_hash: Mapped[str | None] = mapped_column(String(200))
    failed_logins: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    session_max_minutes: Mapped[int] = mapped_column(Integer, default=25)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class GameSession(Base):
    __tablename__ = "game_session"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    profile_id: Mapped[int] = mapped_column(
        ForeignKey("profile.id", ondelete="CASCADE"), index=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    active_seconds: Mapped[int | None] = mapped_column(Integer)
    nb_questions: Mapped[int] = mapped_column(Integer, default=0)
    nb_correct: Mapped[int] = mapped_column(Integer, default=0)


class Attempt(Base):
    """Une réponse. L'identifiant est un UUID créé par le client : renvoyer la même
    tentative après une coupure réseau ne crée pas de doublon (TRD §2.7)."""

    __tablename__ = "attempt"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    profile_id: Mapped[int] = mapped_column(
        ForeignKey("profile.id", ondelete="CASCADE"), index=True
    )
    session_id: Mapped[str | None] = mapped_column(
        ForeignKey("game_session.id", ondelete="CASCADE"), index=True
    )
    item_id: Mapped[str] = mapped_column(String(120))
    generator: Mapped[str | None] = mapped_column(String(80))
    difficulty: Mapped[int] = mapped_column(Integer)
    notion_ids: Mapped[list[str]] = mapped_column(JSONType)
    correct: Mapped[bool] = mapped_column(Boolean)
    time_ms: Mapped[int] = mapped_column(Integer)
    hint_used: Mapped[bool] = mapped_column(Boolean, default=False)
    game_mode: Mapped[str] = mapped_column(String(20), default="combat")
    extra: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
