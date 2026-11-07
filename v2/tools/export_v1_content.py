"""Exporte en JSON les données de jeu écrites en GDScript dans le prototype v1.

Lancé une fois depuis la racine du dépôt (le jeu v1 est dans game/) :

    python v2/tools/export_v1_content.py

Écrit dans v2/content/monde/ :
- lieux.json    : les 30 donjons (DungeonDef) et leur classe, textes de l'histoire compris ;
- regions.json  : régions par matière, matières logées chez une autre, lieux secrets, textes de
                  la Citadelle (WorldMapDef) ;
- villages.json : villages et habitants avec leurs quêtes (VillageDef) ;
- heros.json    : phrases du héros entre deux lieux (HeroVoice).

Les positions de la v1 (salles de 16 m, cases de la carte en hexagones) sont gardées sous des
clés préfixées `v1_` : elles ne valent rien dans l'île ouverte, mais elles disent l'ordre et la
composition des salles. Après cet export, les fichiers JSON font foi : on les modifie à la main
(ou avec l'éditeur de la v2), plus jamais en relançant ce script.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
V1 = ROOT / "game"
OUT = ROOT / "v2" / "content" / "monde"


class GdLiteral:
    """Analyse un sous-ensemble des littéraux GDScript : chaînes (concaténées par +),
    nombres, booléens, null, tableaux, dictionnaires, Vector2/3, Color et `_enemy(...)`."""

    def __init__(self, text: str, pos: int = 0) -> None:
        self.s = text
        self.i = pos

    def _skip(self) -> None:
        while self.i < len(self.s):
            c = self.s[self.i]
            if c in " \t\r\n":
                self.i += 1
            elif c == "#":
                while self.i < len(self.s) and self.s[self.i] != "\n":
                    self.i += 1
            else:
                break

    def _peek(self) -> str:
        self._skip()
        return self.s[self.i] if self.i < len(self.s) else ""

    def _expect(self, c: str) -> None:
        if self._peek() != c:
            raise ValueError(f"« {c} » attendu à {self._where()}")
        self.i += 1

    def _where(self) -> str:
        line = self.s.count("\n", 0, self.i) + 1
        return f"ligne {line} : {self.s[self.i:self.i + 40]!r}"

    def value(self) -> Any:
        c = self._peek()
        if c == '"':
            out = self._string()
            while self._peek() == "+":  # "abc" + "def"
                self.i += 1
                out += self._string()
            return out
        if c == "[":
            return self._list("[", "]")
        if c == "{":
            return self._dict()
        if c == "-" or c.isdigit():
            return self._number()
        word = re.match(r"[A-Za-z_]\w*", self.s[self.i:])
        if not word:
            raise ValueError(f"valeur illisible, {self._where()}")
        name = word.group(0)
        self.i += len(name)
        if name in ("true", "false"):
            return name == "true"
        if name == "null":
            return None
        if self._peek() != "(":
            raise ValueError(f"identifiant {name} non traduit, {self._where()}")
        args = self._list("(", ")")
        if name in ("Vector2", "Vector2i", "Vector3", "Vector3i", "Color"):
            return args
        if name == "_enemy":
            keys = ["model", "name", "hp", "tier", "xp", "v1_at", "scale"]
            enemy = dict(zip(keys, args, strict=False))
            enemy.setdefault("scale", 1.0)
            return enemy
        raise ValueError(f"appel {name}() non traduit, {self._where()}")

    def _string(self) -> str:
        self._expect('"')
        out = []
        while self.s[self.i] != '"':
            if self.s[self.i] == "\\":
                nxt = self.s[self.i + 1]
                out.append({"n": "\n", "t": "\t", '"': '"', "\\": "\\"}.get(nxt, nxt))
                self.i += 2
            else:
                out.append(self.s[self.i])
                self.i += 1
        self.i += 1
        return "".join(out)

    def _number(self) -> int | float:
        m = re.match(r"-?\d+(\.\d+)?", self.s[self.i:])
        if not m:
            raise ValueError(f"nombre illisible, {self._where()}")
        self.i += len(m.group(0))
        return float(m.group(0)) if m.group(1) else int(m.group(0))

    def _list(self, open_c: str, close_c: str) -> list:
        self._expect(open_c)
        out = []
        while self._peek() != close_c:
            out.append(self.value())
            if self._peek() == ",":
                self.i += 1
        self.i += 1
        return out

    def _dict(self) -> dict:
        self._expect("{")
        out = {}
        while self._peek() != "}":
            key = self.value()
            self._expect(":")
            out[str(key)] = self.value()
            if self._peek() == ",":
                self.i += 1
        self.i += 1
        return out


def parse_at(text: str, pos: int) -> Any:
    return GdLiteral(text, pos).value()


def const(text: str, name: str) -> Any:
    m = re.search(rf"^const {name}\s*:?=\s*", text, re.M)
    if not m:
        raise KeyError(name)
    return parse_at(text, m.end())


def factories(text: str, cls: str, var: str) -> dict[str, dict[str, Any]]:
    """`static func nom() -> Cls:` → {champ: valeur} des affectations `var.champ = …`."""
    out = {}
    heads = list(re.finditer(rf"^static func (\w+)\(\) -> {cls}:", text, re.M))
    for k, head in enumerate(heads):
        end = heads[k + 1].start() if k + 1 < len(heads) else len(text)
        body = text[head.end():end]
        body = re.split(r"^(?:static )?func ", body, flags=re.M)[0]
        fields = {}
        for m in re.finditer(rf"^\t{var}\.(\w+) = ", body, re.M):
            fields[m.group(1)] = parse_at(body, m.end())
        out[head.group(1)] = fields
    return out


def by_level(text: str, function: str) -> dict[str, list[str]]:
    """Arms `"6e": return [a(), b()]` (ou `return a()`) de la fonction `function`."""
    body = text.split(f"static func {function}")[1].split("\nstatic func")[0]
    out = {}
    for m in re.finditer(r'"(\w+)":\s*return \[?([^\]\n]*)\]?', body):
        out[m.group(1)] = re.findall(r"(\w+)\(\)", m.group(2))
    return out


DUNGEON_DEFAULTS = {
    "subject": "maths",
    "enigma_mode": "",
    "enigma_xp": 40,
    "chest_xp": 100,
    "decor": {},
}


def export_dungeons() -> dict[str, Any]:
    text = (V1 / "worlds/shared/dungeon_def.gd").read_text("utf-8")
    made = factories(text, "DungeonDef", "d")
    levels = by_level(text, "all_for_level")
    region_of = const((V1 / "worlds/shared/world_map_def.gd").read_text("utf-8"), "REGION_OF")
    dungeons = []
    for level, names in levels.items():
        for order, name in enumerate(names):
            fields = {**DUNGEON_DEFAULTS, **made[name]}
            subject = fields["subject"]
            dungeons.append({
                "code": fields["code"],
                "level": level,
                "subject": subject,
                "region": region_of.get(subject, subject),
                "order": order,
                "title": fields["title"],
                "chapter_codes": fields["chapter_codes"],
                "chapter_title": fields["chapter_title"],
                "intro": fields["intro"],
                "outro": fields["outro"],
                "threshold": fields["threshold"],
                "page": fields["page"],
                "page_text": fields["page_text"],
                "boss_intro": fields["boss_intro"],
                "boss_defeat": fields["boss_defeat"],
                "enigma": {
                    "generator": fields["enigma_generator"],
                    "mode": fields["enigma_mode"],
                    "title": fields["enigma_title"],
                    "intro": fields["enigma_intro"],
                    "xp": fields["enigma_xp"],
                },
                "chest_xp": fields["chest_xp"],
                "rooms": fields["rooms"],
                "v1_map_piece": fields["map_piece"],
                "v1_decor": fields["decor"],
            })
    unlisted = set(made) - {n for names in levels.values() for n in names}
    if unlisted:
        raise SystemExit(f"donjons absents de all_for_level : {sorted(unlisted)}")
    return {"levels": {lv: [made[n]["code"] for n in names] for lv, names in levels.items()},
            "dungeons": dungeons}


def export_regions() -> dict[str, Any]:
    text = (V1 / "worlds/shared/world_map_def.gd").read_text("utf-8")
    regions = const(text, "REGIONS")
    secrets = const(text, "SECRETS")
    return {
        "regions": {
            code: {"title": r["title"], "fog": r["fog"], "v1_slots": r["slots"]}
            for code, r in regions.items()
        },
        "region_of": const(text, "REGION_OF"),
        "secrets": {
            code: {"title": s["title"], "text": s["text"], "v1_piece": s["piece"]}
            for code, s in secrets.items()
        },
        "citadel_text": const(text, "CITADEL_TEXT"),
        "welcome": const(text, "WELCOME"),
    }


def export_villages() -> dict[str, Any]:
    text = (V1 / "worlds/shared/village_def.gd").read_text("utf-8")
    made = factories(text, "VillageDef", "v")
    levels = by_level(text, "for_level")
    villages = []
    for level, names in levels.items():
        for name in names:
            v = made[name]
            npcs = [{**{k: x for k, x in npc.items() if k != "at"}, "v1_at": npc.get("at")}
                    for npc in v["npcs"]]
            villages.append({
                "code": v["code"], "level": level, "title": v["title"], "intro": v["intro"],
                "v1_rooms": v["rooms"], "npcs": npcs,
            })
    return {
        "quest_size": const(text, "QUEST_SIZE"),
        "quest_xp": const(text, "QUEST_XP"),
        "answer_xp": const(text, "ANSWER_XP"),
        "villages": villages,
    }


def export_hero_lines() -> dict[str, Any]:
    text = (V1 / "core/world/hero_voice.gd").read_text("utf-8")
    return {"memory": const(text, "MEMORY"), "lines": const(text, "LINES")}


def main() -> None:
    if not V1.exists():
        sys.exit("Le jeu v1 (game/) est introuvable : lancer depuis le dépôt complet.")
    OUT.mkdir(parents=True, exist_ok=True)
    source = "exporté du prototype v1 par v2/tools/export_v1_content.py ; ce fichier fait foi"
    files = {
        "lieux.json": export_dungeons(),
        "regions.json": export_regions(),
        "villages.json": export_villages(),
        "heros.json": export_hero_lines(),
    }
    for name, data in files.items():
        path = OUT / name
        path.write_text(
            json.dumps({"source": source, **data}, ensure_ascii=False, indent=1) + "\n", "utf-8"
        )
        print(f"{path.relative_to(ROOT)} : {path.stat().st_size // 1024} Ko")


if __name__ == "__main__":
    main()
