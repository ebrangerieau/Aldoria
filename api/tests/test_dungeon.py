"""Phase 2, tranche verticale : paquet d'un donjon (chapitre ciblé, énigme) et
sauvegarde de partie versionnée."""

from app.engine import answers

API = "/api/v1/play"


async def test_dungeon_pack_focuses_its_chapter(client, login, curriculum):
    headers = await login("jules", "1234")
    response = await client.post(
        f"{API}/session/start",
        json={"focus_chapter": "6e.maths.fractions"},
        headers=headers,
    )
    assert response.status_code == 200
    chapter_items = [i for i in response.json()["items"] if i["category"] == "chapitre"]
    assert chapter_items
    # Les questions « chapitre » viennent toutes du chapitre du donjon.
    assert all(i["notions"][0].startswith("6e.maths.fractions.") for i in chapter_items)


async def test_dungeon_pack_has_enigma_items(client, login, curriculum):
    headers = await login("tom", "9876")
    response = await client.post(
        f"{API}/session/start",
        json={
            "focus_chapter": "2nde.maths.vecteurs",
            "enigma": {"generator": "2nde.vecteurs.rayon", "count": 4},
        },
        headers=headers,
    )
    assert response.status_code == 200
    items = response.json()["items"]
    enigma = [i for i in items if i["role"] == "enigme"]
    assert len(enigma) == 4
    assert all(i["generator"] == "2nde.vecteurs.rayon" for i in enigma)
    assert all(i["visual"]["kind"] == "grid" and "meta" not in i for i in enigma)
    # Difficulté croissante : du plus facile au plus difficile.
    difficulties = [i["difficulty"] for i in enigma]
    assert difficulties == sorted(difficulties)
    for i in enigma:
        assert answers.check(i["answer"], i["answer"]["value"])
    # Les énigmes ne se mélangent pas aux questions de combat.
    assert all(i["generator"] != "2nde.vecteurs.rayon" for i in items if i["role"] != "enigme")


async def test_balance_enigma_for_jules(client, login, curriculum):
    headers = await login("jules", "1234")
    body = (
        await client.post(
            f"{API}/session/start",
            json={"enigma": {"generator": "6e.prealgebre.balance"}},
            headers=headers,
        )
    ).json()
    enigma = [i for i in body["items"] if i["role"] == "enigme"]
    assert len(enigma) == 3
    assert all(i["visual"]["kind"] == "balance" for i in enigma)


async def test_dungeon_parameters_must_match_level(client, login, curriculum):
    headers = await login("jules", "1234")
    for payload, code in (
        ({"enigma": {"generator": "2nde.vecteurs.rayon"}}, "unknown_generator"),
        ({"enigma": {"generator": "inconnu"}}, "unknown_generator"),
        ({"focus_chapter": "2nde.maths.vecteurs"}, "unknown_chapter"),
        ({"focus_chapter": "6e.maths.inexistant"}, "unknown_chapter"),
    ):
        response = await client.post(f"{API}/session/start", json=payload, headers=headers)
        assert response.status_code == 422, payload
        assert response.json()["error"]["code"] == code


async def test_session_start_without_body_still_works(client, login, curriculum):
    headers = await login("jules", "1234")
    response = await client.post(f"{API}/session/start", headers=headers)
    assert response.status_code == 200
    assert all(i["role"] != "enigme" for i in response.json()["items"])


# --- Sauvegarde -----------------------------------------------------------------------


def _save(base: int, xp: int, **extra) -> dict:
    return {"base_revision": base, "schema_version": 1, "data": {"xp": xp, **extra}}


async def test_save_round_trip(client, login):
    headers = await login("jules", "1234")
    empty = (await client.get(f"{API}/save", headers=headers)).json()
    assert empty == {"revision": 0, "schema_version": None, "data": None, "saved_at": None}

    response = await client.put(f"{API}/save", json=_save(0, 120, level=2), headers=headers)
    assert response.status_code == 200
    assert response.json()["revision"] == 1
    response = await client.put(f"{API}/save", json=_save(1, 150), headers=headers)
    assert response.json()["revision"] == 2

    current = (await client.get(f"{API}/save", headers=headers)).json()
    assert current["revision"] == 2 and current["data"] == {"xp": 150}


async def test_saves_are_private(client, login):
    jules = await login("jules", "1234")
    tom = await login("tom", "9876")
    await client.put(f"{API}/save", json=_save(0, 500), headers=jules)
    assert (await client.get(f"{API}/save", headers=tom)).json()["revision"] == 0
    assert (await client.get(f"{API}/save")).status_code == 401


async def test_conflict_most_advanced_progress_wins(client, login):
    headers = await login("tom", "9876")
    await client.put(f"{API}/save", json=_save(0, 100), headers=headers)  # révision 1
    # La tablette sauvegarde plus loin (révision 2).
    await client.put(f"{API}/save", json=_save(1, 400), headers=headers)

    # Le PC, resté sur la révision 1 et moins avancé : refusé, il reçoit la partie du serveur.
    response = await client.put(f"{API}/save", json=_save(1, 250), headers=headers)
    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "save_conflict"
    assert error["details"]["current"]["revision"] == 2
    assert error["details"]["current"]["data"]["xp"] == 400

    # Plus avancé que le serveur malgré une base ancienne : accepté.
    response = await client.put(f"{API}/save", json=_save(1, 900), headers=headers)
    assert response.status_code == 200
    assert response.json()["revision"] == 3


async def test_only_last_20_revisions_are_kept(client, login, sessionmaker):
    from sqlalchemy import func, select

    from app.models import SaveRevision

    headers = await login("jules", "1234")
    for revision in range(25):
        response = await client.put(f"{API}/save", json=_save(revision, revision), headers=headers)
        assert response.status_code == 200
    async with sessionmaker() as db:
        kept = await db.scalar(select(func.count()).select_from(SaveRevision))
        oldest = await db.scalar(select(func.min(SaveRevision.revision)))
    assert kept == 20
    assert oldest == 6


async def test_oversized_save_is_rejected(client, login):
    headers = await login("jules", "1234")
    response = await client.put(f"{API}/save", json=_save(0, 1, blob="x" * 70_000), headers=headers)
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "save_too_large"
