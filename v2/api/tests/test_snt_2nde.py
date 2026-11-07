"""SNT de seconde : exemples relus, calculs vérifiés (débits, graphes, tables, itinéraires, images,
programmes Python exécutés pour de vrai), énigmes à remettre en ordre."""

import json
import re
from pathlib import Path

import pytest

from app.engine import answers, session_pack, speech
from app.engine.generators import REGISTRY
from app.engine.generators import snt_2nde as snt
from app.engine.generators import snt_2nde_calculs as calc

CODES = sorted(code for code in REGISTRY if code.startswith("2nde.snt."))


def _items(code: str, seeds: int = 60):
    for difficulty in range(1, 6):
        for seed in range(seeds):
            yield REGISTRY[code].item(difficulty, seed)


def test_every_notion_of_the_programme_has_a_generator():
    root = Path(__file__).resolve().parents[2]
    seed = json.loads((root / "content/seed/2nde/snt.json").read_text("utf-8"))
    programme = {n["code"] for c in seed["chapters"] for n in c["notions"]}
    assert {REGISTRY[code].notion for code in CODES} == programme


@pytest.mark.parametrize("notion", snt.NOTIONS, ids=lambda n: n.code)
def test_facts_are_consistent(notion):
    assert {f.level for f in notion.facts} == {1, 2, 3}, notion.code
    for fact in notion.facts:
        assert len(fact.wrong) == 3 and fact.answer not in fact.wrong, fact.prompt
        assert len(set(fact.wrong)) == 3, fact.prompt


@pytest.mark.parametrize("code", CODES)
def test_items_are_valid_and_read_aloud(code):
    for item in _items(code, 20):
        if item.type == "mcq":
            assert len(item.choices) == len(set(item.choices)) >= 2, item.id
        if item.type == "numeric":
            assert answers.check(item.answer.model_dump(), item.answer.value), item.id
        said = session_pack.item_data(item, "chapitre", {})["speech"]
        for text in [said["prompt"], said.get("explanation", ""), *said.get("choices", [])]:
            assert not re.search(r"<\w+>|\b(?:Mo|Go|Mbit/s)\b|==", text), text


@pytest.mark.parametrize(
    ("shown", "spoken"),
    [
        ("La balise <h1> ferme avec </h1>.", "La balise balise h1 ferme avec balise fermante h1 ."),
        ("5 Mo à 20 Mbit/s", "5 mégaoctets à 20 mégabits par seconde"),
        ("    y = x - 4", "y égale x moins 4"),
        ("a = b * 3", "a égale b fois 3"),
        ("Paris - Lyon", "Paris - Lyon"),  # hors code : rien ne change
    ],
)
def test_snt_notations_are_read_in_words(shown, spoken):
    assert speech.text(shown) == spoken


def test_python_programs_give_the_announced_value():
    for item in _items(f"{calc.PREFIX}.python"):
        scope: dict = {}
        exec(item.meta["code"], {}, scope)  # noqa: S102 - programmes écrits par le générateur
        assert scope[item.meta["var"]] == item.meta["value"], item.meta["code"]


def test_graph_answers():
    for item in _items(f"{calc.PREFIX}.graphe"):
        graph = {p: set(v) for p, v in item.meta["graph"].items()}
        ecc = calc.eccentricities(graph)
        kind = item.meta["kind"]
        if kind == "diametre":
            assert item.meta["value"] == max(ecc.values())
        elif kind == "rayon":
            assert item.meta["value"] == min(ecc.values())
        elif kind == "centre":
            centers = [p for p in graph if ecc[p] == min(ecc.values())]
            assert centers == [item.choices[item.answer.index]], item.id
        for person in graph:  # amitiés symétriques, graphe connexe
            assert all(person in graph[other] for other in graph[person])
            assert len(calc.distances(graph, person)) == len(graph)


def test_shortest_paths():
    graph = {"A": {"B": 2, "C": 9}, "B": {"A": 2, "C": 3}, "C": {"A": 9, "B": 3}}
    assert calc.shortest(graph, "A") == {"A": 0, "B": 2, "C": 5}
    for item in _items(f"{calc.PREFIX}.destinations"):
        dists = item.meta["distances"]
        assert dists == sorted(dists) and len(set(dists)) == len(dists)
        assert item.choices != [item.choices[i] for i in item.answer.value], "présenté mélangé"


def test_table_counts():
    for item in _items(f"{calc.PREFIX}.table"):
        rows, kind = item.meta["rows"], item.meta["kind"]
        csv = [line.split(";") for line in item.prompt.split("\n")[2:] if ";" in line]
        assert [[r[0], r[1], int(r[2]), int(r[3])] for r in csv] == rows
        if kind == "filtre_auteur":
            assert item.meta["value"] == sum(r[1] == item.meta["author"] for r in rows)
        if kind == "filtre_double":
            expected = sum(r[2] > item.meta["year"] and r[3] > item.meta["limit"] for r in rows)
            assert item.meta["value"] == expected


def test_transfer_times():
    for item in _items(f"{calc.PREFIX}.debit"):
        numbers = [float(n.replace(",", ".")) for n in re.findall(r"\d+(?:,\d+)?", item.prompt)]
        if item.meta["kind"] == "duree":
            size, rate = numbers[:2]
            assert item.meta["value"] == pytest.approx(size * 8 / rate)


def test_request_steps_keep_their_order():
    for item in _items(f"{calc.PREFIX}.requete"):
        steps = calc.SEQUENCES[item.meta["title"]]
        ordered = [item.choices[i] for i in item.answer.value]
        assert ordered == [steps[k] for k in item.meta["keep"]]
