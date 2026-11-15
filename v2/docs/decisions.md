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

## D9 : WebGL 2 d'abord (7 novembre 2026)

- **Choix** : moteur WebGL 2 par défaut ; WebGPU derrière `?moteur=webgpu` jusqu'à l'étape 0.4 du plan.
- **Raison** : WebGPU demande de servir soi-même twgsl (traduction de shaders) sous notre CSP ; WebGL 2 fonctionne partout.
- **Revu le 8 novembre (étape 0.4)** : twgsl n'est pas nécessaire. Babylon.js 9 a une version WGSL de tous les shaders de
  l'île : en WebGPU, rien n'est demandé au CDN, aucune violation de la CSP. Mesures (`docs/perf-log.md`, PC de développement) :
  au profil `haut` à 60 Hz, WebGPU est plus régulier (60 i/s, 95 % des images sous 18 ms) que WebGL 2 (55 à 60 i/s, à-coups
  jusqu'à 28 ms) ; sans limite, WebGL 2 rend plus d'images ; aux profils `moyen` et `bas`, aucune différence visible.
- **Choix maintenu** : WebGL 2 par défaut, WebGPU par `?moteur=webgpu`. L'écart est faible, mesuré sur un seul PC, et la CI ne
  peut pas tester WebGPU (rendu logiciel) : une panne propre à WebGPU arriverait jusqu'aux enfants sans être vue.
- **À revoir à l'étape 0.5**, sur le PC familial : si WebGL 2 n'y tient pas 60 i/s régulières au profil choisi et que WebGPU le
  fait, passer WebGPU par défaut (retour automatique à WebGL 2 s'il manque), avec un parcours navigateur en WebGPU.
- **Implique** : tout matériau ajouté doit exister en WGSL dans Babylon.js (pas de matériau seulement GLSL, comme ceux de
  `@babylonjs/materials`, sans servir glslang et twgsl depuis le site) ; on le vérifie avec `?moteur=webgpu`.

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

## D12 : jamais deux fois la même question dans un parcours (14 novembre 2026)

- **Contexte** (demande d'Eric) : `QuestionService` recyclait tout le paquet d'un rôle quand il était épuisé. Un enfant qui ne fait que
  frapper vide les 17 à 28 automatismes d'un paquet en vingt coups et revoyait les mêmes questions ; deux tirages d'un générateur
  pouvaient aussi poser le même énoncé sous deux identifiants.
- **Choix** : « la même question » se juge sur le contenu (`questionSignature`), par parcours (de `reset` à `reset`). Un rôle sans
  question inédite emprunte l'autre ; une énigme toute posée rend `null` ; seul un paquet entièrement posé reprend la plus ancienne
  (`repeats` le compte). Le paquet d'un lieu passe de 60 à 100 questions (mesuré : une soixantaine consommées au plus par une enfant en
  difficulté, `lieux.json`), l'API refait les tirages qui retombent sur le même énoncé. Écarté : mémoriser les questions vues d'une
  séance à l'autre côté serveur (le suivi par notion et la révision espacée s'en chargent déjà ; le client préfère seulement l'inédit
  d'un parcours à l'autre de la même séance).
- **Implique** : sous « Frappe », les maths (seule matière avec des automatismes, 28 sur 100) reçoivent des questions du chapitre un
  cran plus faciles une fois les automatismes posés ; les autres matières n'ont jamais eu d'automatismes. Un paquet de lieu pèse
  jusqu'à 237 Ko (maths de 2nde) et se garde sur l'appareil, un par lieu visité.

## D13 : des reliques à ramasser, liées entre elles par deux traits, pour un jeu de logique (14 novembre 2026)

- **Contexte** (demande d'Eric) : des objets récupérables dans le monde, qui auraient un lien entre eux et serviraient un jeu de logique
  ou de réflexion. Les quatre objets du sac servent déjà en combat et en question ; il faut une autre sorte d'objet, à collectionner.
- **Choix** : seize **sceaux** (les reliques de la Grande Chronique), un par couple d'un **élément** (flamme, onde, feuille, étoile) et d'un
  **rang** (I à IV). Le lien entre deux reliques est ce qu'elles partagent : même élément, ou même rang. Huit se ramassent dans l'île
  (une lueur au sol, on s'en approche et on appuie sur E), huit tombent du coffre des premiers lieux terminés. Elles servent à la **Table des
  Reliques** (la Citadelle) : un carré de 4 × 4 où chaque rangée et chaque colonne ne doit répéter ni un élément ni un rang (les « seize
  officiers » d'Euler à l'ordre quatre). Les reliques qu'on possède sont à placer, les autres sont déjà gravées dans la pierre : plus on en a,
  plus la table est ouverte. Toujours soluble par construction (on part d'un carré complet). Un indice coûte un parchemin du sac. Le
  premier carré résolu du jour rapporte de l'XP et un objet du sac ; les suivants sont de l'entraînement.
- **Écartés** : des engrenages (une chaîne d'engrenages ne dépend que du premier et du dernier : les autres ne servent à rien) ; une chaîne de
  dominos (trop proche d'un jeu de hasard) ; lier les reliques à l'île du Sphinx tout de suite (son écran n'est pas encore branché : elle
  pourra recevoir la Table plus tard, la logique est pure).
- **Implique** : la partie garde `relics` (identifiants possédés) et `table` (dernier jour récompensé) ; une relique n'est jamais perdue ni
  gagnée deux fois ; aucune question de leçon dans ce jeu (comme le Sphinx de la v1) mais il s'appuie sur le sac (le parchemin).
