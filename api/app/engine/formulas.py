"""Rendu LaTeX → SVG (ziamath, Python pur, sans installation LaTeX).

Les formules sont rendues en blanc : le client les teinte avec `modulate`
(blanc × couleur = couleur), ce qui sert les deux ambiances (claire et sombre).
Le rendu par Godot (ThorVG, Image.load_svg_from_buffer) a été vérifié le 2026-10-10.
"""

from __future__ import annotations

import hashlib
from functools import lru_cache

import ziamath

FONT_SIZE = 48


def formula_hash(latex: str) -> str:
    return hashlib.sha256(latex.encode("utf-8")).hexdigest()[:16]


@lru_cache(maxsize=4096)
def render_svg(latex: str) -> str:
    return ziamath.Latex(latex, size=FONT_SIZE, color="#ffffff").svg()
