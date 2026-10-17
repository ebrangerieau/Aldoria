"""Post-traitement de l'export web Godot avant publication.

1. Sort les blocs <script> inline de index.html dans des fichiers externes : la CSP
   du TRD §8 (`script-src 'self'`) interdit les scripts inline.
2. Ajoute l'application installable (deploy/pwa : manifeste, icônes ; lien dans index.html) :
   « Installer l'application » dans le menu de Chrome, plein écran, à l'horizontale.
3. Précompresse en gzip les fichiers lourds (.wasm, .pck, .js, .html) pour
   `gzip_static` de nginx (le .wasm est environ 4 fois plus léger).
4. Affiche le poids brut et compressé (budget TRD §2.2 : < 25 Mo compressés).

Usage : python tools/postprocess_web.py build/web
Bibliothèque standard uniquement.
"""

from __future__ import annotations

import gzip
import hashlib
import re
import shutil
import sys
from pathlib import Path

INLINE_SCRIPT = re.compile(r"<script>(.*?)</script>", re.DOTALL)
COMPRESSIBLE = {".wasm", ".pck", ".js", ".html", ".json", ".svg"}
BUDGET_MB = 25.0
PWA = Path(__file__).resolve().parent.parent / "deploy" / "pwa"
PWA_HEAD = (
    '<link rel="manifest" href="manifest.webmanifest">'
    '<meta name="theme-color" content="#14121c">'
    '<meta name="mobile-web-app-capable" content="yes">'
)


def add_installable_app(directory: Path, index: Path) -> int:
    """Copie manifeste et icônes, remplace l'icône par défaut de Godot, relie le manifeste."""
    for source in PWA.iterdir():
        shutil.copy(source, directory / source.name)
    shutil.copy(PWA / "icon-192.png", directory / "index.icon.png")
    shutil.copy(PWA / "icon-192.png", directory / "index.apple-touch-icon.png")
    html = index.read_text(encoding="utf-8")
    if 'rel="manifest"' not in html:
        html = html.replace("</head>", PWA_HEAD + "</head>", 1)
        index.write_text(html, encoding="utf-8")
    return len(list(PWA.iterdir()))


def externalize_inline_scripts(index: Path) -> int:
    html = index.read_text(encoding="utf-8")
    count = 0

    def replace(match: re.Match[str]) -> str:
        nonlocal count
        code = match.group(1)
        digest = hashlib.sha256(code.encode("utf-8")).hexdigest()[:10]
        name = f"{index.stem}.boot.{digest}.js"
        (index.parent / name).write_text(code, encoding="utf-8")
        count += 1
        return f'<script src="{name}"></script>'

    index.write_text(INLINE_SCRIPT.sub(replace, html), encoding="utf-8")
    return count


def precompress(directory: Path) -> tuple[int, int]:
    raw_total = 0
    compressed_total = 0
    for path in sorted(directory.iterdir()):
        if not path.is_file() or path.suffix == ".gz":
            continue
        size = path.stat().st_size
        raw_total += size
        if path.suffix not in COMPRESSIBLE:
            compressed_total += size
            continue
        target = path.with_name(path.name + ".gz")
        target.write_bytes(gzip.compress(path.read_bytes(), compresslevel=9, mtime=0))
        gz_size = target.stat().st_size
        compressed_total += gz_size
        print(f"  {path.name:<40} {size / 1e6:8.2f} Mo -> {gz_size / 1e6:8.2f} Mo")
    return raw_total, compressed_total


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    directory = Path(sys.argv[1])
    index = directory / "index.html"
    if not index.is_file():
        print(f"Introuvable : {index}")
        return 1
    scripts = externalize_inline_scripts(index)
    print(f"Scripts inline externalisés : {scripts}")
    print(f"Application installable : {add_installable_app(directory, index)} fichiers")
    raw, compressed = precompress(directory)
    print(f"Total : {raw / 1e6:.2f} Mo bruts, {compressed / 1e6:.2f} Mo compressés")
    if compressed / 1e6 > BUDGET_MB:
        print(f"ATTENTION : budget de {BUDGET_MB} Mo compressés dépassé (TRD §2.2)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
