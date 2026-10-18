"""Physique-chimie de seconde : exemples relus, calculs vérifiés, équations ajustées, énigmes."""

import json
import math
import re
from pathlib import Path

import pytest

from app.engine import answers, session_pack, speech
from app.engine.generators import REGISTRY
from app.engine.generators import physique_chimie_2nde as pc
from app.engine.generators import physique_chimie_2nde_calculs as calc

CODES = sorted(code for code in REGISTRY if code.startswith("2nde.physique_chimie."))


def _items(code: str, seeds: int = 60):
    for difficulty in range(1, 6):
        for seed in range(seeds):
            yield REGISTRY[code].item(difficulty, seed)


def test_every_notion_of_the_programme_has_a_generator():
    root = Path(__file__).resolve().parents[2]
    seed = json.loads((root / "content/seed/2nde/physique_chimie.json").read_text("utf-8"))
    programme = {n["code"] for c in seed["chapters"] for n in c["notions"]}
    assert {REGISTRY[code].notion for code in CODES} == programme


@pytest.mark.parametrize("notion", pc.NOTIONS, ids=lambda n: n.code)
def test_facts_are_consistent(notion):
    assert {f.level for f in notion.facts} == {1, 2, 3}, notion.code
    for fact in notion.facts:
        assert len(fact.wrong) == 3 and fact.answer not in fact.wrong, fact.prompt
        assert len(set(fact.wrong)) == 3, fact.prompt
        assert "°" not in fact.prompt + fact.answer, "degrés en toutes lettres"


@pytest.mark.parametrize("code", CODES)
def test_items_are_valid_and_read_aloud(code):
    for item in _items(code, 20):
        if item.type == "mcq":
            assert len(item.choices) == len(set(item.choices)) >= 2, item.id
        if item.type == "numeric":
            value = item.answer.value
            assert answers.check(item.answer.model_dump(), value), item.id
            assert answers.check(item.answer.model_dump(), value.replace(".", ",")), item.id
            tolerance = item.answer.tolerance + 1e-9
            assert float(value) == pytest.approx(item.meta["value"], abs=tolerance)
        said = session_pack.item_data(item, "chapitre", {})["speech"]
        for text in [said["prompt"], said.get("explanation", ""), *said.get("choices", [])]:
            assert "°" not in text, text
            # Unités, indices, charges et flèches lus en mots.
            assert not re.search(r"[₀-₉⁺⟶Ω]|\b(?:km/h|m/s|g/L|g/mL|N/kg|kJ/kg)\b", text), text


@pytest.mark.parametrize(
    ("shown", "spoken"),
    [
        ("CH₄ + 2 O₂ ⟶ CO₂ + 2 H₂O", "C H 4 + 2 O 2 donnent C O 2 + 2 H 2 O"),
        ("4 Al + 3 O₂ ⟶ 2 Al₂O₃", "4 A L + 3 O 2 donnent 2 A L 2 O 3"),
        ("l'ion calcium Ca²⁺", "l'ion calcium C A 2 plus"),
        ("1s² 2s² 2p⁴.", "1 s 2, 2 s 2, 2 p 4."),
        ("H₂O (s) ⟶ H₂O (l)", "H 2 O solide donnent H 2 O liquide"),
        ("n₁ × sin(i₁)", "n 1 fois sinus de (i 1)"),
        ("220 Ω, 25 mA, 4,5 V", "220 ohms, 25 milliampères, 4,5 volts"),
        ("9,8 N/kg ; 440 Hz", "9,8 newtons par kilogramme ; 440 hertz"),
        ("2,7 g/cm³", "2,7 grammes par centimètre cube"),
        ("Le Na et He", "Le Na et He"),  # hors formule : des mots
    ],
)
def test_chemistry_and_units_are_read_in_words(shown, spoken):
    assert speech.text(shown) == spoken


def test_reactions_are_balanced():
    for reactants, products, _level in calc.REACTIONS:
        assert calc.is_balanced(reactants, products), (reactants, products)
    assert not calc.is_balanced([(1, "H₂"), (1, "O₂")], [(1, "H₂O")])
    assert not calc.is_balanced([(1, "Zn"), (1, "H⁺")], [(1, "Zn²⁺"), (1, "H₂")])  # charges


def test_equation_items_have_one_balanced_answer():
    for item in _items(f"{calc.PREFIX}.equation"):
        if item.meta["kind"] == "ajustee":
            balanced = [c for c in item.choices if _balanced_text(c)]
            assert balanced == [item.choices[item.answer.index]], item.id
        else:
            line = item.prompt.split("\n")[1]
            assert _balanced_text(line.replace("…", item.answer.value)), item.id


def _balanced_text(equation: str) -> bool:
    def side(text: str) -> list[tuple[int, str]]:
        terms = []
        for term in text.split(" + "):
            parts = term.strip().split(" ")
            terms.append((int(parts[0]), parts[1]) if len(parts) == 2 else (1, parts[0]))
        return terms

    left, right = equation.split(" ⟶ ")
    return calc.is_balanced(side(left), side(right))


def test_limiting_reactant_is_the_smallest_ratio():
    for item in _items(f"{calc.PREFIX}.reactif_limitant"):
        x_a, x_b = item.meta["x_a"], item.meta["x_b"]
        if item.meta["kind"] == "limitant":
            right = item.choices[item.answer.index]
            if x_a == x_b:
                assert right == calc.STOICHIOMETRIC
            else:
                assert right != calc.STOICHIOMETRIC
        else:
            assert float(item.answer.value) >= 0


def test_electron_configurations():
    assert calc.config_text(11) == "1s² 2s² 2p⁶ 3s¹"
    assert calc.config_text(17) == "1s² 2s² 2p⁶ 3s² 3p⁵"
    assert [calc.valence(z) for z in (1, 2, 6, 10, 11, 17, 18)] == [1, 2, 4, 8, 1, 7, 8]
    for z, charge in calc.STABLE_CHARGE.items():
        # Après l'ion : la configuration d'un gaz noble (2 ou 10 ou 18 électrons, ou 0 pour H⁺).
        assert z - charge in (0, 2, 10, 18), z


@pytest.mark.parametrize(("z", "a", "neutrons"), [(6, 14, 8), (92, 238, 146), (17, 37, 20)])
def test_neutrons_are_a_minus_z(z, a, neutrons):
    assert (z, a) in {(n[2], n[3]) for n in calc.NUCLEI}
    assert a - z == neutrons


def test_snell_descartes_angles():
    for item in _items(f"{calc.PREFIX}.refraction"):
        if item.meta["kind"] in ("angle", "sortie"):
            assert abs(float(item.answer.value) - item.meta["exact"]) <= 0.5 + 1e-9, item.id


def test_orders_have_a_single_answer():
    for item in _items(f"{calc.PREFIX}.echelles"):
        sizes = item.meta["sizes"]
        assert sizes == sorted(sizes) and len(set(sizes)) == len(sizes)
        assert item.choices != [item.choices[i] for i in item.answer.value], "présenté mélangé"
    for item in _items(f"{calc.PREFIX}.sons"):
        freqs = item.meta["frequencies"]
        assert freqs == sorted(freqs) and len(set(freqs)) == len(freqs)
        for k, index in enumerate(item.answer.value):
            label = item.choices[index]
            if "période" in label:
                ms = float(label.split("période ")[1].split(" ms")[0].replace(",", "."))
                assert math.isclose(1000 / ms, freqs[k]), item.id
            else:
                assert int(label.split("fréquence ")[1].split(" Hz")[0]) == freqs[k], item.id


def test_scientific_notation():
    assert calc.sci(6.02e23) == "6,02 × 10²³"
    assert calc.sci(2.99e-26) == "2,99 × 10⁻²⁶"
    assert calc.sci(9.9996e5) == "1 × 10⁶"
