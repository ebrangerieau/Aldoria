# Plan d'implémentation de la v2

7 novembre 2026. Vision : `docs/PRD.md` ; architecture : `docs/TRD.md` ; pourquoi : `docs/decisions.md` et `docs/BILAN-V1.md`.

**Règles du plan** (tirées du bilan de la v1) :

1. Chaque phase se termine par **une séance observée avec Jules et Tom** (`docs/journal-tests.md`) et un **critère de passage**
   écrit avant de commencer. On ne commence pas la phase suivante sans lui.
2. **La profondeur avant la largeur** : un lieu complet et aimé avant trente lieux à moitié faits.
3. Toute logique nouvelle va dans `client/src/core/` avec ses tests ; toute fonction de l'espace parent est décrite dans
   `admin/src/Guide.tsx`.
4. La v1 reste en ligne et jouable jusqu'à la bascule (phase 4).

## Phase 0 : fondations (en cours)

> ✅ **Fait le 7 novembre 2026** (base de ce dossier) :
> - API, espace parent, contenus, voix, outils et assets repris de la v1 ; 1 876 tests de l'API verts.
> - API : emplacement de sauvegarde `v2` (migration 0013, test d'indépendance des deux parties), mode de session `monde`
>   (« Exploration » dans le tableau de bord).
> - Données de jeu de la v1 exportées en JSON (`content/monde/`) ; le test de l'API qui lisait le GDScript lit le JSON.
> - Client Babylon.js 9 + React 19 + TypeScript strict : île procédurale de 500 m (huit régions, relief par matière, île du
>   Sphinx, Tour de l'Oubli), sol en facettes, ciel en dégradé, ombres en cascades, brouillard, halo, occlusion ambiante ;
>   Citadelle, village, 30 lieux de quête posés selon la classe, seuils lumineux ; héros KayKit à la troisième personne
>   (clavier, souris, clic sur le sol), Maître Ysaline, neuf pierres de savoir ; panneau de question HTML (six types),
>   indice, « Écouter », « Pas vu en classe », correction ; connexion (appareil, profil, code) et mode découverte ; file hors
>   connexion, sauvegarde v2, aménagements dys.
> - Tests : 114 tests Vitest (dont les 81 vecteurs partagés), parcours navigateur sous la CSP de production, captures.
> - CI `v2.yml` (sans publication) ; la CI de la v1 ignore `v2/`.
>
> ✅ **Fait le 7 novembre 2026 (suite)** :
> - **0.2, le renard de Jules** : il revient par défaut dans le monde lumineux. Cause des pointes : le `Fox.glb` de
>   Quaternius déclare `Body` comme racine du squelette (`skin.skeleton`) alors que ses os de cinématique inverse
>   (`IKBackLeg.R`…) sont rattachés à `AnimalArmature` ; Babylon.js s'y fiait. Tous les modèles se chargent maintenant avec
>   `alwaysComputeSkeletonRootNode` (`game/assets.ts`) et le renard se pose sur son sommet le plus bas
>   (`settleOnGround`). Le parcours navigateur échoue si un sommet du renard s'éloigne de plus de 1,5 m ou s'il est à plus de
>   8 cm du sol.
> - **0.7, remontée des erreurs** : exceptions, promesses rejetées et `console.error` (Babylon.js, React) partent vers
>   `POST /play/client-errors` avec l'appareil relié (endroit du code, écran, version du build, navigateur ; jamais de donnée
>   d'enfant) ; dédoublonnées, par lots de 20, gardées sans réseau (`core/errorReport.ts`, `app/errors.ts`). Version du
>   jeu dans les Options. 9 tests Vitest (123 en tout) ; le parcours navigateur vérifie la capture d'une erreur d'essai
>   (`?erreur_test=1`). Reste à voir une vraie erreur dans Exploitation → Erreurs du jeu, une fois `aldoria2` en ligne.

**Reste à faire pour terminer la phase 0**

| Étape | Quoi | Comment vérifier |
| --- | --- | --- |
| 0.1 | Jouer la v2 avec un vrai profil (connexion, séance `monde`, réponses en base, sauvegarde `v2`) : se fait sur `aldoria2.bandtrack.fr` dès l'étape 0.6 | l'espace parent montre la séance « Exploration » et les réponses de la v2 |
| 0.3 | Commandes au clavier vérifiées sur AZERTY et QWERTY ; souris (orbite, molette) sur le PC familial | séance de 5 minutes avec Eric |
| 0.4 | ✅ **Fait le 14 novembre** : WebGPU prêt (glslang et twgsl servis par le site, repli automatique sur WebGL 2, nginx `application/wasm`), banc de mesure `?mesure`, parcours `npm run e2e:webgpu` (CI : étape non bloquante, résumé du job). Le moteur par défaut reste WebGL 2 et se décide à l'étape 0.5 (D9) | `npm run e2e:webgpu` ; D9 |
| 0.5 | Mesures sur le PC familial (et le PC de Tom) avec `?mesure`, **dans les deux moteurs** (WebGL 2 et WebGPU), aux trois profils, deux fois : images par seconde, saccades, chargement, mémoire. Puis choisir le profil par défaut **et le moteur par défaut** (D9 : WebGPU seulement s'il est au moins aussi fluide à `haut` et après une garde contre la perte de l'appareil) | `docs/perf-log.md` (protocole en tête) ; décision D9 mise à jour |
| 0.6 | Mise en ligne (D11) : la CI v2 publie l'API (depuis `v2/api`) et le jeu v2, sauvegarde la base, applique la migration 0013 et ouvre `aldoria2.bandtrack.fr` à côté du jeu v1. À faire par Eric une fois : l'entrée DNS `aldoria2`, et vérifier que le VPS peut tirer la nouvelle image `aldoria-web2` | job `deploy` de `v2.yml` vert : API et `version.txt` du commit, parcours navigateur contre le site |
| 0.8 | Espace parent servi par `web2` (code de `v2/admin`) au lieu du conteneur de la v1 ; `admin/` à la racine gelé | `aldoria-admin.bandtrack.fr` sert le build de `v2/admin` (libellé « Exploration », guide à jour) |

**Critère de passage** : Jules et Tom se promènent dix minutes dans l'île sans aide, trouvent et éveillent au moins trois
pierres chacun, et disent ce qu'ils voudraient y trouver. On note où ils s'ennuient et où ils se perdent.

## Phase 1 : un lieu de quête complet

Objectif : un lieu par enfant, de bout en bout, au moins aussi bien que dans la v1. Proposition : la Tour des Fractions (Jules)
et le Labyrinthe des Vecteurs (Tom), les premiers de la v1.

- Intérieur chargé à part (scène Babylon.js par lieu, transition depuis le seuil), étages qui montent (souhait des enfants),
  décor repris de `lieux.json` (`v1_decor`).
- **Rencontres au tour par tour** : port de `Encounter` (v1) dans `core/combat/` (testé sans moteur) ; l'ennemi est dans le
  décor, le monde se fige pendant la question ; Frappe (automatisme), Sort (chapitre), Soin, Sac ; repli sans perte. Monstres
  Quaternius (`Fighter.MONSTERS` de la v1 à porter) et squelettes KayKit.
- **Effaceur** et ses sceaux (`BOSS_HITS`, difficulté d'un cran sous le niveau à un cran au-dessus), répliques d'entrée et de
  défaite, coffre, page rendue, salut de Maître Ysaline au retour, lieu suivant de la région qui s'ouvre.
- Énigme du lieu avec trois piédestaux (comme la v1) ; la balance géante attendra la phase 2.
- Héros qui parle entre deux salles (`content/monde/heros.json`).
- Note de 1 à 5 en fin de lieu (`session/end`, `rating`).
- Widgets restants : vecteur (Tom en a besoin dès le Labyrinthe), droite graduée, tableau de signes.

> ✅ **Fait le 14 novembre 2026** (la phase 1 est lancée à la demande d'Eric, **sans que la séance de la phase 0 ait eu lieu** :
> la règle 1 du plan n'est pas respectée, à rattraper avec les enfants) :
> - **Règles pures et testées** (`core/`) : `combat/` (Encounter, Fighter, monstres des 30 lieux), `progression/` (XP, niveaux, sac de
>   cinq objets), `quest/` (géométrie de l'intérieur, plan de construction des 30 lieux, voix du héros, règles du lieu, contrôleur
>   du déroulé). 236 tests Vitest.
> - **Intérieur 3D** (`game/interior/`) : six salles KayKit en thin instances, héros et ennemis animés (squelettes KayKit,
>   monstres Quaternius mis à taille), combat au contact (D12), énigme à trois piédestaux, Effaceur à huit sceaux, coffre, page
>   rendue, reprise à la salle franchie, note de fin ; interface React (barres de vie, menu Frappe/Sort/Soin/Sac, bandeaux, textes
>   qui montent). Le bouton « J'y vais » des seuils ouvre le lieu ; l'île reprend avec le lieu suivant ouvert et le salut
>   enregistré de Maître Ysaline (D13).
> - **Visuels de questions** : balance, droite graduée, repère quadrillé (vecteurs), tableau de signes. 24 lieux sur 30 sont
>   entièrement jouables avec ce que l'API envoie ; les six lieux de maths prennent une question du chapitre à la place de
>   l'énigme tant que leurs visuels (graph, robot, map, pont, rapporteur, repère de tir) manquent.
> - Parcours `npm run e2e:lieu` : la Tour des Fractions de l'entrée au coffre, sous la CSP de production.
>
> **Reste à faire pour terminer la phase 1** : temps de jeu fixé par le parent (limite, rappel de pause : absent de la v2) ;
> étages qui montent (D12) ; sons (`Sfx` de la v1 : coups, bonne réponse, victoire) ; lieu de Tom vérifié en séance (Labyrinthe
> des Vecteurs : le reste des visuels de maths) ; réglage de la lumière et de la caméra à l'œil ; séance observée.

**Critère de passage** : chaque enfant termine son lieu, et **demande à en faire un autre**. Note de fin de lieu ≥ 4.

## Phase 2 : reprendre ce que les enfants aimaient dans la v1

Dans l'ordre que les enfants choisiront à la séance de la phase 1 :

- les 28 autres lieux (contenu déjà prêt dans `lieux.json`), région par région ;
- balance géante, stand de tir (Lice), pont des fractions : comme des lieux de l'île, plus des panneaux posés sur une salle ;
- Clairval en plein air et ses habitants (`villages.json`), quêtes du jour ;
- Pierre du Jour (défi quotidien, série, coffre de la semaine, sans compte à rebours) ;
- île du Sphinx : barque, passages, blocs du temple (niveaux de `tools/make_sphinx_levels.py` sortis en JSON) ;
- apparence du héros (silhouettes, armes, capes, déblocages) et sac d'objets ;
- prologue en cinq tableaux joués dans l'île, voix enregistrées de Maître Ysaline (`deploy/voix/manifest.json` ; **seuils faits le 14 novembre** : les 30 textes de lieu sont lus de
  sa vraie voix ; restent à brancher les pages rendues, le prologue, le brouillard, Clairval et la Tour de l'Oubli quand ces
  moments existent dans l'île, et à enregistrer ses répliques nouvelles de la v2), musique ;
- Archives (étoiles par notion), bestiaire ; brouillard des régions pas encore au programme, qui recule page après page.

**Critère de passage** : deux semaines d'usage spontané (au moins deux séances par semaine et par enfant, sans relance).

## Phase 3 : l'immersion

- Eau animée, herbe et fleurs, nuages qui passent, papillons et oiseaux (rien qui gêne en mode calme) ;
- sons d'ambiance par région, pas sur l'herbe, la pierre, l'eau ;
- cycle du jour léger (la Pierre du Jour à l'aube, les lanternes du soir) ;
- niveaux de détail des arbres et des bâtiments lointains (pour remonter la végétation au profil `haut`) ;
- chemins entre la Citadelle et les régions, panneaux indicateurs, ponts ;
- manette.

**Critère de passage** : les enfants montrent l'île à quelqu'un d'autre (fierté), note de plaisir ≥ 4 sur un mois.

## Phase 4 : bascule

L'API et la base sont communes depuis l'étape 0.6 (D11) : la bascule ne touche plus aux données.

1. Le jeu v2 est servi aussi sur `aldoria.bandtrack.fr` ; la v1 reste quelques semaines sur une autre adresse.
2. Décision sur la partie v1 (XP, apparence, lieux terminés) : conversion vers la partie v2 ou nouveau départ, avec les enfants.
3. Le dossier `game/` (Godot) est archivé, puis retiré du dépôt ; `v2/` remonte à la racine, avec le Compose de production.

**Critère de passage** : plus aucune séance sur la v1 pendant trois semaines.

## Questions à poser aux enfants dès la première séance

1. Qu'est-ce que tu as envie de trouver en te promenant dans l'île ?
2. Les rencontres : tu veux voir les ennemis venir vers toi, ou les trouver en entrant dans une salle ? (aujourd'hui : on les
   réveille en s'approchant, D12 ; et les étages qui montent, tu les veux ?)
3. Le renard (Jules) : il doit faire quoi ? Trouver des passages, des objets, des pierres cachées ?
4. Tom : le monde Brouillard est-il assez différent ? Plus sombre, la nuit, la pluie ?
5. Vous jouez où : sur quel PC, combien de temps, à quel moment de la journée ?
