"""Erreurs du jeu remontées par les appareils : rangées sans donnée d'enfant, comptées,
lues et vidées par l'exploitant seulement."""

import pytest
from sqlalchemy import func, select

from app import client_errors
from app.config import get_settings
from app.models import Adult, ClientError, Family
from tests.test_admin import ADMIN, KEY, PLAY, parent

BATCH = {
    "version": "abc1234",
    "platform": "Web Android téléphone",
    "errors": [
        {
            "message": "Invalid call. Nonexistent function 'size' in base 'Nil'.",
            "location": "res://scenes/world_map/world_map.gd:212 _dialog",
            "scene": "res://scenes/world_map/world_map.tscn",
        }
    ],
}


@pytest.fixture(autouse=True)
def admin_settings(monkeypatch):
    monkeypatch.setenv("ALDORIA_ADMIN_KEY", KEY)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


async def _operator(sessionmaker):
    async with sessionmaker() as db:
        (await db.get(Adult, 1)).is_operator = True
        await db.commit()


async def test_the_same_error_is_counted_on_one_line(client, sessionmaker):
    assert (await client.post(f"{PLAY}/client-errors", json=BATCH)).json() == {"created": 1}
    twice = {**BATCH, "errors": [{**BATCH["errors"][0], "count": 2}]}
    assert (await client.post(f"{PLAY}/client-errors", json=twice)).json() == {"created": 0}
    # Nouvelle version du jeu : une autre ligne (l'erreur est peut-être corrigée).
    newer = {**BATCH, "version": "def5678"}
    assert (await client.post(f"{PLAY}/client-errors", json=newer)).json() == {"created": 1}

    await _operator(sessionmaker)
    rows = (await client.get(f"{ADMIN}/client-errors", headers=parent())).json()
    assert [(r["version"], r["count"]) for r in rows] == [("def5678", 1), ("abc1234", 3)]
    assert rows[1]["family"] == "Famille test" and rows[1]["device"] == "Tablette"
    assert rows[1]["location"].endswith("_dialog")

    cleared = await client.delete(f"{ADMIN}/client-errors", headers=parent())
    assert cleared.json() == {"deleted": 2}
    assert (await client.get(f"{ADMIN}/client-errors", headers=parent())).json() == []


async def test_only_a_linked_device_can_send(client):
    response = await client.post(
        f"{PLAY}/client-errors", json=BATCH, headers={"X-Aldoria-Device": "inconnu"}
    )
    assert response.status_code == 401


@pytest.mark.parametrize(
    "change",
    [
        {"errors": []},
        {"errors": [{"message": "x" * 501}]},
        {"errors": [{"message": "boum"}] * 21},
        {"version": ""},
    ],
)
async def test_oversized_or_empty_batches_are_refused(client, change):
    response = await client.post(f"{PLAY}/client-errors", json={**BATCH, **change})
    assert response.status_code == 422


async def test_a_family_cannot_fill_the_database(client, sessionmaker, monkeypatch):
    monkeypatch.setattr(client_errors, "MAX_ROWS_PER_FAMILY", 3)
    for i in range(3):
        batch = {**BATCH, "errors": [{"message": f"erreur {i}"} for i in range(i * 2, i * 2 + 2)]}
        await client.post(f"{PLAY}/client-errors", json=batch)
    async with sessionmaker() as db:
        assert await db.scalar(select(func.count()).select_from(ClientError)) == 3


async def test_parents_do_not_see_them(client):
    await client.post(f"{PLAY}/client-errors", json=BATCH)
    assert (await client.get(f"{ADMIN}/client-errors", headers=parent())).status_code == 403
    assert (await client.delete(f"{ADMIN}/client-errors", headers=parent())).status_code == 403


async def test_erased_with_the_family(client, sessionmaker):
    from app.erasure import delete_family

    await client.post(f"{PLAY}/client-errors", json=BATCH)
    async with sessionmaker() as db:
        await delete_family(db, 1)
        await db.commit()
        assert await db.get(Family, 1) is None
        assert await db.scalar(select(func.count()).select_from(ClientError)) == 0
