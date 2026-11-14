# Les Chroniques d'Aldoria, v2

Jeu éducatif en 3D (île ouverte, troisième personne) pour réviser le programme de Jules (6e) et Tom (2nde), sur le
navigateur du PC familial. La v1 (Godot, dossiers `game/`, `api/`, `admin/` à la racine) reste en service jusqu'à la bascule.

À lire avant de coder : `docs/TRD.md` (architecture), `docs/decisions.md` (pourquoi), `IMPLEMENTATION_PLAN.md` (où on en
est), `docs/BILAN-V1.md` (les erreurs à ne pas refaire). Histoire : `docs/histoire.md`.

## Arborescence

- `client/` : jeu (Vite, TypeScript strict, Babylon.js 9, React 19). `src/core/` logique pure testée sans navigateur,
  `src/game/` Babylon.js seulement, `src/ui/` React seulement. Fichiers statiques dans `public/ressources/`.
- `api/` : FastAPI reprise de la v1 (Python 3.12, `uv`) ; `admin/` : espace parent (React), servi en production sur
  `aldoria-admin.bandtrack.fr` par l'image `web2` (`admin/` à la racine du dépôt est gelé).
- `content/` : programmes (`seed/`), vecteurs de réponses partagés (`test-vectors/`), données du monde (`monde/*.json`).
- `deploy/` : nginx (CSP), Dockerfiles (contexte : ce dossier) ; `tools/` : scripts. Le Compose de production est celui de la
  racine (`deploy/docker-compose.yml`) : une seule API (celle de `v2/api`) et une seule base pour les deux jeux (D11).

Mise en ligne : un push sur `main` qui touche `v2/` fait publier par `.github/workflows/v2.yml` l'API et le jeu v2, puis les
déployer (sauvegarde de la base avant toute migration, contrôle de version du jeu et de l'espace parent, parcours navigateur
sur `aldoria2.bandtrack.fr`).
`api/` à la racine est gelé : l'API évolue ici, sans jamais casser le jeu v1 (ses tests sont dans `api/tests/`).

## Commandes

```bash
npm --prefix client install            # une fois
npm --prefix client run dev            # jeu sur http://localhost:5173 (relaie /api vers l'API locale, port 8098)
npm --prefix client test               # Vitest : logique, vecteurs partagés, relief, déplacement
npm --prefix client run typecheck
npm --prefix client run build          # puis : npm --prefix client run preview (port 4173, CSP de production)
npm --prefix client run e2e            # parcours dans Chromium contre la prévisualisation
npm --prefix client run captures       # vues de l'île dans e2e/captures (E2E_QUALITE=moyen en rendu logiciel)
npm --prefix client run perf           # WebGL 2 face à WebGPU, profil par profil (Edge du poste, docs/perf-log.md)
uv run --directory api pytest -q
uv run --directory api ruff check .
npm --prefix admin run build
bash tools/e2e_admin.sh                # espace parent dans le navigateur, contre l'image web2 (Docker)
```

Adresse du jeu : `?decouverte` (île sans compte, rien n'est enregistré), `&classe=2nde`, `&monde=brouillard`,
`&qualite=haut|moyen|bas`, `&perf` (compteur), `&e2e` (crochet `window.__aldoria` : `world.teleport(x, z, versX, versZ)`,
`world.frame(alpha, beta, distance)`, `world.heroPosition()`, `question`, `services`), `&interface=0`, `&moteur=webgpu`,
`&renard=0` (sans le renard), `&erreurs=0|1` (remontée des erreurs ; active par défaut dans le jeu construit seulement),
`&erreur_test=1` (erreur d'essai au démarrage), `&musique=0` (sans musique ni bouton), `&sons=0` (sans effets sonores).

## Règles

- **`core/` ne dépend de rien** (ni Babylon.js, ni React, ni le DOM sauf `localStorage` derrière `Store`). Toute règle de jeu
  y va avec son test Vitest ; une scène Babylon.js reste mince.
- **Le gameplay ne connaît jamais le contenu d'une question** : il demande un item à `QuestionService` (rôle `automatisme`,
  `chapitre`, `enigme`) et reçoit un verdict. La validation (`core/answers.ts`, `core/mathExpr.ts`) rend le même verdict que
  l'API : toute modification se fait des deux côtés et s'ajoute à `content/test-vectors/answers.json`.
- **Données du monde en JSON** (`content/monde/`) : jamais de lieu, de texte d'histoire ou de position écrits dans le code.
  Un lieu ajouté doit passer `api/tests/test_dungeon.py` et `client/tests/world.test.ts`.
- **Combat** (`core/combat/encounter.ts`, testé sans moteur) : les règles seules, portées de la v1. L'interface pose la question
  (`QuestionService.next(role, encounter.questionLevel(role))`), puis appelle `encounter.answer(action, verdict)` et raconte les
  événements rendus, dans l'ordre. Un `Encounter` par donjon (ou arène), `engage(ennemi, …)` à chaque combat : le bouclier levé et
  la série du critique « sans vitesse » passent d'un ennemi au suivant, comme dans la v1 (coup, soin, riposte, chute). Aucune animation, aucun son, aucun panneau dans `core/` ; un
  changement de règle se fait là, avec son test, jamais dans la scène. XP, niveaux et PV du héros : `core/progression.ts`.
- **Mini-carte** (`ui/Minimap.tsx`) : elle ne recalcule aucune position, elle lit les repères posés par le monde
  (`GameWorld.mapInfo`, événements `hero` et `markers`). Un repère d'une sorte nouvelle (habitant, gardien…) passe par
  `mapMarkers` (`core/world/minimap.ts`, avec son test) ; un lieu secret n'y figure jamais. Touche M : `event.key`, pas
  `event.code`, et rien pendant une question.
- **Intérieur d'un lieu** (`core/world/dungeon.ts` décrit, `game/interior.ts` dresse) : six salles de 16 × 20 m en enfilade, 4 m plus
  haut chacune, escalier contre le mur est ; repère x vers l'est, z vers le nord, mur nord en z = 0, **profondeur = -z** (c'est le
  « z » de la v1 : les positions de `lieux.json` y sont valables telles quelles, salles impaires en miroir pour le décor). Les murs
  sont du « vide » pour le déplacement (`heightAt` rend `VOID_HEIGHT`), pas des collisions du moteur. Scène à part, même moteur :
  `GameWorld.enterPlace(code)` met l'île en pause, `leavePlace()` la reprend ; un modèle se charge par scène (`loadContainer`).
  Un chiffre de géométrie change ici avec son test, jamais dans la scène. `&e2e` : `world.enterPlace(code)`, `world.interior`
  (`teleport(x, z)`, `frame(écart, beta, distance)`, `heroPosition()`), `world.places`.
- **Musique** (`app/music.ts` joue, `core/music.ts` décide du volume, testé) : morceaux de `deploy/musique/` listés dans
  `content/monde/musique.json` (ordre de lecture, crédit des Options), servis sous `/musique/` par nginx ; `npm run dev` et
  `vite preview` les servent depuis le même dossier (`vite.config.ts`, requêtes `Range` comprises). Elle démarre à l'entrée
  dans l'île (un geste de l'enfant a déjà eu lieu ; sinon le premier clic ou la première touche), s'éteint en fondu pendant
  une question et baisse sous une voix (`Voice.isSpeaking`) ; `&musique=0` la désactive (ni lecture ni bouton : captures,
  mesures). Ajouter un morceau : `python tools/encode_musique.py`, procédure dans `docs/exploitation.md`. Une scène qui
  pose une question ou un dialogue sans passer par `GameScreen` doit prévenir `services.music.setFocus`.
- **Pierre du Jour** (défi quotidien, `ile.json` : `pierre_jour`, sur le chemin de la Citadelle ; interaction `kind: 'jour'`) : dix automatismes
  d'affilée, **sans compte à rebours à l'écran**, puis un bilan (bonnes réponses, temps de réponse cumulé, record, série de jours, coffre de la
  semaine). `core/dailyChallenge.ts` (série, rattrapage d'un jour manqué, record, coffre) et `core/dailyRun.ts` (déroulé et textes du bilan)
  sont purs et testés ; `app/dailySession.ts` ferme la session « monde » et ouvre une session « defi » (automatismes seulement, côté API),
  puis rouvre l'île ; `ui/DailyChallenge.tsx` enchaîne les écrans avec `QuestionPanel` (`gameMode` « defi », `timeMs` rendu avec la réponse).
  Un défi interrompu ne compte pas ; un second défi le même jour est un entraînement (pas de bonus, pas de série de plus). L'état (`daily`)
  et le sac (`items`) sont rangés dans la partie (`core/save.ts`, `normalizeSave` relit une ancienne partie). Sans pénalité de lenteur
  (`no_speed`) : aucun temps n'est écrit.
- **Archives** (`core/archives.ts` : lecture de `GET /play/progress`, résumé, dernier état gardé sur l'appareil pour la consultation hors
  connexion ; `ui/Archives.tsx`, bouton « Archives » de l'île) : une à trois étoiles par notion, groupées par matière puis par chapitre. La
  maîtrise vient toujours du serveur, jamais calculée par le client. Le bestiaire (créatures vaincues) vient avec les rencontres.
- **Effets sonores** (`core/sfx.ts` : les dix sons de `public/ressources/sfx`, volume de la v1 ; `app/sfx.ts` : lecteur Web Audio créé au
  premier geste, `services.sfx.play('correct')`) : bonne et mauvaise réponse dans `QuestionPanel` ; les coups, le soin et la victoire du
  combat s'appellent de la même façon. Jamais d'effet lié à la vitesse de réponse ; `&sons=0` les désactive (captures, mesures).
- **CSP stricte** : aucun style en ligne dans le HTML (classes et attributs `data-*` ; l'objet `style` de React est permis),
  aucun fichier en `data:` produit par Vite, aucune ressource hors du site (pas de CDN : décodeurs, polices, twgsl). La même
  CSP est posée par `vite preview` : le parcours navigateur échoue sur toute violation.
- **Accessibilité** : tout texte est du HTML ; les aménagements du parent sont des attributs de `<html>` traités en CSS ;
  aucune question contre la montre ; un effet fort respecte le mode calme (`calm`). Énoncés courts, une idée par phrase.
- **Rendu** : les profils (`game/quality.ts`) ne changent que des réglages. Un modèle se charge une fois (`game/assets.ts`) ;
  le décor répété passe en *thin instances*. Tout asset ajouté est inscrit dans `client/public/ressources/LICENSES.md`.
- **Sauvegarde** : partie v2 dans l'emplacement `v2` (`core/save.ts`). La maîtrise des notions n'est jamais calculée par le
  client. Aucune migration ne doit casser la v1 tant qu'elle est en service.
- **Temps de jeu fixé par le parent** (PRD US-11) : `core/playTime.ts` (`PlayClock`, testé) tenu par `Session.clock` : le serveur
  fait foi (`play_time` de la connexion et de `session/start`), le client compte les secondes jouées ; une pause de 30 minutes
  ouvre une nouvelle séance. `ui/PlayTimeGuard.tsx` (monté dans `GameScreen`) fige le monde et propose de terminer à la fin de
  la séance, ou la pause aux intervalles réglés (`pause_minutes`). Un combat ou une activité vérifie `session.timeOver()` **entre
  deux actions**, jamais au milieu d'une question : rien n'est coupé, la progression est sauvegardée. Jamais en mode découverte.
- **Visuels de questions** : une question n'est posée que si son type et son visuel sont dessinés (`core/questionService.ts` :
  `SUPPORTED_TYPES`, `SUPPORTED_VISUALS`, `isPlayable`), sinon l'énoncé serait incompréhensible. Calculs dans `core/visuals.ts`
  (testés), dessin SVG dans `ui/widgets/Visuals.tsx`, réponses dans `ui/widgets/Widgets.tsx`. Aujourd'hui : balance, droite
  graduée, repère quadrillé (vecteurs), tableau de signes, carte à l'échelle, robot sur une grille, courbe : **les 30 lieux sont
  jouables** (chapitre et énigme, mesuré sur les vrais générateurs). Restent `pont`, `rapporteur`, `repere_tir` : leurs générateurs
  (`combat=False`) ne servent qu'au pont des fractions et au stand de tir de la Citadelle, jamais dans un lieu ; les énigmes
  d'enquête de Clairval (tableau, relevé) viendront avec le village. Ajouter un visuel : le composant, son calcul testé sur de
  vraies questions (`tests/fixtures/visual_samples.json`, régénéré par `uv run --directory api python ../tools/export_visual_samples.py`),
  puis son nom dans `SUPPORTED_VISUALS`.
- **Voix enregistrées** (ElevenLabs : Maître Ysaline et le narrateur) : `deploy/voix/` (`manifest.json` : empreinte SHA-256 du
  texte exact vers un MP3), servies sous `/voix/` (image web ; `vite.config.ts` en dev et en preview). `core/voice.ts` joue le son
  d'un texte français dont l'empreinte est au manifeste (même sans compte), sinon Piper, sinon la voix du navigateur
  (`core/recordedVoices.ts`). Un texte enregistré se lit **seul et à l'identique** : une phrase collée à côté lui ferait perdre sa
  voix, donc l'afficher à part (`note` du `Dialog`, non lue). Modifier un texte de `content/voix/lignes.json` ou le `threshold`
  d'un lieu fait échouer `tests/recordedVoices.test.ts` : relancer `python tools/voix_elevenlabs.py` (clé ElevenLabs dans
  l'environnement, jamais dans le dépôt ; `--essai` liste ce qui serait généré, sans clé). Un nouveau texte de Maître Ysaline
  s'ajoute à `lignes.json` (groupe, id, texte, voix), puis le script génère son son. Crédit ElevenLabs dans les Options.
  L'accueil de Maître Ysaline dans l'île (`ile-accueil`) est lu **depuis** `lignes.json` par `GameScreen` : texte et voix au même endroit.
  Les pages rapportées et le prologue parlent de l'île (« le chemin s'éclaire sur l'île »), jamais d'une carte du royaume, que la v2 n'a
  pas ; les `seuil-*` parlent, eux, de vraies cartes (atlas, plans) : ne pas les « corriger ». Pas encore enregistrées : les répliques des
  Effaceurs (`boss_intro`, `boss_defeat` de `lieux.json`, voix « effaceur » : une seule pour les 30, `ELEVENLABS_VOIX_EFFACEUR`) ;
  `python tools/voix_elevenlabs.py --lieux` les reporte dans `lignes.json` (le texte vient toujours de `lieux.json`), puis le script les génère. Le script tourne aussi dans la session
  cloud : la clé s'enregistre par `request_credential` (hôte `api.elevenlabs.io`, en-tête `xi-api-key`, jamais dans le dépôt) et le script
  reçoit `ELEVENLABS_API_KEY=proxy-injected` ; une clé limitée à la synthèse n'a pas le droit `voices_read` (inutile : les voix sont au manifeste).
- **Logiques de la v1 portées, pas encore branchées à l'écran** (pures, testées, `core/`) : sac d'objets (`inventory.ts` : plume,
  parchemin, bouclier, potion, 5 au plus de chaque ; le combat applique déjà les deux derniers), voix du héros entre les salles
  (`heroVoice.ts` et `content/monde/heros.json`), apparence du héros et du renard
  (`wardrobe.ts`, `content/monde/apparence.json`), île du Sphinx (`sphinx/board.ts` : jeu de blocs ; `sphinx/island.ts` : passages de barque, paliers, aide du Sphinx ;
  180 énigmes dans `content/monde/sphinx_niveaux.json`, converties de `game/worlds/shared/sphinx_levels.gd` de la v1 ;
  `python tools/make_sphinx_levels.py` les régénère (graine fixe, mais le palier 6 est très long à calculer : relancé jusqu'au
  palier 5 seulement, jamais comparé en entier à la v1). Leur état se range dans
  la partie (`core/save.ts`) et leur écran vient avec les étapes 1.x : un état se rend toujours neuf (jamais modifié sur place).
- **Textes visibles par les enfants en français**, tutoiement ; aucune donnée personnelle hors du serveur d'Aldoria.
- **Erreurs du jeu** : tout ce qui passe par une exception, une promesse rejetée ou `console.error` remonte à l'exploitant
  (`core/errorReport.ts`, `app/errors.ts`). Ne jamais mettre de prénom, de question ni de réponse dans un message d'erreur ;
  un `console.error` volontaire est une vraie erreur (sinon `console.warn`).
- L'API, l'espace parent, les générateurs et la lecture à voix haute suivent les règles du `CLAUDE.md` de la v1 (racine du
  dépôt), sections « Conventions » sur les matières, la voix, les familles et la banque de questions.

## Pièges déjà rencontrés (Babylon.js 9, Vite)

- `camera.target = …` sur une `ArcRotateCamera` recalcule alpha et beta depuis l'ancienne position : modifier la cible en
  place (`camera.target.copyFrom(…)`), sinon la souris ne fait plus tourner la caméra.
- Un `.glb` peut déclarer une racine de squelette fausse (`skin.skeleton`) : Babylon.js la suit et étire les sommets en
  pointes (renard Quaternius). Tous les modèles se chargent avec `alwaysComputeSkeletonRootNode` (`game/assets.ts`) : ne pas
  l'enlever.
- Un modèle Quaternius a une armature tournée de -90° et à l'échelle 100 ; sa boîte englobante au repos ne dit rien de sa
  taille réelle : échelle fixe, puis `settleOnGround` après la première image (`game/characters.ts`).
- Un matériau PBR métallique sans carte d'environnement paraît noir : `characters.ts` rend les personnages mats.
- `SceneLoaderFlags.ShowLoadingScreen` doit rester à `false` (style injecté, refusé par la CSP).
- Vite intègre les petits fichiers en `data:` : `assetsInlineLimit: 0` (polices de KaTeX).
- En rendu logiciel (CI, conteneur sans carte graphique), le profil `haut` peut dépasser les délais de capture : `bas` pour
  le parcours, `moyen` pour les captures.
- WebGPU (`?moteur=webgpu`) : Babylon.js 9 a une version WGSL de tous ses shaders de base, mais un matériau seulement GLSL
  (ceux de `@babylonjs/materials`, un `ShaderMaterial` écrit en GLSL) lui ferait charger glslang et twgsl depuis son CDN,
  refusé par la CSP. Tout matériau ajouté se vérifie en WebGPU (aucune requête vers cdn.babylonjs.com).
- Mise en ligne pendant qu'un onglet est ouvert : chaque build renomme ses fichiers, l'ancienne page ne trouve plus
  `GameWorld-….js` à l'entrée dans l'île. nginx répond 404 sur `/assets/` (jamais la page d'accueil) et le jeu recharge la
  page une fois sur `vite:preloadError` (`app/staleBuild.ts`). Un fichier chargé à la demande (`import()`) en profite d'office.
- Orientation d'un modèle posé à la main (`game/interior.ts`, `FRONT_HEADING = 0`) : sans rotation, la face avant d'un modèle KayKit
  (+Z du fichier : où descend un escalier, où saille une torche) regarde le **nord** du monde. Un mur est symétrique et ne le dit
  pas : vérifier sur l'escalier (sa boîte doit aller de 12 à 16 m, pas de 16 à 20) et sur les bannières (elles disparaissent
  derrière le mur si l'orientation est inversée).
- Musique : un `<audio>` dont on change `src` passe à « en lecture » (`paused` faux) dès l'appel à `play()`, avant que le début du
  morceau soit arrivé : sa durée vaut alors NaN et `currentTime = duration - 1.5` lève une erreur. Un test attend
  `music.state().duration` fini ; `E2E_RETARD_MUSIQUE=1500 npm run e2e` simule un réseau lent (la CI, chargée, l'a montré).
- CI : Playwright 1.56 n'installe pas Chromium sur `ubuntu-latest` (passé en 26.04) ; tout job qui lance le navigateur
  tourne sur `ubuntu-24.04`. Le VPS n'ouvre SSH qu'à quelques adresses : un job qui s'y connecte passe par
  `.github/scripts/vps-ssh.sh open|close` (comme les deux jobs `deploy`).
