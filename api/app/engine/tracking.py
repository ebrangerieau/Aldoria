"""Moteur pédagogique branché sur la base : programme, paquet de session, suivi par
notion (Leitner + maîtrise) et progression affichée au joueur (étoiles d'Archives)."""

from __future__ import annotations

import json
import random
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import delete
from sqlalchemy import select as sql_select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engine import accommodations, levels, mastery, selector, session_pack
from app.engine.generators import Generator, playable_notions
from app.engine.scheduler import LeitnerScheduler, Scheduler
from app.models import (
    Attempt,
    BankItem,
    Chapter,
    ChapterStatus,
    FamilyNotion,
    Notion,
    NotionState,
    Profile,
    SaveRevision,
    Subject,
)

DEFAULT_TIME_TARGET_MS = 20_000
_scheduler: Scheduler = LeitnerScheduler()


# --- Programme -------------------------------------------------------------------


def seed_dir() -> Path:
    """content/seed du dépôt, ou /app/content/seed dans l'image Docker."""
    here = Path(__file__).resolve()
    for candidate in (here.parents[3] / "content" / "seed", here.parents[2] / "content" / "seed"):
        if candidate.is_dir():
            return candidate
    raise FileNotFoundError("dossier content/seed introuvable")


async def seed_curriculum(db: AsyncSession, directory: Path | None = None) -> dict[str, int]:
    """Charge content/seed/*/curriculum.json (idempotent : mise à jour par code)."""
    directory = directory or seed_dir()
    counts = {"chapters": 0, "notions": 0}
    for path in sorted(directory.glob("*/curriculum.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        subject = await db.scalar(
            sql_select(Subject).where(Subject.code == data["subject"]["code"])
        )
        if subject is None:
            subject = Subject(code=data["subject"]["code"], label=data["subject"]["label"])
            db.add(subject)
            await db.flush()
        for position, ch in enumerate(data["chapters"]):
            chapter = await db.scalar(sql_select(Chapter).where(Chapter.code == ch["code"]))
            if chapter is None:
                chapter = Chapter(code=ch["code"], subject_id=subject.id)
                db.add(chapter)
            chapter.level = data["level"]
            chapter.title = ch["title"]
            chapter.position = position
            await db.flush()
            counts["chapters"] += 1
            for n in ch["notions"]:
                notion = await db.scalar(sql_select(Notion).where(Notion.code == n["code"]))
                if notion is None:
                    notion = Notion(code=n["code"], chapter_id=chapter.id)
                    db.add(notion)
                notion.chapter_id = chapter.id
                notion.label = n["label"]
                notion.is_automatism = bool(n.get("automatism", False))
                notion.to_validate = bool(n.get("to_validate", False))
                counts["notions"] += 1
    await db.commit()
    return counts


async def _level_notions(
    db: AsyncSession, level: str, family_id: int
) -> list[tuple[Notion, Chapter]]:
    """Notions du niveau, sauf celles que la famille a mises hors programme."""
    excluded = sql_select(FamilyNotion.notion_id).where(
        FamilyNotion.family_id == family_id, FamilyNotion.in_program.is_(False)
    )
    rows = await db.execute(
        sql_select(Notion, Chapter)
        .join(Chapter, Notion.chapter_id == Chapter.id)
        .where(Chapter.level == level, Notion.id.not_in(excluded))
        .order_by(Chapter.position, Notion.id)
    )
    return [(n, c) for n, c in rows]


# --- Paquet de session ------------------------------------------------------------


async def build_pack(
    db: AsyncSession,
    profile: Profile,
    rng: random.Random,
    focus_chapters: list[str] | None = None,
    enigmas: list[tuple[Generator, int]] | None = None,
    daily: bool = False,
) -> dict[str, Any]:
    """Paquet de session. `focus_chapters` : chapitres d'un donjon, qui fournissent
    alors toutes les questions « chapitre » (au lieu des chapitres en cours). `enigma` :
    (générateur, nombre) d'items réservés aux énigmes (donjon) ou aux enquêtes
    (village). `daily` : défi quotidien, automatismes seulement."""
    pack = await _combat_pack(db, profile, rng, focus_chapters or [], daily)
    states = await _states(db, profile.id) if enigmas else {}
    for generator, count in enigmas or []:
        notion = await db.scalar(sql_select(Notion).where(Notion.code == generator.notion))
        state = states.get(notion.id) if notion else None
        pack["items"] += session_pack.enigma_items(
            generator, state.mastery if state else 0.0, count, rng, pack["formulas"]
        )
    pack["context"] = await _chapter_context(db, profile)
    return pack


async def _chapter_context(db: AsyncSession, profile: Profile) -> dict[str, Any]:
    """Chapitres que le parent a marqués « en cours » et « contrôle bientôt »."""
    rows = (
        await db.execute(
            sql_select(ChapterStatus, Chapter)
            .join(Chapter, ChapterStatus.chapter_id == Chapter.id)
            .where(ChapterStatus.profile_id == profile.id)
            .order_by(Chapter.position)
        )
    ).all()
    context: dict[str, Any] = {"test_soon": [], "current": []}
    for status, chapter in rows:
        key = {"controle_bientot": "test_soon", "en_cours": "current"}.get(status.status)
        if key:
            context[key].append({"code": chapter.code, "title": chapter.title})
    return context


DAILY_PACK_SIZE = 24


async def _combat_pack(
    db: AsyncSession,
    profile: Profile,
    rng: random.Random,
    focus_chapters: list[str],
    daily: bool = False,
) -> dict[str, Any]:
    bank = await published_bank(db, profile.level, profile.family_id)
    playable = playable_notions() | set(bank)
    rows = [
        (n, c)
        for n, c in await _level_notions(db, profile.level, profile.family_id)
        if n.code in playable
    ]
    if not rows:  # programme pas encore chargé : paquet sans historique
        return session_pack.build(profile.level, rng)
    states = await _states(db, profile.id)
    statuses = {
        c.code: s.status
        for s, c in (
            await db.execute(
                sql_select(ChapterStatus, Chapter)
                .join(Chapter, ChapterStatus.chapter_id == Chapter.id)
                .where(ChapterStatus.profile_id == profile.id)
            )
        ).all()
    }
    recent = list(
        await db.scalars(
            sql_select(Attempt.correct)
            .where(Attempt.profile_id == profile.id)
            .order_by(Attempt.answered_at.desc())
            .limit(20)
        )
    )
    level_chapters = {c.code for _, c in rows}
    prior = [] if daily or focus_chapters else await _prior_notions(db, profile, playable, states)
    focus = [code for code in focus_chapters if code in level_chapters]
    if focus:
        statuses = {code: "en_cours" for code in focus}  # donjon : ses chapitres seuls
    infos = [selector.NotionInfo(n.code, c.code, n.is_automatism) for n, c in rows]
    infos += [selector.NotionInfo(n.code, c.code, n.is_automatism, prior=True) for n, c in prior]
    progress = {
        n.code: selector.NotionProgress(st.mastery, st.seen, _aware(st.due_at))
        for n, _ in rows + prior
        if (st := states.get(n.id)) is not None
    }
    ratios = (profile.ratio_chapter, profile.ratio_review, profile.ratio_automatisms)
    size = selector.PACK_SIZE
    if daily:
        ratios, statuses, size = (0.0, 0.0, 1.0), {}, DAILY_PACK_SIZE
    slots = selector.select(
        infos, progress, statuses, list(reversed(recent)), ratios, datetime.now(UTC), rng, size
    )
    return session_pack.build_items(slots, rng, bank)


async def _prior_notions(
    db: AsyncSession, profile: Profile, playable: set[str], states: dict[int, NotionState]
) -> list[tuple[Notion, Chapter]]:
    """Notions des classes précédentes que l'enfant a déjà travaillées (passage de classe) :
    elles restent en révision espacée tant qu'elles sont jouables."""
    rows: list[tuple[Notion, Chapter]] = []
    for level in levels.earlier(profile.level):
        bank = await published_bank(db, level, profile.family_id)
        for notion, chapter in await _level_notions(db, level, profile.family_id):
            st = states.get(notion.id)
            if st is not None and st.seen > 0 and (notion.code in playable or notion.code in bank):
                rows.append((notion, chapter))
    return rows


async def published_bank(
    db: AsyncSession, level: str, family_id: int
) -> dict[str, list[dict[str, Any]]]:
    """Questions publiées de la banque de la famille, par notion, prêtes pour un paquet."""
    bank: dict[str, list[dict[str, Any]]] = {}
    rows = await db.scalars(
        sql_select(BankItem).where(
            BankItem.family_id == family_id, BankItem.level == level, BankItem.status == "publie"
        )
    )
    for row in rows:
        entry = dict(row.data) | {"id": f"banque:{row.id}:{row.version}"}
        bank.setdefault(row.notion, []).append(entry)
    return bank


# --- Suivi par notion ---------------------------------------------------------------


async def apply_attempts(db: AsyncSession, profile_id: int, attempts: list[dict[str, Any]]) -> None:
    """Met à jour boîte de Leitner et maîtrise pour chaque notion des tentatives
    (dans l'ordre chronologique). À appeler une seule fois par tentative."""
    codes = {code for a in attempts for code in a["notion_ids"]}
    if not codes:
        return
    profile = await db.get(Profile, profile_id)
    # Aménagement « sans pénalité de lenteur » : le temps ne compte pas dans la maîtrise.
    no_speed = profile is not None and accommodations.of(profile.accommodations).no_speed
    notions = {
        n.code: n for n in await db.scalars(sql_select(Notion).where(Notion.code.in_(codes)))
    }
    states = await _states(db, profile_id)
    for a in sorted(attempts, key=lambda x: x["answered_at"]):
        for code in a["notion_ids"]:
            notion = notions.get(code)
            if notion is None:
                continue  # notion hors programme chargé : on garde la tentative, sans suivi
            state = states.get(notion.id)
            if state is None:
                state = NotionState(
                    profile_id=profile_id, notion_id=notion.id, box=1, mastery=0.0, seen=0
                )
                db.add(state)
                states[notion.id] = state
            review = _scheduler.review(state.box, a["correct"], a["hint_used"], a["answered_at"])
            state.box = review.box
            state.due_at = review.due_at
            target = a.get("time_target_ms") or DEFAULT_TIME_TARGET_MS
            state.mastery = mastery.update(
                state.mastery,
                a["correct"],
                a["hint_used"],
                min(a["time_ms"], target) if no_speed else a["time_ms"],
                target,
                a["difficulty"],
            )
            state.seen += 1
            state.last_seen = a["answered_at"]


async def rebuild(db: AsyncSession) -> int:
    """Reconstruit tout le suivi par notion en rejouant les tentatives enregistrées
    (ex. : réponses données avant l'arrivée du moteur). Renvoie le nombre rejoué."""
    await db.execute(delete(NotionState))
    attempts = list(await db.scalars(sql_select(Attempt).order_by(Attempt.answered_at)))
    by_profile: dict[int, list[dict[str, Any]]] = {}
    for a in attempts:
        by_profile.setdefault(a.profile_id, []).append(
            {
                "notion_ids": a.notion_ids,
                "correct": a.correct,
                "hint_used": a.hint_used,
                "time_ms": a.time_ms,
                "time_target_ms": None,  # non conservé avant la phase 2 : valeur par défaut
                "difficulty": a.difficulty,
                "answered_at": _aware(a.answered_at),
            }
        )
    for profile_id, items in by_profile.items():
        await apply_attempts(db, profile_id, items)
    await db.commit()
    return len(attempts)


# --- Progression affichée ------------------------------------------------------------


async def progress(db: AsyncSession, profile: Profile) -> list[dict[str, Any]]:
    playable = playable_notions()
    states = await _states(db, profile.id)
    statuses = {
        s.chapter_id: s.status
        for s in await db.scalars(
            sql_select(ChapterStatus).where(ChapterStatus.profile_id == profile.id)
        )
    }
    subjects = {
        s.id: {"code": s.code, "label": s.label} for s in await db.scalars(sql_select(Subject))
    }
    chapters: dict[int, dict[str, Any]] = {}
    for notion, chapter in await _level_notions(db, profile.level, profile.family_id):
        entry = chapters.setdefault(
            chapter.id,
            {
                "code": chapter.code,
                "title": chapter.title,
                "subject": subjects.get(chapter.subject_id, {"code": "", "label": ""}),
                "status": statuses.get(chapter.id, "a_venir"),
                "notions": [],
            },
        )
        st = states.get(notion.id)
        m, seen = (st.mastery, st.seen) if st else (0.0, 0)
        entry["notions"].append(
            {
                "code": notion.code,
                "label": notion.label,
                "playable": notion.code in playable,
                "stars": mastery.stars(m, seen),
                "state": mastery.label(m, seen),
                "mastery": round(m),
                "seen": seen,
            }
        )
    return list(chapters.values())


async def _states(db: AsyncSession, profile_id: int) -> dict[int, NotionState]:
    rows = await db.scalars(sql_select(NotionState).where(NotionState.profile_id == profile_id))
    return {s.notion_id: s for s in rows}


def _aware(value: datetime | None) -> datetime | None:
    """SQLite rend des dates sans fuseau : on les considère en UTC."""
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


# --- Sauvegarde de partie --------------------------------------------------------------

KEPT_REVISIONS = 20


async def latest_save(db: AsyncSession, profile_id: int) -> SaveRevision | None:
    return await db.scalar(
        sql_select(SaveRevision)
        .where(SaveRevision.profile_id == profile_id)
        .order_by(SaveRevision.revision.desc())
        .limit(1)
    )


async def store_save(
    db: AsyncSession, profile_id: int, base_revision: int, schema_version: int, data: dict
) -> tuple[bool, SaveRevision | None]:
    """Enregistre une sauvegarde. Acceptée si elle part de la dernière révision, ou si
    elle est plus avancée (XP) que celle du serveur : la progression la plus avancée
    gagne. Sinon (un autre appareil a sauvegardé plus loin) : refusée, et la version
    du serveur est renvoyée."""
    current = await latest_save(db, profile_id)
    progress = max(0, int(data.get("xp", 0) or 0))
    if current is not None and base_revision != current.revision and progress <= current.progress:
        return False, current
    revision = (current.revision if current else 0) + 1
    saved = SaveRevision(
        profile_id=profile_id,
        revision=revision,
        schema_version=schema_version,
        progress=progress,
        data=data,
        saved_at=datetime.now(UTC),
    )
    db.add(saved)
    await db.execute(
        delete(SaveRevision).where(
            SaveRevision.profile_id == profile_id,
            SaveRevision.revision <= revision - KEPT_REVISIONS,
        )
    )
    await db.commit()
    return True, saved
