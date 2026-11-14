# Les Chroniques d'Aldoria, v2

Jeu éducatif en 3D (île ouverte, troisième personne) pour réviser le programme de Jules (6e) et Tom (2nde), sur le
navigateur du PC familial. La v1 (Godot, dossiers `game/`, `api/`, `admin/` à la racine) reste en service jusqu'à la bascule.

À lire avant de coder : `docs/TRD.md` (architecture), `docs/decisions.md` (pourquoi), `IMPLEMENTATION_PLAN.md` (où on en
est), `docs/BILAN-V1.md` (les erreurs à ne pas refaire). Histoire : `docs/histoire.md`.

## Arborescence

- `client/` : jeu (Vite, TypeScript strict, Babylon.js 9, React 19). `src/core/` logique pure testée sans navigateur,
  `src/game/` Babylon.js seulement, `src/ui/` React seulement. Fichiers statiques dans `public/ressources/`.
- `api/` : FastAPI reprise de la v1 (Python 3.12, `uv`) ; `admin/` : espace parent (React).
- `content/` : programmes (`seed/`), vecteurs de réponses partagés (`test-vectors/`), données du monde (`monde/*.json`).
- `deploy/` : nginx (CSP), Dockerfiles (contexte : ce dossier) ; `tools/` : scripts. Le Compose de production est celui de la
  racine (`deploy/docker-compose.yml`) : une seule API (celle de `v2/api`) et une seule base pour les deux jeux (D11).

Mise en ligne : un push sur `main` qui touche `v2/` fait publier par `.github/workflows/v2.yml` l'API et le jeu v2, puis les
déployer (sauvegarde de la base avant toute migration, contrôle de version, parcours navigateur sur `aldoria2.bandtrack.fr`).
`api/` à la racine est gelé : l'API évolue ici, sans jamais casser le jeu v1 (ses tests sont dans `api/tests/`).

## Commandes

```bash
npm --prefix client install            # une fois
npm --prefix client run dev            # jeu sur http://localhost:5173 (relaie /api vers l'API locale, port 8098)
npm --prefix client test               # Vitest : logique, vecteurs partagés, relief, déplacement
npm --prefix client run typecheck
npm --prefix client run build          # puis : npm --prefix client run preview (port 4173, CSP de production)
npm --prefix client run e2e            # parcours dans Chromium contre la prévisualisation
npm --prefix client run e2e:lieu        # la Tour des Fractions de l'entrée au coffre, puis retour à l'île (E2E_LIEU=<code> pour un autre)
npm --prefix client run e2e:webgpu     # idem en WebGPU (partie WebGPU ignorée, bien signalée, sans adaptateur ; le repli sur WebGL 2 est toujours vérifié)
npm --prefix client run captures       # vues de l'île dans e2e/captures (E2E_QUALITE=moyen en rendu logiciel)
uv run --directory api pytest -q
uv run --directory api ruff check .
npm --prefix admin run build
```

Adresse du jeu : `?decouverte` (île sans compte, rien n'est enregistré), `&classe=2nde`, `&monde=brouillard`,
`&qualite=haut|moyen|bas`, `&perf` (compteur), `&e2e` (crochet `window.__aldoria` : `world.teleport(x, z, versX, versZ)`,
`world.frame(alpha, beta, distance)`, `world.heroPosition()`, `question`, `services`, `mesure`, `world.engineKind`,
`world.engineFallback`), `&interface=0`, `&moteur=webgl2|webgpu` (WebGL 2 par défaut ; repli automatique si WebGPU manque, D9),
`&lieu=<code>` (entre directement dans un lieu de quête ; crochet `__aldoria.place` : `controller`, `stage`, `progress`),
`&mesure[=secondes]` (banc de mesure : tour fixe de l'île, ligne à recopier dans `docs/perf-log.md`, 40 s par défaut),
`&renard=0` (sans le renard), `&erreurs=0|1` (remontée des erreurs ; active par défaut dans le jeu construit seulement),
`&erreur_test=1` (erreur d'essai au démarrage).

## Règles

- **`core/` ne dépend de rien** (ni Babylon.js, ni React, ni le DOM sauf `localStorage` derrière `Store`). Toute règle de jeu
  y va avec son test Vitest ; une scène Babylon.js reste mince.
- **Le gameplay ne connaît jamais le contenu d'une question** : il demande un item à `QuestionService` (rôle `automatisme`,
  `chapitre`, `enigme`) et reçoit un verdict. La validation (`core/answers.ts`, `core/mathExpr.ts`) rend le même verdict que
  l'API : toute modification se fait des deux côtés et s'ajoute à `content/test-vectors/answers.json`.
- **Données du monde en JSON** (`content/monde/`) : jamais de lieu, de texte d'histoire ou de position écrits dans le code.
  Un lieu ajouté doit passer `api/tests/test_dungeon.py` et `client/tests/world.test.ts`.
- **CSP stricte** : aucun style en ligne dans le HTML (classes et attributs `data-*` ; l'objet `style` de React est permis),
  aucun fichier en `data:` produit par Vite, aucune ressource hors du site (pas de CDN : décodeurs, polices, twgsl). La même
  CSP est posée par `vite preview` : le parcours navigateur échoue sur toute violation.
- **Accessibilité** : tout texte est du HTML ; les aménagements du parent sont des attributs de `<html>` traités en CSS ;
  aucune question contre la montre ; un effet fort respecte le mode calme (`calm`). Énoncés courts, une idée par phrase.
- **Rendu** : les profils (`game/quality.ts`) ne changent que des réglages. Un modèle se charge une fois (`game/assets.ts`) ;
  le décor répété passe en *thin instances*. Tout asset ajouté est inscrit dans `client/public/ressources/LICENSES.md`.
- **Sauvegarde** : partie v2 dans l'emplacement `v2` (`core/save.ts`). La maîtrise des notions n'est jamais calculée par le
  client. Aucune migration ne doit casser la v1 tant qu'elle est en service.
- **Lieux de quête** : le déroulé vit dans `core/quest/` derrière `QuestStage` (scène 3D) et `QuestUi` (React) ; la scène
  (`game/interior/`) et `ui/PlaceScreen.tsx` jouent et affichent, ils ne décident rien. Toute nouvelle règle de lieu va dans
  `core/quest/` avec son test (faux de scène et d'interface). Aucun texte de lieu dans le code : `lieux.json`, `heros.json`,
  `combat.json`. Un modèle d'ennemi ajouté s'inscrit dans `core/combat/monsters.ts` (le test vérifie que le fichier existe).
  Une pièce de décor ajoutée doit être dans `public/ressources/models/kaykit/dungeon/` (`tests/quest-pieces.test.ts` le vérifie
  pour les 30 lieux).
- **Visuels de questions** : une question n'est posée que si son type et son visuel sont dessinés (`core/questionService.ts` :
  `SUPPORTED_TYPES`, `SUPPORTED_VISUALS`, `isPlayable`), sinon l'énoncé serait incompréhensible. Calculs dans `core/visuals.ts`
  (testés), dessin SVG dans `ui/widgets/Visuals.tsx`, réponses dans `ui/widgets/Widgets.tsx`. Aujourd'hui : balance, droite
  graduée, repère quadrillé (vecteurs), tableau de signes ; 24 lieux sur 30 n'ont pas besoin des autres. Restent (lieux de
  maths et Clairval) : graph, robot, map, table, pont, rapporteur, repere_tir. Ajouter un visuel : le composant, son test, puis
  son nom dans `SUPPORTED_VISUALS`.
- **Voix enregistrées** (ElevenLabs : Maître Ysaline et le narrateur) : `deploy/voix/` (`manifest.json` : empreinte SHA-256 du
  texte exact vers un MP3), servies sous `/voix/` (image web ; `vite.config.ts` en dev et en preview). `core/voice.ts` joue le son
  d'un texte français dont l'empreinte est au manifeste (même sans compte), sinon Piper, sinon la voix du navigateur
  (`core/recordedVoices.ts`). Un texte enregistré se lit **seul et à l'identique** : une phrase collée à côté lui ferait perdre sa
  voix, donc l'afficher à part (`note` du `Dialog`, non lue). Modifier un texte de `content/voix/lignes.json` ou le `threshold`
  d'un lieu fait échouer `tests/recordedVoices.test.ts` : relancer `python tools/voix_elevenlabs.py` (clé ElevenLabs dans
  l'environnement, jamais dans le dépôt ; `--essai` liste ce qui serait généré, sans clé). Un nouveau texte de Maître Ysaline
  s'ajoute à `lignes.json` (groupe, id, texte, voix), puis le script génère son son. Crédit ElevenLabs dans les Options.
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
- WebGPU : glslang et twgsl viennent du site (`/ressources/babylon/`, copiés par `vite.config.ts`, `Tools.ScriptBaseUrl`), jamais du
  CDN ; nginx doit servir `.wasm` en `application/wasm`. Un test WebGPU sans carte graphique exige
  `--enable-unsafe-webgpu --enable-features=Vulkan --use-vulkan=swiftshader --use-angle=swiftshader` : sans eux, l'appareil se perd
  (« A valid external Instance reference no longer exists ») ; `navigator.gpu` n'existe pas sur `about:blank` (contexte non sûr).
- En rendu logiciel (CI, conteneur sans carte graphique), le profil `haut` peut dépasser les délais de capture : `bas` pour
  le parcours, `moyen` pour les captures.
