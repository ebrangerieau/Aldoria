# TRD v2 : Les Chroniques d'Aldoria

7 novembre 2026 · Compagnon de `docs/PRD.md` (v2). Les décisions et leur raison : `docs/decisions.md`. Le TRD de la v1
(`docs/TRD.md` à la racine) reste la référence pour l'API, le moteur pédagogique, le modèle de données et la sécurité, qui
sont repris sans changement de fond ; ce document décrit ce qui est nouveau ou différent.

## 0. Décisions structurantes

| Sujet | Décision | Détail |
| --- | --- | --- |
| Appareils | PC seulement, navigateur récent | D1 |
| Moteur 3D | Babylon.js 9, TypeScript strict | D2 |
| Interface | HTML et CSS (React 19) au-dessus du canevas 3D | D3 |
| Monde | une île continue, troisième personne ; lieux de quête en intérieurs | D4 |
| Style | low-poly enrichi (KayKit, Quaternius, sol en facettes, lumière soignée) | D5 |
| Données | même API, même base ; partie v2 dans son propre emplacement | D6 |
| Production | une seule API (construite depuis `v2/api`) et une seule base pour les deux jeux ; le jeu v2 sur `aldoria2.bandtrack.fr` | D11 |
| Contenu du monde | JSON dans `content/monde/`, jamais dans le code | D7 |
| Déplacement | règles pures (eau, pentes, cercles d'obstacles) sans moteur physique | D8 |
| Rendu | WebGL 2 par défaut ; WebGPU prêt (outils servis par le site, repli automatique), défaut à choisir après mesure | D9 |
| CSP | stricte (`style-src 'self'`, rien hors du site), vérifiée par les tests navigateur | D10 |

## 1. Architecture

```mermaid
flowchart LR
    subgraph Navigateur["Navigateur du PC"]
        UI[Interface React<br/>écrans, questions, dialogues]
        W[Monde Babylon.js<br/>île, héros, caméra]
        C[core/<br/>réponses, questions, session,<br/>sauvegarde, relief, déplacement]
        LS[(localStorage<br/>file des réponses, paquets, partie)]
        UI <-->|événements| W
        UI --> C
        W --> C
        C <--> LS
    end
    subgraph VPS["VPS bandtrack.fr (Docker)"]
        T[Traefik]
        N[web : nginx<br/>build Vite, modèles 3D, admin]
        A[api : FastAPI<br/>reprise de la v1]
        V[voice : Piper]
        D[(db : PostgreSQL 16)]
        B[backup]
    end
    C -->|HTTPS /api/v1/play| T
    T --> N
    T --> A
    A --> V
    A --> D
    B --> D
```

Trois couches dans le client, et une seule règle de dépendance : `ui/` et `game/` dépendent de `core/`, jamais l'inverse ;
`ui/` ne touche pas à Babylon.js et `game/` ne connaît pas React. Ils se parlent par `GameWorld.events` (émetteur typé,
`core/events.ts`) et par quelques méthodes (`setInputEnabled`, `stoneAnswered`).

## 2. Client (`v2/client/`)

### 2.1 Organisation

```
client/
├── index.html, vite.config.ts (CSP de prévisualisation), tsconfig.json (strict)
├── public/ressources/      # servi tel quel : modèles 3D, polices, sons, interface (reprise de la v1)
├── src/
│   ├── main.tsx            # services + interface
│   ├── app/                # services.ts (API, stockage, session, questions, voix, erreurs), errors.ts, buildInfo.ts
│   ├── core/               # TypeScript pur, testé sans navigateur
│   │   ├── answers.ts, mathExpr.ts      # validation (même verdict que l'API)
│   │   ├── questionService.ts           # choix adaptatif des questions
│   │   ├── session.ts, api.ts, storage.ts, save.ts
│   │   ├── accessibility.ts, voice.ts, answerText.ts, events.ts, items.ts, errorReport.ts
│   │   └── world/          # terrain.ts (relief), heightGrid.ts, movement.ts, obstacles.ts, places.ts
│   ├── game/               # Babylon.js seulement
│   │   ├── GameWorld.ts    # orchestre l'île, le héros, la caméra, les interactions
│   │   ├── engine.ts, quality.ts, theme.ts, atmosphere.ts (ciel, soleil, ombres, post-traitement)
│   │   ├── island.ts (sol en facettes, mer), decor.ts (bâtiments, forêts, Sphinx), assets.ts
│   │   └── characters.ts   # héros et habitants KayKit, renard Quaternius, animations
│   └── ui/                 # React seulement : App, Title, Login, GameScreen, QuestionPanel, widgets/, Dialogs, styles.css
├── tests/                  # Vitest : vecteurs partagés, questions, session, sauvegarde, relief, déplacement
└── e2e/                    # smoke.mjs (parcours), captures.mjs (vérification visuelle)
```

### 2.2 Rendu

| Élément | Choix | Pourquoi |
| --- | --- | --- |
| Sol | maillage construit depuis `HeightGrid`, rendu en facettes (une couleur et une normale par triangle), teinté par région, sable, roche et neige selon l'altitude et la pente | style low-poly des modèles ; le héros marche sur les triangles qu'on voit |
| Ciel | voûte en dégradé (couleurs par sommet), disque du soleil en panneau | stylisé, fondu dans le brouillard, sans shader particulier |
| Lumière | soleil directionnel + lumière d'ambiance ; ombres en cascades (1 à 3) jusqu'à 180 m | relief lisible, profondeur |
| Post-traitement | rendu HDR, tonalité ACES, vignette, halo (bloom), halo des objets lumineux (glow), occlusion ambiante (SSAO2, profil `haut`) | ce que la v1 ne pouvait pas faire |
| Décor | un modèle chargé une fois ; forêts, rochers et nuages en *thin instances* (un appel de dessin par modèle) | quelques milliers d'arbres pour moins de 300 appels |
| Personnages | `.glb` KayKit avec leurs 76 animations, fondu entre animations ; pièces d'équipement cachées par nom de nœud ; racine de squelette recalculée au chargement (`alwaysComputeSkeletonRootNode`) | même apparence que la v1 ; certains fichiers (renard Quaternius) déclarent une racine fausse |

Profils (`?qualite=`, `game/quality.ts`) : `haut` (défaut), `moyen`, `bas`. Ils ne changent que des réglages (taille des
ombres, cascades, MSAA, SSAO, halo, densité de végétation, résolution), jamais le code d'une scène.

### 2.3 Moteur : WebGL 2 par défaut, WebGPU prêt

`game/engine.ts` crée un moteur WebGL 2 par défaut ; `?moteur=webgpu` demande WebGPU, `?moteur=webgl2` force l'autre. Si WebGPU
manque ou échoue à l'initialisation, le jeu repart en WebGL 2 (`world.engineFallback` dit pourquoi, le compteur `?perf` et le banc
`?mesure` affichent « WebGL 2 (repli) »). Tout le code de rendu passe par l'API commune de Babylon.js et ne dépend pas du moteur.

Babylon.js charge à la demande, depuis son CDN, glslang et twgsl (traduction d'un shader GLSL en WGSL) : la CSP l'interdit.
`vite.config.ts` les copie de `node_modules/@babylonjs/core/assets/` vers `/ressources/babylon/` (build et `npm run dev`, même
version que le moteur), `Tools.ScriptBaseUrl` y pointe, et nginx sert `.wasm` en `application/wasm` (type obligatoire avec
`nosniff`). Les shaders de l'île ont tous leur version WGSL : ces fichiers (2,6 Mo, 0,9 Mo compressés) ne sont téléchargés que si
un shader GLSL sans équivalent apparaît. Le choix du moteur par défaut attend les mesures de l'étape 0.5 : voir D9, avec la
condition à remplir avant de passer WebGPU par défaut.

Mesure : `?mesure` (`core/perf.ts`, `GameWorld.measure`) fait faire un tour fixe de l'île et rend une ligne pour
`docs/perf-log.md` ; protocole dans ce journal.

### 2.4 Déplacement et caméra

- `core/world/movement.ts` : vitesse de course 6,5 m/s, marche 2,8 m/s (Maj) ; refus de l'eau profonde (plus de 0,7 m) et des
  pentes de plus de 50° en glissant le long de l'obstacle ; ralenti dans l'eau ; cercles d'obstacles (`obstacles.ts`, grille
  de cases de 16 m). Le renard et les futurs personnages utilisent les mêmes règles.
- Commandes : `KeyboardEvent.code` (position de la touche : ZQSD sur AZERTY, WASD sur QWERTY), flèches, E ou Entrée pour agir,
  clic sur le sol pour y aller (aménagement « gestes »).
- Caméra orbitale autour du héros (souris, molette), qui revient seule derrière lui quand on avance sans toucher la souris
  depuis 1,8 s, et ne passe jamais sous le relief. Sa cible se modifie **en place** (réaffecter `camera.target` recalcule
  ses angles et annule la souris).

### 2.5 Interface et accessibilité

- Tout texte est du HTML : panneau de question, dialogues de Maître Ysaline, seuils, options, connexion. Les formules sont
  rendues par KaTeX (repli sur le SVG de l'API si KaTeX ne sait pas les lire).
- Les aménagements du parent (`Profile.accommodations`, inchangés) deviennent des attributs de `<html>`
  (`data-text-size`, `data-readable-font`, `data-spacing`, `data-big-targets`, `data-calm`, `data-colorblind`) ; `ui/styles.css`
  fait le reste. L'enfant peut agrandir le texte, pas descendre sous le choix du parent.
- Lecture à voix haute : voix du serveur (`POST /play/speech`) si l'enfant est connecté, sinon voix du navigateur.
- Aucun style en ligne écrit dans le HTML : React passe ses styles par l'objet `style` (autorisé par la CSP), le reste par
  des classes et des attributs `data-*`.

### 2.6 Session, hors connexion et sauvegarde

- `core/session.ts` : paquet de session (`POST /play/session/start`, mode `monde`), file des réponses avec UUID dans le
  stockage local, envoi par lots de 50, refus définitifs écartés (400, 403, 404, 409, 413, 422), dernier paquet gardé pour
  jouer hors connexion. Mode découverte : aucune réponse n'est enregistrée.
- `core/save.ts` : partie v2 (`slot: "v2"`, `schema_version` 1) : XP, lieux terminés, pierres éveillées (par jour), étapes
  de l'histoire vues, apparence. La maîtrise des notions n'y est pas : le serveur la calcule depuis les réponses.

### 2.7 Erreurs du jeu

`core/errorReport.ts` (logique, testée) et `app/errors.ts` (branchement) : exceptions non rattrapées, promesses rejetées et
`console.error` vont, dédoublonnées et par lots de 20, à `POST /play/client-errors` (route reprise de la v1, appareil relié
exigé, jamais de donnée d'enfant). Chaque erreur porte son endroit dans le code (premier appel de la pile, sans l'adresse du
site ; les fichiers `.map` du build permettent de remonter au source), l'écran (`titre`, `profils`, `ile`…), la version du build
(`VITE_VERSION`, le commit) et le navigateur. Active dans le jeu construit seulement (`?erreurs=0|1`) ; sans appareil relié
rien ne part (mode découverte, tests). L'exploitant les lit dans Exploitation → Erreurs du jeu.

### 2.8 Le crochet de test

Avec `?e2e`, `window.__aldoria` expose le monde (`heroPosition`, `teleport`, `frame`, `scene`, `camera`, `fox`), les services
(dont `errors.list()`) et la question affichée. C'est le seul mécanisme de test et de capture (la v1 en avait une quinzaine).
`?decouverte` ouvre l'île sans compte, `?classe=2nde`, `?monde=brouillard`, `?qualite=`, `?perf` (compteur), `?interface=0`
(captures sans interface), `?renard=0`, `?erreurs=0|1`, `?erreur_test=1`.

## 3. Données du monde (`v2/content/monde/`)

| Fichier | Contenu | Lu par |
| --- | --- | --- |
| `ile.json` | graine, rayon, position de la Citadelle, du départ, du village, des secrets, de l'île du Sphinx ; centre, relief, teinte et orientation de chaque région | `core/world/terrain.ts` |
| `lieux.json` | les 30 lieux de quête de la v1 : classe, matière, région, ordre, chapitres, textes (seuil, intro, page, répliques de l'Effaceur), énigme, salles et ennemis | `core/world/places.ts` ; vérifié par `api/tests/test_dungeon.py` |
| `regions.json` | titre et texte de brouillard des régions, matières logées chez une autre, lieux secrets, textes de la Citadelle | client |
| `villages.json` | Clairval et Brumegarde, habitants et quêtes | client (phase 2) |
| `heros.json` | phrases du héros entre deux lieux, par ambiance | client (phase 1) |

Règles : ces fichiers font foi (le script `tools/export_v1_content.py` ne se relance plus) ; un lieu ajouté passe les tests de
l'API (chapitres du programme, énigme du bon niveau) et ceux du client (posé sur un replat de sa région, à plus de 15 m des
autres) ; les positions de la v1 restent sous des clés `v1_` à titre d'information.

## 4. API (`v2/api/`)

Reprise entière de la v1 (FastAPI, SQLAlchemy, Alembic, 1 876 tests). Changements v2 :

| Changement | Détail |
| --- | --- |
| Emplacement de sauvegarde | `save_revision.slot` (`v1` ou `v2`), clé primaire `(profile_id, slot, revision)`, migration 0013 ; `GET /play/save?slot=v2`, `PUT /play/save` avec `"slot": "v2"`. Les révisions, conflits et époques sont propres à chaque emplacement. |
| Mode de session `monde` | séances dans l'île ouverte ; affiché « Exploration » dans le tableau de bord du parent |
| Données des lieux | `tests/test_dungeon.py` lit `content/monde/lieux.json` au lieu du GDScript |

À prévoir : aucun nouveau point d'entrée pour les phases 0 et 1. Une phase qui en ajoute un met à jour ce tableau.

## 5. Tests

| Niveau | Outil | Ce qui est couvert |
| --- | --- | --- |
| API | pytest (`uv run pytest -q`) | inchangé (1 876 tests), plus les emplacements de sauvegarde |
| Logique du client | Vitest (`npm test`) | 81 vecteurs de réponses partagés avec l'API, expressions, choix adaptatif des questions, notion ratée qui revient, mise de côté, file hors connexion, refus définitifs, paquet gardé, mode découverte, sauvegarde et conflits, relief déterministe, régions, pose des 30 lieux, déplacement (eau, falaise, obstacles), remontée des erreurs (dédoublonnage, lots, appareil relié, refus, réseau) |
| Types | `tsc` strict | tout le client |
| Navigateur | `e2e/smoke.mjs` (Chromium, WebGL logiciel, CSP de production) | titre → île → erreur d'essai captée → renard entier et sur le sol → le héros avance → pierre → question → bonne réponse → XP ; échoue sur toute autre erreur de la page ou de la console et toute ressource introuvable |
| Visuel | `e2e/captures.mjs` | huit vues de l'île (départ, panorama, Cimes, lieu, forêt, côte, Sphinx, Brouillard) |

Règle : une logique nouvelle va dans `core/` avec son test ; une scène Babylon.js reste mince.

## 6. Intégration continue et déploiement

En production, **une seule API et une seule base servent les deux jeux** (D11). Le fichier Compose de production reste
`deploy/docker-compose.yml` à la racine du dépôt (dossier `/docker/aldoria` sur le VPS) :

| Service | Image | Publiée et déployée par | Rôle |
| --- | --- | --- | --- |
| `web` | `aldoria-web` (`ALDORIA_TAG`) | `.github/workflows/ci.yml` | jeu v1 sur `aldoria.bandtrack.fr`, espace parent sur `aldoria-admin.bandtrack.fr` |
| `web2` | `aldoria-web2` (`ALDORIA2_TAG`) | `.github/workflows/v2.yml` | jeu v2 sur `aldoria2.bandtrack.fr` (contient aussi l'espace parent de `v2/admin`, servi à l'étape 0.8) |
| `api` | `aldoria-api` (`ALDORIA2_TAG`) | `.github/workflows/v2.yml`, depuis `v2/api` | API des deux jeux ; `/api` est routé vers elle sur `aldoria.*` et `aldoria2.*` |
| `voice`, `db`, `backup` | inchangés | `ci.yml` (voix, sauvegardes) | inchangés |

- `v2.yml` (chemins `v2/**`, son fichier, `deploy/docker-compose.yml`) : API (ruff, pytest), espace parent (build), client
  (types, Vitest, build, parcours navigateur). Sur `main` : publication des deux images (contexte `v2/`), puis déploiement.
- **Déploiement v2** (job `deploy`, mêmes secrets SSH que la v1, environnement `production`) : sauvegarde vérifiée de la base
  si la migration appliquée en base (donnée par `/health`) n'est pas la dernière de `v2/api`, ou si l'API ne répond pas ; copie
  du Compose ;
  `ALDORIA2_TAG` écrit dans `.env` ; `docker compose pull api web2` puis `up -d --no-deps api web2` ; l'API en service et
  `aldoria2.bandtrack.fr/version.txt` doivent donner ce commit dans les 5 minutes ; puis le parcours navigateur (mode découverte,
  rien n'est enregistré) tourne contre `aldoria2.bandtrack.fr`.
- **Déploiement v1** (`ci.yml`) : ne publie plus l'API ; ne recrée que `web`, `voice` et `backup` ; ne contrôle que la version
  de son jeu. Son parcours navigateur construit l'API depuis `v2/api` : le jeu v1 est testé contre l'API de la production.
- Les deux déploiements partagent un groupe de concurrence (`deploiement-vps`) : jamais deux à la fois sur le VPS.
- `api/` à la racine est gelé : toute évolution de l'API se fait dans `v2/api`, qui garde les tests de la v1 (le contrat du jeu
  v1) et y ajoute les siens.

## 7. Sécurité

Inchangée (TRD v1 §8, chantier « plusieurs familles »). Côté jeu, la CSP de nginx (`deploy/nginx/web.conf`) est la même que
celle de `vite preview` (`client/vite.config.ts`), donc vérifiée par chaque parcours navigateur :
`script-src 'self' 'wasm-unsafe-eval'`, `style-src 'self'`, `img-src 'self' data: blob:`, `connect-src 'self'`, polices du site
seulement. Conséquences déjà rencontrées : pas de fichier intégré en `data:` par Vite (`assetsInlineLimit: 0`), pas d'écran de
chargement de Babylon.js (`SceneLoaderFlags.ShowLoadingScreen = false`), aucun CDN (décodeurs, twgsl, polices).

## 8. Budgets de performance (PC)

| Indicateur | Budget | Mesuré le 7 novembre (rendu logiciel, voir `docs/perf-log.md`) |
| --- | --- | --- |
| Images par seconde, PC familial, profil `haut` | 60 | à mesurer sur le PC (étape 0.5) |
| Premier chargement de l'île (Wi-Fi domestique) | < 15 s | île prête en 1,5 s sur le serveur local |
| Téléchargé pour entrer dans l'île | < 25 Mo | 11,9 Mo (Babylon.js 1,7 Mo compressé, modèles 3D 9,8 Mo dont 7,3 Mo pour les deux personnages) |
| Appels de dessin | < 400 | 172 (`bas`) à 290 (`haut`) au départ |
| Triangles visibles | < 2 millions | 0,32 M (`bas`) à 1,44 M (`haut`) |

Piste si un budget est dépassé : imports ciblés de Babylon.js (au lieu de l'import global), niveaux de détail des arbres,
textures et animations des personnages allégées (une seule copie des animations, comme dans la v1).

## 9. Bascule de la v1 vers la v2

1. **Dès l'étape 0.6** : l'API de `v2/api` remplace celle de la v1 en production (migration 0013, sauvegarde automatique
   avant) et le jeu v2 s'ouvre sur `aldoria2.bandtrack.fr`. Les deux jeux écrivent dans la même base : les réponses données dans
   la v2 comptent dans le suivi et dans l'espace parent. Un PC se relie une fois à `aldoria2` (l'appareil est mémorisé par site).
2. **Étape 0.8** : l'espace parent est servi par le conteneur `web2` (code de `v2/admin`) ; `admin/` à la racine est gelé à son
   tour.
3. **Phase 4** : quand la v2 couvre ce que les enfants utilisent dans la v1 (critère du plan), le jeu v2 est servi aussi sur
   `aldoria.bandtrack.fr` ; la v1 reste quelques semaines sur une autre adresse, puis `game/` est archivé et `v2/` remonte à
   la racine (le Compose de production avec lui).
4. La progression pédagogique (réponses, maîtrise, notions mises de côté), la banque de questions, les comptes et les
   appareils reliés ne bougent jamais : ils sont dans la base commune. Seule la partie de jeu (XP, apparence, lieux terminés)
   a deux emplacements ; la partie v2 repart de zéro, ou reprend celle de la v1 par une conversion à écrire au moment de la
   phase 4 (décision à prendre avec les enfants).
