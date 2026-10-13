"""Classes et mondes (étape A de la feuille de route) : référentiel des classes, monde
choisi par le parent, passage de classe avec révision des notions de l'année d'avant."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.engine import levels
from app.models import NotionState
from tests.test_admin import ADMIN, PLAY, admin_settings, parent  # noqa: F401 (fixture)
from tests.test_tracking import _attempt


def test_levels_registry():
    assert [lv.code for lv in levels.LEVELS] == ["6e", "5e", "4e", "3e", "2nde", "1ere", "term"]
    assert levels.label("1ere") == "Première"
    assert levels.earlier("2nde") == ["3e", "4e", "5e", "6e"]
    assert levels.earlier("6e") == []
    assert levels.default_world("5e") == "lumineux"
    assert levels.default_world("term") == "brouillard"


async def test_levels_route_says_which_are_in_the_game(client, curriculum):
    body = (await client.get(f"{ADMIN}/levels", headers=parent())).json()
    available = {lv["code"]: lv["available"] for lv in body["levels"]}
    assert available == {
        "6e": True,
        "5e": False,
        "4e": False,
        "3e": False,
        "2nde": True,
        "1ere": False,
        "term": False,
    }
    assert [w["code"] for w in body["worlds"]] == ["lumineux", "brouillard"]


async def test_new_child_world_defaults_by_cycle_or_is_chosen(client, curriculum):
    url = f"{ADMIN}/profiles"
    college = await client.post(
        url, json={"name": "Léa", "level": "6e", "pin": "1111"}, headers=parent()
    )
    assert college.json()["world"] == "lumineux"
    chosen = await client.post(
        url,
        json={"name": "Hugo", "level": "6e", "pin": "2222", "world": "brouillard"},
        headers=parent(),
    )
    assert chosen.json()["world"] == "brouillard"
    missing = await client.post(
        url, json={"name": "Zoé", "level": "5e", "pin": "3333"}, headers=parent()
    )
    assert missing.status_code == 422
    assert missing.json()["error"]["code"] == "level_unavailable"


async def test_change_of_world_and_class(client, profiles, curriculum, login):
    url = f"{ADMIN}/profiles/{profiles['jules']}"
    world = await client.patch(url, json={"world": "brouillard"}, headers=parent())
    assert world.json()["world"] == "brouillard"
    unavailable = await client.patch(url, json={"level": "5e"}, headers=parent())
    assert unavailable.status_code == 422
    moved = await client.patch(url, json={"level": "2nde"}, headers=parent())
    assert moved.json()["level"] == "2nde" and moved.json()["level_label"] == "Seconde"
    # Le jeu relit le profil (classe et monde) au retour au camp.
    me = (await client.get(f"{PLAY}/me", headers=await login("jules", "1234"))).json()
    assert me["profile"]["level"] == "2nde" and me["profile"]["world"] == "brouillard"


async def test_last_years_notions_come_back_in_review(
    client, profiles, curriculum, login, sessionmaker
):
    headers = await login("jules", "1234")
    session_id = (await client.post(f"{PLAY}/session/start", headers=headers)).json()["session_id"]
    notion = "6e.maths.fractions.comparaison"
    await client.post(
        f"{PLAY}/attempts",
        json={"attempts": [_attempt(session_id, notion=notion, correct=False)]},
        headers=headers,
    )
    # Passage en seconde : la notion de 6e déjà travaillée revient quand elle est due…
    await client.patch(
        f"{ADMIN}/profiles/{profiles['jules']}", json={"level": "2nde"}, headers=parent()
    )
    async with sessionmaker() as db:
        for state in await db.scalars(select(NotionState)):
            state.due_at = datetime.now(UTC) - timedelta(hours=1)
        await db.commit()
    pack = (await client.post(f"{PLAY}/session/start", headers=headers)).json()
    reviews = {n for i in pack["items"] if i["category"] == "revision" for n in i["notions"]}
    assert notion in reviews
    # … mais seulement en révision : le reste du paquet est le programme de seconde.
    others = {n for i in pack["items"] if i["category"] != "revision" for n in i["notions"]}
    assert others and all(code.startswith("2nde.") for code in others)
    # Les Archives et le tableau de bord montrent la classe actuelle.
    progress = (await client.get(f"{PLAY}/progress", headers=headers)).json()
    assert all(ch["code"].startswith("2nde.") for ch in progress["chapters"])
    assert progress["chapters"][0]["subject"] == {"code": "maths", "label": "Mathématiques"}
