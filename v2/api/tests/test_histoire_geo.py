"""Histoire-géographie de 6e : siècles, frise, population, exemples relus."""

import json
import re
from pathlib import Path

import pytest

from app.engine import answers, session_pack
from app.engine.generators import REGISTRY
from app.engine.generators import histoire_geo_6e as hg

CODES = sorted(code for code in REGISTRY if code.startswith("6e.histoire_geo."))


def _items(code: str, seeds: int = 60):
    for difficulty in range(1, 6):
        for seed in range(seeds):
            yield REGISTRY[code].item(difficulty, seed)


def test_every_notion_of_the_programme_has_a_generator():
    root = Path(__file__).resolve().parents[2]
    seed = json.loads((root / "content/seed/6e/histoire_geo.json").read_text("utf-8"))
    programme = {n["code"] for c in seed["chapters"] for n in c["notions"]}
    assert {REGISTRY[code].notion for code in CODES} == programme


@pytest.mark.parametrize(
    ("year", "label"),
    [
        (1, "Ier siècle"),
        (100, "Ier siècle"),
        (101, "IIe siècle"),
        (476, "Ve siècle"),
        (2026, "XXIe siècle"),
        (-1, "Ier siècle av. J.-C."),
        (-52, "Ier siècle av. J.-C."),
        (-100, "Ier siècle av. J.-C."),
        (-101, "IIe siècle av. J.-C."),
        (-753, "VIIIe siècle av. J.-C."),
        (-3300, "XXXIIIe siècle av. J.-C."),
    ],
)
def test_century_of_a_year(year, label):
    assert hg.century_label(*hg.century(year)) == label


def test_century_items():
    for item in _items("6e.histoire_geo.siecles"):
        m = item.meta
        assert item.choices[item.answer.index] == hg.century_label(m["century"], m["before"])
        assert len(set(item.choices)) == len(item.choices) >= 3
        assert m["year"] != 0 and m["year"] <= 2026


def test_timeline_has_a_single_order():
    years = [y for y, _l, _d in hg.EVENTS]
    assert years == sorted(years) and len(set(years)) == len(years)
    for item in _items("6e.histoire_geo.frise"):
        ordered = [item.choices[i] for i in item.answer.value]
        expected = [label for _y, label, _d in sorted(e for e in hg.EVENTS if e[1] in ordered)]
        assert ordered == expected, item.id
        assert item.choices != ordered, "présenté mélangé"
        assert answers.check(item.answer.model_dump(), item.answer.value)


def test_population_order_and_clear_gaps_when_easy():
    for item in _items("6e.histoire_geo.population"):
        millions = item.meta["millions"]
        assert millions == sorted(millions, reverse=True)
        if item.difficulty <= 3:
            assert all(a / b >= 1.15 for a, b in zip(millions, millions[1:], strict=False))


@pytest.mark.parametrize("code", CODES)
def test_items_are_valid_and_read_aloud(code):
    for item in _items(code, 20):
        if item.type == "mcq":
            assert len(item.choices) == len(set(item.choices)) >= 2, item.id
        if item.type == "text":
            assert answers.check(item.answer.model_dump(), item.meta["answer"]), item.id
        said = session_pack.item_data(item, "chapitre", {})["speech"]
        for text in [said["prompt"], said.get("explanation", ""), *said.get("choices", [])]:
            assert "J.-C." not in text, text  # lu « avant Jésus-Christ »
            assert not re.search(r"[IVXL]+(?:er|e) siècle", text), text  # lu en toutes lettres


def test_written_answers_accept_the_bare_term():
    for item in _items("6e.histoire_geo.faible_densite.agricole"):
        if item.type == "text":
            bare = re.sub(r"^(?:le |la |les |l'|un |une |des )", "", item.meta["answer"])
            assert answers.check(item.answer.model_dump(), bare), item.id
