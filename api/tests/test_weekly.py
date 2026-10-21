"""Résumé de la semaine (espace parent) : bornes à l'heure de Paris, activité, matières, notions
réussies et à revoir, comparaison avec la semaine précédente, enfant d'une autre famille."""

from datetime import UTC, date, datetime

from app import weekly
from tests.test_admin import ADMIN, PLAY, admin_settings, parent  # noqa: F401 (fixture)
from tests.test_tracking import _attempt

ADDITION = "6e.maths.fractions.addition"
ANGLES = "6e.maths.angles.vocabulaire"


def test_week_starts_on_monday_in_paris():
    # Dimanche 25 octobre 2026, 23 h 30 à Paris (22 h 30 UTC, heure d'hiver depuis la nuit).
    sunday_night = datetime(2026, 10, 25, 22, 30, tzinfo=UTC)
    monday, start, end = weekly.week_bounds(0, sunday_night)
    assert monday == date(2026, 10, 19)
    assert start == datetime(2026, 10, 18, 22, 0, tzinfo=UTC)  # lundi 0 h, heure d'été
    assert end == datetime(2026, 10, 25, 23, 0, tzinfo=UTC)  # lundi suivant 0 h, heure d'hiver
    assert weekly.week_bounds(1, sunday_night)[0] == date(2026, 10, 12)
    assert weekly.day_label(date(2026, 11, 1)) == "dimanche 1er novembre"


async def test_week_summary_tells_what_the_child_did(client, login, profiles, curriculum):
    headers = await login("jules", "1234")
    session_id = (await client.post(f"{PLAY}/session/start", headers=headers)).json()["session_id"]
    batch = [_attempt(session_id, notion=ADDITION, correct=True, minutes_ago=20 - i)
             for i in range(4)]
    batch += [_attempt(session_id, notion=ANGLES, correct=i == 0, minutes_ago=10 - i)
              for i in range(4)]
    await client.post(f"{PLAY}/attempts", json={"attempts": batch}, headers=headers)
    await client.post(
        f"{PLAY}/session/end",
        json={"session_id": session_id, "active_seconds": 900, "rating": 4},
        headers=headers,
    )
    body = (
        await client.get(f"{ADMIN}/profiles/{profiles['jules']}/week", headers=parent())
    ).json()
    assert body["current"] and body["offset"] == 0
    activity = body["activity"]
    assert activity == {"sessions": 1, "minutes": 15, "days_played": 1, "answers": 8,
                        "correct": 5, "rate": 62}
    assert body["previous"]["answers"] == 0
    assert [s["label"] for s in body["subjects"]] == ["Mathématiques"]
    assert [n["code"] for n in body["successes"]] == [ADDITION]
    assert [n["code"] for n in body["struggles"]] == [ANGLES]
    assert body["struggles"][0]["rate"] == 25
    assert body["new_notions"] == 2 and body["rating"] == 4
    assert sum(d["answers"] for d in body["days"]) == 8 and len(body["days"]) == 7
    sentence = body["sentence"]
    assert sentence.startswith("Cette semaine, Jules a joué 1 jour sur 7 (15 min, 1 séance)")
    assert "8 questions, dont 62 % justes" in sentence
    assert "Surtout en mathématiques." in sentence
    assert "À revoir en priorité" in sentence

    # La semaine précédente : rien ; elle se compare à la semaine d'avant.
    before = (
        await client.get(f"{ADMIN}/profiles/{profiles['jules']}/week?offset=1", headers=parent())
    ).json()
    assert before["activity"]["answers"] == 0 and not before["current"]
    assert before["sentence"] == f"Jules n'a pas joué la semaine du {weekly.day_label(
        date.fromisoformat(before['start']))}."


async def test_week_of_another_family_child_is_unknown(client, profiles):
    response = await client.get(f"{ADMIN}/profiles/999/week", headers=parent())
    assert response.status_code == 404
    response = await client.get(
        f"{ADMIN}/profiles/{profiles['tom']}/week?offset=-1", headers=parent()
    )
    assert response.status_code == 422
