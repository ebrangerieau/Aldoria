"""Énigmes de blocs du temple du Sphinx (jeu de logique, type Sokoban) : génère
`game/worlds/shared/sphinx_levels.gd`.

Chaque niveau part de sa solution : les blocs posés sur les dalles gravées, le héros les tire
à reculons (on ne peut jamais tirer en jeu, seulement pousser). Le niveau obtenu a donc
toujours une solution ; un solveur (parcours en largeur sur les poussées) trouve ensuite la plus
courte, qui mesure la difficulté et sert à l'aide du Sphinx. Pour chaque niveau, on garde le
meilleur de plusieurs essais (plus de poussées, plus de changements de bloc).

Tirage reproductible (graine fixe) : relancer le script redonne les mêmes niveaux.

    python tools/make_sphinx_levels.py [--par-palier 30]
"""

from __future__ import annotations

import argparse
import random
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "game" / "worlds" / "shared" / "sphinx_levels.gd"

# Paliers : (largeur, hauteur, blocs, part de murs intérieurs, poussées min, poussées max, essais)
TIERS = [
    (5, 4, 1, 0.08, 3, 8, 40),
    (6, 5, 2, 0.10, 6, 14, 40),
    (6, 6, 2, 0.16, 10, 22, 40),
    (7, 6, 3, 0.14, 12, 28, 30),
    (7, 7, 3, 0.18, 18, 36, 30),
    (8, 7, 4, 0.16, 22, 48, 20),
]
DIRS = {"l": (-1, 0), "r": (1, 0), "u": (0, -1), "d": (0, 1)}
STATE_CAP = 250_000


class Room:
    def __init__(self, floor: set[tuple[int, int]], width: int, height: int):
        self.floor = floor
        self.width = width
        self.height = height


def _connected(cells: set[tuple[int, int]]) -> bool:
    if not cells:
        return False
    start = next(iter(cells))
    seen = {start}
    todo = [start]
    while todo:
        x, y = todo.pop()
        for dx, dy in DIRS.values():
            n = (x + dx, y + dy)
            if n in cells and n not in seen:
                seen.add(n)
                todo.append(n)
    return len(seen) == len(cells)


def make_room(rng: random.Random, w: int, h: int, ratio: float) -> Room:
    """Salle de w × h dalles (plus le mur d'enceinte), coins parfois rognés, murs intérieurs."""
    while True:
        floor = {(x, y) for x in range(1, w + 1) for y in range(1, h + 1)}
        for _ in range(rng.randint(0, 2)):  # un coin rogné : la salle n'est plus un rectangle
            cw, ch = rng.randint(1, 2), rng.randint(1, 2)
            right, bottom = rng.random() < 0.5, rng.random() < 0.5
            for x in range(cw):
                for y in range(ch):
                    floor.discard((w - x if right else 1 + x, h - y if bottom else 1 + y))
        walls = round(w * h * ratio)
        tries = 0
        while walls > 0 and tries < 200:
            tries += 1
            cell = (rng.randint(1, w), rng.randint(1, h))
            if cell not in floor:
                continue
            floor.discard(cell)
            if _connected(floor):
                walls -= 1
            else:
                floor.add(cell)
        if _connected(floor):
            return Room(floor, w + 2, h + 2)


def flood(start: tuple[int, int], floor: set, boxes: frozenset | set) -> set[tuple[int, int]]:
    seen = {start}
    todo = [start]
    while todo:
        x, y = todo.pop()
        for dx, dy in DIRS.values():
            n = (x + dx, y + dy)
            if n in floor and n not in boxes and n not in seen:
                seen.add(n)
                todo.append(n)
    return seen


def reverse_play(
    rng: random.Random, room: Room, count: int
) -> tuple[frozenset, frozenset, tuple[int, int]] | None:
    """Blocs posés sur leurs dalles, puis tirés à reculons. Rend (dalles, blocs, héros)."""
    cells = sorted(room.floor)
    goals = frozenset(rng.sample(cells, count))
    boxes = set(goals)
    free = [c for c in cells if c not in boxes]
    player = rng.choice(free)
    for _ in range(rng.randint(30, 90)):
        reach = flood(player, room.floor, boxes)
        pulls = []
        for b in boxes:
            for dx, dy in DIRS.values():
                stand = (b[0] + dx, b[1] + dy)
                back = (b[0] + 2 * dx, b[1] + 2 * dy)
                if stand in reach and back in room.floor and back not in boxes:
                    pulls.append((b, dx, dy))
        if not pulls:
            break
        b, dx, dy = rng.choice(pulls)
        for _step in range(rng.randint(1, 3)):  # parfois plusieurs pas dans la même direction
            stand = (b[0] + dx, b[1] + dy)
            back = (b[0] + 2 * dx, b[1] + 2 * dy)
            if back not in room.floor or back in boxes:
                break
            boxes.discard(b)
            boxes.add(stand)
            player = back
            b = stand
    reach = sorted(flood(player, room.floor, boxes))
    return goals, frozenset(boxes), rng.choice(reach)


def dead_squares(floor: set, goals: frozenset) -> set[tuple[int, int]]:
    """Dalles d'où un bloc ne peut plus rejoindre aucune dalle gravée (on le tire depuis elles)."""
    alive = set(goals)
    todo = list(goals)
    while todo:
        x, y = todo.pop()
        for dx, dy in DIRS.values():
            to = (x + dx, y + dy)
            stand = (x + 2 * dx, y + 2 * dy)
            if to in floor and stand in floor and to not in alive:
                alive.add(to)
                todo.append(to)
    return floor - alive


def walk_path(floor: set, boxes: set, start: tuple[int, int], goal: tuple[int, int]) -> str:
    if start == goal:
        return ""
    prev: dict = {start: None}
    todo = deque([start])
    while todo:
        cur = todo.popleft()
        for name, (dx, dy) in DIRS.items():
            n = (cur[0] + dx, cur[1] + dy)
            if n in floor and n not in boxes and n not in prev:
                prev[n] = (cur, name)
                if n == goal:
                    moves = []
                    at = n
                    while prev[at] is not None:
                        at, step = prev[at]
                        moves.append(step)
                    return "".join(reversed(moves))
                todo.append(n)
    raise ValueError("chemin introuvable")


class Masks:
    """Dalles en masque de bits (une ligne de `width` bits par rangée) : le parcours du héros se
    fait par décalages, bien plus vite qu'avec des ensembles."""

    def __init__(self, floor: set, width: int):
        self.width = width
        self.floor = self.of(floor)
        self.offsets = {"l": -1, "r": 1, "u": -width, "d": width}

    def of(self, cells) -> int:
        m = 0
        for x, y in cells:
            m |= 1 << (y * self.width + x)
        return m

    def cell(self, i: int) -> tuple[int, int]:
        return (i % self.width, i // self.width)

    def flood(self, start: int, free: int) -> int:
        w = self.width
        r = 1 << start
        while True:
            n = (r | (r << 1) | (r >> 1) | (r << w) | (r >> w)) & free
            if n == r:
                return r
            r = n


def _bits(m: int):
    while m:
        low = m & -m
        yield low.bit_length() - 1
        m ^= low


def solve(
    floor: set, goals: frozenset, boxes: frozenset, player: tuple[int, int], width: int
) -> str | None:
    """Solution au plus petit nombre de poussées : marche en minuscules, poussées en majuscules."""
    k = Masks(floor, width)
    dead = k.of(dead_squares(floor, goals))
    goals_m = k.of(goals)
    start_boxes = k.of(boxes)
    if start_boxes & dead:
        return None
    start_player = player[1] * width + player[0]
    # File : (blocs, héros, parent, poussée) ; doublons écartés à la sortie (héros normalisé :
    # la plus petite dalle qu'il peut atteindre).
    seen: dict[tuple, tuple] = {}
    todo = deque([(start_boxes, start_player, None, None)])
    while todo:
        cur_boxes, cur_player, parent, push = todo.popleft()
        free = k.floor & ~cur_boxes
        reach = k.flood(cur_player, free)
        key = (cur_boxes, reach & -reach)
        if key in seen:
            continue
        seen[key] = (parent, push)
        if cur_boxes == goals_m:
            return _rebuild(floor, k, seen, key, boxes, player)
        if len(seen) > STATE_CAP:
            return None
        for b in _bits(cur_boxes):
            for name, o in k.offsets.items():
                stand = b - o
                to = b + o
                if (reach >> stand) & 1 and (free >> to) & 1 and not (dead >> to) & 1:
                    todo.append(((cur_boxes ^ (1 << b)) | (1 << to), b, key, (stand, name)))
    return None


def _rebuild(
    floor: set, k: Masks, seen: dict, key: tuple, boxes: frozenset, player: tuple[int, int]
) -> str:
    pushes = []
    while seen[key][0] is not None:
        parent, push = seen[key]
        pushes.append(push)
        key = parent
    moves = []
    cur_boxes, at = set(boxes), player
    for stand_i, name in reversed(pushes):
        stand = k.cell(stand_i)
        moves.append(walk_path(floor, cur_boxes, at, stand))
        moves.append(name.upper())
        dx, dy = DIRS[name]
        b = (stand[0] + dx, stand[1] + dy)
        cur_boxes.discard(b)
        cur_boxes.add((b[0] + dx, b[1] + dy))
        at = b
    return "".join(moves)


def score(solution: str) -> int:
    """Poussées, plus un bonus quand on change de bloc ou de direction (plus de réflexion)."""
    pushes = [c for c in solution if c.isupper()]
    turns = sum(1 for a, b in zip(pushes, pushes[1:], strict=False) if a != b)
    walks = sum(
        1 for i, c in enumerate(solution) if c.isupper() and i > 0 and solution[i - 1].islower()
    )
    return len(pushes) + 2 * turns + 2 * walks


def rows(room: Room, goals: frozenset, boxes: frozenset, player: tuple[int, int]) -> list[str]:
    out = []
    for y in range(room.height):
        line = ""
        for x in range(room.width):
            c = (x, y)
            if c in room.floor:
                goal = c in goals
                if c in boxes:
                    line += "*" if goal else "$"
                elif c == player:
                    line += "+" if goal else "@"
                else:
                    line += "." if goal else " "
            elif any((x + dx, y + dy) in room.floor for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                line += "#"
            else:
                line += "~"  # dehors : le sable
        out.append(line)
    return out


def make_level(rng: random.Random, tier: tuple, seen_layouts: set) -> dict:
    w, h, count, ratio, low, high, tries = tier
    best = None
    best_score = -1
    attempts = 0
    while best is None or attempts < tries:
        attempts += 1
        room = make_room(rng, w, h, ratio)
        made = reverse_play(rng, room, count)
        if made is None:
            continue
        goals, boxes, player = made
        if boxes & goals:
            continue  # aucun bloc déjà en place au départ
        solution = solve(room.floor, goals, boxes, player, room.width)
        if solution is None:
            continue
        pushes = sum(1 for c in solution if c.isupper())
        if not low <= pushes <= high:
            continue
        layout = "\n".join(rows(room, goals, boxes, player))
        if layout in seen_layouts:
            continue
        s = score(solution)
        if s > best_score:
            best, best_score = (layout, pushes, solution), s
    layout, pushes, solution = best
    seen_layouts.add(layout)
    return {"rows": layout.split("\n"), "pushes": pushes, "solution": solution}


HEADER = [
    "## Énigmes de blocs du temple du Sphinx, par palier de difficulté.",
    "## Généré par tools/make_sphinx_levels.py : ne pas modifier à la main.",
    "## Lignes : # mur, espace dalle, . dalle gravée, $ bloc, * bloc sur une dalle",
    "## gravée, @ héros, + héros sur une dalle gravée, ~ sable (hors du temple).",
    "## Solution : marche en minuscules, poussées en majuscules (l r u d).",
]


def write(levels: list[list[dict]]) -> None:
    lines = ["class_name SphinxLevels", "extends RefCounted", *HEADER, "", "const TIERS := ["]
    for tier in levels:
        lines.append("\t[")
        for level in tier:
            body = ", ".join(f'"{r}"' for r in level["rows"])
            rest = f'"pushes": {level["pushes"]}, "solution": "{level["solution"]}"'
            lines.append(f'\t\t{{"rows": [{body}], {rest}}},')
        lines.append("\t],")
    lines.append("]")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--par-palier", type=int, default=30)
    args = parser.parse_args()
    rng = random.Random(2026)
    seen: set[str] = set()
    levels = []
    for i, tier in enumerate(TIERS):
        made = [make_level(rng, tier, seen) for _ in range(args.par_palier)]
        made.sort(
            key=lambda lv: score(lv["solution"])
        )  # du plus simple au plus long dans le palier
        levels.append(made)
        pushes = [lv["pushes"] for lv in made]
        print(f"palier {i + 1} : {len(made)} niveaux, {min(pushes)} à {max(pushes)} poussées")
    write(levels)
    print(f"écrit : {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
