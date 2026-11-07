"""Pont des fractions (Jules) : des planches de longueurs fractionnaires à poser bout à bout."""

from collections import Counter
from fractions import Fraction
from itertools import product

from app.engine import answers, session_pack
from app.engine.generators import REGISTRY, combat_notions, pont

API = "/api/v1/play"
CODE = "6e.fractions.pont"


def _items(seeds: int = 80):
    for difficulty in range(1, 6):
        for seed in range(seeds):
            yield REGISTRY[CODE].item(difficulty, seed)


def _reachable(planks: list[dict], gap: Fraction) -> bool:
    """La réserve permet-elle de couvrir exactement le ravin ?"""
    kinds = [(Fraction(p["length"]), p["count"]) for p in planks]
    return any(
        sum((k * n for (k, _c), n in zip(kinds, counts, strict=True)), Fraction(0)) == gap
        for counts in product(*(range(c + 1) for _k, c in kinds))
    )


def test_the_stock_always_holds_a_solution():
    for item in _items():
        v = item.visual
        gap = Fraction(v["gap"])
        assert v["kind"] == "pont" and item.answer.value == v["gap"]
        solution = [Fraction(s) for s in item.meta["solution"]]
        assert sum(solution) == gap and len(solution) >= 2, item.id
        stock = {Fraction(p["length"]): p["count"] for p in v["planks"]}
        for length, needed in Counter(solution).items():
            assert stock[length] > needed, "des planches en trop de chaque sorte"
        assert gap not in stock, "jamais une seule planche"
        assert _reachable(v["planks"], gap)
        assert 0 < gap <= pont.LEVELS[item.difficulty][2]


def test_any_exact_bridge_is_accepted():
    item = REGISTRY[CODE].item(4, 0)
    gap = Fraction(item.visual["gap"])
    answer = item.answer.model_dump()
    assert answers.check(answer, item.answer.value)
    assert answers.check(answer, f"{gap.numerator * 2}/{gap.denominator * 2}")
    assert not answers.check(answer, str(gap + Fraction(1, 12)))
    whole = next(i for i in _items(40) if i.visual["gap"] == "1")
    assert answers.check(whole.answer.model_dump(), "1")


def test_difficulty_shapes_the_ravine():
    for item in _items():
        gap = Fraction(item.visual["gap"])
        dens = {Fraction(p["length"]).denominator for p in item.visual["planks"]}
        solution = [Fraction(s) for s in item.meta["solution"]]
        if item.difficulty <= 2:
            assert gap <= 1
            assert all(max(dens) % d == 0 for d in dens), "dénominateurs multiples"
        if item.difficulty == 3:
            assert gap > 1
        if item.difficulty >= 4:
            assert pont._mixed_denominators(solution), item.id


def test_texts_explain_the_sum():
    item = REGISTRY[CODE].item(4, 0)
    assert item.hint.startswith("Compte tout en ")
    assert item.explanation.startswith("Par exemple : ")
    assert pont.measure(Fraction(7, 6)) == "7/6 de perche (1 perche et 1/6)"
    assert pont.measure(Fraction(1)) == "1 perche"
    assert pont.measure(Fraction(2)) == "2 perches"
    for item in _items(10):
        said = session_pack.item_data(item, "chapitre", {})["speech"]
        assert "/" not in said["prompt"] + said.get("hint", "") + said.get("explanation", "")


def test_bridge_stays_out_of_combat_packs():
    assert not REGISTRY[CODE].combat
    assert "6e.maths.fractions.addition" in combat_notions(), "d'autres générateurs la posent"


async def test_bridge_session(client, login, curriculum):
    headers = await login("jules", "1234")
    body = (
        await client.post(
            f"{API}/session/start",
            json={"mode": "arene", "enigma": {"generator": CODE, "count": 8}},
            headers=headers,
        )
    ).json()
    ravines = [i for i in body["items"] if i["role"] == "enigme"]
    assert len(ravines) == 8 and all(i["visual"]["kind"] == "pont" for i in ravines)
    tom = await login("tom", "9876")
    refused = await client.post(
        f"{API}/session/start",
        json={"mode": "arene", "enigma": {"generator": CODE, "count": 8}},
        headers=tom,
    )
    assert refused.status_code == 422, "pas de pont pour la seconde"
