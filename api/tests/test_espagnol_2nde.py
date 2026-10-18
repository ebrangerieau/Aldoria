"""Espagnol de seconde (LVB) : exemples relus, conjugaisons justes, nombres, frise et phrases."""

import json
from pathlib import Path

import pytest

from app.engine import answers, session_pack, speech
from app.engine.generators import REGISTRY
from app.engine.generators import espagnol_2nde as es
from app.engine.generators import espagnol_2nde_calculs as calc

CODES = sorted(code for code in REGISTRY if code.startswith("2nde.espagnol."))


def _items(code: str, seeds: int = 60):
    for difficulty in range(1, 6):
        for seed in range(seeds):
            yield REGISTRY[code].item(difficulty, seed)


def test_every_notion_of_the_programme_has_a_generator():
    root = Path(__file__).resolve().parents[2]
    seed = json.loads((root / "content/seed/2nde/espagnol.json").read_text("utf-8"))
    programme = {n["code"] for c in seed["chapters"] for n in c["notions"]}
    assert {REGISTRY[code].notion for code in CODES} == programme


@pytest.mark.parametrize("notion", es.NOTIONS, ids=lambda n: n.code)
def test_facts_are_consistent(notion):
    assert {f.level for f in notion.facts} == {1, 2, 3}, notion.code
    for fact in notion.facts:
        assert len(fact.wrong) == 3 and fact.answer not in fact.wrong, fact.prompt
        assert len(set(fact.wrong)) == 3, fact.prompt


@pytest.mark.parametrize("code", CODES)
def test_items_are_valid_and_read_in_the_right_language(code):
    for item in _items(code, 20):
        if item.type == "mcq":
            assert len(item.choices) == len(set(item.choices)) >= 2, item.id
        if item.type in ("numeric", "text"):
            value = item.answer.value if item.type == "numeric" else item.answer.value[0]
            assert answers.check(item.answer.model_dump(), value), item.id
        data = session_pack.item_data(item, "chapitre", {})
        assert speech.foreign_lang(data) == "es-ES"
        if item.listen:
            assert item.listen.lang == "es-ES"


@pytest.mark.parametrize(
    ("verb", "tense", "forms"),
    [
        ("hablar", "présent", ["hablo", "hablas", "habla", "hablamos", "habláis", "hablan"]),
        ("comer", "imparfait", ["comía", "comías", "comía", "comíamos", "comíais", "comían"]),
        ("vivir", "passé simple", ["viví", "viviste", "vivió", "vivimos", "vivisteis", "vivieron"]),
        ("cantar", "passé simple",
         ["canté", "cantaste", "cantó", "cantamos", "cantasteis", "cantaron"]),
        ("trabajar", "futur",
         ["trabajaré", "trabajarás", "trabajará", "trabajaremos", "trabajaréis", "trabajarán"]),
        ("tener", "futur", ["tendré", "tendrás", "tendrá", "tendremos", "tendréis", "tendrán"]),
        ("hacer", "passé composé",
         ["he hecho", "has hecho", "ha hecho", "hemos hecho", "habéis hecho", "han hecho"]),
        ("comer", "passé composé", ["he comido", "has comido", "ha comido", "hemos comido",
                                    "habéis comido", "han comido"]),
        ("tener", "imparfait", ["tenía", "tenías", "tenía", "teníamos", "teníais", "tenían"]),
        ("ir", "imparfait", ["iba", "ibas", "iba", "íbamos", "ibais", "iban"]),
        ("salir", "passé simple", ["salí", "saliste", "salió", "salimos", "salisteis", "salieron"]),
    ],
)
def test_conjugations(verb, tense, forms):
    assert calc.conjugate(verb, tense) == forms


def test_conjugation_items_have_one_right_answer():
    for name in ("conjugaison_present", "conjugaison_passes", "conjugaison_futur"):
        for item in _items(f"2nde.espagnol.{name}"):
            meta = item.meta
            right = calc.conjugate(meta["verb"], meta["tense"])[meta["person"]]
            if item.type == "mcq":
                assert item.choices[item.answer.index] == right, item.id
            else:
                assert item.answer.value == [right] and item.answer.accents, item.id


@pytest.mark.parametrize(
    ("n", "words"),
    [
        (16, "dieciséis"), (21, "veintiuno"), (22, "veintidós"), (31, "treinta y uno"),
        (100, "cien"), (101, "ciento uno"), (500, "quinientos"),
        (777, "setecientos setenta y siete"),
        (1492, "mil cuatrocientos noventa y dos"), (1978, "mil novecientos setenta y ocho"),
        (2024, "dos mil veinticuatro"),
    ],
)
def test_numbers_in_words(n, words):
    assert calc.number_words(n) == words


def test_vocabulary_has_no_duplicates():
    for _title, words in calc.LEXIQUE.values():
        assert len({w[0] for w in words}) == len(words)
        assert len({w[1] for w in words}) == len(words)


def test_orders_have_a_single_answer():
    for spanish, _french in calc.SENTENCES:
        assert len(set(spanish)) == len(spanish), spanish
    years = [y for y, _l in calc.EVENTS]
    assert years == sorted(years) and len(set(years)) == len(years)
    for item in _items("2nde.espagnol.frise"):
        assert item.meta["years"] == sorted(item.meta["years"])
    for item in _items("2nde.espagnol.frase"):
        ordered = " ".join(item.choices[i] for i in item.answer.value)
        assert ordered == item.meta["sentence"], item.id
