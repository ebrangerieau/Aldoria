"""Exporte des questions à visuel (carte, robot, courbe), tirées des vrais générateurs, pour les tests du client.

Usage (depuis v2/) :
    uv run --directory api python ../tools/export_visual_samples.py
Écrit client/tests/fixtures/visual_samples.json : par générateur, chaque difficulté sur plusieurs graines, avec les
données internes (`meta`) qui permettent aux tests de vérifier que le dessin montre bien ce que dit la question.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from app.engine.generators import REGISTRY  # noqa: E402

GENERATORS = [
    "6e.proportionnalite.carte",
    "6e.algorithmique.sequences",
    "6e.algorithmique.boucles",
    "2nde.automatismes.lecture_graphique",
]
SEEDS = (11, 22, 33, 44)
OUT = ROOT / "client" / "tests" / "fixtures" / "visual_samples.json"


def main() -> None:
    items = []
    for code in GENERATORS:
        for difficulty in range(1, 6):
            for seed in SEEDS:
                items.append(REGISTRY[code].item(difficulty, seed).model_dump())
    OUT.write_text(json.dumps(items, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)} : {len(items)} questions")


if __name__ == "__main__":
    main()
