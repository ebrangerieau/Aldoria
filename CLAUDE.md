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
# Tests client (GUT 9.7.1) — sans -d : en mode debug une erreur de script fige Godot. tools/gut.sh échoue aussi
# si un fichier de test n'a pas tourné (GUT l'ignore sans échouer) ou sur une erreur GUT hors assertion (CI)
GODOT=<godot> bash tools/gut.sh   # ou : godot --headless --path game -s addons/gut/gut_cmdln.gd -gexit [-gselect=…]
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
`godot --path game -- --autologin=<id> --pin=<code> [--pair=<code à 8 chiffres>] [--goto=donjon|village|defi|arene|archives] [--dungeon=<code>]
[--room=N] [--approach=1] [--npc=<code>] [--autoaction=chapitre] [--screenshot=x.png --shot-delay=4]`.
Galerie avec aménagements : `--acc=read_aloud,spacing,readable_font,math_tools,… [--text-size=1] [--tools=table]
[--wrong=1]` (outils ouverts, panneau d'explication).
`--goto` part de la Citadelle vers une destination (`apparence` : écran de personnalisation ; `citadelle` : s'y arrêter) ;
`--seuil=<id>` ouvre le seuil d'un lieu de la carte (`aucun` : carte seule) ; `--places=1` affiche la position des lieux à l'écran (tools/e2e) ; `--dungeon` choisit le donjon (code d'un `DungeonDef`, même fermé) ;
`--npc` place le héros devant un habitant du village et accepte sa quête ;
`--room` démarre le donjon dans la salle N (0 à 5) ; `--stairs=1` vide la salle et fait monter le héros par son escalier ;
`--approach` mène le héros au premier ennemi ou piédestal de la salle (captures d'un combat, d'une énigme) ;
`--autoaction` choisit une action dans l'arène.
Profils locaux : `docker exec <conteneur api> python -m app.cli create --family 1 --name … --level 6e|2nde --pin …`.
Un PC ou un navigateur neuf doit être relié à la famille : `python -m app.cli pairing-code --family 1 --name PC`
donne un code à passer une fois avec `--pair=` (enregistré ensuite dans `user://device.json`).

Test de bout en bout **dans le navigateur** (à lancer avant tout déploiement touchant le réseau,
l'interface ou les polices) : `powershell -File tools/e2e_web.ps1` — export web, nginx + API + PostgreSQL
locaux derrière un proxy de même origine, parcours titre → PIN → combat dans Edge headless.
Le web diffère du PC : décompression gzip faite par le navigateur, pas de polices système.

Sauvegardes de la base (service `backup`, copie à la maison, restauration) : `docs/exploitation.md`.
Vérifier qu'une sauvegarde se restaure, dans un PostgreSQL jetable : `powershell -File tools/test_restauration.ps1 <fichier.sql.gz>`.

Application installable (téléphone, tablette) : manifeste et icônes dans `deploy/pwa/` (icônes : `godot --headless --path game
--script ../tools/make_app_icons.gd`), copiés et reliés à `index.html` par `tools/postprocess_web.py` ; pas de service worker
(Chrome n'en exige plus pour « Installer l'application » depuis la version 108).

Export web local (mêmes conditions que la CI) : image Docker `barichello/godot-ci:4.7.2`, puis
`python tools/postprocess_web.py build/web`.

## Skills du projet (`.claude/skills/`)

Procédures pas à pas, chargées à la demande : `nouvelle-matiere` (ajouter une matière à une classe),
`nouveau-donjon` (un lieu de plus dans une région), `captures` (vérification visuelle du jeu), `livrer` (tests,
sauvegarde avant migration, push, suivi de la CI, contrôle en production). Les tenir à jour quand une étape change.

## Conventions

- GDScript typé, `class_name` pour les types partagés, signaux plutôt que couplage direct.
- Le gameplay ne connaît jamais le contenu d'une question (TRD §2.3) : il passe par `QuestionService`.
  Un donjon (`DungeonDef`) appartient à une matière (`subject`, une région par matière, un onglet au camp ; dans
  une région, ouverts l'un après l'autre : `DungeonDef.previous`). Son paquet reste dans sa matière (`tracking`).
  Sans automatismes dans la matière, la frappe rapide prend une question du chapitre un cran plus facile.
  Donjon qui monte (`DungeonLevel.use_climb`, un étage de 4 m par salle, escalier contre le mur est, quart est
  autour de la porte réservé : pas d'ennemi en x > 11, z de 7 à 13) ; le héros et le compagnon suivent
  `height_at` (`floor_height`) ; le village reste à plat.
  Il ne transmet que ses chapitres et son générateur d'énigme à
  `session/start` ; `api/tests/test_dungeon.py` vérifie qu'ils existent côté API. Son décor (`decor`) est lu
  par `DungeonLevel`.
- Histoire (`docs/histoire.md`, bible à relire avec les enfants) : quête commune de la Grande Chronique, Malvrek et
  ses Effaceurs (les boss), Maître Ysaline. **Carte du royaume** (`scenes/world_map`, écran principal après la
  connexion ; `WorldMapDef` : grille d'hexagones KayKit, une région par matière, emplacements des donjons dans
  l'ordre, brouillard sur les régions pas encore au programme, lieux secrets ; zoom à deux doigts, molette ou boutons + / −,
  déplacement d'un doigt une fois zoomée : `zoom_by`, `pan_by`) : toucher un lieu (au lever du doigt, sans glisser) ouvre son **seuil**
  (texte `DungeonDef.threshold`, page gardée `page`, bâtiment `map_piece`) avec le choix « J'y vais » / « Pas
  maintenant ». Donjons et village partent de la carte et y reviennent ; la **Citadelle des Archives**
  (`scenes/hub`, ex-camp) garde défi du jour, arène, Archives et apparence. Départ commun : `Departure.go`.
  Étapes de l'histoire déjà vues : `SaveManager.story_seen` / `mark_story`. **Prologue** (`scenes/prologue`, classe
  `Prologue`) : cinq tableaux 3D joués comme une cinématique (salle de la Citadelle, héros et renard, Maître Ysaline, Malvrek ;
  action de chaque tableau dans un Tween, `_play_action`, caméra qui glisse entre deux cadrages `SHOTS`), un texte par monde
  lu par la voix (`Accessibility.say`) et caché par défaut (bouton « Texte », affiché d'office sans voix possible) ; texte
  caché, le tableau suivant vient seul après la voix (`Accessibility.is_speaking`) ;
  la carte le lance tant qu'il n'est pas vu (`Prologue.STORY_KEY`), la Citadelle le fait revoir ; `Prologue.play(tree,
  retour)`. Échap ou « Passer » le termine (tools/e2e). Capture : `--goto=prologue --tableau=N [--moment=secondes] [--texte=1]`. L'Effaceur (boss) parle à l'entrée et à sa
  défaite (`boss_intro`, `boss_defeat`) ; la première fois, le coffre rend la page (`page_text`) et Maître Ysaline la
  salue au retour sur la carte (`page_<code>`), en annonçant le chemin qui s'ouvre.
- Village (`VillageDef`) : chaque habitant confie une quête de trois questions par jour (`revision`, `veille`,
  `enquete`) ; les questions passent par `QuestionService.next_quest_item`. Une enquête porte sur un seul
  document : générateur `shared_document` côté API (même document à graine égale, quelle que soit la difficulté).
- Notions pas encore vues en classe (`NotionAside`, table `notion_aside`, par enfant) : cochées par le parent (page
  Programme, `PUT /admin/profiles/{id}/notions/{code}`) ou mises de côté par l'enfant (bouton « Pas vu en classe » du
  `QuestionPanel`, deux appuis, `POST /play/notions/set-aside` ; tableau de bord « Mises de côté par … », « C'est exact »
  passe la source au parent). Jamais posées (`tracking._combat_pack`, après le filtre de matière du donjon ; si toute la
  matière l'est, on les garde). Côté jeu, `Session.aside` les retire du paquet en cours et d'un paquet hors connexion,
  envoi en file (`ASIDE_FILE`) ; le panneau se refait avec une autre question (`QuestionService.set_aside`), rien n'est
  compté : l'appelant lit toujours `panel.item` après `answered`. Jamais sur une énigme.
- Banque de questions (espace parent, `admin_content.py`) : une question rédigée est validée par
  `engine/bank.py` (même schéma qu'un item généré, réponse qui se vérifie elle-même) et n'est jouée qu'une
  fois publiée (`session_pack.build_items`, identifiant `banque:<id>:<version>`). Les signalements des enfants
  passent par `POST /play/reports`. Réinitialisation d'un profil : `save_epoch` change, le client
  (`SaveManager._restart`) abandonne l'ancienne partie au lieu de la renvoyer.
- Accessibilité (troubles « dys ») : aménagements réglés par le parent (`Profile.accommodations`, validés par
  `engine/accommodations.py`) et appliqués par l'autoload `Accessibility` (police, espacement, taille du texte,
  cibles agrandies, mode calme, couleurs, lecture à voix haute, rappel de pause). Toute interface passe par
  `UiKit` (thème, boutons, `message_panel` avec « Écouter ») ; un effet ou une récompense liés à la vitesse
  respectent `Accessibility.on("no_speed")`, un effet visuel fort `on("calm")`. Le texte lu vient de
  `item["speech"]` (engine/speech.py) : un nouveau symbole ou une nouvelle commande LaTeX dans un générateur
  doit y être traduit (`tests/test_accessibility.py` le vérifie sur toutes les questions générées).
  Rédaction : énoncés courts, une idée par phrase.
- Interface « grimoire enluminé » (`UiKit`) : parchemin et cadre doré (monde lumineux), pierre et cadre argenté
  (Brouillard). Textures 9-patch dessinées par `tools/make_ui_textures.py` (relancer après modification ;
  `UiKit.MARGINS`), titres en Cinzel (`UiKit.title`, remplacé par la police lisible si l'aménagement est choisi),
  icônes de game-icons.net (`UiKit.icon`, `icon_button` ; SVG importés à `svg/scale=0.25`, crédit CC BY dans les
  Options ; tout nouvel auteur va dans LICENSES.md et ce crédit). Briques : `ribbon`, `screen_title`, `divider`,
  `card_box`, `speaker`, `info_line`, `style_bar`, `bag_row`, `HeroBadge` (ui/hud). Panneau de question trop haut (texte
  agrandi, téléphone) : il défile (`CombatHud.show_panel` ; ailleurs, tout panneau centré passe par `UiKit.fitted`) ; toute zone qui
  défile reçoit `TouchScroll.attach(scroll)` (défilement au doigt, même posé sur un bouton, sans le déclencher) ; `OrderWidget` met les éléments longs en liste, sur toute la largeur. Texte sur un panneau : contraste
  ≥ 4,5:1 ; juste/faux en `good_ink` / `bad_ink` (WorldTheme), `good` / `bad` seulement pour barres, effets et textes cernés
  sur la 3D. Aménagements forcés pour les captures (PC) : `--acc=big_targets,readable_font,spacing --text-size=2`. Fond des menus : la salle de la
  Citadelle en 3D (`UiKit.backdrop`, `CitadelHall`, rendue une fois sauf à la Citadelle et à l'écran titre). Remplacer
  un nœud : `UiKit.swap` (jamais `replace_by`, qui garde les enfants). Captures sans compteur : `--perf=0` ;
  écran des profils : `--scene=profils [--profil=N]`.
- Personnalisation (`Wardrobe`, core/progression) : apparence du héros (silhouette KayKit, une arme par main,
  couvre-chef, cape et sa couleur) et renard du monde lumineux (`Companion`, core/world : suit les traces du
  héros, jamais à travers un mur). Rangée dans la partie (`SaveManager.look()`, toujours validée : choix
  inconnus ou verrouillés remplacés). Un héros se crée par `Fighter.create_hero(SaveManager.look(), …)` ou
  `HeroController.create(SaveManager.look(), …)` ; tout aventurier KayKit est habillé par `Wardrobe.dress`
  (le .glb contient toutes les armes). Déblocages au niveau ou aux donjons terminés, annoncés au coffre.
- Classes et mondes (`api/app/engine/levels.py`) : classes de la 6e à la terminale, « disponibles » si leur
  programme est chargé (`content/seed/<classe>/`) ; jamais de liste de classes écrite en dur ailleurs. Le **monde**
  (`lumineux` | `brouillard`, choisi par le parent) ne donne que l'ambiance (`WorldTheme`, compagnon) ; la **classe**
  donne le contenu : `DungeonDef.all_for_level`, `VillageDef.for_level` (vides ou null tant qu'une classe n'a pas
  ses régions : le camp l'annonce). Passage de classe : `PATCH /admin/profiles/{id}` ; les notions déjà travaillées
  des classes précédentes reviennent en révision seulement (`tracking._prior_notions`, `NotionInfo.prior`).
  Le jeu relit le profil au retour au camp (`Session.update_profile`, signal `profile_changed`).
- Formats de question : `text` (réponse écrite, `answers.normalize_text` côté serveur et
  `AnswerChecker.normalize_text` côté jeu, même table d'accents, vecteurs partagés) avec `TextAnswerWidget` (clavier
  de lettres à l'écran) ; `listen` (écoute dans une langue, `Accessibility.say`, toujours actif) ; `choices_lang`
  (propositions lues dans leur langue). Programmes : un fichier par matière, `content/seed/<classe>/<matière>.json`.
  Français (et toute matière sans règle « calculable ») : générateurs à base d'exemples relus (`generators/faits.py` :
  `Fact`, `Notion`, `register_notions` ; niveau 1 à 3 par exemple, intrus propres ou vocabulaire de la notion,
  terme à écrire à la difficulté 5 si `writable` ; langue vivante : `Notion.lang = "en-GB"`, propositions lues en anglais,
  `Fact.choices_lang = ""` pour un exemple aux propositions en français). Un trou s'écrit « … ». Citations : auteurs du domaine public,
  exactes, avec leur source ; sinon exemple écrit pour le jeu. `tests/test_francais.py` vérifie la couverture du
  programme et l'unicité des réponses. Histoire-géographie : dates des manuels (« vers » si approximative), écrites
  « 52 av. J.-C. » / « 476 après J.-C. », siècles en chiffres romains (« IVe siècle av. J.-C. ») : `engine/speech.py` les
  lit en toutes lettres (`ordinal`). Sciences : températures écrites en toutes lettres (« 100 degrés »), vitesses en km/h, m/s
  ou m/min (lues par `engine/speech.py`), unité visée d'une conversion en toutes lettres. Physique-chimie : formules avec
  indices et charges (H₂O, Ca²⁺), équations avec ⟶, configurations « 1s² 2s² 2p⁶ » ; `speech._chemistry` les lit (lettres
  épelées, « donnent ») ; une unité après un nombre est lue par `speech._UNITS`, l'unité demandée s'écrit en toutes
  lettres. Une matière peut loger dans la région d'une autre (`WorldMapDef.REGION_OF` : physique-chimie → Laboratoire).
- Questions proposées par l'IA (`engine/ai_author.py`, route `/admin/ai-questions`) : SDK `anthropic`, modèle
  `claude-sonnet-5-5` et effort `medium` par défaut (`ALDORIA_AI_MODEL`, `ALDORIA_AI_EFFORT` ; prix par modèle
  dans `PRICES_PER_MTOK`), sortie structurée, `fallbacks="default"` ; chaque proposition repasse par `bank.validate` et
  entre en brouillon (source `ia`) ; quota par famille et par jour (`ai_usage`). Jamais de donnée d'enfant dans
  la requête. Tests : client simulé (`admin_content.get_ai` remplacé), aucun appel réel.
- Durée de jeu (limite du parent) : comptée par séance, remise à zéro après 30 minutes sans jouer ; le serveur fait
  foi (`api/app/play_time.py`, renvoyé par `login`, `/play/me` et `session/start`), le jeu le relit
  (`Session.sync_play_time`, `time_over`, `rest_text`). Le camp refuse de lancer une activité tant que la pause n'est pas finie.
- Salle-énigme 3D (`DungeonDef.enigma_mode`) : l'énigme se résout dans le décor au lieu de trois piédestaux à question.
  `"balance"` : balance géante (`BalanceRig`, core/world ; objets en MultiMesh) et manche `BalanceEnigma` (scenes/dungeon) qui lit
  `item["visual"]` ; seul le premier essai passe par `QuestionService.submit`, les suivants corrigent (le fléau penche).
- Stand de tir de la Lice (`scenes/tir`, classe `TirScene`, tuile « Tir » de la Citadelle) : six tirs calculés, générateur
  par classe (`TirScene.GENERATORS` : `6e.angles.tir` rapporteur géant, `ProtractorRange` ; `2nde.droites.tir` droite de
  l'arbalète, `LineRange`), paquet `Session.start("arene", TirScene.params(level))`, panneau `TirPanel`. Seul le premier tir
  d'une cible passe par `QuestionService.submit` (`game_mode` "tir"). Générateurs `combat=False` : jamais tirés en combat
  (`combat_notions()` compose les paquets). Capture : `--goto=tir --tir=<valeur>|go`.
- Combat : `Encounter` (core/combat) est partagé par l'arène et le donjon ; une scène ne réécrit pas le tour par tour.
  Boss : `BOSS_HITS` sceaux, difficulté d'un cran sous le niveau à un cran au-dessus ; forces rendues avant le boss ;
  après un repli, l'ennemi garde ses blessures (rien n'est perdu).
- Objets du sac (`Inventory`, core/progression ; `SaveManager.give_items` / `use_item`, 5 au plus par objet) :
  plume et parchemin dans `QuestionPanel` (pas au défi du jour : `with_items = false`), bouclier et potion par le
  bouton « Sac » du combat (`Encounter._open_bag`, sans perdre son tour). Aucun objet ne fait sauter une question ;
  une aide par objet compte comme indice pour le suivi, sans baisse de puissance (`penalized_hint`).
- Voix neuronale : service `voice` (Piper, `voice/app.py`, image `deploy/voice.Dockerfile`, réseau interne seulement,
  1 cœur et 1 Go) ; l'API la relaie et garde les sons en cache (`routers/speech.py`, `POST /play/speech`,
  `ALDORIA_VOICE_URL`, volume `voice-cache`). Côté jeu, `Accessibility.say` passe par l'autoload `Voice` (enfant
  connecté, en ligne, français ou anglais) et se rabat sur la voix de l'appareil (`device_say`) sinon. Les tests
  de l'API simulent le service (`speech.get_voice_client` remplacé). Changer de voix : `VOICE_VERSION`.
  Langues vivantes : dans un item d'anglais, le texte entre “ ” ou " " est en anglais et lu par la voix anglaise,
  les mots français cités entre « » (`engine/speech.py` : `prompt_parts`, `explanation_parts`) ; générateurs,
  IA (`ai_author.SYSTEM`) et guide parent suivent cette règle.
- Voix enregistrées (ElevenLabs) du narrateur du prologue et de Maître Ysaline : `tools/export_voice_lines.gd` écrit
  `content/voix/lignes.json` (texte exact lu par le jeu), `tools/voix_elevenlabs.py` génère `deploy/voix/*.mp3` et
  `manifest.json` (empreinte SHA-256 du texte → fichier ; seulement ce qui manque ou a changé ; clé et voix dans des
  variables d'environnement, jamais dans le dépôt), `tools/postprocess_web.py` les copie dans `voix/` de l'export.
  `Voice` charge le manifeste et joue le son d'un texte français qui en a un, sinon Piper (texte modifié : Piper
  jusqu'à la génération suivante). Sur PC : `-- --voix=<adresse du site>`. Une réplique de Maître Ysaline lue à
  part (`listen_button` avec des morceaux) garde sa voix enregistrée. Après la modification d'un de ces textes :
  relancer les deux scripts.
- Musique (autoload `Music`, `deploy/musique/theme.mp3` : réencodée depuis `music/`, hors du dépôt ; copiée dans
  `musique/` de l'export par `tools/postprocess_web.py`, téléchargée après le démarrage ; sur PC, lue dans deploy/) :
  en boucle partout, sauf dans les scènes de quête (`Music.FOCUS_SCENES` : donjon, village, défi du jour, arène, tir ;
  une nouvelle scène de quête y est ajoutée), fondu à l'entrée et reprise au retour, plus discrète quand une voix parle.
  Volume à part dans les Options (`Accessibility.music_volume`, préférence `music`). Bouton « couper / remettre » toujours en
  bas à gauche, sur tout écran où elle joue (calque `Music.BUTTON_LAYER`, préférence `music_off`) : une scène ne met rien
  dans ce coin, ou lui laisse `Music.button_width()` (prologue). Captures sur PC : `-- --musique=0` (sans bouton) ou
  `--musique=muette` (bouton visible, sans le son).
- Le héros parle entre les salles (`HeroVoice`, core/world ; bulle `CombatHud.say`, lue si lecture automatique) :
  phrases par ton de monde, combinées, les dernières dites ne reviennent pas.
- Progression du joueur : `SaveManager` (XP, donjons, bestiaire, défis quotidiens), jamais de fichier de
  sauvegarde écrit à la main. Défi du jour : règles de série et de coffre dans `DailyChallenge`, sans compte à
  rebours à l'écran (les enfants l'ont vécu comme un chrono).
- Un test qui enregistre des réponses réécrit ensuite la file locale (`Session._save_json`) : sinon de fausses
  réponses partent vers l'API de dev au lancement suivant du jeu.
- Erreurs du jeu remontées (autoload `ErrorReport`, `Logger` de Godot ; API `client_errors.py`, table `client_error`,
  `POST /play/client-errors` avec l'appareil relié) : message, endroit dans le script (`always_track_call_stacks` dans
  project.godot), écran, version, type d'appareil ; jamais de donnée d'enfant. Actif sur le web seulement (PC :
  `-- --erreurs=1`) ; `?erreur_test=1` déclenche une erreur d'essai (tools/e2e/tts_check.js). L'exploitant les lit dans
  Exploitation → Erreurs du jeu. Version : `BuildInfo.VERSION` (commit posé par la CI avant l'export, « dev » sur le
  poste, affichée dans les Options) ; l'API la donne par `/health` (`version`, `migration` ; `ALDORIA_VERSION`, argument
  de build `GIT_SHA`) et la CI attend ce commit en production avant de finir.
- Pas de `JavaScriptBridge.eval` : la CSP interdit `eval`. Utiliser `JavaScriptBridge.get_interface`.
- Pièges GDScript déjà rencontrés :
  - `var x := dico["clé"]` (ou un élément d'`Array`, ou le retour d'une fonction non typée) donne un Variant : erreur
    « cannot infer the type », et dans un test GUT **tout le fichier est ignoré**. Typer explicitement
    (`var x: String = …`, `var page: Array = …`).
  - `Label` à retour à la ligne (`UiKit.label` l'active) dans une rangée (`HBoxContainer`) : largeur nulle, une lettre par
    ligne. Y mettre `autowrap_mode = TextServer.AUTOWRAP_OFF`, ou lui donner une largeur.
  - Un nombre lu dans du JSON est un `float` : `str(p["id"])` donne « 2.0 ». Comparer avec `str(int(p["id"]))`.
  - `Button` de `UiKit` en `FOCUS_NONE` : passer `focus_mode = FOCUS_ALL` avant `grab_focus()`.
  - Fonction contenant un `await` : l'appeler avec `await`, sinon la suite s'exécute avant elle.
  - `godot --check-only --script` échoue sur les scripts qui utilisent les autoloads (`Session`…) : vérifier en lançant
    les tests GUT ou le jeu, pas avec cette commande.
- Géométrie statique d'une salle : un seul matériau partagé + `StaticBatcher.merge` (budget tablette < 100 appels de dessin).
- Éclairage : la tablette (Android 10) ne tient 30 fps que sans vraies lumières ponctuelles ni ombres
  (voir `docs/perf-log.md`). Toute scène lit `Quality.settings()` à sa construction : `lights` (`real`/`fake`),
  `vertex_shading`, `shadows`. En `fake`, utiliser `MobileLighting.make_fake_light` ; si `vertex_shading`,
  appliquer `MobileLighting.apply_vertex_shading`. Jamais d'`OmniLight3D` en dur dans une scène.
- Tout asset ajouté est inscrit dans `game/assets/LICENSES.md`.
- Monstres (Quaternius, `assets/quaternius/monsters/`, animations importées) : déclarés dans `Fighter.MONSTERS`
  (hauteur visée ; taille et hauteur au sol calculées) ; `Fighter.play` traduit les noms d'animation KayKit
  (`MONSTER_ANIMS`). Chemin d'un modèle : `Fighter.model_path`. `tests/unit/test_monsters.gd` vérifie leurs animations.
- Personnage KayKit ajouté : l'importer sans animations (`animation/import=false` dans son `.import`) et
  l'inscrire dans `Fighter.ANIMATION_DONORS` ; toujours l'instancier par `Fighter.create` ou
  `Fighter.instantiate_model`. Chaque copie des animations pèse 1,3 à 1,8 Mo dans l'export web.
- Tablette et PC, un seul jeu : `Quality` choisit le profil à l'ouverture (tablette ou téléphone → `tablette`,
  ordinateur → `haut` : vraies lumières, ombres 4096 en deux zones adoucies via `Quality.dress_sun`, lissage 4×). Toute
  scène qui crée un soleil appelle `Quality.dress_sun(sun)`. Pas de halo (glow) : en WebGL 2 sans HDR, il blanchit le sol.
  Interface sur ordinateur : `Quality.ui_factor` (80 % de l'agrandissement proportionnel, jamais sous 1280 × 720 ;
  `?ui=tablette` pour l'interface de la tablette) ; la tablette reste inchangée. Téléphone (`Quality.device_kind()` :
  appareil tactile dont le petit côté fait moins de 520 points ; `?ui=telephone` / `-- --ui=telephone` pour essayer) :
  interface 1,3 fois plus grande (`PHONE_UI_RATIO`), panneaux qui défilent, jamais d'éclairage par sommet (il rendait
  la carte invisible sur un Galaxy A52s) ; tenu en portrait, un appareil tactile
  affiche « Tourne ton téléphone ». Essai sur PC aux proportions d'un téléphone : `--resolution 1688x780 -- --ui=telephone`. Textures d'interface enregistrées en
  double résolution, affichées à leur taille logique par `UiKit.ui_texture` (jamais `load` direct d'un fichier
  `assets/ui/*.png`).
- Options de test : `?quality=haut|tablette|bas`, `?perf`, `?scale=`, `?lights=fake|real|0`, `?vertex=0|1`,
  `?shadows=0`, `?merge=0` dans l'URL (web) ou `-- --quality=bas` (PC).
- JSON en snake_case, dates ISO 8601 UTC, erreurs `{"error": {"code", "message"}}`.
- Plusieurs familles : enfants, banque de questions, appareils, adultes et décisions « hors programme »
  (`family_notion`) appartiennent à une famille. API parent (`/api/v1/admin`) : jamais de route sans
  `CurrentParent` (accounts.py : secret `X-Aldoria-Admin-Key` posé par Traefik, session d'un adulte dans un
  cookie, `X-Requested-With: aldoria` pour une modification), et toute requête filtre sur
  `parent.family_id` (un enfant d'une autre famille est « inconnu », 404 : `admin._profile`). Côté jeu, la liste
  des enfants et la connexion exigent un appareil relié (`CurrentDevice`, en-tête `X-Aldoria-Device`).
  Effacement d'un enfant ou d'une famille : `erasure.py` (toute nouvelle table liée à un enfant y est ajoutée).
  Exploitant (`adult.is_operator`) : familles et sauvegardes (`CurrentOperator`).
  L'espace parent n'utilise aucun style en ligne (CSP `style-src 'self'`) : graphiques en SVG.
  Toute fonction ajoutée ou modifiée dans l'espace parent est décrite dans son guide (`admin/src/Guide.tsx`),
  en langage simple, avec les étapes pour s'en servir.
- Textes visibles par les enfants en français ; aucune donnée personnelle hors du foyer.
