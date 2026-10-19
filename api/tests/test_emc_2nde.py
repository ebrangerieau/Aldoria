"""EMC de seconde : exemples relus, pyramide des normes, ordre des recours, frise des libertés."""

import json
from pathlib import Path

import pytest

from app.engine import session_pack
from app.engine.generators import REGISTRY
from app.engine.generators import emc_2nde as emc

CODES = sorted(code for code in REGISTRY if code.startswith("2nde.emc."))


def _items(code: str, seeds: int = 60):
    for difficulty in range(1, 6):
        for seed in range(seeds):
            yield REGISTRY[code].item(difficulty, seed)


def test_every_notion_of_the_programme_has_a_generator():
    root = Path(__file__).resolve().parents[2]
    seed = json.loads((root / "content/seed/2nde/emc.json").read_text("utf-8"))
    programme = {n["code"] for c in seed["chapters"] for n in c["notions"]}
    assert {REGISTRY[code].notion for code in CODES} == programme


@pytest.mark.parametrize("notion", emc.NOTIONS, ids=lambda n: n.code)
def test_facts_are_consistent(notion):
    assert {f.level for f in notion.facts} == {1, 2, 3}, notion.code
    for fact in notion.facts:
        assert len(fact.wrong) == 3 and fact.answer not in fact.wrong, fact.prompt
        assert len(set(fact.wrong)) == 3, fact.prompt


def test_orders_have_a_single_answer():
    kinds = set()
    for item in _items("2nde.emc.normes"):
        kinds.add(item.meta["kind"])
        source = emc.NORMS if item.meta["kind"] == "normes" else emc.APPEALS
        ordered = [item.choices[i] for i in item.answer.value]
        assert ordered == [source[r] for r in item.meta["ranks"]], item.id
        assert ordered != item.choices, "présenté mélangé"
    assert kinds == {"normes", "recours"}
    assert emc.NORMS[0] == "la Constitution"
    years = [y for y, _l in emc.EVENTS]
    assert years == sorted(years) and len(set(years)) == len(years)
    for item in _items("2nde.emc.frise"):
        assert item.meta["years"] == sorted(item.meta["years"])


@pytest.mark.parametrize("code", CODES)
def test_items_are_valid_and_read_aloud(code):
    for item in _items(code, 20):
        if item.type == "mcq":
            assert len(item.choices) == len(set(item.choices)) >= 2, item.id
        said = session_pack.item_data(item, "chapitre", {})["speech"]
        for text in [said["prompt"], said.get("explanation", ""), *said.get("choices", [])]:
            assert "Ve République" not in text, text
            for acronym in ("CEDH", "DDHC", "IVG", "PMA", "DSA"):
                assert acronym not in text, text
