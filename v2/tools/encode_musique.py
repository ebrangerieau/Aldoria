"""Prépare un morceau de musique pour le jeu : de music/ (sources, hors du dépôt) vers deploy/musique/.

Même traitement que le thème de la v1 : silence de début et de fin retiré, fondu d'entrée (1,5 s) et
de sortie (3 s) pour que la boucle ne claque pas, volume ramené à -14 LUFS (le niveau du thème, pour
qu'on ne saute pas d'un morceau à l'autre), MP3 stéréo 44,1 kHz à 96 kbit/s (environ 2,4 Mo pour
3 min 20). Il faut ffmpeg (`winget install ffmpeg`).

    python tools/encode_musique.py "Mon morceau.mp3" [--nom mon-morceau] [--sortie dossier]

À lancer depuis v2/. Un nom de fichier seul est cherché dans music/ à la racine du dépôt (le dossier des sources,
ignoré par Git : pas v2/music/) ; un chemin complet marche aussi.

Écrit deploy/musique/<nom>.mp3 (nom tiré du fichier par défaut) et affiche la ligne à ajouter à
content/monde/musique.json (titre et outil à compléter), puis la ligne de client/public/ressources/LICENSES.md.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGET = "I=-14:TP=-1.5:LRA=11"
SHAPE = ",".join(
    [
        "areverse",
        "silenceremove=start_periods=1:start_duration=0.05:start_threshold=-55dB",  # silence final
        "afade=t=in:d=3",  # (à l'envers : fondu de sortie)
        "areverse",
        "silenceremove=start_periods=1:start_duration=0.05:start_threshold=-55dB",  # silence initial
        "afade=t=in:d=1.5",
    ]
)


def measure(source: Path) -> dict[str, str]:
    """Première passe : mesure du volume du morceau une fois taillé (loudnorm, JSON sur stderr)."""
    done = subprocess.run(
        ["ffmpeg", "-nostats", "-i", str(source), "-vn", "-af", f"{SHAPE},loudnorm={TARGET}:print_format=json", "-f", "null", "-"],
        capture_output=True, text=True, check=True,
    )
    measure_json, _ = json.JSONDecoder().raw_decode(done.stderr[done.stderr.rindex("{"):])  # le reste : fin du journal
    return measure_json


def normalize(m: dict[str, str]) -> str:
    """Seconde passe : gain linéaire d'après la mesure (plus juste qu'une passe unique)."""
    return (
        f"loudnorm={TARGET}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
        f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
    )


def slug(text: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-") or "morceau"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", type=Path)
    parser.add_argument("--nom", help="nom du fichier de sortie, sans extension (défaut : tiré de la source)")
    parser.add_argument("--sortie", type=Path, default=ROOT / "deploy" / "musique", help="dossier de sortie")
    args = parser.parse_args()
    if shutil.which("ffmpeg") is None:
        print("ffmpeg est introuvable : winget install ffmpeg", file=sys.stderr)
        return 1
    if not args.source.is_file() and (ROOT.parent / "music" / args.source).is_file():
        args.source = ROOT.parent / "music" / args.source
    if not args.source.is_file():
        print(f"Source introuvable : {args.source} (dossier des sources : {ROOT.parent / 'music'})", file=sys.stderr)
        return 1
    name = slug(args.nom or args.source.stem)
    args.sortie.mkdir(parents=True, exist_ok=True)
    target = args.sortie / f"{name}.mp3"
    chain = f"{SHAPE},{normalize(measure(args.source))}"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(args.source), "-vn", "-map_metadata", "-1", "-af", chain,
         "-ar", "44100", "-ac", "2", "-b:a", "96k", str(target)],
        check=True,
    )
    print(f"{target} ({target.stat().st_size / 1_000_000:.1f} Mo)")
    print("\nAjouter à content/monde/musique.json (« morceaux », dans l'ordre de lecture) :")
    print(f'    {{ "fichier": "{name}.mp3", "titre": "…", "outil": "Suno" }}')
    print("\nEt à client/public/ressources/LICENSES.md (tableau des sons et de la musique) :")
    print(f"| Musique du jeu (`deploy/musique/{name}.mp3`, réencodée par tools/encode_musique.py ; source dans `music/`, hors du dépôt ; "
          "crédit dans les Options) | … | … | … | … | AAAA-MM-JJ |")
    return 0


if __name__ == "__main__":
    sys.exit(main())
