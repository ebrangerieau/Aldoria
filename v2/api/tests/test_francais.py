"""Français de seconde : générateurs à base d'exemples relus (engine/generators/francais_*)."""

import json
import re
import unicodedata
from pathlib import Path

import pytest

from app.engine import answers, session_pack
from app.engine.generators import REGISTRY
from app.engine.generators import francais_2nde_langue as langue
from app.engine.generators import francais_2nde_litterature as litterature

FRENCH = sorted(code for code in REGISTRY if code.startswith("2nde.francais."))
NOTIONS = langue.NOTIONS + litterature.NOTIONS


def _items(code: str, seeds: int = 60):
    for difficulty in range(1, 6):
        for seed in range(seeds):
            yield REGISTRY[code].item(difficulty, seed)


def test_every_notion_of_the_programme_has_a_generator():
    seed = json.loads(
        (Path(__file__).resolve().parents[2] / "content/seed/2nde/francais.json").read_text("utf-8")
    )
    programme = {n["code"] for c in seed["chapters"] for n in c["notions"]}
    covered = {REGISTRY[code].notion for code in FRENCH}
    assert covered == programme


@pytest.mark.parametrize("notion", NOTIONS, ids=lambda n: n.code)
def test_facts_are_consistent(notion):
    assert {f.level for f in notion.facts} >= {1, 2, 3} or len(notion.facts) >= 6, notion.code
    for fact in notion.facts:
        assert fact.answer not in fact.wrong, fact.prompt
        # Sans intrus propres, la réponse fait partie du vocabulaire de la notion.
        if not fact.wrong:
            assert fact.answer in notion.pool, fact.prompt
        assert fact.explanation and fact.prompt.strip()


@pytest.mark.parametrize("code", FRENCH)
def test_items_have_a_single_right_answer(code):
    for item in _items(code):
        if item.type == "mcq":
            assert len(item.choices) >= 2 and len(item.choices) == len(set(item.choices)), item.id
            assert item.choices[item.answer.index] == item.meta.get(
                "answer", item.choices[item.answer.index]
            )
        elif item.type == "text":
            assert answers.check(item.answer.model_dump(), item.meta["answer"]), item.id
            # Sans accents ni majuscule : toujours juste (accents non comptés).
            plain = (
                unicodedata.normalize("NFD", item.meta["answer"])
                .encode("ascii", "ignore")
                .decode()
                .upper()
            )
            assert answers.check(item.answer.model_dump(), plain), item.id
        assert item.type in {"mcq", "text", "order"}, item.id


def test_difficulty_five_asks_to_write_the_term():
    item = REGISTRY["2nde.francais.figures.analogie"].item(5, 1)
    assert item.type == "text" and "Écris ta réponse" in item.prompt
    assert answers.check(item.answer.model_dump(), "une " + item.meta["answer"])


def test_rhyme_schemes_are_right():
    families = {w: i for i, family in enumerate(litterature.RHYMES) for w in family}
    for item in _items("2nde.francais.rimes"):
        ends, scheme = item.meta["ends"], item.meta["scheme"]
        letters = {}
        for word, letter in zip(ends, scheme, strict=True):
            letters.setdefault(letter, families[word])
            assert families[word] == letters[letter], item.id
        assert letters["A"] != letters["B"]
        assert len(set(ends)) == 4, "quatre mots différents"
        assert scheme in item.choices[item.answer.index]


def test_rhyme_families_never_rhyme_together():
    # Deux familles ne partagent jamais leurs trois dernières lettres (pas de rime cachée).
    endings = [{w[-3:] for w in family} for family in litterature.RHYMES]
    for i, a in enumerate(endings):
        for b in endings[i + 1 :]:
            assert not a & b


def test_broken_verses_have_a_single_order():
    for words, _source in litterature.VERSES:
        assert len(set(words)) == len(words), words
    for item in _items("2nde.francais.vers"):
        restored = " ".join(item.choices[i] for i in item.answer.value)
        assert restored == item.meta["verse"]
        assert item.choices != item.meta["verse"].split(" "), "présenté mélangé"
        assert answers.check(item.answer.model_dump(), item.answer.value)


def test_verses_get_longer_with_difficulty():
    def length(d):
        return max(len(REGISTRY["2nde.francais.vers"].item(d, s).choices) for s in range(40))

    assert length(1) <= length(3) <= length(5)


@pytest.mark.parametrize("code", FRENCH)
def test_french_is_read_as_written(code):
    """La lecture à voix haute ne transforme pas le français en unités, formules ou symboles."""
    units = re.compile(r"mètres|grammes|litres|heures? |puissance|parenthèse|l'ensemble")
    for item in _items(code, 20):
        said = session_pack.item_data(item, "chapitre", {})["speech"]
        for text in [said["prompt"], said.get("explanation", ""), *said.get("choices", [])]:
            shown = item.prompt + item.explanation + " ".join(item.choices or [])
            for found in units.findall(text):
                assert found in shown, (code, text)
