"""Espace parent : chaîne de confiance (secret Traefik + identité SSO), statut des
chapitres, tableau de bord, réglages, notions à valider."""

import pytest

from app.config import get_settings

ADMIN = "/api/v1/admin"
PLAY = "/api/v1/play"
KEY = "k" * 40


@pytest.fixture(autouse=True)
def admin_settings(monkeypatch):
    monkeypatch.setenv("ALDORIA_ADMIN_KEY", KEY)
    monkeypatch.setenv("ALDORIA_ADMIN_USERS", "parent@example.org, eric")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def parent(email="parent@example.org", user="parent", key=KEY) -> dict:
    headers = {"Remote-User": user, "Remote-Email": email, "Remote-Name": "Le parent"}
    if key is not None:
        headers["X-Aldoria-Admin-Key"] = key
    return headers


async def test_identity(client):
    response = await client.get(f"{ADMIN}/me", headers=parent())
    assert response.status_code == 200
    assert response.json() == {"user": "parent", "email": "parent@example.org", "name": "Le parent"}


async def test_forged_identity_without_traefik_secret_is_404(client, profiles):
    """Recette : un Remote-User forgé arrivant par l'hôte public (sans le secret que
    seul le routeur admin ajoute) ne voit même pas l'API parent."""
    for headers in (parent(key=None), parent(key="mauvais" * 6), {}):
        response = await client.get(f"{ADMIN}/profiles", headers=headers)
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"


async def test_unknown_parent_is_forbidden(client):
    response = await client.get(f"{ADMIN}/me", headers=parent(email="voisin@example.org", user="x"))
    assert response.status_code == 403
    assert response.json()["error"]["details"]["identity"] == "voisin@example.org"
    # Correspondance par nom d'utilisateur, sans tenir compte de la casse.
    ok = await client.get(f"{ADMIN}/me", headers=parent(email="", user="Eric"))
    assert ok.status_code == 200


async def test_missing_identity_is_401(client):
    response = await client.get(f"{ADMIN}/me", headers={"X-Aldoria-Admin-Key": KEY})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "no_identity"


async def test_admin_closed_without_key(client, monkeypatch):
    monkeypatch.setenv("ALDORIA_ADMIN_KEY", "")
    get_settings.cache_clear()
    response = await client.get(f"{ADMIN}/me", headers=parent(key=""))
    assert response.status_code == 404


async def test_child_token_does_not_open_admin(client, login):
    headers = await login("jules", "1234")
    response = await client.get(f"{ADMIN}/profiles", headers=headers)
    assert response.status_code == 404


async def test_profiles_and_settings(client, profiles):
    body = (await client.get(f"{ADMIN}/profiles", headers=parent())).json()
    assert [p["name"] for p in body] == ["Jules", "Tom"]
    assert body[0]["week"] == {
        "sessions": 0,
        "minutes": 0,
        "answers": 0,
        "correct": 0,
        "last_played": None,
    }
    response = await client.patch(
        f"{ADMIN}/profiles/{profiles['jules']}",
        json={"session_max_minutes": 40},
        headers=parent(),
    )
    assert response.json()["session_max_minutes"] == 40
    bad = await client.patch(
        f"{ADMIN}/profiles/{profiles['jules']}", json={"session_max_minutes": 500}, headers=parent()
    )
    assert bad.status_code == 422


async def test_chapter_status_drives_the_session_pack(client, login, profiles, curriculum):
    url = f"{ADMIN}/profiles/{profiles['jules']}/chapters/6e.maths.prealgebre"
    response = await client.put(
        url, json={"status": "controle_bientot", "test_date": "2026-10-20"}, headers=parent()
    )
    assert response.json() == {
        "code": "6e.maths.prealgebre",
        "status": "controle_bientot",
        "test_date": "2026-10-20",
    }
    chapters = (
        await client.get(f"{ADMIN}/profiles/{profiles['jules']}/chapters", headers=parent())
    ).json()
    prealgebre = next(c for c in chapters if c["code"] == "6e.maths.prealgebre")
    assert prealgebre["status"] == "controle_bientot" and prealgebre["test_date"] == "2026-10-20"

    # Contrôle bientôt : 70 % du paquet porte sur ce chapitre.
    headers = await login("jules", "1234")
    items = (await client.post(f"{PLAY}/session/start", headers=headers)).json()["items"]
    share = sum(i["notions"][0].startswith("6e.maths.prealgebre.") for i in items) / len(items)
    assert share >= 0.6

    # Un autre statut efface la date.
    response = await client.put(
        url, json={"status": "termine", "test_date": "2026-10-20"}, headers=parent()
    )
    assert response.json()["test_date"] is None


async def test_chapter_must_match_child_level(client, profiles, curriculum):
    response = await client.put(
        f"{ADMIN}/profiles/{profiles['jules']}/chapters/2nde.maths.vecteurs",
        json={"status": "en_cours"},
        headers=parent(),
    )
    assert response.status_code == 404
    response = await client.put(
        f"{ADMIN}/profiles/{profiles['jules']}/chapters/6e.maths.fractions",
        json={"status": "en_vacances"},
        headers=parent(),
    )
    assert response.status_code == 422


async def test_dashboard_counts_and_play_time(client, login, profiles, curriculum):
    from datetime import UTC, datetime

    from tests.test_tracking import _attempt

    headers = await login("jules", "1234")
    session_id = (await client.post(f"{PLAY}/session/start", headers=headers)).json()["session_id"]
    batch = [_attempt(session_id, minutes_ago=10 - i) for i in range(8)]
    batch.append(_attempt(session_id, notion="6e.maths.fractions.comparaison", correct=False))
    await client.post(f"{PLAY}/attempts", json={"attempts": batch}, headers=headers)
    await client.post(
        f"{PLAY}/session/end",
        json={"session_id": session_id, "active_seconds": 900},
        headers=headers,
    )

    body = (
        await client.get(f"{ADMIN}/profiles/{profiles['jules']}/dashboard", headers=parent())
    ).json()
    assert body["counts"]["acquise"] == 1
    assert body["counts"]["non acquise"] == 1
    assert body["counts"]["non vue"] == body["playable"] - 2
    assert body["week"]["answers"] == 9 and body["week"]["correct"] == 8
    assert body["week"]["minutes"] == 15
    assert len(body["days"]) == 14
    assert body["days"][-1] == {"date": datetime.now(UTC).date().isoformat(), "minutes": 15}
    assert body["recent_sessions"][0]["questions"] == 9
    assert [n["code"] for n in body["weak_notions"]] == ["6e.maths.fractions.comparaison"]


async def test_notions_to_validate(client, login, curriculum):
    listed = (await client.get(f"{ADMIN}/notions/to-validate", headers=parent())).json()
    assert listed and all(n["in_program"] is None for n in listed)
    code = listed[0]["code"]
    response = await client.put(
        f"{ADMIN}/notions/{code}", json={"in_program": False}, headers=parent()
    )
    assert response.json() == {"code": code, "in_program": False}
    # Hors programme : la notion disparaît des Archives de l'enfant.
    headers = await login("tom", "9876")
    chapters = (await client.get(f"{PLAY}/progress", headers=headers)).json()["chapters"]
    assert code not in {n["code"] for ch in chapters for n in ch["notions"]}


async def test_sessions_without_answers_are_ignored(client, login, profiles, curriculum):
    from tests.test_tracking import _attempt

    headers = await login("tom", "9876")
    for _ in range(3):  # ouvertes puis quittées aussitôt
        await client.post(f"{PLAY}/session/start", headers=headers)
    played = (await client.post(f"{PLAY}/session/start", headers=headers)).json()["session_id"]
    # Onglet fermé : pas de fin de session, durée estimée entre 1re et dernière réponse.
    batch = [
        _attempt(played, notion="2nde.maths.vecteurs.coordonnees", minutes_ago=m) for m in (12, 2)
    ]
    await client.post(f"{PLAY}/attempts", json={"attempts": batch}, headers=headers)
    body = (
        await client.get(f"{ADMIN}/profiles/{profiles['tom']}/dashboard", headers=parent())
    ).json()
    assert body["week"]["sessions"] == 1
    assert body["week"]["minutes"] == 10
    assert len(body["recent_sessions"]) == 1
    assert body["recent_sessions"][0] | {"started_at": None} == {
        "started_at": None,
        "minutes": 10,
        "questions": 2,
        "correct": 2,
        "finished": False,
    }
