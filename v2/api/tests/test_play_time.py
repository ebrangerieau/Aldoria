"""Temps de jeu de la séance (limite du parent) : remis à zéro après une pause de 30 minutes."""

import uuid
from datetime import UTC, datetime, timedelta

from app import play_time
from app.models import Attempt, GameSession

API = "/api/v1/play"
NOW = datetime(2026, 10, 13, 18, 0, tzinfo=UTC)


async def _session(db, profile_id, start_min, end_min=None, active=None, answers_min=()):
    """Session commencée `start_min` minutes avant NOW (terminée `end_min` minutes avant)."""
    sid = str(uuid.uuid4())
    db.add(
        GameSession(
            id=sid,
            profile_id=profile_id,
            mode="donjon",
            started_at=NOW - timedelta(minutes=start_min),
            ended_at=None if end_min is None else NOW - timedelta(minutes=end_min),
            active_seconds=active,
        )
    )
    await db.flush()
    for minutes in answers_min:
        db.add(
            Attempt(
                id=str(uuid.uuid4()),
                profile_id=profile_id,
                session_id=sid,
                item_id="x",
                difficulty=1,
                notion_ids=[],
                correct=True,
                time_ms=1000,
                answered_at=NOW - timedelta(minutes=minutes),
            )
        )
    await db.commit()


async def test_nothing_played(sessionmaker, profiles):
    async with sessionmaker() as db:
        assert await play_time.seance(db, profiles["jules"], NOW) == (0, 30 * 60)


async def test_sessions_close_together_add_up(sessionmaker, profiles):
    async with sessionmaker() as db:
        # Donjon de 26 min, puis arène 5 min après : même séance.
        await _session(db, profiles["jules"], 40, 14, active=26 * 60)
        await _session(db, profiles["jules"], 9, 2, active=7 * 60)
        played, idle = await play_time.seance(db, profiles["jules"], NOW)
        assert played == 33 * 60
        assert idle == 2 * 60


async def test_a_long_break_starts_a_new_seance(sessionmaker, profiles):
    async with sessionmaker() as db:
        await _session(db, profiles["jules"], 120, 95, active=25 * 60)
        # Plus d'une heure de pause, puis 10 minutes de jeu terminées il y a 15 minutes.
        await _session(db, profiles["jules"], 25, 15, active=10 * 60)
        assert await play_time.seance(db, profiles["jules"], NOW) == (10 * 60, 15 * 60)
        # 30 minutes après la dernière partie, la séance est terminée.
        later = NOW + timedelta(minutes=16)
        assert (await play_time.seance(db, profiles["jules"], later))[0] == 0


async def test_unfinished_session_counts_until_its_last_answer(sessionmaker, profiles):
    async with sessionmaker() as db:
        # Onglet fermé en plein donjon : jamais terminée, dernière réponse il y a 3 min.
        await _session(db, profiles["jules"], 25, answers_min=(20, 3))
        played, idle = await play_time.seance(db, profiles["jules"], NOW)
        assert played == 22 * 60
        assert idle == 3 * 60


async def test_other_child_is_not_counted(sessionmaker, profiles):
    async with sessionmaker() as db:
        await _session(db, profiles["tom"], 30, 1, active=29 * 60)
        assert (await play_time.seance(db, profiles["jules"], NOW))[0] == 0


async def test_login_me_and_session_report_play_time(client, login):
    headers = await login("jules", "1234")
    me = (await client.get(f"{API}/me", headers=headers)).json()
    assert me["play_time"] == {
        "played_seconds": 0,
        "idle_seconds": 30 * 60,
        "session_max_minutes": 25,
        "break_minutes": 30,
    }
    start = (await client.post(f"{API}/session/start", headers=headers, json={})).json()
    await client.post(
        f"{API}/session/end",
        headers=headers,
        json={"session_id": start["session_id"], "active_seconds": 600},
    )
    me = (await client.get(f"{API}/me", headers=headers)).json()
    assert me["play_time"]["played_seconds"] == 600
    assert me["play_time"]["idle_seconds"] < 60
    again = (await client.post(f"{API}/session/start", headers=headers, json={})).json()
    assert again["settings"]["play_time"]["played_seconds"] == 600


async def test_sphinx_island_counts_as_play_time(client, login, curriculum):
    """L'Île du Sphinx (jeux de logique) : aucune question, mais le temps passé compte."""
    headers = await login("jules", "1234")
    body = (
        await client.post(f"{API}/session/start", json={"mode": "sphinx"}, headers=headers)
    ).json()
    assert body["items"] == [] and body["formulas"] == {}
    assert "play_time" in body["settings"]
    ended = await client.post(
        f"{API}/session/end",
        json={"session_id": body["session_id"], "active_seconds": 300},
        headers=headers,
    )
    assert ended.json() == {"nb_questions": 0, "nb_correct": 0}
    me = (await client.get(f"{API}/me", headers=headers)).json()
    assert me["play_time"]["played_seconds"] >= 300
