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

from app.engine import mastery, selector, session_pack
from app.engine.generators import playable_notions
from app.engine.scheduler import LeitnerScheduler, Scheduler
from app.models import Attempt, Chapter, ChapterStatus, Notion, NotionState, Profile, Subject

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


async def _level_notions(db: AsyncSession, level: str) -> list[tuple[Notion, Chapter]]:
    rows = await db.execute(
        sql_select(Notion, Chapter)
        .join(Chapter, Notion.chapter_id == Chapter.id)
        .where(Chapter.level == level)
        .order_by(Chapter.position, Notion.id)
    )
    return [(n, c) for n, c in rows]


# --- Paquet de session ------------------------------------------------------------


async def build_pack(db: AsyncSession, profile: Profile, rng: random.Random) -> dict[str, Any]:
    playable = playable_notions()
    rows = [(n, c) for n, c in await _level_notions(db, profile.level) if n.code in playable]
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
    infos = [selector.NotionInfo(n.code, c.code, n.is_automatism) for n, c in rows]
    progress = {
        n.code: selector.NotionProgress(st.mastery, st.seen, _aware(st.due_at))
        for n, _ in rows
        if (st := states.get(n.id)) is not None
    }
    ratios = (profile.ratio_chapter, profile.ratio_review, profile.ratio_automatisms)
    slots = selector.select(
        infos, progress, statuses, list(reversed(recent)), ratios, datetime.now(UTC), rng
    )
    return session_pack.build_items(slots, rng)


# --- Suivi par notion ---------------------------------------------------------------


async def apply_attempts(db: AsyncSession, profile_id: int, attempts: list[dict[str, Any]]) -> None:
    """Met à jour boîte de Leitner et maîtrise pour chaque notion des tentatives
    (dans l'ordre chronologique). À appeler une seule fois par tentative."""
    codes = {code for a in attempts for code in a["notion_ids"]}
    if not codes:
        return
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
            state.mastery = mastery.update(
                state.mastery,
                a["correct"],
                a["hint_used"],
                a["time_ms"],
                a.get("time_target_ms") or DEFAULT_TIME_TARGET_MS,
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
    chapters: dict[int, dict[str, Any]] = {}
    for notion, chapter in await _level_notions(db, profile.level):
        entry = chapters.setdefault(
            chapter.id,
            {
                "code": chapter.code,
                "title": chapter.title,
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
