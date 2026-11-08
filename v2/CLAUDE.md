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
`&erreur_test=1` (erreur d'essai au démarrage), `&musique=0` (sans musique ni bouton).

## Règles

- **`core/` ne dépend de rien** (ni Babylon.js, ni React, ni le DOM sauf `localStorage` derrière `Store`). Toute règle de jeu
  y va avec son test Vitest ; une scène Babylon.js reste mince.
- **Le gameplay ne connaît jamais le contenu d'une question** : il demande un item à `QuestionService` (rôle `automatisme`,
  `chapitre`, `enigme`) et reçoit un verdict. La validation (`core/answers.ts`, `core/mathExpr.ts`) rend le même verdict que
  l'API : toute modification se fait des deux côtés et s'ajoute à `content/test-vectors/answers.json`.
- **Données du monde en JSON** (`content/monde/`) : jamais de lieu, de texte d'histoire ou de position écrits dans le code.
  Un lieu ajouté doit passer `api/tests/test_dungeon.py` et `client/tests/world.test.ts`.
- **Combat** (`core/combat/`, testé sans moteur) : `encounter.ts` les règles seules, portées de la v1 ; `flow.ts` le déroulé (action,
  question, verdict, récit) avec un hôte à trois méthodes ; `texts.ts` les mots de chaque monde (`content/monde/combat.json`). Un
  `Encounter` par lieu, `engage(ennemi, …)` à chaque combat : le bouclier levé et la série du critique « sans vitesse » passent d'un
  ennemi au suivant, comme dans la v1. Aucune animation, aucun son, aucun panneau dans `core/` : `game/interior.ts` met en scène
  (`beginFight`, `present`, `endFight`), `ui/useFight.tsx` mène le combat (barres, actions, question, annonces). Un changement de
  règle se fait dans `core/`, avec son test, jamais dans la scène. XP, niveaux et PV du héros : `core/progression.ts`. Les questions
  d'un lieu viennent de sa session « donjon » (`app/placeSession.ts` : chapitres du lieu, comme dans la v1 ; en mode découverte, le
  paquet de test restreint à la matière) : sans elle, un combat poserait des questions de toute matière.
- **Mini-carte** (`ui/Minimap.tsx`) : elle ne recalcule aucune position, elle lit les repères posés par le monde
  (`GameWorld.mapInfo`, événements `hero` et `markers`). Un repère d'une sorte nouvelle (habitant, gardien…) passe par
  `mapMarkers` (`core/world/minimap.ts`, avec son test) ; un lieu secret n'y figure jamais. Touche M : `event.key`, pas
  `event.code`, et rien pendant une question.
- **Intérieur d'un lieu** (`core/world/dungeon.ts` décrit, `game/interior.ts` dresse) : six salles de 16 × 20 m en enfilade, 4 m plus
  haut chacune, escalier contre le mur est ; repère x vers l'est, z vers le nord, mur nord en z = 0, **profondeur = -z** (c'est le
  « z » de la v1 : les positions de `lieux.json` y sont valables telles quelles, salles impaires en miroir pour le décor). Les murs
  sont du « vide » pour le déplacement (`heightAt` rend `VOID_HEIGHT`), pas des collisions du moteur. Scène à part, même moteur :
  `GameWorld.enterPlace(code)` met l'île en pause, `leavePlace()` la reprend ; un modèle se charge par scène (`loadContainer`).
  Un chiffre de géométrie change ici avec son test, jamais dans la scène. Portes : fermées jusqu'à la victoire dans la salle (sauf
  l'entrée et l'énigme : `OPEN_KINDS`), du « vide » pour le déplacement tant qu'elles le sont ; ennemis à leur place de la v1
  (`v1_at`, sans miroir), tournés vers l'ouest, leur obstacle retiré à leur chute. Ennemis : squelettes KayKit (même rig que le héros)
  et monstres Quaternius, dont l'échelle est mesurée une fois (`content/monde/monstres.json`, `node tools/mesurer_monstres.mjs` avec
  la prévisualisation lancée : une boîte au repos ne dit rien d'une armature à l'échelle 100). `&e2e` : `world.enterPlace(code)`,
  `world.interior` (`teleport(x, z)`, `frame(écart, beta, distance)`, `heroPosition()`, `enemies`, `fighting`), `world.places`,
  `world.measureMonster(modèle)`, et `encounter` (le combat en cours : `hero.hp`…).
- **Musique** (`app/music.ts` joue, `core/music.ts` décide du volume, testé) : morceaux de `deploy/musique/` listés dans
  `content/monde/musique.json` (ordre de lecture, crédit des Options), servis sous `/musique/` par nginx ; `npm run dev` et
  `vite preview` les servent depuis le même dossier (`vite.config.ts`, requêtes `Range` comprises). Elle démarre à l'entrée
  dans l'île (un geste de l'enfant a déjà eu lieu ; sinon le premier clic ou la première touche), s'éteint en fondu pendant
  une question et baisse sous une voix (`Voice.isSpeaking`) ; `&musique=0` la désactive (ni lecture ni bouton : captures,
  mesures). Ajouter un morceau : `python tools/encode_musique.py`, procédure dans `docs/exploitation.md`. Une scène qui
  pose une question ou un dialogue sans passer par `GameScreen` doit prévenir `services.music.setFocus`.
- **CSP stricte** : aucun style en ligne dans le HTML (classes et attributs `data-*` ; l'objet `style` de React est permis),
  aucun fichier en `data:` produit par Vite, aucune ressource hors du site (pas de CDN : décodeurs, polices, twgsl). La même
  CSP est posée par `vite preview` : le parcours navigateur échoue sur toute violation.
- **Accessibilité** : tout texte est du HTML ; les aménagements du parent sont des attributs de `<html>` traités en CSS ;
  aucune question contre la montre ; un effet fort respecte le mode calme (`calm`). Énoncés courts, une idée par phrase.
- **Rendu** : les profils (`game/quality.ts`) ne changent que des réglages. Un modèle se charge une fois (`game/assets.ts`) ;
  le décor répété passe en *thin instances*. Tout asset ajouté est inscrit dans `client/public/ressources/LICENSES.md`.
- **Sauvegarde** : partie v2 dans l'emplacement `v2` (`core/save.ts`). La maîtrise des notions n'est jamais calculée par le
  client. Aucune migration ne doit casser la v1 tant qu'elle est en service.
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
- Un monstre Quaternius se charge dans son propre conteneur (`loadOwnContainer`, pas de cache) et garde les nœuds de son fichier :
  une copie perd l'armature (-90°, ×100) et s'étire. Deux gelées dans un même lieu ont donc chacune leur chargement. Les squelettes
  KayKit, eux, passent par le cache (copie sans danger) mais pèsent 4,8 Mo chacun, avec leurs 95 animations.
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
