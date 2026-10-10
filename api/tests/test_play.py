import uuid
from datetime import UTC, datetime

from app.engine import answers

API = "/api/v1/play"


async def test_profiles_list_has_no_secret(client, profiles):
    response = await client.get(f"{API}/profiles")
    assert response.status_code == 200
    body = response.json()
    assert [p["name"] for p in body] == ["Jules", "Tom"]
    assert all("pin" not in key for p in body for key in p)


async def test_login_ok(client, profiles):
    response = await client.post(
        f"{API}/login", json={"profile_id": profiles["jules"], "pin": "1234"}
    )
    assert response.status_code == 200
    assert response.json()["profile"]["level"] == "6e"


async def test_login_wrong_pin_then_lock(client, profiles):
    payload = {"profile_id": profiles["tom"], "pin": "0000"}
    for remaining in (4, 3, 2, 1):
        response = await client.post(f"{API}/login", json=payload)
        assert response.status_code == 401
        assert response.json()["error"]["details"]["remaining_attempts"] == remaining
    response = await client.post(f"{API}/login", json=payload)
    assert response.status_code == 423
    assert response.json()["error"]["code"] == "locked"
    # Même le bon PIN est refusé pendant le blocage.
    response = await client.post(
        f"{API}/login", json={"profile_id": profiles["tom"], "pin": "9876"}
    )
    assert response.status_code == 423


async def test_login_rejects_malformed_pin(client, profiles):
    response = await client.post(
        f"{API}/login", json={"profile_id": profiles["tom"], "pin": "12a4"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


async def test_session_requires_token(client, profiles):
    response = await client.post(f"{API}/session/start")
    assert response.status_code == 401
    response = await client.post(f"{API}/session/start", headers={"Authorization": "Bearer abc"})
    assert response.json()["error"]["code"] == "invalid_token"


async def test_session_pack_matches_level(client, login):
    headers = await login("jules", "1234")
    response = await client.post(f"{API}/session/start", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 60
    assert {i["generator"].split(".")[0] for i in body["items"]} == {"6e"}
    assert {i["role"] for i in body["items"]} == {"automatisme", "chapitre"}
    assert {i["difficulty"] for i in body["items"]} == {1, 2, 3, 4, 5}
    for item in body["items"]:
        assert "meta" not in item
        if item.get("latex"):
            assert body["formulas"][item["latex_hash"]].startswith("<svg")
        # Chaque réponse attendue est acceptée par le validateur.
        expected = item["answer"]
        if expected["kind"] != "choice":
            assert answers.check(expected, expected["value"])


async def test_tom_gets_seconde_items(client, login):
    headers = await login("tom", "9876")
    body = (await client.post(f"{API}/session/start", headers=headers)).json()
    assert {i["generator"] for i in body["items"]} == {
        "2nde.automatismes.evolutions",
        "2nde.calcul.developper",
    }


def _attempt(session_id: str, **overrides) -> dict:
    data = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "item_id": "6e.fractions.addition:2:42",
        "generator": "6e.fractions.addition",
        "difficulty": 2,
        "notion_ids": ["6e.maths.fractions.addition"],
        "correct": True,
        "time_ms": 12000,
        "answered_at": datetime.now(UTC).isoformat(),
    }
    data.update(overrides)
    return data


async def test_attempts_are_idempotent(client, login):
    headers = await login("jules", "1234")
    session_id = (await client.post(f"{API}/session/start", headers=headers)).json()["session_id"]
    batch = [_attempt(session_id), _attempt(session_id, correct=False)]
    first = await client.post(f"{API}/attempts", json={"attempts": batch}, headers=headers)
    assert first.json() == {"accepted": 2, "duplicates": 0}
    # Renvoi après coupure réseau : même lot + une nouvelle tentative.
    again = await client.post(
        f"{API}/attempts", json={"attempts": [*batch, _attempt(session_id)]}, headers=headers
    )
    assert again.json() == {"accepted": 1, "duplicates": 2}
    end = await client.post(
        f"{API}/session/end",
        json={"session_id": session_id, "active_seconds": 600},
        headers=headers,
    )
    assert end.json() == {"nb_questions": 3, "nb_correct": 2}


async def test_attempts_rejected_on_foreign_session(client, login):
    jules = await login("jules", "1234")
    tom = await login("tom", "9876")
    tom_session = (await client.post(f"{API}/session/start", headers=tom)).json()["session_id"]
    response = await client.post(
        f"{API}/attempts", json={"attempts": [_attempt(tom_session)]}, headers=jules
    )
    assert response.status_code == 403
