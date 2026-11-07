"""SES de seconde : exemples relus, calculs justes (valeur ajoutée, taux, moyenne, médiane,
équilibre, chômage), classements à une seule réponse, lecture à voix haute."""

import json
from pathlib import Path

import pytest

from app.engine import answers, session_pack
from app.engine.generators import REGISTRY
from app.engine.generators import ses_2nde as ses

CODES = sorted(code for code in REGISTRY if code.startswith("2nde.ses."))


def _items(code: str, seeds: int = 60):
    for difficulty in range(1, 6):
        for seed in range(seeds):
            yield REGISTRY[code].item(difficulty, seed)


def test_every_notion_of_the_programme_has_a_generator():
    root = Path(__file__).resolve().parents[2]
    seed = json.loads((root / "content/seed/2nde/ses.json").read_text("utf-8"))
    programme = {n["code"] for c in seed["chapters"] for n in c["notions"]}
    assert {REGISTRY[code].notion for code in CODES} == programme


@pytest.mark.parametrize("notion", ses.NOTIONS, ids=lambda n: n.code)
def test_facts_are_consistent(notion):
    assert {f.level for f in notion.facts} == {1, 2, 3}, notion.code
    for fact in notion.facts:
        assert len(fact.wrong) == 3 and fact.answer not in fact.wrong, fact.prompt
        assert len(set(fact.wrong)) == 3, fact.prompt


def test_added_value_and_gdp():
    for item in _items("2nde.ses.valeur_ajoutee"):
        meta = item.meta
        if meta["kind"] == "va":
            assert meta["answer"] == meta["sales"] - meta["inputs"] > 0
        elif meta["kind"] == "ci":
            assert meta["answer"] == meta["sales"] - meta["va"] > 0
        else:
            assert meta["answer"] == sum(s - i for s, i in meta["firms"])
        assert float(item.answer.value) == meta["answer"]


def test_rates_means_and_medians():
    for item in _items("2nde.ses.taux"):
        assert float(item.answer.value) == item.meta["answer"]
        assert answers.check(item.answer.model_dump(), item.answer.value.replace(".", ","))
    for item in _items("2nde.ses.moyenne_mediane"):
        wages = item.meta["wages"]
        if item.meta["kind"] == "moyen":
            assert float(item.answer.value) == sum(wages) / len(wages)
        else:
            low = sum(w < float(item.answer.value) for w in wages)
            high = sum(w > float(item.answer.value) for w in wages)
            assert low == high, item.id
        assert f"salaire {item.meta['kind']}," in item.prompt


def test_market_equilibrium():
    for item in _items("2nde.ses.equilibre"):
        meta = item.meta
        eq = meta["eq"]
        assert meta["demand"][eq] == meta["supply"][eq] and 0 < eq < 4
        assert min(meta["demand"] + meta["supply"]) > 0
        if item.type == "mcq":
            assert item.choices[item.answer.index] == f"{meta['prices'][eq]} €"
        else:
            k = meta["price"]
            assert float(item.answer.value) == abs(meta["supply"][k] - meta["demand"][k])


def test_unemployment_rates():
    for item in _items("2nde.ses.chomage"):
        meta = item.meta
        assert float(item.answer.value) == pytest.approx(
            meta["unemployed"] / meta["active"] * 100)
    for item in _items("2nde.ses.classement_chomage"):
        rates = item.meta["rates"]
        assert rates == sorted(rates) and len(set(rates)) == len(rates)
        assert item.meta["ranks"] == sorted(item.meta["ranks"]), "le diplôme protège, en moyenne"
        assert all("cap ou" not in c for c in item.choices), "CAP en capitales"
    for item in _items("2nde.ses.classement_va"):
        added = item.meta["added"]
        assert added == sorted(added) and len(set(added)) == len(added)
        assert [item.choices[i] for i in item.answer.value] != item.choices


@pytest.mark.parametrize("code", CODES)
def test_items_are_valid_and_read_aloud(code):
    for item in _items(code, 20):
        if item.type == "mcq":
            assert len(item.choices) == len(set(item.choices)) >= 2, item.id
        if item.type == "numeric":
            assert answers.check(item.answer.model_dump(), item.answer.value)
        said = session_pack.item_data(item, "chapitre", {})["speech"]
        for text in [said["prompt"], said.get("explanation", ""), *said.get("choices", [])]:
            assert "€" not in text and "PIB" not in text, text
