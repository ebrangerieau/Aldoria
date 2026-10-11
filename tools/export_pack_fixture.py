"""Exporte des paquets de session déterministes pour les tests du client (GUT).

Usage (depuis la racine du dépôt) :
    uv run --directory api python ../tools/export_pack_fixture.py
Écrit game/tests/fixtures/pack_6e.json et pack_2nde.json, avec les items de
l'énigme du donjon de chaque monde (balance, miroirs).
"""

from __future__ import annotations

import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from app.engine import session_pack  # noqa: E402
from app.engine.generators import REGISTRY  # noqa: E402

OUT = ROOT / "game" / "tests" / "fixtures"
ENIGMAS = {"6e": "6e.prealgebre.balance", "2nde": "2nde.vecteurs.rayon"}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for level in ("6e", "2nde"):
        rng = random.Random(f"fixture-{level}")
        pack = session_pack.build(level, rng)
        pack["items"] += session_pack.enigma_items(
            REGISTRY[ENIGMAS[level]], 30.0, 6, rng, pack["formulas"]
        )
        pack["session_id"] = ""
        pack["settings"] = {"session_max_minutes": 25}
        path = OUT / f"pack_{level}.json"
        path.write_text(json.dumps(pack, ensure_ascii=False), encoding="utf-8")
        print(f"{path.relative_to(ROOT)} : {len(pack['items'])} items, {len(pack['formulas'])} formules")


if __name__ == "__main__":
    main()
