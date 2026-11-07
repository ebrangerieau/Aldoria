"""SVT de seconde : exemples relus, calculs justes (microscope, ADN, populations, élevage),
énigmes à une seule réponse, lecture à voix haute."""

import json
from pathlib import Path

import pytest

from app.engine import answers, session_pack, speech
from app.engine.generators import REGISTRY
from app.engine.generators import svt_2nde as svt
from app.engine.generators import svt_2nde_calculs as calc

CODES = sorted(code for code in REGISTRY if code.startswith("2nde.svt."))


def _items(code: str, seeds: int = 60):
    for difficulty in range(1, 6):
        for seed in range(seeds):
            yield REGISTRY[code].item(difficulty, seed)


def test_every_notion_of_the_programme_has_a_generator():
    root = Path(__file__).resolve().parents[2]
    seed = json.loads((root / "content/seed/2nde/svt.json").read_text("utf-8"))
    programme = {n["code"] for c in seed["chapters"] for n in c["notions"]}
    assert {REGISTRY[code].notion for code in CODES} == programme


@pytest.mark.parametrize("notion", svt.NOTIONS, ids=lambda n: n.code)
def test_facts_are_consistent(notion):
    assert {f.level for f in notion.facts} == {1, 2, 3}, notion.code
    for fact in notion.facts:
        assert len(fact.wrong) == 3 and fact.answer not in fact.wrong, fact.prompt
        assert len(set(fact.wrong)) == 3, fact.prompt


def test_microscope_sizes():
    for item in _items("2nde.svt.microscope"):
        meta = item.meta
        if meta["kind"] == "taille":
            assert meta["image_mm"] * 1000 / meta["g"] == pytest.approx(meta["real"]), item.id
            assert float(item.answer.value) == meta["real"]
            names = [name for name, sizes in calc.CELLS if meta["real"] in sizes]
            assert any(name in item.prompt for name in names), "taille plausible pour la cellule"
        assert answers.check(item.answer.model_dump(), item.answer.value)


@pytest.mark.parametrize(("strand", "other"), [("ATGC", "TACG"), ("GGCCAT", "CCGGTA")])
def test_complementary_strand(strand, other):
    assert calc.complement(strand) == other
    assert calc.complement(other) == strand


def test_complementary_items_have_one_right_answer():
    for item in _items("2nde.svt.complementaire"):
        right = calc.complement(item.meta["strand"])
        if item.type == "mcq":
            assert item.choices[item.answer.index] == right
            assert len(set(item.choices)) == len(item.choices)
        else:
            assert item.answer.value == [right]
            assert answers.check(item.answer.model_dump(), right.lower())


def test_population_counts():
    for item in _items("2nde.svt.capture"):
        meta = item.meta
        assert meta["marked"] * meta["second"] / meta["recaptured"] == meta["total"]
        assert meta["recaptured"] < meta["second"] <= meta["total"]
    for item in _items("2nde.svt.frequences"):
        homo, hetero, rest = item.meta["genotypes"]
        size = item.meta["size"]
        assert homo + hetero + rest == size
        mine = homo if item.meta["asked"] == item.meta["big"] else rest
        assert float(item.answer.value) == pytest.approx((2 * mine + hetero) / (2 * size))
        assert len(item.answer.value.split(".")[-1]) <= 2, "deux décimales au plus"


def test_livestock_yield():
    for item in _items("2nde.svt.rendement"):
        meta = item.meta
        assert meta["meat"] * 100 % meta["percent"] == 0
        assert float(item.answer.value) == meta["answer"]


def test_orders_have_a_single_answer():
    sizes = [v for _n, _s, v in calc.SIZES]
    assert len(set(sizes)) == len(sizes)
    for code in ("2nde.svt.tailles", "2nde.svt.sediments"):
        for item in _items(code):
            values = item.meta.get("ranks") or item.meta["sizes"]
            assert values == sorted(values) and len(set(values)) == len(values), item.id
            assert [item.choices[i] for i in item.answer.value] != item.choices


@pytest.mark.parametrize("code", CODES)
def test_items_are_valid_and_read_aloud(code):
    for item in _items(code, 20):
        if item.type == "mcq":
            assert len(item.choices) == len(set(item.choices)) >= 2, item.id
        if item.type == "numeric":
            assert answers.check(item.answer.model_dump(), item.answer.value)
        data = session_pack.item_data(item, "chapitre", {})
        assert speech.foreign_lang(data) == ""
        said = data["speech"]
        for text in [said["prompt"], said.get("explanation", ""), *said.get("choices", [])]:
            assert "µm" not in text and "×" not in text, text
            assert "génotype B" not in text, text  # « grand B », « petit b »
