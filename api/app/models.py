"""Tables (TRD §4) : profils, programme (matières, chapitres, notions), suivi par
notion (Leitner + maîtrise), sessions de jeu, tentatives."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String
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
    # Mélange d'une session (TRD §5.5), réglable par le parent.
    ratio_chapter: Mapped[float] = mapped_column(Float, default=0.5)
    ratio_review: Mapped[float] = mapped_column(Float, default=0.3)
    ratio_automatisms: Mapped[float] = mapped_column(Float, default=0.2)
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


class Subject(Base):
    __tablename__ = "subject"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    label: Mapped[str] = mapped_column(String(60))


class Chapter(Base):
    __tablename__ = "chapter"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subject.id", ondelete="CASCADE"))
    level: Mapped[str] = mapped_column(String(8), index=True)
    code: Mapped[str] = mapped_column(String(80), unique=True)
    title: Mapped[str] = mapped_column(String(120))
    position: Mapped[int] = mapped_column(Integer, default=0)


class Notion(Base):
    __tablename__ = "notion"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    chapter_id: Mapped[int] = mapped_column(
        ForeignKey("chapter.id", ondelete="CASCADE"), index=True
    )
    code: Mapped[str] = mapped_column(String(120), unique=True)
    label: Mapped[str] = mapped_column(String(200))
    is_automatism: Mapped[bool] = mapped_column(Boolean, default=False)
    # Contenu de programme incertain (sources contradictoires), à confirmer par le parent.
    to_validate: Mapped[bool] = mapped_column(Boolean, default=False)


class ChapterStatus(Base):
    """Statut d'un chapitre pour un enfant, piloté par le parent (PRD US-08)."""

    __tablename__ = "chapter_status"

    profile_id: Mapped[int] = mapped_column(
        ForeignKey("profile.id", ondelete="CASCADE"), primary_key=True
    )
    chapter_id: Mapped[int] = mapped_column(
        ForeignKey("chapter.id", ondelete="CASCADE"), primary_key=True
    )
    # a_venir | en_cours | termine | controle_bientot
    status: Mapped[str] = mapped_column(String(20), default="a_venir")
    test_date: Mapped[date | None] = mapped_column(Date)


class NotionState(Base):
    """Suivi d'une notion pour un enfant : boîte de Leitner et score de maîtrise."""

    __tablename__ = "notion_state"

    profile_id: Mapped[int] = mapped_column(
        ForeignKey("profile.id", ondelete="CASCADE"), primary_key=True
    )
    notion_id: Mapped[int] = mapped_column(
        ForeignKey("notion.id", ondelete="CASCADE"), primary_key=True
    )
    box: Mapped[int] = mapped_column(Integer, default=1)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    mastery: Mapped[float] = mapped_column(Float, default=0.0)
    seen: Mapped[int] = mapped_column(Integer, default=0)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
