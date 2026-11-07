"""Résumé de la semaine d'un enfant (espace parent, onglet « Semaine »).

Une semaine va du lundi 0 h au dimanche 24 h, heure de Paris (la famille vit en France). Le résumé
dit ce que l'enfant a fait (temps, séances, jours joués, réponses), dans quelles matières, ce qui
a bien marché et ce qui reste à revoir, compare avec la semaine précédente et le dit en une
phrase. Il ne lit que les réponses déjà envoyées au serveur.

Une notion est jugée sur la semaine à partir de `MIN_ANSWERS` réponses : réussie à `GOOD` au
moins, à revoir sous `WEAK`.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Attempt, Chapter, Notion, NotionAside, Profile, Report, Subject

TZ = ZoneInfo("Europe/Paris")
MIN_ANSWERS = 3
GOOD = 0.8
WEAK = 0.5
MAX_LISTED = 8
DAY_NAMES = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre",
          "octobre", "novembre", "décembre"]


def week_bounds(offset: int, now: datetime | None = None) -> tuple[date, datetime, datetime]:
    """Lundi de la semaine (`offset` semaines avant la semaine en cours), et ses bornes en UTC."""
    local_today = (now or datetime.now(UTC)).astimezone(TZ).date()
    monday = local_today - timedelta(days=local_today.weekday() + 7 * offset)
    start = datetime.combine(monday, time.min, TZ).astimezone(UTC)
    end = datetime.combine(monday + timedelta(days=7), time.min, TZ).astimezone(UTC)
    return monday, start, end


def day_label(day: date) -> str:
    first = "er" if day.day == 1 else ""
    return f"{DAY_NAMES[day.weekday()]} {day.day}{first} {MONTHS[day.month - 1]}"


def _aware(value: datetime) -> datetime:
    """SQLite rend des dates sans fuseau : on les considère en UTC."""
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


def _activity(sessions: list[dict[str, Any]], answers: list[tuple[list[str], bool, datetime]],
              ) -> dict[str, Any]:
    correct = sum(1 for _n, ok, _at in answers if ok)
    days = {_aware(at).astimezone(TZ).date() for _n, _ok, at in answers}
    return {
        "sessions": len(sessions),
        "minutes": round(sum(s["seconds"] for s in sessions) / 60),
        "days_played": len(days),
        "answers": len(answers),
        "correct": correct,
        "rate": round(100 * correct / len(answers)) if answers else None,
    }


async def _answers(db: AsyncSession, profile_id: int, start: datetime, end: datetime,
                   ) -> list[tuple[list[str], bool, datetime]]:
    rows = await db.execute(
        select(Attempt.notion_ids, Attempt.correct, Attempt.answered_at).where(
            Attempt.profile_id == profile_id,
            Attempt.answered_at >= start,
            Attempt.answered_at < end,
        )
    )
    return [(list(n or []), bool(ok), at) for n, ok, at in rows.all()]


async def _notion_info(db: AsyncSession, codes: set[str]) -> dict[str, dict[str, str]]:
    """Notion → libellé, matière (code et libellé). Code inconnu : rangé à part."""
    rows = await db.execute(
        select(Notion.code, Notion.label, Subject.code, Subject.label)
        .join(Chapter, Chapter.id == Notion.chapter_id)
        .join(Subject, Subject.id == Chapter.subject_id)
        .where(Notion.code.in_(codes))
    )
    return {
        code: {"label": label, "subject": subject, "subject_label": subject_label}
        for code, label, subject, subject_label in rows.all()
    }


def _plural(n: int, word: str, plural: str | None = None) -> str:
    return f"{n} {word if n <= 1 else plural or word + 's'}"


def _sentence(name: str, current: bool, monday: date, now: dict[str, Any],
              before: dict[str, Any], subjects: list[dict[str, Any]],
              struggles: list[dict[str, Any]]) -> str:
    when = "cette semaine" if current else f"la semaine du {day_label(monday)}"
    if not now["answers"]:
        return f"{name} n'a pas joué {when}."
    parts = [
        f"{when.capitalize()}, {name} a joué {_plural(now['days_played'], 'jour')} sur 7 "
        f"({now['minutes']} min, {_plural(now['sessions'], 'séance')}) et répondu à "
        f"{_plural(now['answers'], 'question')}, dont {now['rate']} % justes."
    ]
    if subjects:
        top = [s["label"][0].lower() + s["label"][1:] for s in subjects[:2]]
        parts.append(f"Surtout en {' et en '.join(top)}.")
    if before["answers"]:
        if now["minutes"] > before["minutes"] * 1.2:
            parts.append(f"Plus que la semaine précédente ({before['minutes']} min).")
        elif now["minutes"] < before["minutes"] * 0.8:
            parts.append(f"Moins que la semaine précédente ({before['minutes']} min).")
        else:
            parts.append("Autant que la semaine précédente.")
    if struggles:
        parts.append(f"À revoir en priorité : {struggles[0]['label'].lower()}.")
    return " ".join(parts)


async def summary(db: AsyncSession, profile: Profile, offset: int,
                  sessions: list[dict[str, Any]], sessions_before: list[dict[str, Any]],
                  now: datetime | None = None) -> dict[str, Any]:
    """Résumé d'une semaine. `sessions` / `sessions_before` : séances jouées (avec au moins une
    réponse) de la semaine et de la précédente, déjà calculées par l'espace parent."""
    monday, start, end = week_bounds(offset, now)
    _m, before_start, _e = week_bounds(offset + 1, now)
    answers = await _answers(db, profile.id, start, end)
    previous = await _answers(db, profile.id, before_start, start)
    activity = _activity(sessions, answers)
    before = _activity(sessions_before, previous)

    # Par notion (la première notion de la question) et par matière.
    by_notion: dict[str, list[bool]] = {}
    for notions, ok, _at in answers:
        if notions:
            by_notion.setdefault(notions[0], []).append(ok)
    info = await _notion_info(db, set(by_notion))
    subjects: dict[str, dict[str, Any]] = {}
    for code, results in by_notion.items():
        n = info.get(code, {"label": code, "subject": "autre", "subject_label": "Autres"})
        s = subjects.setdefault(n["subject"], {"code": n["subject"], "label": n["subject_label"],
                                               "answers": 0, "correct": 0})
        s["answers"] += len(results)
        s["correct"] += sum(results)
    subject_list = sorted(subjects.values(), key=lambda s: -s["answers"])
    for s in subject_list:
        s["rate"] = round(100 * s["correct"] / s["answers"])

    judged = []
    for code, results in by_notion.items():
        if len(results) < MIN_ANSWERS:
            continue
        n = info.get(code, {"label": code, "subject_label": "Autres"})
        judged.append({"code": code, "label": n["label"], "subject": n["subject_label"],
                       "answers": len(results), "correct": sum(results),
                       "rate": round(100 * sum(results) / len(results))})
    successes = sorted((j for j in judged if j["rate"] >= 100 * GOOD),
                       key=lambda j: (-j["rate"], -j["answers"]))[:MAX_LISTED]
    struggles = sorted((j for j in judged if j["rate"] < 100 * WEAK),
                       key=lambda j: (j["rate"], -j["answers"]))[:MAX_LISTED]

    # Notions rencontrées pour la première fois cette semaine.
    firsts = await db.execute(
        select(Attempt.notion_ids, Attempt.answered_at).where(
            Attempt.profile_id == profile.id, Attempt.answered_at < end
        )
    )
    first_seen: dict[str, datetime] = {}
    for notions, at in firsts.all():
        if notions:
            code = notions[0]
            at = _aware(at)
            first_seen[code] = min(first_seen.get(code, at), at)
    new_notions = sum(1 for at in first_seen.values() if start <= at < end)

    aside_rows = await db.execute(
        select(Notion.label, NotionAside.source, NotionAside.created_at)
        .join(Notion, Notion.id == NotionAside.notion_id)
        .where(NotionAside.profile_id == profile.id)
    )
    set_aside = [
        {"label": label, "source": source}
        for label, source, at in aside_rows.all()
        if start <= _aware(at) < end
    ]
    reports = await db.scalar(
        select(func.count()).where(
            Report.profile_id == profile.id, Report.created_at >= start, Report.created_at < end
        )
    )
    ratings = [s["rating"] for s in sessions if s.get("rating")]

    days = []
    for i in range(7):
        day = monday + timedelta(days=i)
        days.append({
            "date": day.isoformat(),
            "minutes": round(sum(
                s["seconds"] for s in sessions
                if datetime.fromisoformat(s["started_at"]).astimezone(TZ).date() == day
            ) / 60),
            "answers": sum(1 for _n, _ok, at in answers if _aware(at).astimezone(TZ).date() == day),
        })
    current = offset == 0
    return {
        "start": monday.isoformat(),
        "end": (monday + timedelta(days=6)).isoformat(),
        "label": f"du {day_label(monday)} au {day_label(monday + timedelta(days=6))}",
        "offset": offset,
        "current": current,
        "sentence": _sentence(profile.name, current, monday, activity, before, subject_list,
                              struggles),
        "activity": activity,
        "previous": before,
        "days": days,
        "subjects": subject_list,
        "successes": successes,
        "struggles": struggles,
        "new_notions": new_notions,
        "set_aside": set_aside,
        "reports": int(reports or 0),
        "rating": round(sum(ratings) / len(ratings), 1) if ratings else None,
    }
