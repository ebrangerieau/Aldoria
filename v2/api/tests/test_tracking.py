"""Moteur branché sur l'API : programme chargé, suivi par notion, progression."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.engine.tracking import rebuild, seed_curriculum
from app.models import Chapter, Notion, NotionState

API = "/api/v1/play"
ADDITION = "6e.maths.fractions.addition"


def _attempt(session_id, notion=ADDITION, correct=True, minutes_ago=0, hint=False):
    return {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "item_id": f"{notion}:1:1",
        "difficulty": 2,
        "notion_ids": [notion],
        "correct": correct,
        "time_ms": 8000,
        "time_target_ms": 40000,
        "hint_used": hint,
        "answered_at": (datetime.now(UTC) - timedelta(minutes=minutes_ago)).isoformat(),
    }


async def test_seed_is_idempotent(sessionmaker, curriculum):
    assert curriculum["chapters"] >= 20
    async with sessionmaker() as db:
        again = await seed_curriculum(db)
        assert again == curriculum
        chapters = list(await db.scalars(select(Chapter)))
        assert len(chapters) == curriculum["chapters"]
        to_validate = {n.code for n in await db.scalars(select(Notion).where(Notion.to_validate))}
        assert "2nde.maths.statistiques.echantillonnage" in to_validate


async def test_every_generator_notion_is_in_the_curriculum(sessionmaker, curriculum):
    from app.engine.generators import playable_notions

    async with sessionmaker() as db:
        codes = set(await db.scalars(select(Notion.code)))
    assert playable_notions() <= codes


async def test_answers_raise_stars_and_schedule_review(client, login, curriculum, sessionmaker):
    headers = await login("jules", "1234")
    session_id = (await client.post(f"{API}/session/start", headers=headers)).json()["session_id"]
    batch = [_attempt(session_id, minutes_ago=10 - i) for i in range(8)]
    batch.append(_attempt(session_id, notion="6e.maths.fractions.comparaison", correct=False))
    await client.post(f"{API}/attempts", json={"attempts": batch}, headers=headers)
    # Renvoyer le même lot ne compte pas deux fois.
    await client.post(f"{API}/attempts", json={"attempts": batch}, headers=headers)

    body = (await client.get(f"{API}/progress", headers=headers)).json()
    notions = {n["code"]: n for ch in body["chapters"] for n in ch["notions"]}
    assert notions[ADDITION]["seen"] == 8
    assert notions[ADDITION]["stars"] == 3
    assert notions["6e.maths.fractions.comparaison"]["stars"] == 1
    assert notions["6e.maths.prealgebre.balance"]["stars"] == 0
    assert all(ch["code"].startswith("6e.") for ch in body["chapters"])

    async with sessionmaker() as db:
        states = {
            n.code: st
            for st, n in (
                await db.execute(
                    select(NotionState, Notion).join(Notion, NotionState.notion_id == Notion.id)
                )
            ).all()
        }
    assert states[ADDITION].box == 5
    assert states["6e.maths.fractions.comparaison"].box == 1


async def test_due_review_comes_back_in_next_pack(client, login, curriculum, sessionmaker):
    headers = await login("jules", "1234")
    session_id = (await client.post(f"{API}/session/start", headers=headers)).json()["session_id"]
    await client.post(
        f"{API}/attempts",
        json={
            "attempts": [
                _attempt(session_id, notion="6e.maths.fractions.comparaison", correct=False)
            ]
        },
        headers=headers,
    )
    async with sessionmaker() as db:  # simule le passage d'une journée
        for state in await db.scalars(select(NotionState)):
            state.due_at = datetime.now(UTC) - timedelta(hours=1)
        await db.commit()
    pack = (await client.post(f"{API}/session/start", headers=headers)).json()
    reviews = [i for i in pack["items"] if i["category"] == "revision"]
    assert reviews
    assert {n for i in reviews for n in i["notions"]} == {"6e.maths.fractions.comparaison"}


async def test_rebuild_replays_history(client, login, curriculum, sessionmaker):
    headers = await login("jules", "1234")
    session_id = (await client.post(f"{API}/session/start", headers=headers)).json()["session_id"]
    batch = [_attempt(session_id, minutes_ago=5 - i) for i in range(4)]
    await client.post(f"{API}/attempts", json={"attempts": batch}, headers=headers)
    before = (await client.get(f"{API}/progress", headers=headers)).json()
    async with sessionmaker() as db:
        assert await rebuild(db) == 4
    after = (await client.get(f"{API}/progress", headers=headers)).json()
    seen = {n["code"]: n["seen"] for ch in after["chapters"] for n in ch["notions"]}
    assert seen[ADDITION] == 4
    stars_before = {n["code"]: n["stars"] for ch in before["chapters"] for n in ch["notions"]}
    stars_after = {n["code"]: n["stars"] for ch in after["chapters"] for n in ch["notions"]}
    assert stars_after == stars_before
