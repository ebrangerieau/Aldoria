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
- **Combat** (`core/combat/`, testé sans moteur) : `encounter.ts` les règles seules, portées de la v1 ; `flow.ts` le déroulé (action,
  question, verdict, récit) avec un hôte à trois méthodes ; `texts.ts` les mots de chaque monde (`content/monde/combat.json`). Un
  `Encounter` par lieu, `engage(ennemi, …)` à chaque combat : le bouclier levé et la série du critique « sans vitesse » passent d'un
  ennemi au suivant, comme dans la v1. Aucune animation, aucun son, aucun panneau dans `core/` : `game/interior.ts` met en scène
  (`beginFight`, `present`, `endFight`), `ui/useFight.tsx` mène le combat (barres, actions, question, annonces). Un changement de
  règle se fait dans `core/`, avec son test, jamais dans la scène. XP, niveaux et PV du héros : `core/progression.ts`. Les questions
  d'un lieu viennent de sa session « donjon » (`app/placeSession.ts` : chapitres du lieu, comme dans la v1 ; en mode découverte, le
  paquet de test restreint à la matière) : sans elle, un combat poserait des questions de toute matière.
- **Jamais deux fois la même question dans un parcours** (`core/questionService.ts`, tests `questions-uniques.test.ts`) : un parcours va d'un `reset`
  à l'autre (un lieu, l'île, le défi du jour). « La même » se juge sur le **contenu** (`questionSignature` : type, énoncé, visuel, propositions dans le
  désordre, texte de la bonne réponse), jamais sur l'identifiant : deux tirages d'un générateur à petit espace de valeurs peuvent poser le même énoncé
  (le serveur les écarte aussi, `session_pack.content_key`). Un rôle qui n'a plus de question inédite emprunte l'autre (automatisme ↔ chapitre : qui ne
  fait que frapper vide les automatismes en vingt coups) ; une énigme toutes posées rend `null` (le piédestal prend alors une question du chapitre, jamais
  une énigme reposée) ; une notion ratée ne revient que sous une question inédite. Seul un paquet **entièrement** posé reprend la plus ancienne (jamais celle
  qu'on vient de poser), et `QuestionService.repeats` le compte : un lieu n'y arrive pas, son paquet fait 100 questions (`tracking.DUNGEON_PACK_SIZE`, une
  soixantaine consommées au plus par une enfant en difficulté, mesuré sur `lieux.json` ; au plus 237 Ko et 0,14 s à générer, maths de 2nde, contre 148 Ko à 60 questions : l'appareil en garde un par lieu visité, `Store.set` avale un dépassement de quota). D'un parcours à l'autre de la même séance, on préfère aussi le
  contenu pas encore vu. Une nouvelle source de questions passe par `QuestionService.next`, jamais par le paquet directement. Seules les maths ont des automatismes (28 sur 100) : ailleurs, ou une fois les 28 posés, « Frappe » reçoit une question du chapitre un cran plus facile.
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
  l'entrée seulement : `OPEN_KINDS` ; la porte de l'énigme s'ouvre au troisième cristal), du « vide » pour le déplacement tant qu'elles le sont ; ennemis à leur place de la v1
  (`v1_at`, sans miroir), tournés vers l'ouest, leur obstacle retiré à leur chute. Ennemis : squelettes KayKit (même rig que le héros)
  et monstres Quaternius, dont l'échelle est mesurée une fois (`content/monde/monstres.json`, `node tools/mesurer_monstres.mjs` avec
  la prévisualisation lancée : une boîte au repos ne dit rien d'une armature à l'échelle 100). `&e2e` : `world.enterPlace(code)`,
  `world.interior` (`teleport(x, z)`, `frame(écart, beta, distance)`, `heroPosition()`, `enemies`, `fighting`, `pedestals`, `riddling`, `solvePedestal(p)`), `world.places`,
  `world.measureMonster(modèle)`, `encounter` (le combat en cours : `hero.hp`…) et `save()` (la partie en cours, lecture seule).
- **Effaceur, coffre et page** (étape 1.4) : le gardien de la dernière salle de chaque lieu (`core/quest/boss.ts`, `Enemy.boss` dans `game/interior.ts`)
  se combat avec `Encounter` en mode `boss` : huit sceaux (`sealsLeft(hp, maxHp)`, **dérivés des PV**, jamais comptés à part : un indice ou un
  coup critique change le nombre de sceaux brisés), difficulté qui monte, héros aux forces rendues avant le combat. L'Effaceur se présente une
  fois par visite (pas après un repli) puis a le dernier mot ; ses répliques (`boss_intro`, `boss_defeat` de `lieux.json`) s'affichent avec le
  bouton « Écouter » de sa voix enregistrée (lues d'office avec « lecture automatique »), comme les seuils. Sa chute fait apparaître le coffre doré
  (`chest_gold.glb`, chargé avec le lieu : `revealChest` puis `openChest`, le couvercle est un nœud à part) ; E l'ouvre. `core/quest/chest.ts` :
  `completePlace(save, lieu)` rend une **nouvelle** partie (lieu terminé +1, XP du coffre, deux objets du sac, `page-<code>` dans `story` la première
  fois), `chestMessage` (« La page des X retrouvée ! » la première fois, le mot de la fin ensuite), `pageGreeting` (le salut enregistré de
  Maître Ysaline). Le coffre ouvert ramène sur l'île ; **la première fois seulement**, Maître Ysaline salue le héros en annonçant le chemin qui
  s'ouvre. `GameWorld.placeCompleted(places)` allume le lieu suivant et son repère de la mini-carte : le monde garde la partie de sa création, il
  faut le prévenir. Vérifier un Effaceur : captures `boss-*`, `boss-combat-*`, `coffre`, `coffre-ouvert` (`npm run captures`). Les modèles de
  Quaternius sont sombres par construction (couleurs de base très foncées : la gelée verte et le dragon paraissent presque noirs) : ce n'est pas
  un défaut d'éclairage. Le coffre se referme sur la note de plaisir (étape 1.5, ci-dessous) ; il annonce aussi ce que le niveau et le lieu débloquent dans l'apparence (ci-dessous).
- **Prologue** (reprise de `scenes/prologue` de la v1 ; `core/prologue.ts`, `content/monde/prologue.json`, `ui/Prologue.tsx`, test `prologue.test.ts`) : cinq tableaux joués dans l'île : la Grande Chronique (la Citadelle), le vol de Malvrek (la tour
  de l'Oubli), le Brouillard de l'Oubli (la Vallée du Vivant), Maître Ysaline (elle-même) puis la quête (le héros, prêt à partir). Chaque tableau a un **plan** de caméra (`Shot` : point de l'île, hauteur, `alpha`, `beta`, `rayon` ; le test
  vérifie que le point visé est sur la terre ferme, que la caméra reste dans le monde et au-dessus du sol) et un **texte par monde** : le ton de Jules, celui de Tom, repris de `content/voix/lignes.json` (`prologue-<tableau>-<monde>`,
  **enregistrés** de la voix du narrateur, puis de Maître Ysaline : le test les relie au manifeste). La caméra de cinéma est `GameWorld.setCinematic(shot | null)` : elle quitte le héros, glisse d'un plan au suivant (d'un coup en mode calme),
  lève la distance maximale de la caméra du jeu (160 m au lieu de 18) et ne la rend qu'à l'arrivée du retour derrière le héros (sinon elle sauterait). Le texte est **caché** d'abord (bouton « Texte » ; `sr-only` pour les lecteurs d'écran),
  affiché d'office quand la voix s'arrête tout de suite (rien n'a été dit : `SILENT_BELOW`) ; sans clic, le tableau suivant vient **seul après la voix** (`PAUSE_AFTER_VOICE`), ou après `readingTime` si la voix n'a rien dit. « Suite »,
  « Passer » et Échap (le prologue est alors marqué vu : `STORY_KEY` dans `SaveData.story`), la flèche droite avance. La page passe en mode cinéma (`html.en-prologue` : barre du haut, mini-carte et aides cachées). Il se joue **tout seul la
  première fois pour un enfant connecté** (`shouldAutoplay`, jamais en mode découverte), et se **revoit** chez Maître Ysaline (« Revoir l'histoire »). Vérifier : captures `prologue-1` à `prologue-5`, `prologue-brouillard` ; parcours
  navigateur (voix enregistrée jouée, texte caché puis affiché, caméra sur chaque lieu, enchaînement sans clic après la voix, héros immobile, vu rangé dans la partie, caméra et interface de retour).
- **Régions qui s'éclairent** (PRD V2-09, le brouillard de la carte de la v1 ; `core/world/regionLight.ts`, test `regionLight.test.ts`) : la lumière de chaque région vient **seulement** des lieux de
  la classe et de ceux que la partie a terminés (`regionLights(places, done)`, jamais un compteur à part). Une région sans lieu pour la classe (SVT et SNT en 6e) est sous le **brouillard**
  (lumière 0, `fogNote` : son texte de `regions.json`, affiché sous son nom dans la bannière, `data-testid="region-brume"`) ; une région au programme vaut `BASE_LIGHT` (0,5) sans page,
  monte de moitié par page rapportée (`endormie`, `eveillee`, `eclairee`), une page rapportée deux fois ne compte qu'une fois. Le **sol** (`game/island.ts` : `buildGround` rend `setLights`)
  se fane vers un gris bleuté et s'assombrit selon le **carré du manque de lumière** de la région qui le colore (une région qui attend son premier lieu ne se fane qu'un peu : l'île reste
  accueillante au départ ; le brouillard se fane pleinement ; même pondération que la teinte, un octet par région et par sommet ; la couleur des facettes est recalculée sans reconstruire le maillage) ; `GameWorld.placeCompleted` rappelle `relight()` : **le monde garde la partie de sa création, il faut le prévenir** (comme pour le lieu suivant).
  La **brume locale** : la densité de la brume du monde est multipliée par `fogDensityFactor(lumière)` (1 à 1,8, au carré du manque de lumière) dans la région du héros, en douceur (d'un coup en mode calme).
  Crochets `&e2e` : `world.regionLights()` et, en découverte, `giveRegion(code)` (tous les lieux d'une région). Vérifier : captures `region-brume`, `region-endormie`, `region-eclairee`,
  `region-panorama` ; parcours navigateur (lumière de chaque région d'après la partie, Vallée du Vivant sous le brouillard avec son texte, brume qui s'épaissit puis se lève).
  **Voix** : le texte de brouillard d'une région est celui que Maître Ysaline a enregistré (`brouillard-<région>` de `lignes.json`, test `regionLight.test.ts`) ; avec la « lecture automatique », entrer dans la région le lit de sa vraie voix (`GameScreen` : effet sur `region.note`, coupé quand le héros s'en va avec `stopIf`).
  **Mini-carte** : chaque région qui manque de lumière y porte un voile de brouillard (`fogDiscs` de `core/world/minimap.ts`, `FOG_OPACITY` 0,62 au carré du manque de lumière, `circle.mark-fog`,
  événement `lights` du monde) qui se lève page après page ; capture `carte-lumiere`.
- **Énigme, héros qui parle, note de plaisir** (étape 1.5) : la quatrième salle de chaque lieu a **trois piédestaux** (`PEDESTAL_SPOTS` de
  `core/world/dungeon.ts`, positions de la v1, `Dungeon.pedestalPoints`), un cristal chacun (`game/interior.ts` : `Pedestal`, `buildPedestals`,
  événement `riddle`). Le héros qui s'approche à `PEDESTAL_DISTANCE` reçoit une question et ne marche plus (`riddling`) ; `ui/useFight.tsx`
  la pose (`core/quest/enigma.ts` : `riddleItem` = une énigme de la session, à défaut une question du chapitre, jamais « Pas vu en classe »,
  `gameMode` « enigme »). Juste : le cristal s'éveille (vert, plus grand, immobile), XP du lieu et de la question (`enigmaXp`). Faux : l'explication
  s'affiche, le piédestal repose jusqu'à ce que le héros s'éloigne de `PEDESTAL_REARM` puis revienne (autre question). Les trois cristaux éveillés
  ouvrent la porte (`openDoor`, « La porte s'ouvre ! ») et un objet attendait au sac (`findItems`, `ENIGMA_ITEMS`). L'introduction de la salle se
  dit la première fois (`enigmaIntro` : celle de `lieux.json`). La **Tour des Fractions** (seul lieu au mode « balance ») n'a pas de piédestaux : sa salle-énigme a la balance géante (ci-dessous).
  Seule la **salle atteinte** est gardée (reprise d'un lieu, ci-dessous) : les cristaux et les manches de la salle en cours reviennent à neuf à la visite suivante.
  **Le héros parle** (`core/heroVoice.ts`, `content/monde/heros.json`, `HeroVoice` gardé par appareil : les dernières phrases ne reviennent pas) :
  bulle `.hero-bubble` en bas à gauche (`data-testid="heros-dit"`, effacée dès qu'une question, un dialogue ou un combat s'ouvre), lue avec la
  « lecture automatique » ; une phrase de départ à l'entrée dans le lieu, puis un mot sur la salle suivante à chaque porte qui s'ouvre (combat
  vaincu, énigme résolue). **Note de plaisir** (`core/quest/rating.ts`, `ui/Rating.tsx`) : après le message du coffre, « Comment as-tu trouvé ce lieu ? »,
  cinq étoiles (touches 1 à 5, « Passer » ou Échap : pas de note), envoyée avec la fin de la session du lieu (`PlaceSession.end(rating)` →
  `Session.end(rating)` → `session/end`, champ `rating`) ; elle sert d'indicateur au parent (critère de la phase 1 : note ≥ 4). Vérifier :
  captures `enigme`, `enigme-eveillee`, `enigme-brouillard` ; parcours `e2e/smoke.mjs` (erreur, réarmement, trois cristaux, porte, bulle, étoiles).
- **Balance géante** (v1 : `scenes/dungeon/balance_enigma.gd`, `core/world/balance_rig.gd` ; Tour des Fractions, la salle-énigme du mode « balance » ; tests `balance-geante.test.ts`) : **trois manches sur la balance elle-même**
  au lieu des trois piédestaux. `core/balanceEnigma.ts` (pur) : une manche (`BalanceRound`, état rendu neuf à chaque geste) part de la balance en équilibre de la question (`visual` kind « balance » : `isBalanceItem`) ;
  l'enfant enlève la même chose des deux côtés (`removeFromBoth`, elle reste en équilibre : c'est le raisonnement de la pré-algèbre), propose une masse pour une boîte (`stepGuess`, de 0 à 40) et essaie (`attempt`) : le fléau penche du côté
  le plus lourd (`weigh`), chaque boîte affiche la masse essayée, le message dit le côté et le sens de la correction **sans donner la réponse** (« trop lourde, essaie moins »), l'indice sort au troisième essai (ou à la demande), l'explication
  de la question après une correction. **Seul le premier essai est enregistré comme réponse** (`services.questions.submit(…, 'enigme')`) ; XP de l'énigme (`enigmaXp`) en entier du premier coup, la moitié après correction (`roundXp`).
  `core/balanceRig.ts` (pur) : dimensions, places des boîtes et des billes sur un plateau, position des plateaux selon l'inclinaison, mouvement du fléau (`tiltAt` : un rebond, en douceur en mode calme). `game/balanceRig.ts` : la balance (socle,
  colonne, fléau, chaînes, plateaux ; boîtes et billes en *thin instances*, sacs et pièces selon les noms de la question ; nombres sur des plans qui regardent la caméra : l'étiquette de chaque plateau au-dessus du fléau, la masse essayée sur chaque
  boîte) ; elle ne décide de rien, l'interface lui pousse tout l'état (`show`). `game/interior.ts` : `buildBalance` (la salle-énigme du mode « balance » : pied en `BALANCE_AT`, trois obstacles, **aucun piédestal**), le héros qui
  s'approche à `BALANCE_DISTANCE` (3,4 m du pied) **ou touche un plateau** (`isNear` de `core/balanceRig.ts` : de côté, à l'ouest, les plateaux l'arrêtent à plus de 4 m du pied ; testé en le faisant marcher depuis la porte et depuis l'ouest) commence (`beginBalance` : il se place à l'ouest de la balance, face à elle, la caméra la cadre ; événement `balance`), `showBalance`, `balanceRoundDone`, `endBalance(done)` ; renoncer (« Plus tard »,
  Échap) rend la main et la balance ne se réarme qu'une fois le héros éloigné d'un mètre de plus (`isFarEnough`, `BALANCE_REARM_MARGIN`). `ui/useFight.tsx` (`balanceRef`) mène les trois manches : une question de balance chacune (`riddleItem`) ; **sans question de balance**
  (paquet sans énigme, hors connexion), la manche est une question ordinaire (`QuestionPanel`) : la porte ne reste jamais fermée faute de balance ; la troisième manche ouvre la porte et rapporte l'objet de l'énigme (`openRiddleDoor`, comme les
  piédestaux). `ui/BalanceEnigma.tsx` : le panneau du bas (`.balance-overlay` : fond transparent mais **la barre du haut est couverte**, Archives ou Options ouverts par-dessus la manche laisseraient son écouteur du clavier actif : Entrée y répondrait pour l'enfant), « Essayer sur la balance » collé en bas quand le texte agrandi le fait défiler, flèches ou + et − pour la masse, Entrée essaie, Échap : plus tard.
  Crochets `&e2e` : `balance` (la manche : `item`, `round`), `world.interior.balance` (`rounds`, `armed`, `rig.snapshot()` : plateaux, étiquettes, masse essayée, fléau, `settled`), `world.interior.balancing`. Vérifier : captures
  `balance-attente`, `balance-manche`, `balance-penche`, `balance-equilibre`, `balance-brouillard` ; parcours navigateur (la scène comparée au panneau après chaque geste, renoncer puis revenir, retrait des deux côtés, un essai trop fort, un
  essai trop faible, la bonne masse, XP corrigée < XP du premier coup, indice, porte, balance résolue qui ne se relance pas) ; `node e2e/balance-a11y.mjs` (aménagements les plus larges à 1280 × 720).
  Le parcours des **piédestaux** (autres lieux) se joue dans le Moulin des Phrases (premier lieu de la région du français, ouvert dès le départ).
- **Reprise d'un lieu** (v1 : `SaveManager.set_checkpoint`, `dungeon.gd` `_checkpoint` ; `core/checkpoint.ts`, test `reprise-lieu.test.ts`) : quitter un lieu en plein milieu (la séance se termine) ne fait plus tout recommencer. `SaveData.checkpoints`
  (code du lieu → salle atteinte, relu par `normalizeCheckpoints` : entiers de 1 à 20, 100 lieux au plus) est posé **dès qu'une porte s'ouvre** (`useFight.rememberRoom` : un combat vaincu, l'énigme résolue ; `withCheckpoint` ne recule
  jamais et ne dépasse pas la dernière salle) et **effacé quand le lieu est terminé** (`completePlace` : il se rejoue depuis l'entrée). À l'entrée, `checkpointOf` donne la salle de départ : `GameWorld.enterPlace(code, onProgress, startRoom)` →
  `InteriorWorld` (`startRoom`) ouvre les portes d'avant, ne dresse pas les ennemis des salles franchies, éveille leurs cristaux (`awaken`, sans gerbe) ou donne la balance pour résolue, et place le héros à l'entrée de la salle de reprise ;
  seule la salle atteinte est gardée (ses ennemis, ses cristaux, ses manches reviennent à neuf, comme dans la v1). Le seuil du lieu ajoute « Tu reprendras à l'étage N. » sous le texte enregistré (la `note` du `Dialog`, jamais lue : la voix enregistrée se lit
  seule), l'entrée annonce « Reprise : <salle> » (`resumeBanner`) et le héros dit un mot sur la salle. Crochets `&e2e` : `giveCheckpoint(code, salle)` (découverte ; 0 l'efface), `world.interior.startRoom`, `save().checkpoints`. Parcours : la victoire de la
  salle 1 garde la salle 2, la balance se joue depuis une reprise à la salle de l'énigme, une étape dédiée (seuil, portes, ennemis d'avant absents, bandeau, sortie qui garde le point, lieu sans reprise qui n'en parle pas).
- **Le sac** (`core/inventory.ts` : plume, parchemin, bouclier, potion, 5 au plus de chaque ; gagnés au coffre d'un lieu (2), à l'énigme (1), au coffre de la
  semaine ; rangés dans la partie, `SaveData.items`) : **aucun objet ne fait sauter une question**. `core/bag.ts` (pur, testé) décide : `bagEntries`
  (potion et bouclier avec ce qui empêche de s'en servir : plus d'objet, vie pleine, bouclier déjà levé), `useInCombat` (dépense l'objet et rend
  l'événement `potion` ou `shield_up` d'`Encounter.usePotion` / `useShield`), `questionAids` et `featherHides`. **En combat**, le bouton « Sac »
  (touche 4, `ui/Bag.tsx`, `ui/useFight.tsx`) ne pose aucune question et ne fait pas perdre le tour : `chooseAction` boucle tant que l'enfant
  ouvre le sac ; un bouclier levé s'affiche (`FightView.shield`, badge « Bouclier levé ») jusqu'au prochain coup de l'ennemi, la potion rend
  toute la vie ; l'usage est rangé par `persist` avant d'être raconté (`interior.present` : `potion`, `shield_up`). **Dans une question**
  (`QuestionPanel`, prop `aids` : `ui/aids.ts` `makeAids`, donnée au combat, à l'énigme et à la pierre de l'île, **jamais** au défi du jour) : la
  plume cache deux mauvaises propositions d'un QCM d'au moins trois choix (**une seule sur trois choix**, la v1 en retirait deux et laissait la
  bonne réponse seule), le parchemin montre l'indice. Une aide d'objet compte comme indice pour le suivi mais **sans baisse de puissance**
  (`helpCounted` : seul « Un indice ? » baisse la puissance du coup). Tests dans le navigateur (`&e2e`) : `__aldoria.give(id, n)` met des objets
  au sac. **Sur l'île**, le bouton « Sac » de la barre (hors intérieur, `ui/BagView.tsx`, `bagOverview` / `isBagEmpty` de `core/bag.ts`) liste les quatre objets avec ce qu'il en reste, ce qu'ils font et où ils servent, en lecture seule (rien ne s'y dépense) ; un sac vide dit où en trouver (`BAG_SOURCES`). Captures `sac-vide`, `sac-garni`. Reste à faire : l'arène n'existe pas encore dans la v2 (une quête de village rapporte un objet).
- **Reliques et Table des Reliques** (décision D13 ; `core/relics.ts`, `content/monde/reliques.json`, tests `reliques.test.ts`) : seize **sceaux**, un par couple
  d'un élément (flamme, onde, feuille, étoile : chacun a une couleur **et une forme**, jamais la couleur seule) et d'un rang (I à IV) ; deux reliques
  « se répondent » quand elles partagent un élément ou un rang. Huit se ramassent dans l'île (une par région, positions de `reliques.json`, vérifiées sur
  la terre ferme, atteignables à pied et à l'écart des bâtiments par `reliques.test.ts`), huit tombent du **coffre** des premiers lieux terminés
  (`completePlace` : `chestRelic` à **chaque** fin de lieu rend la relique due et pas encore trouvée, donc le tour d'un lieu terminé la première fois et le rattrapage d'une
  partie ancienne, même en rejouant un lieu, jamais de doublon ; `Completion.relic`, ligne « Relique trouvée : … ! »).
  Rangées dans la partie (`SaveData.relics`, `normalizeRelics`, jamais deux fois ; `SaveData.table` : dernier jour récompensé). **La table** : un carré de 4 × 4
  où chaque rangée et chaque colonne ne répète ni un élément ni un rang ; les reliques de l'enfant (neuf au plus, `MAX_HOLES`) sont à placer, toutes les autres
  sont gravées dans la pierre ; `makePuzzle(owned, graine)` part d'un carré complet (`randomSquare`), donc **toujours soluble** (une seule solution jusqu'à huit
  cases, parfois deux à neuf : `isSolved` juge la règle, pas le carré d'origine). `place` / `lift` / `hint` / `applyHint` rendent une nouvelle table ; l'indice
  coûtera un parchemin du sac. `claimTable` : le premier carré du jour rapporte l'XP (`TABLE_XP_PER_HOLE` par case) et, à partir de cinq cases, un objet ;
  les suivants sont de l'entraînement. **Dans l'île** (`game/GameWorld.ts` : `buildRelics`, `relicCollected`) : un éclat de la forme et de la couleur de l'élément sur un anneau lumineux
  (interaction `kind: 'relique'`, rayon 2,4 m ; **jamais sur la mini-carte** : on les trouve en se promenant) ; E la ramasse (`GameScreen.collectRelic` : la partie la
  garde, l'éclat disparaît, « Relique trouvée ! … sur 16 »). Celles que la partie possède déjà ne sont pas posées. Captures `relique-flamme`, `-onde`, `-feuille`,
  `-etoile`, `-brouillard`. **L'écran de la Table** (`ui/RelicTable.tsx`, plateau de pierre sur le plateau de la Citadelle : `table_reliques` de `ile.json`, `GameWorld.buildRelicTable`, interaction
  `kind: 'table'`, repère sur la mini-carte, anneau allumé tant qu'une table du jour attend : `setTableState`) : le carré à gauche, à droite le message (lu par
  `role="status"`), les reliques à placer, l'indice et « Recommencer ». On choisit une relique en bas (ou 1 à 9) puis une case libre ; toucher une relique posée la reprend ;
  flèches, Entrée, Échap au clavier ; une case en conflit porte un « ! » et une bordure rouge (jamais la couleur seule), chaque élément sa forme, chaque case un libellé
  pour lecteur d'écran (`describeCell`). **Aucune table sans deux reliques** (message qui dit où en trouver). Le premier carré du jour rapporte (`claimTable`, la partie est
  rangée par `onSave`), une table déjà récompensée s'ouvre directement en entraînement ; « Une autre table » en donne une autre. Crochets `&e2e` : `table` (la table en
  cours : `fixed`, `pool`, `solution`), `save()`, et en découverte `giveRelics(ids)` et `give`. Parcours navigateur : table vide, conflit signalé, indice, carré résolu, récompense
  une seule fois, entraînement au clavier ; captures `table`, `table-brouillard` ; `node e2e/table-a11y.mjs` (aménagements les plus larges : à texte agrandi la table passe sur une colonne et le panneau défile, Échap ferme). Reste à faire : brancher la Table à l'île du Sphinx quand son écran existera ; un indice de Maître Ysaline vers
  la première relique ; un bestiaire des reliques (chaque sceau avec son histoire).
- **Île du Sphinx** (idée de Jules ; jeux de logique, **aucune question de leçon** ; règles `core/sphinx/board.ts`, passages et paliers `core/sphinx/island.ts`, textes et déroulé
  `core/sphinx/visit.ts`, 180 énigmes de `content/monde/sphinx_niveaux.json` converties de la v1 ; `tests/sphinx.test.ts`). **Les passages** : une visite de lieu où l'enfant a répondu à au moins
  `PASS_ANSWERS` (6) questions, ou un défi du jour terminé, rapporte un passage (`afterActivity`, réserve de `MAX_PASSES` = 3, annoncé par un bandeau ou une ligne du bilan) ; **jamais** les
  pierres de l'île principale (session « monde ») ni l'île du Sphinx ; un défi interrompu n'en rapporte pas (comme pour sa série). L'état (`SaveData.sphinx`, relu par `sphinxOf(save, classe)` :
  la classe fixe le palier de départ) est rendu neuf à chaque changement. **La barque** (`ile.json` : `barque`, `GameWorld.buildBoat` : coque, proue, mât et voile en formes simples, qui tangue ;
  interaction `kind: 'barque'`, repère sur la mini-carte ; atteignable à pied et en eau profonde, testé) ouvre `ui/SphinxVisit.tsx` : sans passage elle l'explique (`noPassageText`) ; avec, « Traverser »
  en dépense un, le Sphinx se présente (la première fois : `STORY_KEY`, texte lu par Piper, pas de voix enregistrée), puis `VISIT_PUZZLES` (3) énigmes (`ui/SphinxPuzzle.tsx` : flèches ou Z, Q, S, D,
  Retour arrière ou U pour annuler, R pour recommencer, H pour l'aide, Échap pour quitter ; cliquer sur une dalle libre, du plan ou de la salle 3D, y mène sans pousser de bloc ; l'aide remet la salle au départ et rejoue un tiers de plus de la
  solution à chaque appel) ; jamais la couleur seule (dalle gravée = losange creux, bloc = croix, bloc posé = coche dorée, bloc coincé = « ! »). Trois énigmes de suite sans aide font monter d'un palier.
  **Le temple en 3D** (`game/temple.ts`, classe `TempleWorld` ; la part sans moteur dans `core/sphinx/stage.ts`, `tests/sphinx-stage.test.ts`) : une scène à part, même moteur et même canevas que l'île, qui est mise en pause comme dans un lieu
  (`GameWorld.enterTemple` à « Traverser », `leaveTemple` au retour, à Échap, au changement de joueur ; si la scène ne s'ouvre pas, l'île continue et le plan à plat passe en grand). **L'état du plateau reste dans `SphinxPuzzle`** (`SphinxBoard`) :
  la scène ne décide de rien, `SphinxPuzzle` lui pousse tout l'état (`show` : héros, blocs, regard, résolu, bloc coincé) après chaque rendu ; la scène le montre (le héros marche, un bloc glisse : `glide`, d'un coup au-delà de 1,6 dalle ou en mode calme)
  et rend le clic sur une dalle (`tile` → `walkTo`). **Aucune touche dans la scène** : les touches de l'île sont coupées (`setInputEnabled` sans effet tant que le temple est là, sinon E rouvrirait la barque). Orientation : caméra au sud, rangée 0 du plateau au
  fond (`cellCenter`, `yawOf` : testés) ; la caméra est fixe (`frame`, `freeWindow` : toute la salle tient dans la part libre de l'écran à gauche du panneau, mesuré par `SphinxPuzzle` et recalculé au redimensionnement). Géométrie en formes simples fusionnées
  à couleurs par sommet (une salle = quelques appels de dessin), un maillage par bloc ; un mur qui a une dalle derrière lui est bas (`WALL_LOW`) pour qu'un bloc ne disparaisse jamais derrière ; la salle d'accueil `VESTIBULE` (Sphinx, héros, renard assis sur le mur
  dans le monde lumineux) sert aux cartes de bienvenue et de bilan, `TempleWorld.load(rows)` dresse chaque énigme sans recréer la scène. Palettes `PALETTES` (lumineux, brouillard). Le panneau passe à droite (`.on-stage`, calque transparent aux clics : titre, message et boutons d'abord, le plan
  à plat réduit en dernier, il garde tous les repères de test et l'accessibilité) ; **Archives, Options et Quitter de la barre du haut sont cachés pendant l'énigme** (`inTemple` : l'énigme est le modal ouvert, un autre écran la fermerait et ferait perdre le passage ; « Quitter l'île » est la sortie). Mode calme : rien ne tremble ni ne flotte, moins d'étincelles.
  La traversée ouvre une session « sphinx » (`app/sphinxSession.ts`, paquet vide côté API) : elle compte le temps de jeu fixé par le parent. Crochets `&e2e` : `sphinx` (l'énigme en cours : `rows`, `solution`,
  `tier`, `round`), `world.temple.snapshot()` (ce que la scène a montré et où sont réellement le héros et les blocs, `settled`) et `world.temple.projectCell(cell)` (pixels, pour cliquer sur la scène) ; en découverte, `giveSphinxPasses(n, patch)` (le patch change le palier, `next`…).
  Parcours navigateur : barque sans passage, traversée, présentation, trois énigmes (annuler, recommencer, aide, dalle du plan et dalle de la salle 3D cliquées, la scène comparée au plan après chaque geste), bilan, seconde visite
  quittée à Échap ; captures `barque`, `barque-brouillard`, `temple-accueil`, `temple-1`, `temple-1-pas`, `temple-3`, `temple-6`, `temple-brouillard` ; `node e2e/sphinx-a11y.mjs` (le plus grand plateau, aménagements les plus larges : la salle tient à gauche du panneau).
  **Pas encore fait** : le village rapporte un passage (la deuxième quête du jour, six réponses), l'arène n'existe pas encore dans la v2.
- **Le village** (Clairval en 6e, Brumegarde en 2nde ; portés de la v1 : `core/village.ts`, `content/monde/villages.json` exporté de la v1, tests `village.test.ts`). Les habitants se tiennent
  en plein air autour du puits (`ile.json` : `village.habitants`, écarts au puits dans l'ordre de `villages.json`, testés : sur le replat, atteignables à pied, loin des maisons et les uns des autres ;
  `GameWorld.buildVillagers`, `Interactable` de sorte « habitant », invite « Parler à … ») avec un « ! » doré (un trait et un point, jamais de texte dans le monde) tant que leur quête du jour
  attend (`setQuestState`) ; `talkTo` les tourne l'un vers l'autre et joue un geste. **Une quête par habitant et par jour** (`SaveData.quests`, code → jour ISO local, `questDone`, `normalizeQuests`) :
  `revision` (notions à revoir, catégorie « revision » du paquet), `veille` (chapitre « contrôle bientôt » du parent, sinon en cours : `context` du paquet, `askText` le nomme), `enquete` (trois
  questions sur un même document : générateur d'énigme, `shared_document` côté API). `QuestionService.nextQuestItem` choisit (jamais deux fois la même ; sans candidate, ou toutes posées, une
  question inédite de n'importe quel chapitre ; une enquête rend `null` quand ses énigmes sont posées). `ui/VillageQuest.tsx` (demande, « Je t'aide ! » ou « Plus tard », trois `QuestionPanel`
  `gameMode` « village », remerciement) et `app/villageSession.ts` (ferme la session « monde », ouvre « village » avec les `enigmas` du village, puis rouvre l'île : comme le défi du jour ; hors
  connexion sans paquet gardé : « il faut une connexion »). `completeQuest` (pur, état neuf) : 50 XP de forfait + 10 par bonne réponse (une quête sans bonne réponse compte aussi), un objet au sac, le niveau
  gagné et ce qu'il débloque dans l'apparence annoncés ; **la deuxième quête du jour (six réponses) rapporte un passage pour la barque du Sphinx**, jamais un second le même jour. Une quête faite ne
  se refait pas (l'habitant le dit : « Reviens demain »). Crochet de test : `world.interactables` (`habitant-<code>`), `world.villagers`, `save().quests`. Vérifier : captures `village`,
  `village-brumegarde`, `village-dialogue`, `village-enquete`, `village-enquete-croisee` ; parcours navigateur (les trois quêtes de Clairval : XP, objet, « ! » éteint, quête refusée le même jour,
  passage ; puis Brumegarde : les deux enquêtes avec leur tableau). **Mini-carte** : les habitants n'y figurent pas (trois points au même endroit ne se liraient pas) mais le repère du village s'allume (pastille dorée, état `quetes`, `mapMarkers`) tant qu'une quête du jour attend, et s'éteint quand toutes sont faites. Reste : les habitants n'ont pas de voix enregistrée.
- **La Lice et le Pont des fractions** (portés de la v1 : `scenes/pont`, `core/world/chasm_bridge.gd` ; Jules, 6e seulement : `generatorFor('pont', classe)` ; tests `pont.test.ts`, `lice.test.ts`).
  Des exercices calculés sur le plateau de la Citadelle, **sans chrono**, par **séries de six** (`core/lice.ts` : `ROUNDS`, `finishRound`, `roundGain` = 15 + 10 × difficulté, moitié moins après un premier
  essai raté ; seul **le premier essai** de chaque cible est enregistré comme réponse, les suivants servent à corriger). **Le pont** (`ile.json` : `pont`, `GameWorld.buildBridge` : deux piles, une passerelle, des
  rambardes et un tas de planches aux couleurs des réglettes, interaction `kind: 'pont'` et repère `pont` sur la mini-carte ; atteignable à pied, loin du château, testé) ouvre `ui/PontBridge.tsx` : un ravin
  dont la largeur est une fraction de perche, une réserve de planches de longueurs fractionnaires (`visual = { kind: 'pont', gap, planks }`), posées bout à bout ; le pont tient si la somme vaut **exactement**
  le ravin (`core/pont.ts` : fractions exactes `Frac`, **jamais de flottant**, `outcomeOf` juste, court ou long ; une somme juste quelconque est acceptée, la réponse enregistrée est la somme posée). Un
  pont raté s'effondre (les planches reviennent), le conseil dit **la somme posée et le sens de l'erreur sans donner la réponse** (`adviceFor`), l'indice sort après trois essais (ou à la demande) ; un pont juste
  fait traverser le héros, l'XP est rangée tout de suite. Chaque planche porte sa fraction écrite (jamais la couleur seule). Clavier : 1, 2, 3… prennent une planche, Retour arrière la retire, Entrée pose le pont,
  Échap quitte. **Session** (`app/liceSession.ts`) : ferme « monde », ouvre « arene » avec `enigma` (le générateur, deux cibles d'avance), puis rouvre l'île ; en découverte, des cibles prises dans
  `visual_samples.json` (vrais tirages des générateurs, régénérés par `tools/export_visual_samples.py`) remplacent le paquet le temps de la série. Une série menée au bout (six cibles enregistrées) rapporte un
  **passage pour la barque du Sphinx** (`afterActivity`, mode « arene »). Crochet `&e2e` : `pont` (`gap`, `stock`, `solution`). Vérifier : captures `pont`, `pont-jeu`, `pont-tient` ; parcours navigateur (pont trop
  court, conseil, retrait, bonne somme, six ravins dont un au clavier, bilan, passage).
  **Le stand de tir** (`core/tir.ts`, `ui/TirRange.tsx`, `ui/LiceCard.tsx` pour les cartes communes ; `ile.json` : `stand_tir`, `GameWorld.buildRange` : comptoir, piquets et cible peinte, interaction `kind: 'tir'` et repère `tir`
  sur la mini-carte ; les deux classes) : six tirs calculés, même cadre que le pont (séries, XP, premier tir seul enregistré, passage du Sphinx). **6e** : un rapporteur géant peint au sol, vu d'en haut
  (`visual = { kind: 'rapporteur', angle, reference, minor, labels, double_scale, distance }`) ; l'enfant règle l'angle (pas de la petite graduation, de 0 à 180) et tire : la flèche part **exactement** dans la direction choisie
  (`directionOf`), touche si l'angle est celui de la cible (`hitsAngle`) ; raté, elle reste dessinée avec son angle et le conseil dit le sens de la correction, ou « graduation lue du mauvais côté » quand la ligne de départ
  est à gauche (`angleAdvice`, jamais la réponse). **2nde** : le repère de l'arbalète (`visual = { kind: 'repere_tir', start: [0, b], target: [x, y], width, height }`) ; l'enfant règle le coefficient directeur
  `n/d` (numérateur −12 à 12, dénominateur 1 à 6) ; le tir touche si la droite passe par la cible **en entiers** (`lineHits`, jamais de flottant), la valeur enregistrée s'écrit `slopeText` (« 2 », « -3/4 ») et
  la validation du client l'accepte pour toute fraction équivalente ; raté, le conseil donne la hauteur du carreau à l'abscisse de la cible et le sens de la correction (`lineAdvice`). Chaque graduation, chaque
  point porte son nombre écrit ; les flèches ont une animation (coupée par le mode calme sans cacher le tir). Clavier : flèches pour la valeur, Entrée tire, Échap quitte. Crochet `&e2e` : `tir`.
  Vérifier : captures `tir`, `tir-brouillard`, `tir-jeu`, `tir-touche`, `tir-droite`, `tir-droite-touche` ; parcours navigateur (un tir à côté puis la correction, six cibles dont une au clavier, bilan, passage ; puis le repère en 2nde) ;
  `node e2e/lice-a11y.mjs` (aménagements les plus larges à 1280 × 720 sur le tir, le pont, le prologue, le sac et le bestiaire : à texte agrandi le panneau défile mais **le bouton qui fait avancer** — « Tirer », « Poser le pont » — reste collé en bas, `position: sticky`, avec le retour de l'essai au-dessus).
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
  maîtrise vient toujours du serveur, jamais calculée par le client. **Bestiaire** (onglet « Bestiaire » des Archives ; `core/bestiary.ts`, test `bestiary.test.ts`, `SaveData.bestiary` : nom de la créature → victoires, relu par `normalizeBestiary`, borné à 200 espèces) : chaque combat gagné dans un lieu (Effaceur compris) ajoute une victoire sur le nom de l'ennemi (`useFight` : `recordDefeat`, rangé tout de suite), comme `record_defeat` de la v1 ; les créatures sont listées de la plus souvent vaincue à la moins (`bestiaryLines`), avec un résumé (`bestiarySummary`). Le bestiaire vit dans la partie : il suit l'enfant d'un PC à l'autre, jamais dans l'API des Archives (la maîtrise des notions, elle, vient toujours du serveur). Parcours : l'étape « Archives » compare la liste à la partie ; capture `05c-bestiaire`.
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
  jouables** (chapitre et énigme, mesuré sur les vrais générateurs), et `table` (relevé statistique et tableau croisé des enquêtes de Brumegarde,
  `TableView` : un vrai tableau HTML, en-têtes lus par un lecteur d'écran, totaux en gras avec leur nom écrit). `pont` (le Pont des fractions), `rapporteur` et `repere_tir` (le stand de tir, ci-dessous) : leurs générateurs
  (`combat=False`) ne servent qu'à la Lice, jamais dans un lieu. Ajouter un visuel : le composant, son calcul testé sur de
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
  **Couper la voix** : un composant qui se ferme ne doit couper que **sa** lecture. `Voice.token` désigne la lecture en cours (juste après `void say(…)`), `Voice.stopIf(token)` n'arrête
  que si personne n'a parlé depuis (`QuestionPanel` le fait) ; un `voice.stop()` aveugle, arrivé après coup, annulerait la lecture d'un dialogue qui s'ouvre avant même la demande du son.
  **Vérifier qu'un son enregistré a été joué** : le journal de la voix (`Voice.trace`, une quarantaine d'étapes en mémoire, jamais envoyées : « say », « qui a coupé », « son <fichier> », « joue », « fini » ;
  `Voice.notedCount` pour n'attendre que ce qui suit un repère) et non une réponse réseau. **Piège rencontré en production** : à la seconde visite d'un lieu, Chromium rejoue un son déjà reçu
  **sans nouvelle demande** ; le parcours qui exigeait une réponse réseau pour chaque lecture a échoué quatre fois à l'étape du boss alors que le journal montrait le son de défaite demandé, joué et fini
  (la voix marchait : l'échec était dans le test). `joue` (l'événement `playing` du lecteur) prouve que le fichier est présent, bien typé et décodable. Réglages du parcours : `E2E_CPU=<facteur>` ralentit le
  processeur de la page, `E2E_RETARD_VOIX=<ms>` retarde chaque fichier de `/voix/`, `E2E_RETARD_MUSIQUE=<ms>` ceux de `/musique/`.
  L'accueil de Maître Ysaline dans l'île (`ile-accueil`) est lu **depuis** `lignes.json` par `GameScreen` : texte et voix au même endroit.
  Les pages rapportées et le prologue parlent de l'île (« le chemin s'éclaire sur l'île »), jamais d'une carte du royaume, que la v2 n'a
  pas ; les `seuil-*` parlent, eux, de vraies cartes (atlas, plans) : ne pas les « corriger ». Les 60 répliques des
  Effaceurs (`boss_intro`, `boss_defeat` de `lieux.json`) sont enregistrées d'une voix unique pour les 30 (rôle « effaceur »,
  `ELEVENLABS_VOIX_EFFACEUR`), et jouées par l'écran du boss (étape 1.4, `services.voice.say`) ; le test
  `recordedVoices` les lie à `lieux.json`. Modifier une de ces répliques : la changer dans `lieux.json`, puis
  `python tools/voix_elevenlabs.py --lieux` la reporte dans `lignes.json`, puis le script la génère. Le script tourne aussi dans la session
  cloud : la clé s'enregistre par `request_credential` (hôte `api.elevenlabs.io`, en-tête `xi-api-key`, jamais dans le dépôt) et le script
  reçoit `ELEVENLABS_API_KEY=proxy-injected` ; une clé limitée à la synthèse n'a pas le droit `voices_read` (inutile : les voix sont au manifeste).
- **Apparence du héros et du renard** (PRD V2-08, portée de la v1 ; règles dans `core/wardrobe.ts` et `content/monde/apparence.json`, lien avec la partie dans
  `core/appearance.ts` : `lookOf`, `choose`, `menuOf`, `unlockNews`, `unseenCount`, `markSeen` ; tests `wardrobe.test.ts`, `apparence.test.ts`). Un `Look`
  (silhouette, arme, main gauche, couvre-chef, cape et sa couleur, renard : nom et pelage) est rangé dans `SaveData.look` et **relu partout par
  `sanitizeLook`** avec ce que l'enfant a débloqué (niveau du héros, lieux terminés) : un choix inconnu, verrouillé ou incompatible (arme à deux mains et main
  gauche) reprend sa valeur par défaut, une partie d'un autre appareil reste jouable. Jamais d'accès direct à `save.look` : `lookOf(save, world)`. Le
  compagnon n'existe que dans le monde lumineux (`hasPet`). Monde : `game/characters.ts` (`dress` idempotent, `tintCape`, `tintFox`, `loadHero(scene, look)`) ;
  les personnages KayKit partagent **un seul matériau à atlas** : la cape colorée est un clone à couleur unie (`toLinearSpace()` pour un PBR), jamais une
  teinte posée sur le matériau commun ; le renard a ses propres matériaux `Main` / `Main_Light`. `GameWorld.setLook` rhabille le héros (autre silhouette : un
  nouveau modèle au même endroit, dans le même sens, ombre comprise) ; **ses demandes se font à la file** (le chargement d'un modèle est asynchrone : sans file,
  des clics rapprochés laissaient trois héros à l'écran, mesuré), chacune avec le dernier choix, et `shownModel` dit ce qui est vraiment affiché ; un lieu recharge son
  héros avec `this.look`. Écran : `ui/Wardrobe.tsx`, bouton
  « Apparence » du bandeau (hors intérieur) avec la pastille des nouveautés (`unseenCount`, effacée à l'ouverture par `markSeen`), panneau à droite et
  `GameWorld.setShowcase` qui passe la caméra devant le héros, décalé à gauche du panneau, puis la ramène derrière lui. Un choix verrouillé reste visible avec
  sa condition (« Niveau 5 », « Termine 2 lieux ») ; le toucher l'explique sans rien changer ; jamais la couleur seule (nom, coche, texte de verrou). Le coffre
  (`chestMessage`, fait `unlocked`) et le niveau gagné en combat (`announce`) annoncent les nouveautés. Vérifier : captures `apparence-*` (héros), `apparence-ecran*`
  (écran, niveau 3 et deux lieux), `e2e/wardrobe-a11y.mjs` (texte agrandi à 1280 × 720) et l'étape « l'apparence » du parcours (`giveProgress(xp, lieux)`,
  mode découverte seulement). Le **nom du renard** s'affiche sous le badge du héros (`companionLabel`, `data-testid="compagnon"`, monde lumineux seulement, hors intérieur d'un lieu) et suit tout de suite un renommage.
- **Un état se rend toujours neuf** (jamais modifié sur place) dans `core/`.
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
