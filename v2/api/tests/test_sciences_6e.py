"""Sciences de 6e : exemples relus, masses et volumes, vitesse, énigmes à remettre en ordre."""

import json
from pathlib import Path

import pytest

from app.engine import answers, session_pack
from app.engine.generators import REGISTRY
from app.engine.generators import sciences_6e as sc

CODES = sorted(code for code in REGISTRY if code.startswith("6e.sciences."))


def _items(code: str, seeds: int = 60):
    for difficulty in range(1, 6):
        for seed in range(seeds):
            yield REGISTRY[code].item(difficulty, seed)


def test_every_notion_of_the_programme_has_a_generator():
    root = Path(__file__).resolve().parents[2]
    seed = json.loads((root / "content/seed/6e/sciences.json").read_text("utf-8"))
    programme = {n["code"] for c in seed["chapters"] for n in c["notions"]}
    assert {REGISTRY[code].notion for code in CODES} == programme


@pytest.mark.parametrize("notion", sc.NOTIONS, ids=lambda n: n.code)
def test_facts_are_consistent(notion):
    assert {f.level for f in notion.facts} == {1, 2, 3}, notion.code
    for fact in notion.facts:
        assert len(fact.wrong) == 3 and fact.answer not in fact.wrong, fact.prompt
        assert len(set(fact.wrong)) == 3, fact.prompt


def test_conversions_are_right():
    for item in _items("6e.sciences.masse_volume"):
        assert answers.check(item.answer.model_dump(), item.answer.value), item.id
        if item.meta["kind"] in ("masse", "volume"):
            units = sc.MASS_UNITS if item.meta["kind"] == "masse" else sc.VOLUME_UNITS
            amount = float(item.prompt.split()[1].replace(",", "."))
            expected = amount * units[item.meta["from"]] / units[item.meta["to"]]
            assert float(item.answer.value) == pytest.approx(expected), item.id
            # La réponse s'écrit aussi avec une virgule.
            assert answers.check(item.answer.model_dump(), item.answer.value.replace(".", ","))


def test_speed_is_distance_over_duration():
    for item in _items("6e.sciences.vitesse"):
        assert float(item.answer.value) == item.meta["speed"], item.id
        assert item.meta["unit"] in item.prompt


def test_race_is_ordered_from_slowest_to_fastest():
    for item in _items("6e.sciences.course"):
        speeds = item.meta["speeds"]
        assert speeds == sorted(speeds) and len(set(speeds)) == len(speeds)
        for k, index in enumerate(item.answer.value):
            label = item.choices[index]
            km = int(label.split(" : ")[1].split(" km")[0])
            hours = int(label.split(" en ")[1].split(" h")[0])
            assert km / hours == speeds[k], item.id


def test_life_timeline_has_a_single_order():
    ages = [a for a, _l, _d in sc.LIFE_EVENTS]
    assert ages == sorted(ages, reverse=True) and len(set(ages)) == len(ages)
    for item in _items("6e.sciences.frise_vivant"):
        assert item.meta["ages"] == sorted(item.meta["ages"], reverse=True)
        ordered = [item.choices[i] for i in item.answer.value]
        assert item.choices != ordered, "présenté mélangé"


def test_food_chains_come_back_in_order():
    for item in _items("6e.sciences.chaine"):
        ordered = [item.choices[i] for i in item.answer.value]
        assert ordered == item.meta["chain"], item.id
        assert len(set(ordered)) == len(ordered)


@pytest.mark.parametrize("code", CODES)
def test_items_are_valid_and_read_aloud(code):
    for item in _items(code, 20):
        if item.type == "mcq":
            assert len(item.choices) == len(set(item.choices)) >= 2, item.id
        said = session_pack.item_data(item, "chapitre", {})["speech"]
        for text in [said["prompt"], said.get("explanation", ""), *said.get("choices", [])]:
            assert "km/h" not in text and "m/s" not in text, text  # lu en toutes lettres
            assert "°" not in text, text
