"""Voix enregistrées (ElevenLabs) du narrateur et de Maître Ysaline.

Lit content/voix/lignes.json (écrit par tools/export_voice_lines.gd) et génère un MP3 par
réplique dans deploy/voix/, avec deploy/voix/manifest.json (empreinte SHA-256 du texte ->
fichier). Le jeu (autoload Voice) joue le son dont l'empreinte correspond au texte qu'il doit
lire ; un texte modifié n'a plus de son et retombe sur la voix du serveur (Piper) jusqu'à la
prochaine génération. tools/postprocess_web.py copie deploy/voix/ dans l'export web.

Ne génère que ce qui manque ou a changé (texte, voix, modèle) ; retire les sons des textes
disparus. Seul le texte de l'histoire part chez ElevenLabs : aucune donnée d'enfant.

Variables d'environnement (jamais dans le dépôt) :
  ELEVENLABS_API_KEY          clé de l'API
  ELEVENLABS_VOIX_NARRATEUR   identifiant de la voix du narrateur (prologue, tableaux 1 à 3)
  ELEVENLABS_VOIX_YSALINE     identifiant de la voix de Maître Ysaline
  ELEVENLABS_MODELE           modèle (par défaut eleven_multilingual_v2)

Usage :
  python tools/voix_elevenlabs.py --essai             ce qui serait généré, sans appel ni clé
  python tools/voix_elevenlabs.py --voix              voix du compte (nom, identifiant)
  python tools/voix_elevenlabs.py --exemple ysaline   une réplique d'essai (dossier temporaire)
  python tools/voix_elevenlabs.py [--groupe prologue|carte|tout]
Bibliothèque standard uniquement.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LINES = ROOT / "content" / "voix" / "lignes.json"
OUT = ROOT / "deploy" / "voix"
MANIFEST = OUT / "manifest.json"
API = "https://api.elevenlabs.io/v1"
FORMAT = "mp3_44100_64"  # voix seule : 64 kbit/s suffisent (≈ 0,5 Mo par minute)
DEFAULT_MODEL = "eleven_multilingual_v2"
VOICE_ENV = {"narrateur": "ELEVENLABS_VOIX_NARRATEUR", "ysaline": "ELEVENLABS_VOIX_YSALINE"}


def digest(text: str) -> str:
    """Même empreinte que le jeu (`String.sha256_text`)."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def load_lines() -> list[dict]:
    if not LINES.exists():
        sys.exit(f"{LINES} absent : lancer d'abord tools/export_voice_lines.gd")
    return json.loads(LINES.read_text(encoding="utf-8"))


def load_manifest() -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text(encoding="utf-8"))
    return {}


def save_manifest(manifest: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ordered = dict(sorted(manifest.items(), key=lambda kv: kv[1]["id"]))
    MANIFEST.write_text(json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def request(path: str, key: str, body: dict | None = None) -> bytes:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    method = "POST" if body is not None else "GET"
    req = urllib.request.Request(f"{API}{path}", data=data, method=method)
    req.add_header("xi-api-key", key)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            return res.read()
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", "replace")[:300]
        sys.exit(f"ElevenLabs a répondu {err.code} : {detail}")


def speak(text: str, voice_id: str, model: str, key: str) -> bytes:
    body = {"text": text, "model_id": model}
    return request(f"/text-to-speech/{voice_id}?output_format={FORMAT}", key, body)


def env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        sys.exit(f"Variable d'environnement {name} absente.")
    return value


def list_voices(key: str) -> None:
    voices = json.loads(request("/voices", key)).get("voices", [])
    for v in sorted(voices, key=lambda v: v.get("name", "")):
        labels = ", ".join(f"{k}: {val}" for k, val in (v.get("labels") or {}).items())
        print(f"{v.get('voice_id')}  {v.get('name')}  ({labels})")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # accents lisibles dans la console Windows
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--groupe", choices=["prologue", "carte", "tout"], default="tout")
    parser.add_argument("--essai", action="store_true", help="ce qui serait généré, sans appel")
    parser.add_argument("--voix", action="store_true", help="voix disponibles sur le compte")
    parser.add_argument("--exemple", choices=sorted(VOICE_ENV), help="une réplique d'essai")
    args = parser.parse_args()

    lines = load_lines()
    manifest = load_manifest()
    model = os.environ.get("ELEVENLABS_MODELE", "").strip() or DEFAULT_MODEL

    if args.voix:
        list_voices(env("ELEVENLABS_API_KEY"))
        return
    if args.exemple:
        key = env("ELEVENLABS_API_KEY")
        line = next(x for x in lines if x["voix"] == args.exemple)
        target = Path(tempfile.gettempdir()) / f"aldoria-exemple-{args.exemple}.mp3"
        target.write_bytes(speak(line["texte"], env(VOICE_ENV[args.exemple]), model, key))
        print(f"{target} ({len(line['texte'])} caractères)")
        return

    wanted = [x for x in lines if args.groupe == "tout" or x["groupe"] == args.groupe]
    voices = {} if args.essai else {name: env(var) for name, var in VOICE_ENV.items()}
    todo = []
    for line in wanted:
        entry = manifest.get(digest(line["texte"]))
        voice_id = voices.get(line["voix"], (entry or {}).get("voix_id"))
        if entry is None or entry.get("voix_id") != voice_id or entry.get("modele") != model \
                or not (OUT / entry["fichier"]).exists():
            todo.append(line)
    chars = sum(len(x["texte"]) for x in todo)
    print(f"{len(todo)} réplique(s) à générer sur {len(wanted)}, {chars} caractères ({model}).")
    if args.essai:
        for line in todo:
            print(f"  {line['voix']:<10} {line['id']:<32} {len(line['texte']):>4} car.")
        return

    key = env("ELEVENLABS_API_KEY")
    OUT.mkdir(parents=True, exist_ok=True)
    for line in todo:
        h = digest(line["texte"])
        name = f"{line['id']}-{h[:8]}.mp3"
        (OUT / name).write_bytes(speak(line["texte"], voices[line["voix"]], model, key))
        old = manifest.get(h)
        if old and old["fichier"] != name:
            (OUT / old["fichier"]).unlink(missing_ok=True)
        manifest[h] = {
            "id": line["id"], "voix": line["voix"], "fichier": name,
            "voix_id": voices[line["voix"]], "modele": model,
        }
        save_manifest(manifest)  # après chaque son : une coupure ne fait rien perdre
        print(f"  {name}")

    # Textes disparus ou modifiés : leurs anciens sons sont retirés.
    current = {digest(x["texte"]) for x in lines}
    for h in [h for h in manifest if h not in current]:
        (OUT / manifest.pop(h)["fichier"]).unlink(missing_ok=True)
    save_manifest(manifest)
    size = sum(p.stat().st_size for p in OUT.glob("*.mp3"))
    print(f"{len(manifest)} sons dans {OUT} ({size / 1e6:.1f} Mo).")


if __name__ == "__main__":
    main()
