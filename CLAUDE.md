# Les Chroniques d'Aldoria

Jeu éducatif 2.5D (Godot 4.7.2, export web) pour réviser les maths de 6ème (Jules) et de seconde (Tom).
Documents de référence : `docs/PRD.md`, `docs/TRD.md`, `IMPLEMENTATION_PLAN.md` (phases, décisions, écarts au TRD).

## Arborescence

- `game/` : projet Godot (GDScript typé, renderer Compatibility, export web sans threads)
- `api/` : FastAPI (Python 3.12, `uv`)
- `admin/` : espace parent React + TypeScript + Vite (servi par l'image `web` sur `aldoria-admin.*`)
- `content/` : schémas d'items, seed, vecteurs de test partagés API/client
- `deploy/` : docker-compose (Traefik bandtrack.fr), Dockerfiles, nginx
- `tools/` : scripts (post-traitement de l'export web…)
- `docs/` : PRD, TRD, journal de perf (`perf-log.md`), journal des tests avec les enfants

## Commandes

Godot est installé hors du dépôt : `D:\developpement\tools\godot\4.7.2\Godot_v4.7.2-stable_win64_console.exe` (noté `godot` ci-dessous).

```powershell
# Import des ressources (après ajout d'assets ou de class_name)
godot --headless --path game --import
# Tests client (GUT 9.7.1) — sans -d : en mode debug une erreur de script fige Godot
godot --headless --path game -s addons/gut/gut_cmdln.gd -gexit
# Paquets de session de test (après modification d'un générateur)
uv run --directory api python ../tools/export_pack_fixture.py
# Lancer la scène d'étalonnage avec une capture d'écran (vérification visuelle)
godot --path game --rendering-driver opengl3 -- --scene=calibration --screenshot=C:/chemin/capture.png --quality=tablette
# Galerie de questions (PC) : une question d'un type donné, tirée des paquets de test, dans le vrai panneau
godot --path game --rendering-driver opengl3 -- --scene=questions --level=6e --type=number_line [--visual=graph] [--index=0] --screenshot=C:/chemin/q.png --shot-delay=1.5
# Espace parent : vérification des types + build ; `npm run dev` relaie /api vers l'API locale
# (exporter ALDORIA_ADMIN_KEY, la même que celle du conteneur API local)
npm --prefix admin run build
# API
uv run --directory api pytest -q
uv run --directory api ruff check .
```

Jeu sur PC contre l'API locale (Docker, port 8098) — options réservées au PC, ignorées sur le web :
`godot --path game -- --autologin=<id> --pin=<code> [--goto=donjon|village|defi|arene|archives] [--dungeon=<code>]
[--room=N] [--approach=1] [--npc=<code>] [--autoaction=chapitre] [--screenshot=x.png --shot-delay=4]`.
`--goto` part du camp vers une destination ; `--dungeon` choisit le donjon (code d'un `DungeonDef`, même fermé) ;
`--npc` place le héros devant un habitant du village et accepte sa quête ;
`--room` démarre le donjon dans la salle N (0 à 5) ;
`--approach` mène le héros au premier ennemi ou piédestal de la salle (captures d'un combat, d'une énigme) ;
`--autoaction` choisit une action dans l'arène.
Profils locaux : `docker exec <conteneur api> python -m app.cli create --name … --level 6e|2nde --avatar … --pin …`.

Test de bout en bout **dans le navigateur** (à lancer avant tout déploiement touchant le réseau,
l'interface ou les polices) : `powershell -File tools/e2e_web.ps1` — export web, nginx + API + PostgreSQL
locaux derrière un proxy de même origine, parcours titre → PIN → combat dans Edge headless.
Le web diffère du PC : décompression gzip faite par le navigateur, pas de polices système.

Export web local (mêmes conditions que la CI) : image Docker `barichello/godot-ci:4.7.2`, puis
`python tools/postprocess_web.py build/web`.

## Conventions

- GDScript typé, `class_name` pour les types partagés, signaux plutôt que couplage direct.
- Le gameplay ne connaît jamais le contenu d'une question (TRD §2.3) : il passe par `QuestionService`.
  Un donjon (`DungeonDef`, trois par monde) ne transmet que ses chapitres et son générateur d'énigme à
  `session/start` ; `api/tests/test_dungeon.py` vérifie qu'ils existent côté API. Son décor (`decor`) est lu
  par `DungeonLevel`.
- Village (`VillageDef`) : chaque habitant confie une quête de trois questions par jour (`revision`, `veille`,
  `enquete`) ; les questions passent par `QuestionService.next_quest_item`. Une enquête porte sur un seul
  document : générateur `shared_document` côté API (même document à graine égale, quelle que soit la difficulté).
- Combat : `Encounter` (core/combat) est partagé par l'arène et le donjon ; une scène ne réécrit pas le tour par tour.
- Progression du joueur : `SaveManager` (XP, donjons, bestiaire, défis quotidiens), jamais de fichier de
  sauvegarde écrit à la main. Défi du jour : règles de série et de coffre dans `DailyChallenge`, sans compte à
  rebours à l'écran (les enfants l'ont vécu comme un chrono).
- Un test qui enregistre des réponses réécrit ensuite la file locale (`Session._save_json`) : sinon de fausses
  réponses partent vers l'API de dev au lancement suivant du jeu.
- Pas de `JavaScriptBridge.eval` : la CSP interdit `eval`. Utiliser `JavaScriptBridge.get_interface`.
- Géométrie statique d'une salle : un seul matériau partagé + `StaticBatcher.merge` (budget tablette < 100 appels de dessin).
- Éclairage : la tablette (Android 10) ne tient 30 fps que sans vraies lumières ponctuelles ni ombres
  (voir `docs/perf-log.md`). Toute scène lit `Quality.settings()` à sa construction : `lights` (`real`/`fake`),
  `vertex_shading`, `shadows`. En `fake`, utiliser `MobileLighting.make_fake_light` ; si `vertex_shading`,
  appliquer `MobileLighting.apply_vertex_shading`. Jamais d'`OmniLight3D` en dur dans une scène.
- Tout asset ajouté est inscrit dans `game/assets/LICENSES.md`.
- Personnage KayKit ajouté : l'importer sans animations (`animation/import=false` dans son `.import`) et
  l'inscrire dans `Fighter.ANIMATION_DONORS` ; toujours l'instancier par `Fighter.create` ou
  `Fighter.instantiate_model`. Chaque copie des animations pèse 1,3 à 1,8 Mo dans l'export web.
- Options de test : `?quality=haut|tablette|bas`, `?perf`, `?scale=`, `?lights=fake|real|0`, `?vertex=0|1`,
  `?shadows=0`, `?merge=0` dans l'URL (web) ou `-- --quality=bas` (PC).
- JSON en snake_case, dates ISO 8601 UTC, erreurs `{"error": {"code", "message"}}`.
- API parent (`/api/v1/admin`) : jamais de route parent sans la dépendance `CurrentParent` (secret
  `X-Aldoria-Admin-Key` posé par Traefik + identité TinyAuth dans `ALDORIA_ADMIN_USERS`).
  L'espace parent n'utilise aucun style en ligne (CSP `style-src 'self'`) : graphiques en SVG.
- Textes visibles par les enfants en français ; aucune donnée personnelle hors du foyer.
