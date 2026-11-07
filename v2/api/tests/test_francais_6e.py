"""Français de 6e : exemples relus, conjugaison calculée, énigmes (generators/francais_6e_*)."""

import json
import unicodedata
from pathlib import Path

import pytest

from app.engine import answers
from app.engine.generators import REGISTRY
from app.engine.generators import francais_6e_conjugaison as conj
from app.engine.generators import francais_6e_langue as langue
from app.engine.generators import francais_6e_lectures as lectures

FRENCH = sorted(code for code in REGISTRY if code.startswith("6e.francais."))
NOTIONS = langue.NOTIONS + lectures.NOTIONS


def _items(code: str, seeds: int = 60):
    for difficulty in range(1, 6):
        for seed in range(seeds):
            yield REGISTRY[code].item(difficulty, seed)


def test_every_notion_of_the_programme_has_a_generator():
    seed = json.loads(
        (Path(__file__).resolve().parents[2] / "content/seed/6e/francais.json").read_text("utf-8")
    )
    programme = {n["code"] for c in seed["chapters"] for n in c["notions"]}
    covered = {REGISTRY[code].notion for code in FRENCH}
    assert covered == programme


@pytest.mark.parametrize("notion", NOTIONS, ids=lambda n: n.code)
def test_facts_are_consistent(notion):
    assert {f.level for f in notion.facts} >= {1, 2, 3}, notion.code
    for fact in notion.facts:
        assert fact.answer not in fact.wrong, fact.prompt
        assert len(set(fact.wrong)) == len(fact.wrong), fact.prompt
        if not fact.wrong:
            assert fact.answer in notion.pool, fact.prompt
        assert fact.explanation and fact.prompt.strip()


@pytest.mark.parametrize("code", FRENCH)
def test_items_have_a_single_right_answer(code):
    for item in _items(code):
        assert item.type in {"mcq", "text", "order"}, item.id
        if item.type == "mcq":
            assert len(item.choices) >= 2 and len(item.choices) == len(set(item.choices)), item.id
        elif item.type == "text":
            meta_answer = item.meta.get("answer") or item.answer.value[0]
            assert answers.check(item.answer.model_dump(), meta_answer), item.id


@pytest.mark.parametrize(
    ("verb", "tense", "person", "shown", "expected"),
    [
        ("prendre", conj.PASSE_SIMPLE, 5, "ils", "prirent"),
        ("manger", conj.PRESENT, 3, "nous", "mangeons"),
        ("manger", conj.PASSE_SIMPLE, 3, "nous", "mangeâmes"),
        ("nager", conj.IMPARFAIT, 0, "je", "nageais"),
        ("nager", conj.IMPARFAIT, 3, "nous", "nagions"),
        ("commencer", conj.PASSE_SIMPLE, 2, "il", "commença"),
        ("commencer", conj.IMPARFAIT, 3, "nous", "commencions"),
        ("lancer", conj.PASSE_SIMPLE, 5, "ils", "lancèrent"),
        ("finir", conj.PRESENT, 3, "nous", "finissons"),
        ("finir", conj.PASSE_SIMPLE, 5, "ils", "finirent"),
        ("aller", conj.FUTUR, 0, "je", "irai"),
        ("voir", conj.IMPARFAIT, 3, "nous", "voyions"),
        ("être", conj.CONDITIONNEL, 4, "vous", "seriez"),
        ("vouloir", conj.CONDITIONNEL, 0, "je", "voudrais"),
        ("venir", conj.FUTUR, 5, "ils", "viendront"),
        ("faire", conj.PRESENT, 4, "vous", "faites"),
        ("dire", conj.PRESENT, 4, "vous", "dites"),
        ("chanter", conj.IMPERATIF, 1, "tu", "chante"),
        ("finir", conj.IMPERATIF, 3, "nous", "finissons"),
        ("avoir", conj.IMPERATIF, 1, "tu", "aie"),
        ("être", conj.IMPERATIF, 4, "vous", "soyez"),
        ("venir", conj.PASSE_COMPOSE, 2, "elle", "est venue"),
        ("aller", conj.PLUS_QUE_PARFAIT, 5, "elles", "étaient allées"),
        ("prendre", conj.PASSE_COMPOSE, 0, "je", "ai pris"),
        ("réussir", conj.PLUS_QUE_PARFAIT, 3, "nous", "avions réussi"),
    ],
)
def test_conjugated_forms(verb, tense, person, shown, expected):
    assert conj.form(verb, tense, person, shown) == expected


def test_forms_that_do_not_exist_are_never_asked():
    assert conj.form("pouvoir", conj.IMPERATIF, 1, "tu") is None
    assert conj.form("venir", conj.PASSE_COMPOSE, 0, "je") is None  # genre invisible
    assert conj.with_pronoun("ai", 0, "je", conj.PRESENT) == "j'ai"
    assert conj.with_pronoun("obéis", 0, "je", conj.PRESENT) == "j'obéis"
    assert conj.with_pronoun("prenez", 4, "vous", conj.IMPERATIF) == "Prenez !"


def test_conjugation_choices_are_other_tenses_of_the_same_person():
    for item in _items("6e.francais.conjugaison.formes", 40):
        if item.type == "text":
            assert answers.check(item.answer.model_dump(), item.answer.value[0])
            continue
        right = item.choices[item.answer.index]
        assert right in item.explanation, item.id


def test_tense_recognition_is_never_ambiguous():
    for item in _items("6e.francais.conjugaison.reconnaitre", 60):
        displayed = conj._all_displayed(item.meta["verb"])
        assert displayed[item.meta["form"]] == {item.meta["tense"]}, item.id
        assert item.choices[item.answer.index] == item.meta["tense"]


def test_written_conjugation_accepts_with_or_without_pronoun():
    item = next(i for i in _items("6e.francais.conjugaison.formes") if i.type == "text")
    full = item.answer.value[0]
    assert answers.check(item.answer.model_dump(), full)
    plain = unicodedata.normalize("NFC", full).upper()
    assert answers.check(item.answer.model_dump(), plain)


def test_fable_verses_have_a_single_order():
    for words, _fable in lectures.FABLE_VERSES:
        assert len(set(words)) == len(words), words
    for item in _items("6e.francais.fables"):
        restored = " ".join(item.choices[i] for i in item.answer.value)
        assert restored == item.meta["verse"]
        assert item.choices != item.meta["verse"].split(" "), "présenté mélangé"


def test_tale_steps_come_back_in_order():
    steps = {title: s for title, s in lectures.TALES}
    for item in _items("6e.francais.conte"):
        restored = [item.choices[i] for i in item.answer.value]
        full = steps[item.meta["tale"]]
        assert restored == [s for s in full if s in restored], item.id
        assert item.choices != restored, "présenté mélangé"
