# Décisions de la v2

Chaque décision : le contexte, le choix, la raison et ce qu'elle implique. On n'efface pas une décision : on en écrit une
nouvelle qui la remplace, avec la date. D1 à D6 et D11 ont été prises avec Eric le 7 novembre 2026.

## D1 : PC seulement (7 novembre 2026)

- **Contexte** : dans la v1, la tablette Android (9 fps au réglage haut) puis le téléphone de Tom ont dicté le rendu, les
  budgets et une partie de l'interface (`docs/BILAN-V1.md` §3, n° 1).
- **Choix** : la v2 vise le navigateur du PC familial, clavier et souris (manette plus tard).
- **Implique** : un seul jeu de commandes ; trois profils de rendu qui ne changent que des réglages ; plus d'écran « Tourne ton
  téléphone », de PWA ni de joystick tactile. À confirmer avec Jules, qui jouait sur la tablette.

## D2 : Babylon.js et TypeScript (7 novembre 2026)

- **Contexte** : Godot sur le web est limité au rendu WebGL 2 « Compatibility » (pas de halo HDR ni d'occlusion ambiante),
  pèse 10 Mo de moteur compressé et oblige à refaire l'interface dans le moteur.
- **Choix** : Babylon.js 9 (moteur complet : glTF, animations, ombres en cascades, post-traitement, WebGPU possible), en
  TypeScript strict, construit par Vite. Écarté : Three.js (plus de briques à assembler soi-même), garder Godot (mêmes limites).
- **Implique** : le client Godot n'est pas porté ligne à ligne : la logique l'est (`core/`), les scènes sont réécrites. Les
  modèles glTF, sons, polices et icônes sont repris. Versions figées dans `package.json` ; une montée de version se fait seule,
  dans son propre commit, avec les tests et les captures.

## D3 : Interface en HTML (7 novembre 2026)

- **Contexte** : dans la v1, l'interface dans Godot a coûté des milliers de lignes et ses pièges (`Label`, défilement au doigt,
  focus, échelle, polices).
- **Choix** : React par-dessus le canevas ; Babylon.js ne dessine aucune interface (pas de Babylon GUI).
- **Implique** : accessibilité et aménagements en CSS ; formules en KaTeX ; tests de l'interface par le DOM.

## D4 : Une île ouverte en troisième personne (7 novembre 2026)

- **Contexte** : salles vues d'en haut et carte en hexagones donnaient un monde en morceaux, et des jeux qui se ressemblaient.
- **Choix** : une île continue, caméra derrière le héros ; les lieux de quête sont des intérieurs chargés à part. Écartés :
  régions séparées (moins de continuité) et première personne (héros invisible, mal des transports, dyspraxie).
- **Implique** : un relief, une caméra et des règles de déplacement robustes ; des repères pour ne jamais se perdre (nom de la
  région, invite « E : … », seuils lumineux).

## D5 : Low-poly enrichi (7 novembre 2026)

- **Choix** : on garde KayKit et Quaternius (CC0) ; l'immersion vient de la lumière, du ciel, du brouillard et du sol en
  facettes. Écartés : rendu « peint » (shaders et assets à créer), semi-réaliste (lourd, personnages KayKit qui détonnent).
- **Implique** : tout nouvel asset reste dans ce style et s'inscrit dans `client/public/ressources/LICENSES.md`.

## D6 : Même API, même base (7 novembre 2026)

- **Choix** : l'API de la v1 est reprise ; la v2 lit la même progression pédagogique, la même banque et les mêmes comptes. La
  partie de jeu a son emplacement (`slot = 'v2'`, migration 0013), indépendant de celle de la v1.
- **Implique** : la v1 et la v2 peuvent tourner ensemble sur la même base pendant la transition ; aucune migration ne doit
  casser la v1 tant qu'elle est en service.

## D7 : Le contenu du monde en JSON (7 novembre 2026)

- **Contexte** : les donjons de la v1 étaient du GDScript (1 700 lignes) que l'API lisait par expressions régulières.
- **Choix** : `content/monde/*.json`, exportés une fois de la v1, puis modifiés à la main.
- **Implique** : le client importe ces fichiers ; l'API vérifie les chapitres et les énigmes ; les tests du client vérifient la
  pose dans l'île.

## D8 : Pas de moteur physique pour marcher (7 novembre 2026)

- **Choix** : relief échantillonné (`HeightGrid`), règles d'eau et de pente, cercles d'obstacles, le tout en TypeScript pur.
- **Raison** : prévisible, testable sans navigateur, rien à charger (Havok est un module WASM de plus).
- **Implique** : un jeu qui a besoin de physique (blocs à pousser du Sphinx, objets à lancer) pourra ajouter Havok pour lui seul.

## D9 : WebGL 2 par défaut, WebGPU prêt et optionnel (7 novembre 2026, complétée le 14 novembre 2026)

- **Choix** : moteur WebGL 2 par défaut. WebGPU est prêt derrière `?moteur=webgpu`, avec repli automatique sur WebGL 2 s'il
  manque ou s'il échoue à l'initialisation. `?moteur=webgl2` force l'autre sens.
- **Fait (étape 0.4)** :
  - glslang et twgsl (traduction de shaders GLSL en WGSL) sont copiés de `@babylonjs/core` vers `/ressources/babylon/` au build
    et par `npm run dev` (`vite.config.ts`) ; `Tools.ScriptBaseUrl` y pointe ; nginx sert `.wasm` en `application/wasm`. Aucun
    CDN : la CSP n'a pas changé.
  - Vérifié dans Chromium 153 (WebGPU sur Vulkan logiciel), sous la CSP de production : l'île se charge, le héros avance, et
    aux trois profils (`bas`, `moyen`, `haut`, bloom, occlusion ambiante et halo compris) **aucun de ces outils n'est téléchargé**,
    tous les shaders de l'île ayant leur version WGSL. Ils ne viennent que si un shader GLSL sans équivalent apparaît (2,6 Mo,
    0,9 Mo compressés) ; testé : ils se chargent depuis le site et traduisent un shader.
  - Banc de mesure `?mesure` (`core/perf.ts`) et parcours `npm run e2e:webgpu`.
- **Pas décidé** : le moteur par défaut. Il se choisira d'après `?mesure` dans les deux moteurs, aux trois profils, sur le PC
  familial et celui de Tom (étape 0.5). Le conteneur de développement n'a pas de carte graphique : ses relevés (2 à 50 images,
  rendu logiciel) ne comparent rien. Hypothèse à vérifier : à environ 300 appels de dessin, WebGPU gagnera peu ; il pèsera
  davantage avec l'herbe, l'eau animée et les nuages de la phase 3.
- **Avant de passer WebGPU par défaut** : (1) au profil `haut`, au moins aussi fluide que WebGL 2 (images par seconde, saccades,
  chargement), sur les deux PC. (2) Une garde après l'initialisation : dans le conteneur, sans les options Vulkan logicielles,
  l'appareil WebGPU a été créé puis perdu, restauré, reperdu, et le moteur s'est arrêté sur une erreur fatale. Le repli actuel ne
  couvre qu'un échec de `initAsync` : sur une perte fatale de l'appareil, il faudra recharger en `?moteur=webgl2` ou mémoriser le
  choix sur le poste.
- **Raison** : WebGL 2 fonctionne partout (Firefox compris) et le jeu y est mesuré ; WebGPU n'apporte rien de visible aujourd'hui.

## D10 : CSP stricte, vérifiée par les tests (7 novembre 2026)

- **Choix** : la même CSP en production (nginx) et en prévisualisation (`vite preview`) ; le parcours navigateur échoue sur
  toute violation.
- **Implique** : aucun style ni fichier en ligne, aucun CDN ; deux problèmes déjà attrapés (polices KaTeX en `data:`, écran de
  chargement de Babylon.js).

## D11 : une seule API et une seule base en production dès la phase 0 (7 novembre 2026)

- **Contexte** : le TRD prévoyait une v2 à part (projet `aldoria2`) sur une copie de la base. Les réponses données dans la v2
  n'auraient pas compté dans le vrai suivi des enfants, il y aurait eu deux API à faire évoluer, et deux piles sur un VPS à deux
  cœurs.
- **Choix** (option B, Eric) : l'API construite depuis `v2/api` remplace celle de la v1 en production ; les deux jeux
  (`aldoria.*` et `aldoria2.*`) parlent à la même API et à la même base. Écarté : la pile à part (option A).
- **Implique** : `api/` à la racine est gelé ; `v2/api` garde tous les tests de la v1, qui décrivent ce que le jeu v1 attend ;
  le parcours navigateur de la v1 tourne contre `v2/api` ; toute migration est sauvegardée avant d'être appliquée (job `deploy`
  de `v2.yml`) et ne doit jamais casser la v1. Remplace la partie « déploiement séparé » de D6 et du TRD.

## D12 : l'intérieur d'un lieu : combat au contact, salles de plain-pied (14 novembre 2026, provisoire)

- **Contexte** : le PRD §10 laisse ouvert « rencontres visibles qui approchent, ou combat déclenché au contact » ; la v1 faisait
  monter l'enfant d'étage en étage par des escaliers (souhait des enfants).
- **Choix provisoire** : le combat se déclenche **au contact** (le héros s'approche d'un ennemi endormi, à 3,6 m, `AGGRO_DISTANCE`
  dans `game/interior/InteriorWorld.ts`) et les six salles sont **de plain-pied**, côté sud ouvert comme dans la v1 (la caméra
  reste de ce côté). Un seul réglage à changer pour essayer l'autre approche.
- **Reste à faire** : trancher avec Jules et Tom à la séance de la phase 1 (question 2 de la liste du plan) ; remettre les étages
  qui montent (escalier KayKit, `height_at` de la v1) si les enfants le réclament : le contrôleur du lieu ne change pas, seule la
  scène (`Floor.heightAt`) change.
- **Implique** : tout le déroulé (salles, combats, énigme, Effaceur, coffre, reprise) vit dans `core/quest/` derrière deux
  interfaces (`QuestStage`, `QuestUi`) et se teste sans navigateur ; la scène 3D et React ne font que jouer et afficher.

## D13 : les répliques enregistrées de la v1 servent telles quelles, même celles qui parlent d'une « carte » (14 novembre 2026)

- **Contexte** : les 83 enregistrements ElevenLabs de la v1 (voix de Maître Ysaline et du narrateur) sont meilleurs que Piper. Les
  30 phrases de « page rapportée » (`page-<lieu>`) finissent par « le chemin vers … s'éclaire sur la carte », or la v2 n'a plus
  de carte du royaume mais une île.
- **Choix** : on les joue quand même (c'est la qualité de voix qu'Eric a demandée), le texte affiché étant **identique** au son
  (sinon l'empreinte ne correspond plus et Piper reprend la main).
- **À réenregistrer** : ces 30 phrases, avec « s'éclaire sur l'île » (ou le seuil qui brille), puis `python tools/voix_elevenlabs.py`
  (clé ElevenLabs). Idem les répliques de Maître Ysaline propres à la v2 (accueil dans l'île) et les répliques d'entrée et de
  défaite des Effaceurs (`boss_intro`, `boss_defeat`, sans enregistrement : Piper).

