"""Notions pas encore vues en classe : mises de côté par l'enfant (« Pas encore vu en classe »)
ou par le parent (page Programme), jamais posées tant qu'elles le restent."""

import pytest

from app.config import get_settings
from tests.test_admin import ADMIN, KEY, PLAY, parent

PASSE_SIMPLE = "6e.francais.conjugaison.formes"


@pytest.fixture(autouse=True)
def admin_settings(monkeypatch):
    monkeypatch.setenv("ALDORIA_ADMIN_KEY", KEY)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


async def _pack(client, headers, **body):
    response = await client.post(f"{PLAY}/session/start", json=body or None, headers=headers)
    return response.json()["items"]


def _notions(items):
    return {n for i in items for n in i["notions"]}


async def _program_notion(client, profiles, code):
    chapters = (
        await client.get(f"{ADMIN}/profiles/{profiles['jules']}/chapters", headers=parent())
    ).json()
    return next(n for ch in chapters for n in ch["notions"] if n["code"] == code)


async def test_child_sets_a_notion_aside_and_the_parent_sees_it(
    client, login, profiles, curriculum
):
    headers = await login("jules", "1234")
    dungeon = {"mode": "donjon", "focus_chapters": ["6e.francais.conjugaison"]}
    assert PASSE_SIMPLE in _notions(await _pack(client, headers, **dungeon))

    response = await client.post(
        f"{PLAY}/notions/set-aside", json={"notion": PASSE_SIMPLE}, headers=headers
    )
    assert response.status_code == 200
    # Plus jamais posée, même dans le donjon qui vise son chapitre.
    assert PASSE_SIMPLE not in _notions(await _pack(client, headers, **dungeon))
    assert PASSE_SIMPLE not in _notions(await _pack(client, headers))

    assert (await _program_notion(client, profiles, PASSE_SIMPLE))["set_aside"] == "enfant"
    board = (
        await client.get(f"{ADMIN}/profiles/{profiles['jules']}/dashboard", headers=parent())
    ).json()
    assert [n["code"] for n in board["set_aside_by_child"]] == [PASSE_SIMPLE]

    # Le parent la réactive : elle revient.
    url = f"{ADMIN}/profiles/{profiles['jules']}/notions/{PASSE_SIMPLE}"
    response = await client.put(url, json={"set_aside": False}, headers=parent())
    assert response.json() == {"code": PASSE_SIMPLE, "set_aside": None}
    assert (await _program_notion(client, profiles, PASSE_SIMPLE))["set_aside"] is None
    assert PASSE_SIMPLE in _notions(await _pack(client, headers, **dungeon))


async def test_parent_marks_a_notion_not_seen_yet(client, login, profiles, curriculum):
    url = f"{ADMIN}/profiles/{profiles['jules']}/notions/{PASSE_SIMPLE}"
    response = await client.put(url, json={"set_aside": True}, headers=parent())
    assert response.json() == {"code": PASSE_SIMPLE, "set_aside": "parent"}
    assert (await _program_notion(client, profiles, PASSE_SIMPLE))["set_aside"] == "parent"
    headers = await login("jules", "1234")
    dungeon = {"mode": "donjon", "focus_chapters": ["6e.francais.conjugaison"]}
    assert PASSE_SIMPLE not in _notions(await _pack(client, headers, **dungeon))
    # Mise de côté par le parent : pas dans la liste « mises de côté par l'enfant ».
    board = (
        await client.get(f"{ADMIN}/profiles/{profiles['jules']}/dashboard", headers=parent())
    ).json()
    assert board["set_aside_by_child"] == []


async def test_parent_confirms_what_the_child_set_aside(client, login, profiles, curriculum):
    headers = await login("jules", "1234")
    await client.post(f"{PLAY}/notions/set-aside", json={"notion": PASSE_SIMPLE}, headers=headers)
    url = f"{ADMIN}/profiles/{profiles['jules']}/notions/{PASSE_SIMPLE}"
    await client.put(url, json={"set_aside": True}, headers=parent())
    assert (await _program_notion(client, profiles, PASSE_SIMPLE))["set_aside"] == "parent"


async def test_a_whole_dungeon_set_aside_still_asks_its_subject(
    client, login, profiles, curriculum
):
    """Toute la matière mise de côté : le donjon garde ses questions (jamais d'une autre
    matière) ; le seuil prévient l'enfant."""
    chapters = (
        await client.get(f"{ADMIN}/profiles/{profiles['jules']}/chapters", headers=parent())
    ).json()
    french = [n["code"] for ch in chapters if ch["subject"]["code"] == "francais"
              for n in ch["notions"]]
    for code in french:
        await client.put(
            f"{ADMIN}/profiles/{profiles['jules']}/notions/{code}",
            json={"set_aside": True},
            headers=parent(),
        )
    headers = await login("jules", "1234")
    items = await _pack(client, headers, mode="donjon", focus_chapters=["6e.francais.grammaire"])
    assert items and all(i["notions"][0].startswith("6e.francais.") for i in items)


async def test_unknown_or_other_level_notion_is_refused(client, login, profiles, curriculum):
    headers = await login("jules", "1234")
    for code in ("6e.inconnue.notion", "2nde.francais.langue.accords"):
        response = await client.post(
            f"{PLAY}/notions/set-aside", json={"notion": code}, headers=headers
        )
        assert response.status_code == 404
        response = await client.put(
            f"{ADMIN}/profiles/{profiles['jules']}/notions/{code}",
            json={"set_aside": True},
            headers=parent(),
        )
        assert response.status_code == 404
