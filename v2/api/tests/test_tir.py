"""Tir de précision à la Lice : rapporteur (Jules) et droite de l'arbalète (Tom)."""

from fractions import Fraction

from app.engine import answers, session_pack
from app.engine.generators import REGISTRY, combat_notions, tir

API = "/api/v1/play"


def _items(code: str, seeds: int = 80):
    for difficulty in range(1, 6):
        for seed in range(seeds):
            yield REGISTRY[code].item(difficulty, seed)


def test_angle_items_match_their_drawing():
    for item in _items("6e.angles.tir"):
        v = item.visual
        assert v["kind"] == "rapporteur" and 0 < v["angle"] < 180
        assert item.answer.value == str(v["angle"])
        multiple, minor, _labels, left = tir.ANGLES[item.difficulty]
        assert v["angle"] % multiple == 0 and v["angle"] % minor == 0, "sur une graduation"
        assert (v["reference"] == "gauche") == left == v["double_scale"]
        assert answers.check(item.answer.model_dump(), str(v["angle"]))
        if left and v["angle"] != 90:
            assert not answers.check(item.answer.model_dump(), str(180 - v["angle"])), "le piège"


def test_crossbow_line_goes_through_the_target():
    for item in _items("2nde.droites.tir"):
        v = item.visual
        (x0, b), (x, y) = v["start"], v["target"]
        a = Fraction(item.answer.value)
        assert x0 == 0 and a * x + b == y, item.id
        assert 0 <= b <= v["height"] and 0 <= y <= v["height"] and 0 < x <= v["width"]
        assert answers.check(item.answer.model_dump(), item.answer.value)
        if a.denominator > 1:
            assert answers.check(
                item.answer.model_dump(), str(a.numerator * 2) + "/" + str(a.denominator * 2)
            )
        if item.difficulty == 1:
            assert b == 0 and a > 0


def test_fractions_come_with_difficulty():
    def has_fraction(d):
        return any("/" in REGISTRY["2nde.droites.tir"].item(d, s).answer.value for s in range(60))

    assert not has_fraction(1) and not has_fraction(2) and has_fraction(4) and has_fraction(5)


def test_shooting_notions_stay_out_of_combat_packs():
    assert not REGISTRY["6e.angles.tir"].combat and not REGISTRY["2nde.droites.tir"].combat
    assert "6e.maths.angles.mesure" not in combat_notions()
    assert "2nde.maths.geometrie_reperee.droites" in combat_notions(), (
        "d'autres générateurs la posent"
    )


def test_items_are_read_aloud():
    for code in ("6e.angles.tir", "2nde.droites.tir"):
        for item in _items(code, 10):
            said = session_pack.item_data(item, "chapitre", {})["speech"]
            assert "÷" not in said.get("hint", "") + said.get("explanation", "")


async def test_shooting_range_session(client, login, curriculum):
    headers = await login("jules", "1234")
    body = (
        await client.post(
            f"{API}/session/start",
            json={"mode": "arene", "enigma": {"generator": "6e.angles.tir", "count": 8}},
            headers=headers,
        )
    ).json()
    shots = [i for i in body["items"] if i["role"] == "enigme"]
    assert len(shots) == 8 and all(i["visual"]["kind"] == "rapporteur" for i in shots)
    assert all(i["generator"] != "6e.angles.tir" for i in body["items"] if i["role"] != "enigme")


async def test_crossbow_session_for_tom(client, login, curriculum):
    headers = await login("tom", "9876")
    body = (
        await client.post(
            f"{API}/session/start",
            json={"mode": "arene", "enigma": {"generator": "2nde.droites.tir", "count": 8}},
            headers=headers,
        )
    ).json()
    shots = [i for i in body["items"] if i["role"] == "enigme"]
    assert len(shots) == 8 and all(i["visual"]["kind"] == "repere_tir" for i in shots)
    assert all(i["generator"] != "2nde.droites.tir" for i in body["items"] if i["role"] != "enigme")


def test_slope_written_by_the_game_is_accepted_for_any_equivalent_fraction():
    """Le jeu envoie « 2 », « -3/4 », « 0/3 » (slopeText) : toute fraction égale est juste."""

    def fraction(value: str) -> dict:
        return {
            "kind": "fraction",
            "value": value,
            "accept_equivalent": True,
            "require_irreducible": False,
        }

    answer = fraction("-1/4")
    assert answers.check(answer, "-1/4") and answers.check(answer, "-2/8")
    assert answers.check(answer, "-3/12") and not answers.check(answer, "-1/3")
    assert answers.check(fraction("2"), "2") and answers.check(fraction("2"), "4/2")
    assert not answers.check(fraction("2"), "3")
    assert answers.check(fraction("0"), "0") and answers.check(fraction("0"), "0/3")
    assert not answers.check(fraction("0"), "1/3")
