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
> - **0.6, mise en ligne** (D11) : la CI v2 publie l'API (depuis `v2/api`) et le jeu v2 ; la base a été sauvegardée puis
>   est passée à la migration 0013 ; `aldoria2.bandtrack.fr` sert le jeu v2 à côté du jeu v1 (commit `24314b4`). Le job
>   `deploy` vérifie d'abord que les images se lisent sans compte (le paquet `aldoria-web2` a été rendu public). Depuis le
>   30 octobre, le pare-feu Hostinger n'ouvre le port 22 qu'à quelques adresses : chaque déploiement (v1 et v2) l'ouvre pour
>   son runner par l'API Hostinger, puis le referme (`.github/scripts/vps-ssh.sh`, secret `HOSTINGER_API_TOKEN` ;
>   `docs/exploitation.md`). Le parcours navigateur de contrôle passe contre `aldoria2` (job sur Ubuntu 24.04, commit `8387608`).
> - **0.8, espace parent servi par la v2** : `aldoria-admin.bandtrack.fr` est routé vers le conteneur `web2` (build de
>   `v2/admin`, routeur Traefik à part et de priorité 2) ; l'image `web` de la v1 ne contient plus que le jeu, `admin/` à la
>   racine est gelé (`admin/README.md`). Le parcours de l'espace parent (`admin/e2e/admin_flow.js`, repris de la v1) tourne
>   dans la CI v2 contre la vraie image `web2`, avec base, API et sauvegarde jetables (`tools/e2e_admin.sh`) ; après chaque
>   mise en ligne, la CI vérifie que l'espace parent sert le commit (`aldoria-admin…/version.txt`).

**Reste à faire pour terminer la phase 0**

| Étape | Quoi | Comment vérifier |
| --- | --- | --- |
| 0.1 | Jouer la v2 avec un vrai profil (connexion, séance `monde`, réponses en base, sauvegarde `v2`) : sur `aldoria2.bandtrack.fr`, après avoir relié le PC une fois (code de l'onglet Famille) | l'espace parent montre la séance « Exploration » et les réponses de la v2 |
| 0.3 | Commandes au clavier vérifiées sur AZERTY et QWERTY ; souris (orbite, molette) sur le PC familial | séance de 5 minutes avec Eric |
| 0.4 | WebGPU : servir twgsl depuis le site, mesurer face à WebGL 2, décider du moteur par défaut (D9) | `docs/perf-log.md`, nouvelle décision si changement |
| 0.5 | Mesures sur le PC familial (et le PC de Tom) : images par seconde par profil, chargement, mémoire | `docs/perf-log.md` ; profil par défaut choisi d'après les mesures |

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

**Critère de passage** : chaque enfant termine son lieu, et **demande à en faire un autre**. Note de fin de lieu ≥ 4.

## Phase 2 : reprendre ce que les enfants aimaient dans la v1

Dans l'ordre que les enfants choisiront à la séance de la phase 1 :

- les 28 autres lieux (contenu déjà prêt dans `lieux.json`), région par région ;
- balance géante, stand de tir (Lice), pont des fractions : comme des lieux de l'île, plus des panneaux posés sur une salle ;
- Clairval en plein air et ses habitants (`villages.json`), quêtes du jour ;
- Pierre du Jour (défi quotidien, série, coffre de la semaine, sans compte à rebours) ;
- île du Sphinx : barque, passages, blocs du temple (niveaux de `tools/make_sphinx_levels.py` sortis en JSON) ;
- apparence du héros (silhouettes, armes, capes, déblocages) et sac d'objets ;
- prologue en cinq tableaux joués dans l'île, voix enregistrées de Maître Ysaline (`deploy/voix/manifest.json`), musique ;
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
2. Les rencontres : tu veux voir les ennemis venir vers toi, ou les trouver en entrant dans une salle ?
3. Le renard (Jules) : il doit faire quoi ? Trouver des passages, des objets, des pierres cachées ?
4. Tom : le monde Brouillard est-il assez différent ? Plus sombre, la nuit, la pluie ?
5. Vous jouez où : sur quel PC, combien de temps, à quel moment de la journée ?
