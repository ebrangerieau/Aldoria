"""Phase 3, espace parent complet : banque de questions (saisie, aperçu, import,
publication), aperçu des générateurs, signalements, mélange des questions,
réinitialisation d'un profil, indicateurs du PRD §2."""

from tests.test_admin import ADMIN, PLAY, admin_settings, parent  # noqa: F401 (fixture)
from tests.test_tracking import _attempt

MEDIATRICE = "6e.maths.mediatrice.definition"  # aucune question générée : banque seule

QCM = {
    "notion": MEDIATRICE,
    "type": "mcq",
    "difficulty": 2,
    "prompt": "Un point de la médiatrice de [AB] est…",
    "choices": ["à égale distance de A et de B", "le milieu de [AB]", "plus près de A"],
    "answer": {"kind": "choice", "index": 0},
    "hint": "Pense à la définition.",
    "explanation": "La médiatrice est l'ensemble des points équidistants de A et de B.",
}


async def test_question_is_validated_before_saving(client, curriculum):
    bad = QCM | {"answer": {"kind": "choice", "index": 5}, "notion": "6e.maths.inexistante"}
    response = await client.post(
        f"{ADMIN}/bank", json={"level": "6e", "question": bad}, headers=parent()
    )
    assert response.status_code == 422
    assert any("notion inconnue" in e for e in response.json()["error"]["details"]["errors"])
    wrong_level = await client.post(
        f"{ADMIN}/bank", json={"level": "2nde", "question": QCM}, headers=parent()
    )
    assert wrong_level.status_code == 422
    preview = (
        await client.post(
            f"{ADMIN}/bank/preview",
            json={"level": "6e", "question": QCM | {"latex": "\\frac{1}{2}"}},
            headers=parent(),
        )
    ).json()
    assert preview["ok"] and preview["item"]["latex_hash"] in preview["formulas"]
    assert preview["formulas"][preview["item"]["latex_hash"]].startswith("<svg")
    invalid = (
        await client.post(
            f"{ADMIN}/bank/preview",
            json={"level": "6e", "question": QCM | {"choices": ["a", "a"]}},
            headers=parent(),
        )
    ).json()
    assert invalid == {"ok": False, "errors": ["deux propositions identiques"]}


async def test_published_question_enters_the_game(client, login, profiles, curriculum):
    created = (
        await client.post(f"{ADMIN}/bank", json={"level": "6e", "question": QCM}, headers=parent())
    ).json()
    assert created["status"] == "brouillon" and created["notion"] == MEDIATRICE
    await client.put(
        f"{ADMIN}/profiles/{profiles['jules']}/chapters/6e.maths.mediatrice",
        json={"status": "en_cours"},
        headers=parent(),
    )
    headers = await login("jules", "1234")

    async def bank_items():
        body = (await client.post(f"{PLAY}/session/start", headers=headers)).json()
        return [i for i in body["items"] if i["id"].startswith("banque:")]

    assert await bank_items() == [], "un brouillon n'est jamais joué"
    item_id = created["id"]
    await client.put(
        f"{ADMIN}/bank/{item_id}",
        json={"level": "6e", "status": "publie", "question": QCM},
        headers=parent(),
    )
    played = await bank_items()
    assert [i["id"] for i in played] == [f"banque:{item_id}:1"], "une seule fois par paquet"
    assert played[0]["prompt"] == QCM["prompt"] and played[0]["generator"] == "banque"
    # Correction : nouvelle version, nouvel identifiant de jeu.
    fixed = QCM | {"hint": "Compare les distances à A et à B."}
    await client.put(
        f"{ADMIN}/bank/{item_id}",
        json={"level": "6e", "status": "publie", "question": fixed},
        headers=parent(),
    )
    assert [i["id"] for i in await bank_items()] == [f"banque:{item_id}:2"]
    listed = (await client.get(f"{ADMIN}/bank?level=6e", headers=parent())).json()
    assert [(r["id"], r["status"], r["type"]) for r in listed] == [(item_id, "publie", "mcq")]
    assert (await client.delete(f"{ADMIN}/bank/{item_id}", headers=parent())).status_code == 204
    assert await bank_items() == []


CSV = "\n".join(
    [
        "notion;type;difficulte;enonce;formule;choix;reponse;indice;explication",
        "6e.maths.mediatrice.definition;qcm;1;Une médiatrice est…;;"
        "une droite|un segment|un cercle;1;;C'est une droite.",
        "6e.maths.fractions.addition;nombre;2;Calcule.;\\frac{1}{4}+\\frac{2}{4};;3/4;;"
        "On ajoute les numérateurs.",
        "6e.maths.inconnue;nombre;2;Calcule 2 + 2.;;;4;;Quatre.",
        "6e.maths.fractions.addition;nombre;deux;Calcule.;;;4;;Quatre.",
    ]
)


async def test_csv_import_reports_each_line_then_creates_drafts(client, curriculum):
    body = {"level": "6e", "format": "csv", "content": CSV}
    dry = (await client.post(f"{ADMIN}/bank/import", json=body, headers=parent())).json()
    assert [(line["line"], line["ok"]) for line in dry["lines"]] == [
        (2, True),
        (3, True),
        (4, False),
        (5, False),
    ]
    assert "notion inconnue" in dry["lines"][2]["errors"][0]
    assert "difficulté illisible" in dry["lines"][3]["errors"][0]
    assert (dry["valid"], dry["invalid"], dry["created"]) == (2, 2, 0)
    assert (await client.get(f"{ADMIN}/bank", headers=parent())).json() == []

    done = (
        await client.post(f"{ADMIN}/bank/import", json=body | {"commit": True}, headers=parent())
    ).json()
    assert done["created"] == 2
    listed = (await client.get(f"{ADMIN}/bank", headers=parent())).json()
    assert {(r["source"], r["status"]) for r in listed} == {("import", "brouillon")}
    fraction = next(r for r in listed if r["type"] == "numeric")
    full = (await client.get(f"{ADMIN}/bank/{fraction['id']}", headers=parent())).json()
    assert full["question"]["answer"]["kind"] == "fraction"


async def test_json_import_and_unreadable_files(client, curriculum):
    import json

    good = {"level": "6e", "format": "json", "content": json.dumps([QCM, {"notion": 3}])}
    report = (await client.post(f"{ADMIN}/bank/import", json=good, headers=parent())).json()
    assert [line["ok"] for line in report["lines"]] == [True, False]
    broken = {"level": "6e", "format": "json", "content": "[{"}
    response = await client.post(f"{ADMIN}/bank/import", json=broken, headers=parent())
    assert response.status_code == 422 and "JSON illisible" in response.json()["error"]["message"]
    no_header = {"level": "6e", "format": "csv", "content": "a;b\n1;2\n"}
    response = await client.post(f"{ADMIN}/bank/import", json=no_header, headers=parent())
    assert "colonnes manquantes" in response.json()["error"]["message"]


async def test_generator_preview_shows_ten_items(client, curriculum):
    listed = (await client.get(f"{ADMIN}/generators?level=2nde", headers=parent())).json()
    codes = {g["code"]: g for g in listed}
    assert codes["2nde.statistiques.enquete"]["use"] == "énigme ou quête"
    preview = (
        await client.get(
            f"{ADMIN}/generators/2nde.calcul.developper/preview?difficulty=2&seed=4",
            headers=parent(),
        )
    ).json()
    assert len(preview["items"]) == 10
    assert all(i["difficulty"] == 2 and "meta" not in i for i in preview["items"])
    assert all(i["latex_hash"] in preview["formulas"] for i in preview["items"])
    missing = await client.get(f"{ADMIN}/generators/inconnu/preview", headers=parent())
    assert missing.status_code == 404


async def test_child_report_reaches_the_parent(client, login, curriculum):
    headers = await login("tom", "9876")
    item = {"id": "2nde.calcul.developper:2:7", "prompt": "Développe.", "secret": "x" * 10}
    response = await client.post(
        f"{PLAY}/reports",
        json={"item": item, "user_input": "x²+9", "reason": "reponse"},
        headers=headers,
    )
    assert response.status_code == 201
    assert (await client.get(f"{ADMIN}/reports/count", headers=parent())).json() == {"open": 1}
    reports = (await client.get(f"{ADMIN}/reports", headers=parent())).json()
    assert reports[0]["child"] == "Tom" and reports[0]["user_input"] == "x²+9"
    assert "secret" not in reports[0]["item"], "seuls les champs de la question sont gardés"
    await client.put(
        f"{ADMIN}/reports/{reports[0]['id']}", json={"status": "traite"}, headers=parent()
    )
    assert (await client.get(f"{ADMIN}/reports/count", headers=parent())).json() == {"open": 0}


async def test_session_mix_is_adjustable(client, login, profiles, curriculum):
    url = f"{ADMIN}/profiles/{profiles['jules']}"
    bad = await client.patch(
        url, json={"ratios": {"chapter": 0.5, "review": 0.5, "automatisms": 0.5}}, headers=parent()
    )
    assert bad.status_code == 422
    ok = await client.patch(
        url, json={"ratios": {"chapter": 0.2, "review": 0.2, "automatisms": 0.6}}, headers=parent()
    )
    assert ok.json()["ratios"] == {"chapter": 0.2, "review": 0.2, "automatisms": 0.6}
    assert ok.json()["session_max_minutes"] == 25, "durée inchangée"
    headers = await login("jules", "1234")
    items = (await client.post(f"{PLAY}/session/start", headers=headers)).json()["items"]
    automatisms = [i for i in items if i["category"] == "automatisme"]
    assert len(automatisms) > len(items) / 2


async def test_reset_erases_progress_and_old_saves(client, login, profiles, curriculum):
    headers = await login("jules", "1234")
    session_id = (await client.post(f"{PLAY}/session/start", headers=headers)).json()["session_id"]
    await client.post(
        f"{PLAY}/attempts", json={"attempts": [_attempt(session_id)]}, headers=headers
    )
    await client.put(
        f"{PLAY}/save",
        json={"base_revision": 0, "schema_version": 1, "data": {"xp": 500}},
        headers=headers,
    )
    url = f"{ADMIN}/profiles/{profiles['jules']}/reset"
    refused = await client.post(url, json={"confirm": "Tom"}, headers=parent())
    assert refused.status_code == 422
    counts = (await client.post(url, json={"confirm": "jules"}, headers=parent())).json()
    assert counts["attempts"] == 1 and counts["saves"] == 1 and counts["sessions"] == 1
    save = (await client.get(f"{PLAY}/save", headers=headers)).json()
    assert (save["revision"], save["epoch"], save["data"]) == (0, 1, None)
    # Un appareil resté sur l'ancienne partie ne la restaure pas.
    stale = await client.put(
        f"{PLAY}/save",
        json={"base_revision": 1, "schema_version": 1, "data": {"xp": 900}, "epoch": 0},
        headers=headers,
    )
    assert stale.status_code == 409
    assert stale.json()["error"]["details"]["current"]["epoch"] == 1
    fresh = await client.put(
        f"{PLAY}/save",
        json={"base_revision": 0, "schema_version": 1, "data": {"xp": 0}, "epoch": 1},
        headers=headers,
    )
    assert fresh.status_code == 200
    dashboard = (
        await client.get(f"{ADMIN}/profiles/{profiles['jules']}/dashboard", headers=parent())
    ).json()
    assert dashboard["week"]["answers"] == 0


async def test_indicators_follow_the_prd(client, login, profiles, curriculum):
    await client.put(
        f"{ADMIN}/profiles/{profiles['jules']}/chapters/6e.maths.fractions",
        json={"status": "en_cours"},
        headers=parent(),
    )
    headers = await login("jules", "1234")
    for rating in (5, 4):
        session_id = (await client.post(f"{PLAY}/session/start", headers=headers)).json()[
            "session_id"
        ]
        # Une notion vue 4 fois : ratée la 1re fois, réussie la 4e.
        batch = [_attempt(session_id, correct=i > 0, minutes_ago=30 - i) for i in range(4)]
        batch.append(_attempt(session_id, notion="6e.maths.angles.vocabulaire", minutes_ago=1))
        await client.post(f"{PLAY}/attempts", json={"attempts": batch}, headers=headers)
        await client.post(
            f"{PLAY}/session/end",
            json={"session_id": session_id, "active_seconds": 600, "rating": rating},
            headers=headers,
        )
    body = (
        await client.get(f"{ADMIN}/profiles/{profiles['jules']}/indicators", headers=parent())
    ).json()
    assert len(body["weeks"]) == 8 and body["weeks"][-1]["sessions"] == 2
    values = {i["code"]: i for i in body["indicators"]}
    assert values["regularite"]["value"] == 1
    assert values["revision"]["value"] == 5
    assert values["apprentissage"]["value"] == 100 and values["apprentissage"]["met"]
    assert values["alignement"]["value"] == 80
    assert values["plaisir"]["value"] == 4.5 and values["plaisir"]["met"]
    assert values["envie"]["value"] == 0.5 and values["envie"]["met"] is False


async def test_parent_changes_a_pin(client, profiles, login):
    url = f"{ADMIN}/profiles/{profiles['jules']}/pin"
    assert (await client.put(url, json={"pin": "4321"})).status_code == 404  # sans le secret
    for bad in ("12", "12345", "12a4", " 123"):
        response = await client.put(url, json={"pin": bad}, headers=parent())
        assert response.status_code == 422, bad
    # Code de Tom : refusé pour Jules (chacun entrerait dans le profil de l'autre).
    taken = await client.put(url, json={"pin": "9876"}, headers=parent())
    assert taken.status_code == 422
    assert taken.json()["error"]["code"] == "pin_taken"
    assert "Tom" in taken.json()["error"]["message"]

    # Jules s'est trompé 5 fois : bloqué ; le nouveau code lève le blocage.
    for _ in range(5):
        await client.post(f"{PLAY}/login", json={"profile_id": profiles["jules"], "pin": "0000"})
    locked = await client.post(
        f"{PLAY}/login", json={"profile_id": profiles["jules"], "pin": "1234"}
    )
    assert locked.status_code != 200
    response = await client.put(url, json={"pin": "4321"}, headers=parent())
    assert response.status_code == 204
    old = await client.post(f"{PLAY}/login", json={"profile_id": profiles["jules"], "pin": "1234"})
    assert old.status_code == 401
    assert await login("jules", "4321")
    # Remettre son propre code n'est pas un conflit.
    same = await client.put(url, json={"pin": "4321"}, headers=parent())
    assert same.status_code == 204
