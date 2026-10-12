# IMPLEMENTATION_PLAN – Les Chroniques d'Aldoria

> Plan d'implémentation issu du PRD et du TRD du 10/10/2026 (Eric), complété par une veille technique et pédagogique faite le 10/10/2026. Validé le 10/10/2026.

---

## 0. Contexte

Eric veut un RPG d'exploration 2.5D jouable dans le navigateur (PC familial et tablette Android) pour que Jules (11 ans, 6ème) et Tom (15 ans, seconde générale) révisent leurs maths « sans s'en rendre compte » : chaque combat, énigme ou dialogue repose sur une notion du programme. Le PRD fixe la vision, les personas, le périmètre pédagogique et la roadmap (prototype, tranche verticale, MVP, puis V2 à V4). Le TRD fixe l'architecture : client Godot 4 en export web, API FastAPI, PostgreSQL, éditeur parent React, le tout en Docker derrière Traefik sur le VPS bandtrack.fr.

Le dossier ne contient encore aucun code (seulement `PRD-jeu-educatif-2.5D.md` et `TRD-jeu-educatif-2.5D.md`). Ce plan découpe la construction en phases courtes, chacune validée par un test réel avec les enfants. Il signale les écarts trouvés entre le TRD et l'état de l'art à date, et la façon de les traiter.

**Décisions prises avec Eric le 10/10/2026**

| Sujet | Décision |
| --- | --- |
| Forge / CI | Dépôt privé GitHub + GitHub Actions, déploiement SSH vers le VPS |
| SSO parent | TinyAuth (ForwardAuth Traefik) + Pocket ID (OIDC), déjà en place |
| Personnages | Modèles 3D low-poly CC0 déjà riggés et animés (KayKit, Quaternius) |
| Environnement du prototype | Déployé directement sur le VPS (`aldoria.bandtrack.fr`) pour tester sur la vraie tablette dès le départ |

---

## 1. Synthèse de la veille (10/10/2026) et impacts sur le TRD

### 1.1 Programmes scolaires

**Jules, 6ème** : programme de cycle 3 fixé par l'arrêté du 10 avril 2025 (BO n°16 du 17/04/2025), applicable en 6ème depuis la rentrée 2025.
- *Nouveautés* : pré-algèbre (schémas en barres, balances, suites de motifs) ; probabilités (nombre entre 0 et 1, équiprobabilité) ; fractions approfondies (comparer, encadrer, ordonner fractions et nombres mixtes, additionner et soustraire y compris avec des dénominateurs non multiples dans des cas simples, multiplier par un entier) ; angles (vocabulaire, somme des angles du triangle, bissectrice) ; médiatrice et cercle circonscrit ; échelles ; pensée informatique (séquences d'instructions, boucles) ; dimension historique des notions.
- *Retraits* : aires du triangle et du disque, formules de volume (on compte des cubes), agrandissement et réduction, distance d'un point à une droite, critères de divisibilité par 3 et par 9, division par un nombre à deux chiffres, coefficient de proportionnalité (remplacé par le retour à l'unité).
- Une progression type de l'académie de Bordeaux compte 22 séquences, plus une progression d'automatismes menée en parallèle.

**Tom, seconde** : arrêté du 26 février 2026 (JO du 27/03/2026, BO n°14 du 02/04/2026, NOR MENE2602914A), applicable depuis la rentrée 2026.
- *Structure* : 4 thèmes (nombres, calculs et algèbre ; géométrie ; fonctions ; statistiques et probabilités) et 3 parties transversales (vocabulaire ensembliste et logique ; algorithmique et programmation en Python ; automatismes).
- *Nouveautés* : fonction valeur absolue comme fonction de référence ; équations avec quotients ; probabilités conditionnelles, arbres pondérés et tableaux croisés ; séries regroupées en classes, histogrammes, fréquences cumulées, moyenne pondérée, comparaison de séries (moyenne et écart type, médiane et écart interquartile) ; pourcentages de pourcentages ; boucles `while` et fonctions en Python ; raisonnement par disjonction de cas et par l'absurde.
- *Retraits* : nombres premiers (seuls restent multiples, diviseurs et parité).
- ⚠️ **Les sources secondaires se contredisent** sur l'échantillonnage et sur l'étude des fonctions racine carrée et cube. Le texte officiel (annexe du BO) est bloqué pour la récupération automatique (erreur 403). **Action Eric** : vérifier ces deux points dans l'annexe et dans le manuel de Tom avant de figer les notions correspondantes. Elles sont marquées `a_valider` dans le seed.

**Fait nouveau qui a de l'importance pour Tom** : depuis la session 2027, une **épreuve anticipée de mathématiques** a lieu en fin de première (2 h, sans calculatrice, coefficient 2). Sa première partie, sur 6 points, est un **QCM d'automatismes** organisé en 6 thèmes : calcul numérique et algébrique ; proportions et pourcentages ; évolutions et variations ; fonctions et représentations ; statistiques ; probabilités. Tom la passera en juin 2028. → Pour Tom, les automatismes du jeu prennent **le format QCM de l'épreuve**, classés selon ces 6 thèmes (la note de service du 10/06/2025 au BO n°24 donne la liste officielle ; une brochure de l'académie de Nice en recense 256).

### 1.2 Briques techniques

| Sujet | Constat | Impact sur le plan |
| --- | --- | --- |
| Godot | Dernière version stable : **4.7.2** (18/08/2026). 4.8 est en dev7. Le web ne gère toujours que **WebGL 2 (renderer Compatibility)**, pas WebGPU. L'export sans threads est le défaut depuis 4.3. | On fige **Godot 4.7.2 standard (sans .NET)** pour toute la phase. |
| Audio web | Le mode par défaut **Sample** a une faible latence mais ne permet ni effets, ni réverbération, ni audio procédural. | Le design sonore se passe d'effets temps réel (sons préparés à l'avance). Les navigateurs bloquent la lecture automatique : l'écran-titre impose un « Toucher pour commencer ». |
| Persistance `user://` | Stockée en IndexedDB. Ne fonctionne pas en navigation privée. `OS.is_userfs_persistent()` peut se tromper. | Le serveur reste la source de vérité. Un avertissement s'affiche si la persistance échoue. |
| Onglet en arrière-plan | Le jeu se met en pause. | Le minuteur de session compte le temps actif, pas le temps écoulé. |
| Perf mobile | Un retour d'expérience Godot 4 web sur un Android moyen : 31→60 fps et 612→152 Mo. Les gains viennent surtout du **pipeline d'assets** : textures compressées en VRAM (ETC2/ASTC) au lieu de WebP, **atlas**, chargement différé par priorité, profils de qualité adaptés à l'appareil. | Ces règles sont inscrites dans le pipeline d'assets dès la phase 0, avec un profil qualité « tablette ». |
| Serveur web | Servir `.wasm` en `application/wasm` et `.pck` en `application/octet-stream`. gzip divise le `.wasm` par environ 4 ; Brotli fait mieux. | Fichiers `.br` et `.gz` précompressés en CI, servis par nginx avec `gzip_static` (et le module brotli si disponible, sinon gzip seul). |
| Template d'export allégé | Recommandé pour le mobile, mais demande de compiler Godot (SCons + Emscripten). | **Seulement si** les budgets de chargement ne sont pas tenus avec le template officiel (décision à la fin de la phase 1). |
| Pyodide | Version **314.0.x** (Python 3.14, nouvelle numérotation). L'interruption d'un code qui boucle (`setInterruptBuffer`) **exige SharedArrayBuffer, donc les en-têtes COOP/COEP**. Le TRD les exclut. | ⚠️ **Écart TRD §2.6** : le délai de 3 s est obtenu par `worker.terminate()` puis recréation du worker (Pyodide est rechargé depuis le cache). Pas de COOP/COEP. Concerne la V2 seulement. |
| LaTeX → SVG | **ziamath 0.13** (fév. 2026) : Python pur, sans installation LaTeX, police STIX Two Math intégrée, SVG fait uniquement de chemins (donc sans dépendance de police côté client). | Cela tranche le point TRD §14 « bibliothèque LaTeX → SVG ». Il reste à vérifier en phase 1 le rendu des SVG ziamath par `Image.load_svg_from_buffer` (moteur ThorVG). |
| Tests Godot | **GUT 9.x**, branche `godot_4_7`. Exécution en ligne de commande : `godot --headless -d -s addons/gut/gut_cmdln.gd -gdir=res://tests -gjunit_xml_file=... -gexit`. | Adopté. |
| CI Godot | Image Docker `barichello/godot-ci:4.7.2` (export headless `godot --headless --export-release "Web"`). | Adopté dans GitHub Actions. |
| Assets CC0 | KayKit (Dungeon Remastered avec 200+ éléments ; Adventurers avec personnages riggés et 75+ animations, en glTF), Quaternius (personnages, monstres, environnements, bibliothèque d'animations universelle), Kenney (3D, UI, audio). Poly Pizza mélange CC0 et CC-BY. | Registre `assets/LICENSES.md` obligatoire, avec pack, URL, licence et date. |
| Répétition espacée | `fsrs` (py-fsrs, algorithme FSRS-6) est maintenu. | Leitner au MVP derrière l'interface `Scheduler` ; FSRS en option plus tard (TRD §5.3). |
| TinyAuth + Pocket ID | Piège connu : derrière Traefik, les en-têtes d'identité **n'arrivent pas** si l'adresse ForwardAuth vise le service interne au lieu de l'URL publique complète de l'endpoint. | Ce cas fait partie des tests de recette de la phase 2 (voir §3.3). On utilise le skill `docker-compose-traefik` (stack bandtrack.fr). |
| Dev assisté par IA | Le serveur MCP `godot-mcp` (Coding-Solo) permet à Claude Code de lancer le projet, lire les logs de debug et manipuler les scènes. | Optionnel, recommandé dès la phase 0 (`claude mcp add godot -- npx @coding-solo/godot-mcp`). |

### 1.3 Ajustements apportés au TRD (justifiés)

1. **API admin servie sur l'hôte admin** : `aldoria-admin.bandtrack.fr/api/v1/admin/*` (au lieu de `aldoria.bandtrack.fr/api/v1/admin/*`). L'éditeur appelle ainsi sa propre origine : pas de CORS, cookie TinyAuth naturel, une seule règle ForwardAuth. Le router `aldoria.bandtrack.fr/api` exclut explicitement `/api/v1/admin` et retire les en-têtes `Remote-*` entrants (protection contre l'usurpation d'en-tête).
2. **Timeout Pyodide** par `worker.terminate()` (voir ci-dessus).
3. **Source unique des schémas d'items** : les modèles Pydantic font foi. Un script exporte les JSON Schema dans `content/schemas/`. Des **vecteurs de test partagés** (`content/test-vectors/*.json` : saisie, réponse attendue, verdict) sont rejoués à la fois par pytest et par GUT, pour garantir que l'API et le client valident les réponses de la même façon.
4. **Automatismes de Tom** au format QCM de l'épreuve anticipée (6 thèmes), en plus des autres types.
5. **Pas de module de navigation 3D** : déplacement direct avec `CharacterBody3D.move_and_slide` (clavier, manette, joystick virtuel tactile, clic ou toucher pour aller vers un point en ligne droite avec glissement le long des murs). Les salles sont petites ; cela garde le template d'export minimal.

---

## 2. Stack et conventions

| Couche | Choix | Version |
| --- | --- | --- |
| Client jeu | Godot standard, GDScript typé, renderer Compatibility, export web sans threads, compression VRAM Desktop + Mobile | 4.7.2-stable (figée) |
| Tests client | GUT | 9.x, branche `godot_4_7` |
| API | Python, FastAPI, Uvicorn, Pydantic v2, SQLAlchemy 2 (async), Alembic, pydantic-settings, PyJWT, argon2-cffi, SymPy, ziamath | Python 3.12 ou plus, gestion des dépendances avec `uv` |
| Base | PostgreSQL | 16-alpine |
| Admin | React + TypeScript + Vite, TanStack Query, shadcn/ui, React Router | React 18 ou plus |
| Tests | pytest + httpx, Hypothesis pour les générateurs, Playwright pour l'admin | — |
| Infra | Docker Compose, Traefik (existant), nginx:alpine, GitHub Actions, `barichello/godot-ci:4.7.2` | — |
| Python de Tom (V2) | Pyodide auto-hébergé, dans un Web Worker | 314.0.x |

**Conventions** : JSON en snake_case, dates ISO 8601 UTC, erreurs au format `{"error":{"code","message"}}` (TRD §3.4). Codes de notion stables de la forme `6e.maths.fractions.addition` et `2nde.maths.vecteurs.colinearite`. GDScript : `class_name` pour les types partagés, signaux plutôt que couplages directs, ressources `.tres` pour les données de jeu (`WorldTheme`, `DungeonDef`, `EnemyDef`). Un `CLAUDE.md` à la racine documente les commandes (tests, export, déploiement) et les conventions.

**Arborescence** : celle du TRD §10.2, avec en plus `content/test-vectors/`, `content/seed/{6e,2nde}/`, `tools/` (scripts : export des schémas, précompression, mesure du poids) et `docs/` (PRD et TRD déplacés ici).

---

## 3. Phases

Chaque phase se termine par un **critère de passage** testé avec Jules et Tom. Les durées supposent un travail à temps partiel avec assistance IA.

### Phase 0 – Fondations et levée du risque tablette (≈ 1 semaine)

> ✅ **Terminée le 2026-10-10.** En ligne sur https://aldoria.bandtrack.fr, CI/CD opérationnelle (déploiement à chaque push sur `main`). Tablette (Android 10, Chrome 138) : 30 fps avec le profil `tablette` (fausses lumières, éclairage par sommet, sans ombres, pleine résolution). **Godot 4 confirmé, plan B non déclenché.** Contrainte pour la suite : pas de vraies lumières ponctuelles ni d'ombres temps réel sur tablette (détail et mesures : `docs/perf-log.md`).

Objectif : savoir **avant tout développement de gameplay** si un export Godot 3D tient sur la tablette.

1. Initialiser le dépôt GitHub privé `aldoria` avec l'arborescence, `.gitignore` (Godot, Python, Node), `.editorconfig`, `CLAUDE.md`, et déplacer PRD et TRD dans `docs/`.
2. Créer le projet Godot 4.7.2 avec les réglages : renderer Compatibility ; export Web sans threads ; compression VRAM Desktop + Mobile ; audio web en mode Sample ; étirement `canvas_items` avec ratio `expand` ; base 1280×720. Installer GUT (branche 4.7). Ajouter un *overlay* de debug (fps, appels de dessin, mémoire vidéo et statique, temps de chargement) activable par une touche ou un geste à trois doigts.
3. Construire une **scène d'étalonnage** : un diorama représentatif (salle de donjon KayKit, 2 personnages animés, une lumière directionnelle et des ombres, quelques particules, caméra inclinée à focale longue d'environ 20° de FOV).
4. Squelette `deploy/docker-compose.yml` avec `web` (nginx : types MIME wasm et pck, `gzip_static`, cache long sur les fichiers hachés, `no-cache` sur `index.html`, CSP du TRD §8), `api` (FastAPI avec seulement `/api/v1/health`) et `db`. Labels Traefik générés avec le **skill `docker-compose-traefik`** (réseau, entrypoint, certresolver propres à bandtrack.fr). `.env.example`.
5. Mettre en place le premier workflow GitHub Actions : export web headless, précompression `.br`/`.gz` (script `tools/precompress`), publication sur le VPS par rsync/SSH, puis `docker compose up -d`.
6. **Mesures sur la tablette réelle** (Chrome Android, débogage distant via `chrome://inspect`) et sur le PC : poids compressé, premier chargement et chargements suivants, fps, appels de dessin, mémoire. Consigner les résultats dans `docs/perf-log.md`.

**Critère de passage** : déploiement HTTPS fonctionnel ; mesures notées. Si la tablette affiche moins de 30 fps sur la scène d'étalonnage malgré le profil « tablette » (ombres coupées, résolution à 0,75, moins de particules), on **décide tout de suite** : plus d'optimisation ou plan B Babylon.js (PRD §8).

### Phase 1 – Prototype « combat » (2 à 3 semaines)

> 🟡 **Prototype livré le 2026-10-10, en attente du test avec Jules et Tom.** En ligne sur https://aldoria.bandtrack.fr (profils créés, PIN tirés au hasard). Livré : 4 générateurs (1 000 tirages/difficulté vérifiés par SymPy), validation des réponses identique API/client (41 vecteurs partagés), API joueur (PIN Argon2id, JWT, session, tentatives idempotentes), formules SVG intégrées au paquet de session, combat complet dans les deux ambiances, file de réponses hors connexion. Tests : 78 pytest, 26 GUT (dont parcours de combat complet). **Écarts au plan** : formules incluses dans le paquet plutôt qu'une route `/render/latex` (plus simple, jouable hors connexion) ; équivalence d'expressions sur 8 points fixes (verdict identique client/serveur) ; effets sonores synthétisés (`tools/make_sfx.py`). **Reste** : test enfants, mesures tablette du combat, test de coupure réseau sur tablette.

Livrables du TRD §13 : une salle, un ennemi, 3 widgets, 4 générateurs, et les routes `login`, `session/start` et `attempts`.

**API** (`api/app/`)
- Modèles minimaux et migration Alembic initiale : `profile`, `game_session`, `attempt`. Seed de deux profils (Jules et Tom) avec PIN haché en Argon2id.
- `POST /play/login` : PIN vers JWT HS256 de 12 h, avec verrouillage de 5 minutes après 5 échecs. `GET /play/profiles`.
- `engine/generators/` : interface `generate(params, difficulty, seed) -> Item` et **4 générateurs** : `6e.fractions.addition_meme_denominateur_et_multiples`, `6e.fractions.comparer`, `2nde.auto.coefficient_multiplicateur` (QCM au format de l'épreuve anticipée), `2nde.calcul.developper_identites` (type `expression`).
- `POST /play/session/start` : paquet d'items générés aléatoirement, sans scheduler pour l'instant. `POST /play/attempts` : idempotent par UUID (`ON CONFLICT DO NOTHING`).
- `GET /render/latex?h=` : ziamath avec cache disque par hash. Le paquet contient les hashes de ses formules.
- Tests : 1 000 tirages par difficulté et par générateur, réponses vérifiées par SymPy ; idempotence des tentatives.

**Client** (`game/`)
- Autoloads : `ApiClient` (HTTPRequest, jeton, base d'URL selon le *feature tag* web ou dev), `Session` (paquet en mémoire), `QuestionService` (choix d'un item compatible et **validation locale**).
- `ui/question_widgets/` : `mcq`, `numeric` (pavé tactile avec touches fraction et virgule ; accepte `3/4`, `0,75` et les fractions équivalentes selon `accept_equivalent`), `expression` (clavier mathématique virtuel ; équivalence testée sur 8 points avec la classe `Expression`, tolérance 1e-6, contrôle de forme optionnel). Cibles tactiles d'au moins 48 px, 3 tailles de texte.
- Rendu des formules : `RichTextLabel` en BBCode pour les cas simples, SVG ziamath via `Image.load_svg_from_buffer` pour les autres. **À vérifier sur une vingtaine de formules de seconde.**
- **Scène de combat** (`core/combat/`) au tour par tour :
  - Trois actions : *Frappe* (automatisme rapide), *Sort* (notion du chapitre, plus de dégâts) et *Soin* (révision).
  - La justesse et la vitesse modulent la puissance : coup critique avec ralenti si la réponse est juste en moins de 50 % du temps cible.
  - Une erreur ouvre un panneau d'**explication courte** et laisse l'ennemi jouer. À 0 PV, le héros se replie au point de contrôle, PV restaurés, **sans aucune perte** de progression.
  - *Game feel* : particules, légère secousse d'écran, pause d'impact (*hitstop*), chiffres de dégâts, sons de réussite très gratifiants et son d'erreur doux.
- Écran de profil : avatars et pavé PIN.
- `WorldTheme.tres` pour Jules (palette chaude et lumineuse, ennemi rond) et pour Tom (palette froide et sombre, ennemi inquiétant, interface épurée), appliqué à la même scène.
- Tests GUT : validation des réponses sur les vecteurs de test partagés.

**Critère de passage** (PRD et TRD) : les deux enfants **demandent à rejouer** ; budgets du TRD §2.2 tenus sur la tablette ; aucune tentative perdue après une coupure réseau simulée (DevTools hors ligne puis reconnexion). Si le chargement dépasse 15 s sur la tablette, on lance le chantier « template d'export allégé ».

### Phase 2 – Tranche verticale (4 à 6 semaines)

> 🟡 **En cours (2026-10-11).** Fait : modèle de données et seed du programme (23 chapitres, 65 notions) ;
> moteur pédagogique (Leitner, maîtrise, sélecteur, suivi rejoué depuis l'historique) ; 14 générateurs
> (dont l'énigme des miroirs, réservée aux énigmes) ; sauvegarde serveur versionnée (`GET/PUT /play/save`,
> 20 révisions, la partie la plus avancée gagne) et `SaveManager` ; XP et niveaux ; camp de base ; Archives
> (étoiles par notion, bestiaire) ; donjon complet par monde (6 salles, 2 combats à 1-2 ennemis, énigme à
> 3 piédestaux, salle d'élite, boss de synthèse, coffre), points de reprise, repli sans perte.
> Espace parent (2026-10-11) : `aldoria-admin.bandtrack.fr` derrière TinyAuth ; tableau de bord (notions
> acquises / fragiles / en cours / jamais vues, temps de jeu sur 14 jours, sessions, notions à retravailler),
> statut des chapitres et date de contrôle par enfant, durée de session, décision sur les notions « à valider ».
> Recette automatisée : un `Remote-User` forgé sur l'hôte public reçoit 404 (banc local et production).
> Connexion SSO réelle vérifiée par Eric le 2026-10-11 (identité Pocket ID transmise par TinyAuth, ajoutée à
> `ALDORIA_ADMIN_USERS`).
> Reste avant le critère de passage : réglage des chapitres par Eric, mesures du donjon sur la tablette
> (`?perf`), retours des enfants. À la reprise : corrections issues de ces retours, puis phase 3 (contenu
> d'abord : 20 générateurs par niveau, banque d'items relue, widgets restants).
>
> Écarts admin : pas de shadcn/ui ni de React Router (3 écrans, CSS simple, aucun style en ligne pour la
> CSP) ; défense en profondeur en plus du plan : secret `X-Aldoria-Admin-Key` ajouté par le routeur admin
> de Traefik, sans lequel l'API parent répond 404 ; middleware ForwardAuth propre à Aldoria (le middleware
> partagé du VPS ne transmet que `X-User`).
>
> Écarts : `DungeonDef` est une classe GDScript à constructeurs statiques (comme `WorldTheme`) plutôt
> qu'un `.tres` (données typées, relues en revue de code) ; la balance se résout en enlevant la même
> chose des deux côtés puis en donnant la masse au pavé (pas de pose libre de poids) ; le boss compte
> 10 « sceaux » (8 questions au mieux avec des critiques, davantage avec des indices) ; pas de masquage
> des murs : la vue en coupe (côté sud ouvert) rend la caméra toujours dégagée.

**Modèle de données complet** (TRD §4) avec ses migrations. **Seed du programme** : matières, chapitres et notions des deux niveaux (§4 de ce plan). Les notions incertaines de seconde portent `a_valider=true`.

**Moteur pédagogique** (`api/app/engine/`)
- `scheduler.py` : interface `Scheduler` et implémentation `LeitnerScheduler` (boîtes 1 à 5 : même session puis 1 j, 3 j, 7 j, 21 j, 60 j ; règles juste, juste avec indice, faux).
- `mastery.py` : moyenne mobile exponentielle du TRD §5.4 (facteur temps, indice, α dépendant de la difficulté) ; seuils 40 et 75 pour 1, 2 ou 3 étoiles.
- `selector.py` : paquet d'environ 60 items avec les ratios du profil (50/30/20, ou 70 % pour un chapitre `controle_bientot`), ajustement de difficulté de ±1 pour viser 70 à 85 % de réussite sur les 20 dernières tentatives, contraintes de diversité (pas de doublon, au plus 3 items de suite sur la même notion), étiquettes de compatibilité `combat`, `enigme` et `dialogue`.
- Une erreur remet la notion dans la même session **sous une autre forme** (autre générateur ou autre type).
- Détection du clic au hasard (3 erreurs de suite, chacune en moins de 25 % du temps cible) : gains de jeu réduits sur les 5 questions suivantes, sans aucun message.
- Couverture pytest d'au moins 90 % sur `engine/`.

**Sauvegarde et mode dégradé (client)**
- `SaveManager` : sauvegarde locale (`user://`) puis serveur (`PUT /play/save` avec `schema_version` et `base_revision`) ; règle de conflit « la progression la plus avancée gagne » ; 20 révisions conservées ; `migrate(from, to)`.
- File d'attente hors ligne : tentatives identifiées par UUID v4, renvoyées à la reconnexion ; indicateur discret de mode hors ligne.

**Gameplay**
- Contrôleur du héros : clavier, manette, joystick virtuel tactile, toucher ou clic pour se déplacer. Caméra inclinée qui suit le héros, avec masquage des murs placés devant lui.
- **Un donjon complet par niveau** (4 à 6 salles, des combats, une énigme, un boss de synthèse de 8 à 12 questions de difficulté croissante) :
  - Jules : *Tour des Fractions*, avec une énigme **balance** (pré-algèbre : poser des poids pour équilibrer).
  - Tom : *Labyrinthe des Vecteurs*, avec une énigme **miroirs et vecteurs** (orienter un rayon en donnant les coordonnées d'un vecteur).
- `DungeonDef.tres` lie un donjon à un `chapter_code`. Le gameplay ne connaît jamais le contenu des questions (principe du TRD §2.3).
- Progression : XP, niveau, étoiles d'Archives par notion (`GET /play/progress`), début de bestiaire.

**Parent**
- Admin React minimal : profils, statut des chapitres par enfant, tableau de bord (notions acquises, fragiles, non vues ; temps de jeu).
- Traefik : router `aldoria-admin` avec le middleware TinyAuth. **Test de recette** : l'API reçoit bien `Remote-User`, et un appel direct à `aldoria.bandtrack.fr/api/v1/admin/...` est **refusé** (404 ou 403), y compris avec un en-tête `Remote-User` forgé.

**Critère de passage** : 2 semaines d'usage spontané (au moins 2 sessions par semaine et par enfant, sans relance).

### Phase 3 – MVP (6 à 8 semaines)

> 🟡 **Commencée le 2026-10-11 par le contenu.** 30 nouveaux générateurs : **21 pour Jules** (tables,
> calcul mental, conversions, ×÷10, décimaux, division euclidienne, fraction d'une quantité, encadrement,
> schéma en barres, suites de motifs, durées, aires, angle manquant, retour à l'unité, échelles,
> probabilités) et **22 pour Tom** hors énigme (puissances, racines, calcul fractionnaire, intervalles,
> valeur absolue, ensembles de nombres, image, fonction affine, coefficient directeur, produit nul,
> moyenne pondérée, probabilités conditionnelles et arbres, Pythagore et Thalès, lecture de code Python).
> Tous en QCM, nombre, fraction ou expression (widgets existants), réponses recalculées indépendamment
> sur 1 000 tirages par niveau (`api/tests/test_generators_phase3.py`).
> Widgets interactifs (2026-10-11) : droite graduée (placer un point, aimanté sur les graduations ; ou lire
> l'abscisse d'un point), remettre dans l'ordre (touches successives, plus fiable qu'un glisser-déposer sur
> tablette), courbe pour la lecture graphique. Nouveaux générateurs : droite graduée et ranger des décimaux
> (Jules), ranger des réels et lecture graphique (Tom). Réponse de type `order` ajoutée aux vecteurs de test.
> Derniers widgets du MVP (2026-10-11) : vrai/faux justifié (verdict puis justification : le hasard ne
> suffit pas), tableau de signes (cases à toucher, en-têtes en intervalles), robot sur grille. Générateurs :
> vocabulaire des angles, séquences et boucles du robot (Jules) ; implication, réciproque et contre-exemple,
> tableau de signes d'un produit ou d'un quotient (Tom). Réponses `true_false` et `signs` dans les vecteurs
> de test. Bilan : **25 générateurs pour Jules, 26 pour Tom** (hors énigme), 46 notions jouables sur 65.
> Écart : « relier » (drag_match) n'a pas de widget générique ; son seul usage prévu, le tableau de signes,
> a son widget dédié.
> Reste au contenu : banque d'items relue par Eric (questions rédigées, hors générateurs).
> Monde (2026-10-11) : **trois donjons par enfant**, ouverts l'un après l'autre depuis le camp. Jules : Tour des
> Fractions, Atelier des Balances (pré-algèbre, proportionnalité ; énigme de la **carte** : compter les carreaux,
> appliquer l'échelle), Observatoire des Angles (angles, probabilités ; énigme des automates : robot et boucles).
> Tom : Labyrinthe des Vecteurs, Forge de l'Algèbre (calcul littéral, équations, valeur absolue ; énigme des
> sceaux : tableaux de signes), Citadelle des Fonctions (fonctions, droites ; énigme des courbes : lecture
> graphique). Décor propre à chaque donjon (sol, bannières, mobilier, couleur des torches), squelettes mage et
> voleur. Un donjon peut viser plusieurs chapitres (`focus_chapters`). **Note de 1 à 5** en fin de donjon,
> visible dans l'espace parent avec le type d'activité de chaque session.
> **Défi du jour** : 10 automatismes (paquet `defi` du serveur), série de jours, un jour manqué rattrapable le
> lendemain, coffre de la semaine à 5 défis, record personnel (bonnes réponses, puis temps).
> Écarts : pas de compte à rebours (retour des enfants : un chrono visible les stresse), le temps n'apparaît
> qu'au bilan ; pas de « mana » (le jeu n'en a pas), le défi rapporte de l'XP. Énigmes de Tom : tableaux de
> signes et courbes plutôt qu'« artisanat proportionnel » (les générateurs existaient et couvrent le programme).
> Poids web : animations des personnages partagées (pck 13,4 → 7,3 Mo, voir `docs/perf-log.md`).
> **Village** (2026-10-12) : Clairval (Jules) et Brumegarde (Tom), une halle en deux salles avec ses
> habitants (barbare, mage, voleuse, chevalier du pack Aventuriers). Chaque habitant confie **une quête de
> trois questions par jour** : révision espacée (notions à revoir), **veille de contrôle** (chapitre marqué
> « contrôle bientôt » par le parent, sinon chapitre en cours ; le paquet en renvoie la liste dans
> `context`), **enquêtes** sur un document : la carte pour Jules, un relevé statistique (effectif, fréquence,
> fréquence cumulée, moyenne, médiane) et un tableau croisé (probabilités, conditionnelles, réunion) pour Tom,
> trois questions de difficulté croissante sur le même document. Le camp affiche le nombre d'habitants qui
> attendent de l'aide.
> Écart : une halle couverte faite des pièces du donjon plutôt qu'un village en plein air (aucun pack
> extérieur, budget de poids et de rendu déjà mesuré sur tablette).
> Reste au monde : la personnalisation du héros (apparence, compagnon de Jules).

**Contenu**
- **20 générateurs par niveau** (§4).
- Banque de départ : 150 à 200 items par niveau dans `content/seed/` (JSON validés par le schéma), **tous relus par Eric** avant publication.

**Widgets restants** : `true_false_justify`, `drag_order`, `drag_match`, `place_on_figure` (droite graduée, repère, figure). Le widget `python` reste en V2.

**Monde**
- Région *Cimes Fractales* complète dans chaque monde : un village central (PNJ, quêtes secondaires de révision espacée, de type « le forgeron a oublié comment calculer un pourcentage »), **3 donjons par niveau** et une 2ème énigme par monde (échelle de carte pour Jules ; artisanat proportionnel ou séquence d'instructions pour Tom).
  - Jules : Tour des Fractions, Atelier des Balances (pré-algèbre, proportionnalité, échelles), Observatoire des Angles (angles, médiatrice, probabilités).
  - Tom : Labyrinthe des Vecteurs, Forge de l'Algèbre (calcul littéral, équations, inéquations, valeur absolue), Citadelle des Fonctions (fonctions de référence, variations, signe).
  - Statistiques et probabilités de Tom : dans les quêtes d'enquête du village (documents à analyser).
  - Le lien donjon ↔ chapitre reste paramétrable par Eric.
- Rituels : **défi quotidien** de 3 minutes (10 automatismes chronométrés qui rechargent le mana), série de jours, coffre hebdomadaire en jeu. Aucune récompense réelle et aucun FOMO agressif : une série cassée se répare par un défi rattrapé.
- Personnalisation : apparence du héros et compagnon animal pour Jules.
- Note de 1 à 5 donnée par l'enfant en fin de donjon.

**Bien-être et accessibilité** : durée maximale de session réglable par le parent, rappel de pause, temps compté uniquement quand le jeu est actif ; tailles de texte, mode daltonien, sous-titres ; volumes musique et effets séparés.

**Admin complet** : CRUD des items avec aperçu identique au rendu en jeu (SVG de l'API), import CSV et JSON (5 Mo maximum, rapport ligne par ligne avant validation), aperçu de 10 items par générateur, signalements d'erreur venant des enfants, réglages (durée, ratios), réinitialisation d'un profil (droit à l'effacement), tableau des indicateurs du PRD §2 (sessions spontanées, régularité, questions par session, progression entre la 1ère et la 4ème exposition, note de plaisir).

**Exploitation** : service `backup` (pg_dump quotidien, rétention 14 jours, copie hors du VPS), healthcheck sur `/api/v1/health`, logs JSON conservés 30 jours sans données de réponse, en-têtes de sécurité, fichiers versionnés par hash. CI complète : pytest, GUT headless, Playwright, export, images Docker, déploiement.

**Critère de passage** : objectifs du PRD §2 atteints sur un mois.

### Phases suivantes (à détailler le moment venu)

- **V2** : français et langues vivantes ; génération d'items par IA validée par le parent (route admin uniquement, sortie JSON validée par le schéma, statut `brouillon`) ; **grimoire Python** (Pyodide 314 auto-hébergé, Web Worker, `aldoriaPy.run(code, tests)` appelé via `JavaScriptBridge` avec des callbacks conservés en variables membres et des échanges en JSON, délai par `terminate()`) ; cinématiques ; résumé hebdomadaire au parent ; lecture vocale.
- **V3** : histoire-géographie, EMC, sciences ; saisons trimestrielles ; arène coopérative si elle est retenue.
- **V4** : SES, SNT, arts, musique, EPS ; PWA avec cache hors ligne (service worker, en-têtes d'isolation désactivés).

---

## 4. Référentiel de contenu maths (seed et générateurs)

Format des codes : `<niveau>.maths.<chapitre>.<notion>`. Les générateurs marqués ★ sont livrés en phase 1, ceux marqués ● en phase 2, les autres au MVP.

**Jules, 6ème (20 générateurs)**

| # | Générateur | Type(s) | Mécanique |
| --- | --- | --- | --- |
| 1 | Tables de multiplication (automatisme) | numeric | combat, défi quotidien |
| 2 | Calcul mental (addition, soustraction, compléments) | numeric | combat |
| 3 | ×, ÷ par 10, 100, 1000 sur les décimaux | numeric | combat |
| 4 | Conversions de longueurs, masses, contenances | numeric, mcq | combat, artisanat |
| 5 | Comparer et ranger des décimaux | mcq, drag_order | combat |
| 6 | Division euclidienne et durées | numeric | dialogue |
| 7 | Fraction d'une quantité | numeric | artisanat |
| 8 | Placer une fraction sur une droite graduée | place_on_figure | énigme |
| 9 ★ | Comparer des fractions (dénominateurs égaux ou multiples, comparaison à 1) | mcq | combat |
| 10 | Encadrer une fraction entre deux entiers, nombres mixtes | numeric, mcq | combat |
| 11 ★ | Additionner et soustraire (même dénominateur, dénominateurs multiples) | numeric (fraction) | combat |
| 12 ● | Additionner et soustraire avec des dénominateurs non multiples (cas simples) | numeric (fraction) | combat, boss |
| 13 ● | Multiplier une fraction par un entier | numeric | combat |
| 14 ● | Fractions égales, simplification simple | numeric, mcq | combat |
| 15 ● | Balance (valeur inconnue) | numeric, énigme | énigme balance |
| 16 | Schéma en barres (problème à trou) | numeric | dialogue |
| 17 | Suites de motifs (terme suivant, rang n) | numeric, mcq | énigme |
| 18 | Angle manquant d'un triangle | numeric | combat |
| 19 | Échelles et proportionnalité (retour à l'unité) | numeric | énigme carte |
| 20 | Probabilités en situation d'équiprobabilité (urne, dé, roue) | mcq, numeric | combat |
| + | Séquences d'instructions et boucles (robot sur grille) | drag_order | énigme |

Chapitres seed pour Jules : Nombres entiers et décimaux · Fractions · Pré-algèbre · Calcul et automatismes · Grandeurs et mesures · Angles et triangles · Médiatrice et cercle · Proportionnalité et échelles · Probabilités · Pensée informatique.

**Tom, seconde (20 générateurs)**

| # | Générateur | Type(s) | Mécanique |
| --- | --- | --- | --- |
| 1 | Ensembles de nombres (ℕ, ℤ, 𝔻, ℚ, ℝ) | mcq | combat |
| 2 | Intervalles ↔ inégalités, réunion et intersection | mcq, numeric | combat |
| 3 | Valeur absolue : distance, \|x−a\| ≤ r ↔ intervalle | mcq, expression | combat |
| 4 | Puissances (règles de calcul) | expression, mcq | automatismes |
| 5 | Racines carrées (simplification) | expression | automatismes |
| 6 | Calcul fractionnaire sans calculatrice | numeric | automatismes (format épreuve anticipée) |
| 7 ★ | Développer (identités remarquables) | expression | combat |
| 8 ● | Factoriser (facteur commun, identités) | expression + contrôle de forme | combat, boss |
| 9 ● | Équations du 1er degré et équations avec quotients | numeric | combat |
| 10 ● | Inéquations du 1er degré (intervalle solution) | mcq, expression | combat |
| 11 | Équation produit nul | numeric (liste) | combat |
| 12 | Signe d'un produit ou d'un quotient (tableau de signes) | drag_match | énigme |
| 13 ★ | Coefficient multiplicateur, évolutions successives et réciproques, pourcentages de pourcentages | mcq (format épreuve anticipée) | automatismes, défi |
| 14 ● | Vecteurs : coordonnées, somme, colinéarité par le déterminant | numeric, mcq | énigme miroirs |
| 15 ● | Milieu et distance dans un repère orthonormé | numeric | combat |
| 16 | Équations de droites (réduite, pente, vecteur directeur) | expression, mcq | combat |
| 17 | Image et antécédent par lecture graphique | place_on_figure | énigme |
| 18 | Fonction affine à partir de 2 points, sens de variation | expression | combat |
| 19 | Statistiques : moyenne pondérée, médiane, écart type, séries en classes | numeric | enquête village |
| 20 | Probabilités conditionnelles (arbre pondéré, tableau croisé) | numeric (fraction) | enquête village |
| + | Pythagore, Thalès, trigonométrie (automatismes) ; lecture de code Python (« que vaut x ? ») en QCM avant le grimoire | mcq, numeric | automatismes |

Chapitres seed pour Tom : Nombres réels et intervalles · Valeur absolue · Calcul littéral · Équations et inéquations · Vecteurs · Géométrie repérée et droites · Généralités sur les fonctions · Fonctions de référence · Proportions et évolutions · Statistiques · Probabilités conditionnelles · Logique et ensembles · Algorithmique Python · Automatismes (6 thèmes de l'épreuve anticipée).

---

## 5. Pilotage, risques et points à valider

| Risque ou point | Moment | Parade |
| --- | --- | --- |
| Tablette trop faible pour la 3D Godot | Phase 0 | Scène d'étalonnage, profil qualité, template allégé, sinon plan B Babylon.js |
| SVG ziamath mal rendus par ThorVG | Phase 1 | Batterie de 20 formules ; repli en PNG rasterisé côté API |
| Contenu de seconde incertain (échantillonnage, racine carrée et cube) | Avant le seed de la phase 2 | Eric vérifie l'annexe du BO ; notions marquées `a_valider` |
| En-têtes TinyAuth absents ou usurpables | Phase 2 | Test de recette dédié ; router public qui exclut `/api/v1/admin` et retire `Remote-*` |
| Interruption Pyodide sans COOP/COEP | V2 | `worker.terminate()` + recréation, chargement depuis le cache |
| Navigation privée ou cookies bloqués sur la tablette (pas de persistance) | Phase 1 | Le serveur fait foi ; avertissement à l'écran |
| Tom trouve le jeu « pour petits » | Phases 1 à 3 | Thème sombre, humour, difficulté qui monte vite, automatismes au format examen (enjeu réel et valorisant) |
| Charge de saisie du contenu | Phase 3 et suivantes | Générateurs, import CSV, IA en V2 |

---

## 6. Vérification de bout en bout

- **API** : `uv run pytest` (moteur à 90 % ou plus ; générateurs : 1 000 tirages par difficulté vérifiés par SymPy et Hypothesis ; routes, cas d'erreur, idempotence).
- **Parité client et serveur** : `content/test-vectors/*.json` rejoués par pytest **et** par GUT ; toute divergence fait échouer la CI.
- **Client** : `godot --headless -d -s addons/gut/gut_cmdln.gd -gdir=res://tests -gexit` (validation des réponses, file hors ligne, migration des sauvegardes).
- **Admin** : Playwright sur les parcours « créer un item », « importer un CSV » et « changer un statut ».
- **Recette sur appareils** à chaque version : PC (Chrome et Edge) et tablette (Chrome, débogage distant `chrome://inspect`), avec l'overlay de perf ; consignation dans `docs/perf-log.md`.
- **Hors ligne** : DevTools → Offline en plein combat → 10 réponses → retour en ligne → vérifier en base que les 10 tentatives sont présentes, sans doublon.
- **Sécurité** : appel à l'API admin sans SSO et avec un `Remote-User` forgé → refusé ; PIN faux 5 fois → blocage ; CSP vérifiée dans la console sans erreur.
- **Test réel** : session observée avec chaque enfant à la fin de chaque phase ; critère de passage noté dans `docs/journal-tests.md`.

---

## 7. Sources consultées (10/10/2026)

- Programme de 6ème : [Académie de Bordeaux – ce qui disparaît et ce qui apparaît](https://ent2d.ac-bordeaux.fr/disciplines/mathematiques/le-nouveau-programme-de-mathematiques-en-sixieme-ce-qui-disparait-et-ce-qui-apparait/) · [Progression type 6ème](https://ent2d.ac-bordeaux.fr/disciplines/mathematiques/programme-de-cycle-2025-exemple-de-progression-pour-lannee-de-6eme/) · [BO n°16 du 17/04/2025](https://education.gouv.fr/bo/2025/Hebdo16/MENE2504620A) · [Ressources Eduscol cycle 3](https://eduscol.education.gouv.fr/5712/ressources-d-accompagnement-du-programme-de-mathematiques-au-cycle-3)
- Programme de seconde : [Légifrance – arrêté du 26/02/2026](https://www.legifrance.gouv.fr/loda/id/JORFTEXT000053723219/) · [BO n°14 du 02/04/2026](https://www.education.gouv.fr/bo/2026/Hebdo14/MENE2602914A) · [maths-cours.fr](https://www.maths-cours.fr/blog/nouveau-programme-maths-seconde-2026/) · [preparemescours.fr – trame 2026-2027](https://preparemescours.fr/blog/progression-maths-seconde-2026-2027) · [mathlvl.fr](https://mathlvl.fr/programme-maths-seconde-2026)
- Épreuve anticipée : [Eduscol](https://eduscol.education.gouv.fr/5688/epreuve-anticipee-de-mathematiques-aux-baccalaureats-general-et-technologique) · [Brochure automatismes, académie de Nice](https://www.pedagogie.ac-nice.fr/mathematiques/wp-content/uploads/sites/30/2025/11/EAM_BrochureAutomatismes_Vdef.pdf) · [Académie de Nancy-Metz](https://sites.ac-nancy-metz.fr/mathematiques/baccalaureat-epreuve-anticipee-de-mathematiques-en-fin-de-premiere-en-voies-generale-et-technologique/)
- Godot : [Téléchargement 4.7.2](https://godotengine.org/download/windows/) · [Export web (doc 4.7)](https://docs.godotengine.org/en/4.7/tutorials/export/exporting_for_web.html) · [JavaScriptBridge](https://docs.godotengine.org/en/4.2/classes/class_javascriptbridge.html) · [Retour d'expérience sur la perf mobile web](https://forum.godotengine.org/t/godot-4-web-export-stutters-on-mobile-its-probably-your-art-pipeline-not-your-code-31fps-to-60fps-benchmarks-inside/143268) · [godot-ci](https://hub.docker.com/r/barichello/godot-ci) · [GUT](https://store.godotengine.org/asset/bitwes/gut/) · [godot-mcp](https://mcpservers.org/es/servers/Coding-Solo/godot-mcp)
- Pyodide : [Annonce de la 314.0](https://blog.pyodide.org/posts/314-release) · [Interruption de l'exécution](https://pyodide.readthedocs.io/en/latest/usage/keyboard-interrupts.html)
- Formules : [ziamath](https://ziamath.readthedocs.io/)
- Assets : [KayKit Dungeon Remastered](https://kaylousberg.itch.io/kaykit-dungeon-remastered) · [KayKit Adventurers](https://kaylousberg.itch.io/kaykit-adventurers)
- Répétition espacée : [fsrs sur PyPI](https://pypi.org/project/fsrs)
- SSO : [Fil Traefik + TinyAuth + PocketID](https://piefed.keyboardvagabond.com/post/299175)
