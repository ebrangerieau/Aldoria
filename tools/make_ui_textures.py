"""Textures de l'interface « grimoire enluminé » (game/assets/ui/), dessinées ici pour rester
cohérentes et modifiables : parchemin à cadre doré (monde lumineux, Jules), pierre sombre à cadre
argenté (Brouillard, Tom), boutons, bandeau de titre, ornement de séparation.

Chaque texture est dessinée en double taille puis réduite (bords lissés). Les panneaux et les
boutons sont des « 9-patch » : coins fixes, bords et centre étirés (UiKit, StyleBoxTexture) ;
leurs marges sont dans `MARGINS` côté jeu (ui_kit.gd).

    python tools/make_ui_textures.py
"""

from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "game" / "assets" / "ui"
S = 2  # suréchantillonnage

THEMES = {
    "lumineux": {
        "paper": (246, 231, 196), "paper_dark": (214, 183, 128), "burn": (150, 104, 52),
        "frame": (196, 146, 52), "frame_light": (246, 214, 128), "frame_dark": (110, 72, 24),
        "primary": [(250, 214, 120), (226, 160, 52)], "primary_edge": (122, 74, 20), "primary_depth": (150, 92, 26),
        "secondary": [(253, 244, 220), (240, 224, 186)], "secondary_edge": (168, 116, 42),
        "disabled": [(214, 204, 182), (196, 186, 164)], "disabled_edge": (150, 140, 120),
        "ribbon": [(186, 66, 50), (140, 40, 32)], "ribbon_edge": (230, 186, 92),
    },
    "brouillard": {
        "paper": (38, 46, 58), "paper_dark": (24, 30, 39), "burn": (10, 13, 18),
        "frame": (143, 163, 184), "frame_light": (214, 226, 238), "frame_dark": (60, 72, 88),
        "primary": [(84, 138, 206), (44, 90, 152)], "primary_edge": (12, 20, 34), "primary_depth": (26, 52, 92),
        "secondary": [(40, 49, 62), (28, 35, 45)], "secondary_edge": (143, 163, 184),
        "disabled": [(52, 58, 66), (44, 50, 58)], "disabled_edge": (86, 94, 104),
        "ribbon": [(44, 64, 96), (26, 38, 60)], "ribbon_edge": (190, 206, 222),
    },
}


def noise(size: tuple[int, int], sigma: float, blur: float, seed: int) -> Image.Image:
    random.seed(seed)
    n = Image.effect_noise(size, sigma)
    return n.filter(ImageFilter.GaussianBlur(blur)) if blur else n


def mix(a: tuple, b: tuple, t: float) -> tuple:
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def vertical_gradient(size: tuple[int, int], top: tuple, bottom: tuple) -> Image.Image:
    w, h = size
    g = Image.new("RGB", (1, h))
    for y in range(h):
        g.putpixel((0, y), mix(top, bottom, y / max(1, h - 1)))
    return g.resize((w, h))


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=255)
    return m


def save(img: Image.Image, name: str) -> None:
    w, h = img.size
    img.resize((w // S, h // S), Image.LANCZOS).save(OUT / name)


# --- Panneau : parchemin (ou pierre) et cadre -----------------------------------------------------

def surface(size: tuple[int, int], c: dict, seed: int) -> Image.Image:
    """Fond du panneau : couleur, marbrures douces, bords assombris (vieux papier, pierre)."""
    w, h = size
    base = Image.new("RGB", size, c["paper"])
    dark = Image.new("RGB", size, c["paper_dark"])
    mottling = noise(size, 60, 18 * S, seed).point(lambda v: max(0, min(255, (v - 128) * 2 + 70)))
    img = Image.composite(dark, base, mottling)
    grain = noise(size, 30, 0.6 * S, seed + 1).point(lambda v: max(0, min(255, (v - 128) + 18)))
    img = Image.composite(dark, img, grain)
    # Bords brûlés : distance au bord, floutée.
    edge = Image.new("L", size, 0)
    inset = 26 * S
    ImageDraw.Draw(edge).rectangle((inset, inset, w - inset, h - inset), fill=255)
    edge = edge.filter(ImageFilter.GaussianBlur(14 * S))
    burn = Image.new("RGB", size, c["burn"])
    return Image.composite(img, burn, edge.point(lambda v: 90 + v * 165 // 255))


def frame(draw: ImageDraw.ImageDraw, size: tuple[int, int], c: dict, at: int, corner: int) -> None:
    """Double filet (épais puis fin) et fleurons dans les coins."""
    w, h = size
    o = at * S
    for width, inset, color in ((5 * S, o, c["frame_dark"]), (3 * S, o, c["frame"])):
        draw.rectangle((inset, inset, w - 1 - inset, h - 1 - inset), outline=color, width=width)
    draw.line((o + S, o + S, w - o - S, o + S), fill=c["frame_light"], width=S)  # reflet en haut
    inner = o + 9 * S
    draw.rectangle((inner, inner, w - 1 - inner, h - 1 - inner), outline=c["frame"], width=max(1, S))
    for cx, cy in ((o, o), (w - 1 - o, o), (o, h - 1 - o), (w - 1 - o, h - 1 - o)):
        fleuron(draw, cx, cy, corner * S, c)


def fleuron(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, c: dict) -> None:
    """Coin orné : losange doré cerné, petit cercle au centre, deux pétales."""
    d = r
    diamond = [(cx, cy - d), (cx + d, cy), (cx, cy + d), (cx - d, cy)]
    draw.polygon(diamond, fill=c["frame"], outline=c["frame_dark"])
    draw.line(diamond + [diamond[0]], fill=c["frame_dark"], width=S * 2)
    inner = d // 2
    draw.polygon([(cx, cy - inner), (cx + inner, cy), (cx, cy + inner), (cx - inner, cy)], fill=c["frame_light"])
    dot = max(2, d // 5)
    draw.ellipse((cx - dot, cy - dot, cx + dot, cy + dot), fill=c["frame_dark"])


def panel(name: str, c: dict, size: int, seed: int, inset: int = 8, corner: int = 11, radius: int = 10) -> None:
    sz = (size * S, size * S)
    img = surface(sz, c, seed).convert("RGBA")
    frame(ImageDraw.Draw(img), sz, c, inset, corner)
    img.putalpha(rounded_mask(sz, radius * S))
    save(img, name)


# --- Boutons -----------------------------------------------------------------------------------------

def button(name: str, colors: list, edge: tuple, depth: tuple | None, pressed: bool, light: bool) -> None:
    w, h, r = 96 * S, 72 * S, 14 * S
    drop = 0 if pressed or depth is None else 5 * S
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    top = 2 * S if pressed else 0
    if drop:
        d.rounded_rectangle((0, drop, w - 1, h - 1), r, fill=depth + (255,))
    face = vertical_gradient((w, h - drop - top), *(colors if not pressed else [mix(colors[0], colors[1], 0.5), colors[1]]))
    mask = rounded_mask((w, h - drop - top), r)
    img.paste(face, (0, top), mask)
    d.rounded_rectangle((0, top, w - 1, h - 1 - drop), r, outline=edge + (255,), width=3 * S)
    if light and not pressed:  # reflet doré en haut du bouton
        d.line((r, top + 5 * S, w - r, top + 5 * S), fill=(255, 255, 255, 110), width=2 * S)
    save(img, name)


# --- Bandeau de titre et ornement -------------------------------------------------------------------

def ribbon(name: str, c: dict) -> None:
    w, h = 320 * S, 64 * S
    tail = 34 * S
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    back = mix(c["ribbon"][1], (0, 0, 0), 0.35)
    # Queues fourchues de part et d'autre, plus sombres (derrière).
    d.polygon([(0, 12 * S), (tail + 10 * S, 12 * S), (tail + 10 * S, h - 4 * S), (0, h - 4 * S), (14 * S, h // 2 + 4 * S)], fill=back + (255,))
    d.polygon([(w, 12 * S), (w - tail - 10 * S, 12 * S), (w - tail - 10 * S, h - 4 * S), (w, h - 4 * S), (w - 14 * S, h // 2 + 4 * S)], fill=back + (255,))
    body = vertical_gradient((w - 2 * tail, h - 16 * S), *c["ribbon"])
    img.paste(body, (tail, 4 * S))
    d.rectangle((tail, 4 * S, w - tail - 1, h - 12 * S - 1), outline=c["ribbon_edge"] + (255,), width=3 * S)
    d.line((tail + 6 * S, 10 * S, w - tail - 6 * S, 10 * S), fill=c["ribbon_edge"] + (140,), width=S)
    save(img, name)


def divider(name: str, c: dict) -> None:
    w, h = 480 * S, 28 * S
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cy = h // 2
    for side in (-1, 1):
        x0 = w // 2 + side * 22 * S
        x1 = w // 2 + side * (w // 2 - 6 * S)
        d.line((x0, cy, x1, cy), fill=c["frame"] + (255,), width=2 * S)
        d.ellipse((x1 - 3 * S, cy - 3 * S, x1 + 3 * S, cy + 3 * S), fill=c["frame"] + (255,))
    fleuron(d, w // 2, cy, 11 * S, c)
    save(img, name)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for i, (world, c) in enumerate(THEMES.items()):
        light = world == "lumineux"
        panel(f"panel_{world}.png", c, 160, seed=11 + i)
        panel(f"card_{world}.png", c, 112, seed=21 + i, inset=6, corner=8, radius=10)
        button(f"button_{world}.png", c["primary"], c["primary_edge"], c["primary_depth"], False, light)
        button(f"button_{world}_pressed.png", c["primary"], c["primary_edge"], c["primary_depth"], True, light)
        button(f"button2_{world}.png", c["secondary"], c["secondary_edge"], mix(c["secondary_edge"], (0, 0, 0), 0.2), False, light)
        button(f"button2_{world}_pressed.png", c["secondary"], c["secondary_edge"], None, True, light)
        button(f"button_{world}_disabled.png", c["disabled"], c["disabled_edge"], None, False, False)
        ribbon(f"ribbon_{world}.png", c)
        divider(f"divider_{world}.png", c)
    print("textures écrites dans", OUT)


if __name__ == "__main__":
    main()
