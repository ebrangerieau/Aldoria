"""Tables (TRD §4) : familles et adultes, profils, programme (matières, chapitres,
notions), suivi par notion (Leitner + maîtrise), sessions de jeu, tentatives.
Tout ce qu'un parent voit ou modifie appartient à une famille (IMPLEMENTATION_PLAN,
chantier « plusieurs familles »)."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# JSONB sur PostgreSQL, JSON ailleurs (SQLite des tests).
JSONType = JSON().with_variant(JSONB(), "postgresql")


def utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class Family(Base):
    __tablename__ = "family"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Adult(Base):
    """Parent (ou autre adulte) d'une famille : e-mail + mot de passe (accounts.py).
    `is_operator` : l'exploitant du serveur (familles, sauvegardes)."""

    __tablename__ = "adult"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("family.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(200), unique=True)  # en minuscules
    name: Mapped[str] = mapped_column(String(60))
    password_hash: Mapped[str] = mapped_column(String(200))
    is_operator: Mapped[bool] = mapped_column(Boolean, default=False)
    failed_logins: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AdultSession(Base):
    """Session de l'espace parent : seul l'empreinte SHA-256 du jeton est gardée."""

    __tablename__ = "adult_session"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    adult_id: Mapped[int] = mapped_column(ForeignKey("adult.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Invitation(Base):
    """Lien à usage unique (empreinte SHA-256 du jeton) : « adulte » rejoint une famille,
    « famille » en crée une, « mot_de_passe » réinitialise celui d'un adulte."""

    __tablename__ = "invitation"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    kind: Mapped[str] = mapped_column(String(14))
    family_id: Mapped[int | None] = mapped_column(
        ForeignKey("family.id", ondelete="CASCADE"), index=True
    )
    adult_id: Mapped[int | None] = mapped_column(ForeignKey("adult.id", ondelete="CASCADE"))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("adult.id", ondelete="SET NULL"))
    note: Mapped[str] = mapped_column(String(80), default="")
    operator: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Device(Base):
    """Appareil relié à une famille (tablette, PC) : le jeu y liste les enfants."""

    __tablename__ = "device"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("family.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(60))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PairingCode(Base):
    """Code de liaison d'un appareil (8 chiffres, empreinte SHA-256), à usage unique."""

    __tablename__ = "pairing_code"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("family.id", ondelete="CASCADE"), index=True)
    device_name: Mapped[str] = mapped_column(String(60))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Profile(Base):
    __tablename__ = "profile"
    __table_args__ = (UniqueConstraint("family_id", "name", name="uq_profile_family_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("family.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(40))
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
    # Incrémentée à chaque réinitialisation par le parent : une sauvegarde d'une époque
    # antérieure (appareil resté hors ligne) est refusée au lieu de restaurer la partie.
    save_epoch: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # Aménagements (accessibilité, troubles « dys ») : engine/accommodations.py.
    accommodations: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
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
    mode: Mapped[str | None] = mapped_column(String(20))  # arene, donjon, defi
    rating: Mapped[int | None] = mapped_column(Integer)  # note de plaisir, 1 à 5


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
    # Contenu de programme incertain (sources contradictoires), à confirmer par chaque
    # famille (FamilyNotion).
    to_validate: Mapped[bool] = mapped_column(Boolean, default=False)


class FamilyNotion(Base):
    """Décision d'une famille sur une notion incertaine : False = hors programme (jamais
    proposée à ses enfants). Pas de ligne = pas encore tranché."""

    __tablename__ = "family_notion"

    family_id: Mapped[int] = mapped_column(
        ForeignKey("family.id", ondelete="CASCADE"), primary_key=True
    )
    notion_id: Mapped[int] = mapped_column(
        ForeignKey("notion.id", ondelete="CASCADE"), primary_key=True
    )
    in_program: Mapped[bool] = mapped_column(Boolean)


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


class NotionAside(Base):
    """Notion mise de côté pour un enfant : pas encore vue en classe. Jamais posée tant que la
    ligne existe. `source` : « parent » (page Programme) ou « enfant » (bouton « Pas encore vu
    en classe » du jeu, que le parent voit et peut réactiver)."""

    __tablename__ = "notion_aside"

    profile_id: Mapped[int] = mapped_column(
        ForeignKey("profile.id", ondelete="CASCADE"), primary_key=True
    )
    notion_id: Mapped[int] = mapped_column(
        ForeignKey("notion.id", ondelete="CASCADE"), primary_key=True
    )
    source: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


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


class SaveRevision(Base):
    """Sauvegarde de partie (TRD §2.7) : contenu opaque versionné par le client
    (`schema_version`), 20 dernières révisions conservées par profil.
    `progress` (XP totale) départage deux appareils : la plus avancée gagne."""

    __tablename__ = "save_revision"

    profile_id: Mapped[int] = mapped_column(
        ForeignKey("profile.id", ondelete="CASCADE"), primary_key=True
    )
    revision: Mapped[int] = mapped_column(Integer, primary_key=True)
    schema_version: Mapped[int] = mapped_column(Integer)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    data: Mapped[dict[str, Any]] = mapped_column(JSONType)
    saved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class BankItem(Base):
    """Question rédigée (banque, PRD US-10) : créée ou importée par le parent, jouée
    seulement une fois publiée. `data` : champs d'un Item (engine/items.py) hors id,
    validés à chaque enregistrement (engine/bank.py)."""

    __tablename__ = "bank_item"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("family.id", ondelete="CASCADE"), index=True)
    level: Mapped[str] = mapped_column(String(8), index=True)
    notion: Mapped[str] = mapped_column(String(120), index=True)
    difficulty: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(12), default="brouillon")  # brouillon | publie
    source: Mapped[str] = mapped_column(String(12), default="parent")  # parent | import
    data: Mapped[dict[str, Any]] = mapped_column(JSONType)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AiUsage(Base):
    """Demandes à l'IA (questions proposées) par famille et par jour : quota et coût."""

    __tablename__ = "ai_usage"

    family_id: Mapped[int] = mapped_column(
        ForeignKey("family.id", ondelete="CASCADE"), primary_key=True
    )
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    requests: Mapped[int] = mapped_column(Integer, default=0)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)


class Report(Base):
    """Signalement d'une question par un enfant (« il y a une erreur ») : la question
    telle qu'affichée, la réponse donnée, le motif. Traité par le parent."""

    __tablename__ = "report"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[int] = mapped_column(
        ForeignKey("profile.id", ondelete="CASCADE"), index=True
    )
    item_id: Mapped[str] = mapped_column(String(120))
    item: Mapped[dict[str, Any]] = mapped_column(JSONType)
    user_input: Mapped[str | None] = mapped_column(String(200))
    reason: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(12), default="ouvert")  # ouvert | traite
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ClientError(Base):
    """Erreur du jeu remontée par un appareil (client_errors.py) : où, quoi, combien de fois.
    Aucune donnée d'enfant : ni profil, ni question, ni réponse. Gardée 30 jours."""

    __tablename__ = "client_error"
    __table_args__ = (UniqueConstraint("family_id", "fingerprint"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("family.id", ondelete="CASCADE"), index=True)
    device_id: Mapped[int | None] = mapped_column(ForeignKey("device.id", ondelete="SET NULL"))
    fingerprint: Mapped[str] = mapped_column(String(64))  # SHA-256 de version, endroit, message
    version: Mapped[str] = mapped_column(String(40))
    platform: Mapped[str] = mapped_column(String(80), default="")
    scene: Mapped[str] = mapped_column(String(120), default="")
    location: Mapped[str] = mapped_column(String(200), default="")
    message: Mapped[str] = mapped_column(String(500))
    count: Mapped[int] = mapped_column(Integer, default=1)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
