# Les Chroniques d'Aldoria

Jeu éducatif 2.5D (Godot 4.7.2, export web) pour réviser les maths de 6ème (Jules) et de seconde (Tom).
Documents de référence : `docs/PRD.md`, `docs/TRD.md`, `IMPLEMENTATION_PLAN.md` (phases, décisions, écarts au TRD).

## Arborescence

- `game/` : projet Godot (GDScript typé, renderer Compatibility, export web sans threads)
- `api/` : FastAPI (Python 3.12, `uv`)
- `admin/` : éditeur parent React (phase 2)
- `content/` : schémas d'items, seed, vecteurs de test partagés API/client
- `deploy/` : docker-compose (Traefik bandtrack.fr), Dockerfiles, nginx
- `tools/` : scripts (post-traitement de l'export web…)
- `docs/` : PRD, TRD, journal de perf (`perf-log.md`), journal des tests avec les enfants

## Commandes

Godot est installé hors du dépôt : `D:\developpement\tools\godot\4.7.2\Godot_v4.7.2-stable_win64_console.exe` (noté `godot` ci-dessous).

```powershell
# Import des ressources (après ajout d'assets ou de class_name)
godot --headless --path game --import
# Tests client (GUT 9.7.1)
godot --headless -d --path game -s addons/gut/gut_cmdln.gd -gexit
# Lancer la scène d'étalonnage avec une capture d'écran (vérification visuelle)
godot --path game --rendering-driver opengl3 -- --screenshot=C:/chemin/capture.png --quality=bas
# API
uv run --directory api pytest -q
uv run --directory api ruff check .
```

Export web local (mêmes conditions que la CI) : image Docker `barichello/godot-ci:4.7.2`, puis
`python tools/postprocess_web.py build/web`.

## Conventions

- GDScript typé, `class_name` pour les types partagés, signaux plutôt que couplage direct.
- Le gameplay ne connaît jamais le contenu d'une question (TRD §2.3) : il passe par `QuestionService`.
- Pas de `JavaScriptBridge.eval` : la CSP interdit `eval`. Utiliser `JavaScriptBridge.get_interface`.
- Géométrie statique d'une salle : un seul matériau partagé + `StaticBatcher.merge` (budget tablette < 100 appels de dessin).
- Tout asset ajouté est inscrit dans `game/assets/LICENSES.md`.
- Options de test : `?quality=haut|moyen|bas`, `?perf`, `?merge=0` dans l'URL (web) ou `-- --quality=bas` (PC).
- JSON en snake_case, dates ISO 8601 UTC, erreurs `{"error": {"code", "message"}}`.
- Textes visibles par les enfants en français ; aucune donnée personnelle hors du foyer.
