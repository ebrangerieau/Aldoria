"""Anglais de seconde : exemples relus, lexique des axes, verbes irréguliers, phrases et frise."""

import json
from pathlib import Path

import pytest

from app.engine import answers, session_pack
from app.engine.generators import REGISTRY
from app.engine.generators import anglais_2nde as en

CODES = sorted(code for code in REGISTRY if code.startswith("2nde.anglais."))


def _items(code: str, seeds: int = 60):
    for difficulty in range(1, 6):
        for seed in range(seeds):
            yield REGISTRY[code].item(difficulty, seed)


def test_every_notion_of_the_programme_has_a_generator():
    root = Path(__file__).resolve().parents[2]
    seed = json.loads((root / "content/seed/2nde/anglais.json").read_text("utf-8"))
    programme = {n["code"] for c in seed["chapters"] for n in c["notions"]}
    assert {REGISTRY[code].notion for code in CODES} == programme


@pytest.mark.parametrize("notion", en.NOTIONS, ids=lambda n: n.code)
def test_facts_are_consistent(notion):
    assert {f.level for f in notion.facts} >= {1, 2, 3}, notion.code
    for fact in notion.facts:
        assert fact.answer not in fact.wrong, fact.prompt
        assert len(set(fact.wrong)) == len(fact.wrong) >= 3, fact.prompt
        assert fact.explanation and fact.prompt.strip()
        # L'anglais cité dans l'énoncé est entre “ ” (lu par la voix anglaise).
        assert '"' not in fact.prompt, fact.prompt


@pytest.mark.parametrize("code", CODES)
def test_items_have_a_single_right_answer(code):
    for item in _items(code):
        if item.type == "mcq":
            assert len(item.choices) == len(set(item.choices)) >= 3, item.id
        elif item.type == "text":
            assert answers.check(item.answer.model_dump(), item.answer.value[0]), item.id
        else:
            assert item.type == "order", item.id
            assert answers.check(item.answer.model_dump(), item.answer.value), item.id


def test_english_choices_are_read_in_english():
    for item in _items("2nde.anglais.verbe.present_perfect", 20):
        if item.type == "mcq":
            assert item.choices_lang == "en-GB"
    french = REGISTRY["2nde.anglais.modalite.obligation"]
    item = next(
        i for s in range(200) if "needn't" in (i := french.item(2, s)).prompt and i.type == "mcq"
    )
    assert not item.choices_lang, "propositions en français : voix française"
    assert not REGISTRY["2nde.anglais.culture.commonwealth"].item(1, 0).choices_lang


def test_irregular_verbs():
    every = [v for tier in en.IRREGULAR.values() for v in tier]
    assert len({v[0] for v in every}) == len(every), "verbe en double"
    for item in _items("2nde.anglais.irreguliers"):
        m = item.meta
        right = m["preterit"] if m["form"] == "preterit" else m["participle"]
        if item.type == "mcq":
            assert item.choices[item.answer.index] == right
            assert en.regularized(m["base"]) != right
        else:
            assert answers.check(item.answer.model_dump(), right.upper())


@pytest.mark.parametrize(
    ("base", "wrong"), [("buy", "buyed"), ("write", "writed"), ("cry", "cried")]
)
def test_regularized_form(base, wrong):
    assert en.regularized(base) == wrong


def test_broken_sentences_have_a_single_order():
    for words, french in en.SENTENCES:
        assert len(set(words)) == len(words), words
        assert words[0][0].isupper() and words[-1][-1] in ".?!", words
        assert french.strip()
    for difficulty, (low, high) in en.SENTENCE_LENGTHS.items():
        assert sum(low <= len(w) <= high for w, _f in en.SENTENCES) >= 3, difficulty
    for item in _items("2nde.anglais.phrases"):
        restored = " ".join(item.choices[i] for i in item.answer.value)
        assert restored == item.meta["sentence"]
        assert item.choices != item.meta["sentence"].split(" "), "présenté mélangé"


def test_commonwealth_timeline_has_a_single_order():
    years = [y for y, _l in en.EVENTS]
    assert years == sorted(years) and len(set(years)) == len(years)
    for item in _items("2nde.anglais.frise"):
        ordered = [item.choices[i] for i in item.answer.value]
        expected = [label for _y, label in sorted(e for e in en.EVENTS if e[1] in ordered)]
        assert ordered == expected, item.id
        assert item.choices != ordered, "présenté mélangé"


def test_vocabulary_themes_are_unambiguous():
    for theme, (_title, words) in en.LEXIQUE.items():
        assert len(words) >= 12, theme
        assert len({w[0] for w in words}) == len(words), theme
        assert len({w[1] for w in words}) == len(words), theme


@pytest.mark.parametrize("code", CODES)
def test_english_is_read_by_the_english_voice(code):
    for item in _items(code, 10):
        said = session_pack.item_data(item, "chapitre", {})["speech"]
        if "“" in item.prompt:
            assert any(lang == "en-GB" for _text, lang in said["prompt_parts"]), item.id
