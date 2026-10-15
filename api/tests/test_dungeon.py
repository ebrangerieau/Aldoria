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
    assert empty == {
        "revision": 0,
        "epoch": 0,
        "schema_version": None,
        "data": None,
        "saved_at": None,
    }

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


async def test_dungeon_pack_with_several_chapters(client, login, curriculum):
    headers = await login("jules", "1234")
    chapters = ["6e.maths.prealgebre", "6e.maths.proportionnalite"]
    body = (
        await client.post(
            f"{API}/session/start",
            json={
                "mode": "donjon",
                "focus_chapters": chapters,
                "enigma": {"generator": "6e.proportionnalite.carte", "count": 6},
            },
            headers=headers,
        )
    ).json()
    chapter_items = [i for i in body["items"] if i["category"] == "chapitre"]
    assert {i["notions"][0].rsplit(".", 1)[0] for i in chapter_items} == set(chapters)
    enigma = [i for i in body["items"] if i["role"] == "enigme"]
    assert len(enigma) == 6 and all(i["visual"]["kind"] == "map" for i in enigma)
    # La carte n'a de sens qu'avec son dessin : jamais tirée pour un combat.
    assert all(i["generator"] != "6e.proportionnalite.carte" for i in chapter_items)


async def test_unknown_chapter_among_several_is_refused(client, login, curriculum):
    headers = await login("tom", "9876")
    response = await client.post(
        f"{API}/session/start",
        json={"focus_chapters": ["2nde.maths.fonctions", "6e.maths.fractions"]},
        headers=headers,
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "unknown_chapter"


async def test_daily_challenge_pack_is_automatisms_only(client, login, curriculum):
    headers = await login("tom", "9876")
    body = (
        await client.post(f"{API}/session/start", json={"mode": "defi"}, headers=headers)
    ).json()
    assert len(body["items"]) >= 10
    assert all(i["role"] == "automatisme" for i in body["items"])


async def test_session_end_keeps_mode_and_rating(client, login, curriculum, sessionmaker):
    from app.models import GameSession

    headers = await login("jules", "1234")
    started = (
        await client.post(f"{API}/session/start", json={"mode": "donjon"}, headers=headers)
    ).json()
    for rating, status in ((6, 422), (4, 200)):
        response = await client.post(
            f"{API}/session/end",
            json={"session_id": started["session_id"], "active_seconds": 300, "rating": rating},
            headers=headers,
        )
        assert response.status_code == status
    async with sessionmaker() as db:
        session = await db.get(GameSession, started["session_id"])
    assert (session.mode, session.rating) == ("donjon", 4)


def test_game_dungeons_match_curriculum_and_generators():
    """Les donjons du jeu (DungeonDef) visent des chapitres du programme qui ont des
    questions, et une énigme du bon niveau."""
    import json
    import re
    from pathlib import Path

    from app.engine.generators import REGISTRY, playable_notions

    root = Path(__file__).resolve().parents[2]
    source = (root / "game/worlds/shared/dungeon_def.gd").read_text(encoding="utf-8")
    chapters = {}
    for path in (root / "content/seed").glob("*/*.json"):
        seed = json.loads(path.read_text("utf-8"))
        chapters |= {c["code"]: seed["level"] for c in seed["chapters"]}
    playable = {n.rsplit(".", 1)[0] for n in playable_notions()}
    dungeons = re.findall(
        r'd\.code = "(\w+)".*?d\.chapter_codes = \[(.*?)\].*?d\.enigma_generator = "([\w.]+)"',
        source,
        re.S,
    )
    assert len(dungeons) == 12
    for code, chapter_list, enigma in dungeons:
        codes = re.findall(r'"([\w.]+)"', chapter_list)
        levels = {chapters[c] for c in codes}  # KeyError : chapitre absent du programme
        assert len(levels) == 1, code
        # Un chapitre sans générateur se nourrit de la banque ; au moins un a un générateur.
        assert any(c in playable for c in codes), code
        assert REGISTRY[enigma].level == levels.pop(), code


async def test_english_dungeon_stays_in_english(client, login, curriculum):
    """Bibliothèque des Langues : sorts, frappes et révisions en anglais seulement (aucune
    question de maths), énigme des lettres mélangées."""
    headers = await login("jules", "1234")
    body = (
        await client.post(
            f"{API}/session/start",
            json={
                "mode": "donjon",
                "focus_chapters": [
                    "6e.anglais.vocabulaire",
                    "6e.anglais.grammaire",
                    "6e.anglais.communication",
                ],
                "enigma": {"generator": "6e.anglais.lettres", "count": 6},
            },
            headers=headers,
        )
    ).json()
    items = body["items"]
    assert items
    assert all(i["notions"][0].startswith("6e.anglais.") for i in items)
    enigma = [i for i in items if i["role"] == "enigme"]
    assert len(enigma) == 6
    for i in enigma:
        assert i["type"] == "order" and i["listen"]["lang"] == "en-GB"
        word = "".join(i["choices"][k] for k in i["answer"]["value"])
        assert word.isalpha() and len(set(word)) == len(word), "lettres toutes différentes"
        assert i["choices"] != list(word), "présenté mélangé"
        assert answers.check(i["answer"], i["answer"]["value"])


async def test_maths_dungeon_has_no_english(client, login, curriculum):
    headers = await login("jules", "1234")
    items = (
        await client.post(
            f"{API}/session/start",
            json={"mode": "donjon", "focus_chapters": ["6e.maths.fractions"]},
            headers=headers,
        )
    ).json()["items"]
    assert all(i["notions"][0].startswith("6e.maths.") for i in items)


async def test_french_dungeon_stays_in_french(client, login, curriculum):
    """Théâtre de Verdure (Bois des Mots) : questions de français seulement, énigme des vers."""
    headers = await login("tom", "9876")
    names = ("langue", "figures", "poesie", "idees", "recit", "theatre")
    chapters = [f"2nde.francais.{c}" for c in names]
    body = (
        await client.post(
            f"{API}/session/start",
            json={
                "mode": "donjon",
                "focus_chapters": chapters,
                "enigma": {"generator": "2nde.francais.vers", "count": 6},
            },
            headers=headers,
        )
    ).json()
    items = body["items"]
    assert len(items) > 20
    assert all(i["notions"][0].startswith("2nde.francais.") for i in items)
    enigma = [i for i in items if i["role"] == "enigme"]
    assert len(enigma) == 6 and all(i["type"] == "order" for i in enigma)
    # Plusieurs chapitres représentés, pas seulement l'étude de la langue.
    assert len({i["notions"][0].split(".")[2] for i in items}) >= 4
