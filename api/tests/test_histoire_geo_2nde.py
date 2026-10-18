"""Histoire-géographie de seconde : exemples relus, siècles, frise, IDH."""

import json
import re
from pathlib import Path

import pytest

from app.engine import session_pack
from app.engine.generators import REGISTRY
from app.engine.generators import histoire_geo_2nde as hg

CODES = sorted(code for code in REGISTRY if code.startswith("2nde.histoire_geo."))


def _items(code: str, seeds: int = 60):
    for difficulty in range(1, 6):
        for seed in range(seeds):
            yield REGISTRY[code].item(difficulty, seed)


def test_every_notion_of_the_programme_has_a_generator():
    root = Path(__file__).resolve().parents[2]
    seed = json.loads((root / "content/seed/2nde/histoire_geo.json").read_text("utf-8"))
    programme = {n["code"] for c in seed["chapters"] for n in c["notions"]}
    assert {REGISTRY[code].notion for code in CODES} == programme


@pytest.mark.parametrize("notion", hg.NOTIONS, ids=lambda n: n.code)
def test_facts_are_consistent(notion):
    assert {f.level for f in notion.facts} == {1, 2, 3}, notion.code
    for fact in notion.facts:
        assert len(fact.wrong) == 3 and fact.answer not in fact.wrong, fact.prompt
        assert len(set(fact.wrong)) == 3, fact.prompt
        assert fact.explanation and fact.prompt.strip()


def test_programme_landmarks_are_asked():
    """Les points de passage et d'ouverture du programme ont leur question."""
    text = " ".join(f.prompt + f.answer + f.explanation for n in hg.NOTIONS for f in n.facts)
    for landmark in (
        "Périclès", "Auguste", "Constantin", "Bernard de Clairvaux", "Venise", "Las Casas",
        "Michel-Ange", "Érasme", "Luther", "Villers-Cotterêts", "Colbert", "Versailles",
        "édit de Nantes", "Habeas Corpus", "Bill of Rights", "Voltaire", "Washington", "Galilée",
        "Newcomen", "Émilie du Châtelet", "Va-nu-pieds", "salon", "Nantes et Bordeaux",
    ):
        assert landmark in text, landmark


def test_century_items_stay_in_the_programme_period():
    for item in _items("2nde.histoire_geo.siecles"):
        m = item.meta
        assert item.choices[item.answer.index] == hg.century_label(m["century"], m["before"])
        assert len(set(item.choices)) == len(item.choices) >= 3
        assert -800 <= m["year"] <= 1800 and m["year"] != 0


def test_timeline_has_a_single_order():
    years = [y for y, _l, _d in hg.EVENTS]
    assert years == sorted(years) and len(set(years)) == len(years)
    for item in _items("2nde.histoire_geo.frise"):
        ordered = [item.choices[i] for i in item.answer.value]
        expected = [label for _y, label, _d in sorted(e for e in hg.EVENTS if e[1] in ordered)]
        assert ordered == expected, item.id
        assert item.choices != ordered, "présenté mélangé"


def test_hdi_ranking_follows_the_undp_order():
    for item in _items("2nde.histoire_geo.idh"):
        ordered = [item.choices[i] for i in item.answer.value]
        assert ordered == [c for c in hg.HDI_ORDER if c in ordered], item.id
        if item.difficulty <= 3:
            ranks = item.meta["ranks"]
            assert all(b - a >= 2 for a, b in zip(ranks, ranks[1:], strict=False))


@pytest.mark.parametrize("code", CODES)
def test_items_are_valid_and_read_aloud(code):
    for item in _items(code, 20):
        if item.type == "mcq":
            assert len(item.choices) == len(set(item.choices)) >= 2, item.id
        said = session_pack.item_data(item, "chapitre", {})["speech"]
        for text in [said["prompt"], said.get("explanation", ""), *said.get("choices", [])]:
            assert "J.-C." not in text, text  # lu « avant Jésus-Christ »
            assert not re.search(r"[IVXL]+(?:er|e) siècle", text), text  # lu en toutes lettres
