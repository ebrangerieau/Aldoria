"""EMC de 6e : exemples relus, élection des délégués, échelons et frise des droits."""

import json
from pathlib import Path

import pytest

from app.engine import answers, session_pack
from app.engine.generators import REGISTRY
from app.engine.generators import emc_6e as emc

CODES = sorted(code for code in REGISTRY if code.startswith("6e.emc."))


def _items(code: str, seeds: int = 60):
    for difficulty in range(1, 6):
        for seed in range(seeds):
            yield REGISTRY[code].item(difficulty, seed)


def test_every_notion_of_the_programme_has_a_generator():
    root = Path(__file__).resolve().parents[2]
    seed = json.loads((root / "content/seed/6e/emc.json").read_text("utf-8"))
    programme = {n["code"] for c in seed["chapters"] for n in c["notions"]}
    assert {REGISTRY[code].notion for code in CODES} == programme


@pytest.mark.parametrize("notion", emc.NOTIONS, ids=lambda n: n.code)
def test_facts_are_consistent(notion):
    assert {f.level for f in notion.facts} == {1, 2, 3}, notion.code
    for fact in notion.facts:
        assert len(fact.wrong) == 3 and fact.answer not in fact.wrong, fact.prompt
        assert len(set(fact.wrong)) == 3, fact.prompt


@pytest.mark.parametrize(("expressed", "need"), [(24, 13), (25, 13), (26, 14), (21, 11), (2, 2)])
def test_absolute_majority_is_more_than_half(expressed, need):
    assert emc.majority(expressed) == need
    assert need > expressed / 2 and need - 1 <= expressed / 2


def test_elections_are_counted_right():
    kinds = set()
    for item in _items("6e.emc.election"):
        meta = item.meta
        kinds.add((meta["kind"], meta.get("answer") == emc.NOBODY))
        if item.type == "numeric":
            assert int(item.answer.value) == emc.majority(meta["expressed"]), item.id
            assert answers.check(item.answer.model_dump(), item.answer.value)
            continue
        votes, names = meta["votes"], meta["names"]
        assert votes == sorted(votes, reverse=True) and len(set(votes)) == 3
        right = item.choices[item.answer.index]
        if meta["kind"] == "premier_tour":
            elected = votes[0] >= emc.majority(sum(votes))
            assert right == (names[0] if elected else emc.NOBODY), item.id
            assert item.choices[-1] == emc.NOBODY
        else:
            assert right == names[0], item.id
        assert sum(votes) <= 36, "une classe, pas un stade"
    # Toutes les situations se présentent : majorité, blancs, élu ou non au 1er tour, 2d tour.
    assert {("majorite", False), ("blancs", False), ("premier_tour", True),
            ("premier_tour", False), ("second_tour", False)} <= kinds


def test_orders_have_a_single_answer():
    ranks = [r for r, _a, _w in emc.ECHELONS]
    assert ranks == sorted(ranks) and len(set(ranks)) == len(ranks)
    for item in _items("6e.emc.echelons"):
        assert item.meta["ranks"] == sorted(item.meta["ranks"])
        assert len(set(item.choices)) == len(item.choices)
        assert [item.choices[i] for i in item.answer.value] != item.choices, "présenté mélangé"
    years = [y for y, _l in emc.EVENTS]
    assert years == sorted(years) and len(set(years)) == len(years)
    for item in _items("6e.emc.frise"):
        assert item.meta["years"] == sorted(item.meta["years"])


@pytest.mark.parametrize("code", CODES)
def test_items_are_valid_and_read_aloud(code):
    for item in _items(code, 20):
        if item.type == "mcq":
            assert len(item.choices) == len(set(item.choices)) >= 2, item.id
        said = session_pack.item_data(item, "chapitre", {})["speech"]
        for text in [said["prompt"], said.get("explanation", ""), *said.get("choices", [])]:
            assert "Ve République" not in text and "3018" not in text, text
            assert "−" not in text, text
