# Bilan du prototype (v1) et leçons pour la v2

7 novembre 2026. Sources : le code de la v1 (dossiers `game/`, `api/`, `admin/` à la racine du dépôt), `IMPLEMENTATION_PLAN.md`,
`docs/perf-log.md`, `docs/journal-tests.md`, `CLAUDE.md` de la v1, et ce qu'on a appris en construisant la base de la v2.

## 1. La v1 en chiffres (du 10 au 21 octobre 2026)

| Élément | Valeur |
| --- | --- |
| Joueurs et classes | Jules (6e) et Tom (2nde), deux mondes d'ambiance (lumineux, Brouillard) |
| Matières jouables | 6 en 6e (maths, français, anglais, histoire-géographie, sciences, EMC), 10 en 2nde (maths, français, anglais, espagnol, histoire-géographie, physique-chimie, SVT, SES, SNT, EMC) |
| Lieux de quête (donjons) | 30 : 12 en 6e, 18 en 2nde, chacun avec ses textes d'histoire (seuil, Effaceur, page) |
| Code | 22 000 lignes de GDScript (jeu), 29 000 lignes de Python (API, dont 23 000 de générateurs de questions), 5 300 lignes de TypeScript (espace parent) |
| Tests | 1 875 tests de l'API, 191 tests du jeu (GUT), un parcours navigateur rejoué par la CI avant chaque mise en ligne |
| Export web | 21,8 Mo compressés (budget 25 Mo), dont 10 Mo pour le moteur Godot seul |
| Voix | voix neuronale Piper sur le serveur (fr, en, es) et 84 répliques enregistrées (ElevenLabs) |

## 2. Ce qui a marché, et que la v2 garde tel quel

1. **Le moteur pédagogique côté serveur.** Générateurs déterministes (même graine, même question), réponses recalculées sur
   1 000 tirages par difficulté, Leitner et maîtrise, paquets de session préchargés, file des réponses hors connexion avec UUID
   et idempotence. C'est le cœur du projet et il n'a pas de défaut connu : l'API est reprise entière (`v2/api/`).
2. **Le gameplay ne connaît jamais le contenu d'une question.** Une scène demande un item pour un rôle et reçoit un verdict
   (`QuestionService`). Ajouter une matière n'a jamais demandé de toucher au jeu. Repris à l'identique en TypeScript.
3. **Les vecteurs de réponses partagés.** `content/test-vectors/answers.json` est rejoué par l'API et par le jeu : le verdict
   du client et celui du serveur ne peuvent pas diverger. Les 81 cas passent dans le client v2 (Vitest).
4. **L'espace parent, les familles et la sécurité.** Comptes adultes, appareils reliés, clé posée par Traefik, CSP stricte,
   sauvegardes quotidiennes et copie à la maison, effacement d'un enfant. Tout est repris (`v2/admin/`, `v2/deploy/`).
5. **L'accessibilité « dys » dès le départ.** Aménagements réglés par le parent, texte « speech » préparé par le serveur pour
   la lecture à voix haute, aucune pénalité de lenteur possible. Repris, et plus simple à appliquer en HTML.
6. **La boucle courte avec les enfants.** Le 13 octobre, les six souhaits de Jules et Tom (boss moins dur, récompenses, monter
   dans les donjons, carte du monde, héros qui parle, monstres variés) ont été faits dans la journée. C'est la meilleure
   habitude du projet.
7. **Une histoire commune** (`docs/histoire.md` : Malvrek, les Effaceurs, Maître Ysaline, la Grande Chronique) qui donne un
   sens à chaque lieu. Reprise sans changement de fond.
8. **Les contenus.** Programmes officiels vérifiés et sourcés (`content/seed/`), exemples relus, citations exactes : c'est
   le travail le plus long à refaire, et il n'est pas à refaire.

## 3. Ce qui a coûté cher : les erreurs à ne pas refaire

| # | Ce qui s'est passé dans la v1 | Ce que la v2 fait autrement |
| --- | --- | --- |
| 1 | **La tablette a dicté tout le rendu.** À 9 fps au réglage haut, il a fallu des fausses lumières, de l'éclairage par sommet, aucune ombre, 100 appels de dessin au plus, puis un profil téléphone (carte invisible sur un Galaxy A52s, écran « Tourne ton téléphone »). | PC et navigateur seulement. Trois profils de rendu (`haut`, `moyen`, `bas`) qui ne diffèrent que par des réglages, jamais par du code à part. |
| 2 | **Un moteur web bridé.** Godot exporte pour le web en WebGL 2 « Compatibility » : pas de halo HDR (il blanchissait le sol), pas d'occlusion ambiante, 40 Mo de WASM, une décompression gzip faite deux fois, pas de polices système. | Babylon.js : un moteur conçu pour le navigateur (ombres en cascades, HDR, halo, occlusion ambiante, WebGPU possible). Le moteur pèse 1,8 Mo compressé. |
| 3 | **Une interface refaite à la main.** `UiKit`, défilement au doigt (`TouchScroll`), pièges des `Label` dans les rangées, focus, facteur d'échelle, textures en double résolution, clavier d'accents à l'écran : des milliers de lignes pour ce que le navigateur sait faire. | L'interface est en HTML et CSS (React) par-dessus le canevas 3D : polices, tailles, espacement, défilement, saisie, formules KaTeX et lecteur d'écran sont natifs. Les aménagements dys sont des attributs CSS. |
| 4 | **Des erreurs silencieuses.** Un `Variant` mal typé faisait ignorer un fichier de tests GUT entier sans échec ; un nombre JSON devenait « 2.0 » ; un `await` oublié laissait passer la suite. Il a fallu `tools/gut.sh` pour détecter les tests qui n'avaient pas tourné. | TypeScript strict (`noUncheckedIndexedAccess`) : ces erreurs bloquent la compilation. Vitest échoue si un fichier ne se charge pas. |
| 5 | **Des tests du jeu lents et indirects.** Godot sans tête, captures pilotées par une quinzaine d'options (`--goto`, `--seuil`, `--room`, `--approach`…), parcours navigateur qui cliquait sur un canevas sans DOM. | La logique vit dans `client/src/core/`, sans moteur : relief, déplacement, choix des questions, file des réponses et sauvegarde se testent en millisecondes. L'interface a un vrai DOM ; un seul crochet de test (`?e2e`, `window.__aldoria`). |
| 6 | **Les données du jeu écrites en code.** `DungeonDef.gd` (1 700 lignes), `VillageDef`, `WorldMapDef`, `HeroVoice` : l'API devait lire du GDScript avec des expressions régulières pour vérifier les donjons. | Données en JSON dans `content/monde/` (exportées une fois de la v1 par `tools/export_v1_content.py`), lues par le client et vérifiées par les tests de l'API. |
| 7 | **Un monde en morceaux.** Salles de 16 m vues de haut, carte en hexagones, une scène par activité : « les jeux se ressemblaient (une question dans un panneau) » (plan, 15 octobre). | Une île continue en troisième personne. Les questions sont des objets du monde (pierres de savoir, seuils, habitants) ; les mécaniques (balance, tir, pont) deviendront des lieux. |
| 8 | **La largeur avant la validation.** Treize programmes ajoutés en cinq jours (du 15 au 19 octobre), alors que la séance de test prévue après le 15 octobre n'a pas eu lieu : beaucoup de contenu jamais essayé par les enfants. | Phases courtes, une séance observée par phase, un critère de passage écrit avant de commencer (`IMPLEMENTATION_PLAN.md`). |
| 9 | **Un `CLAUDE.md` de 310 lignes** qui mêlait commandes, conventions, pièges et description de chaque fonction. | Un `CLAUDE.md` court (commandes et règles). Le pourquoi va dans `docs/decisions.md`, le comment dans `docs/TRD.md`. |
| 10 | **Le poids des personnages.** Chaque personnage KayKit embarquait ses 76 animations (1,3 à 1,8 Mo) ; il a fallu les partager entre modèles (`ANIMATION_DONORS`). | Sur PC le poids compte moins, mais la règle reste : un modèle se charge une fois et se copie (`client/src/game/assets.ts`). À surveiller dans `docs/perf-log.md`. |
| 11 | **Des tests qui salissaient les données.** Un test qui enregistrait des réponses devait réécrire la file locale, sinon de fausses réponses partaient vers l'API au lancement suivant. | Le stockage est injectable (`MemoryStore` dans les tests) et le mode découverte n'enregistre jamais rien. |

## 4. Ce qui est repris dans `v2/`

| Brique v1 | Dans la v2 | État |
| --- | --- | --- |
| API FastAPI, moteur pédagogique, générateurs, comptes, familles | `v2/api/` (copie) | 1 876 tests verts ; ajouts : emplacement de sauvegarde `v2` (migration 0013), mode de session `monde` |
| Espace parent React | `v2/admin/` (copie) | build vert ; libellé « Exploration » pour le mode `monde` |
| Programmes, schémas, vecteurs de test | `v2/content/` (copie) | inchangés |
| Données des donjons, régions, villages, phrases du héros | `v2/content/monde/*.json` | exportées par `v2/tools/export_v1_content.py` |
| Voix Piper, voix enregistrées, musique | `v2/voice/`, `v2/deploy/voix/`, `v2/deploy/musique/` | copiés ; voix enregistrées pas encore lues par le client |
| Déploiement (Traefik, nginx, sauvegardes) | `v2/deploy/` et le Compose de la racine | nginx pour le build Vite, CSP sans `unsafe-inline` ; en production, le jeu v2 à côté du jeu v1, même API et même base (D11) |
| Modèles 3D (KayKit, Quaternius), polices, sons, icônes | `v2/client/public/ressources/` | copiés (fichiers `.import` de Godot retirés) |
| Validation des réponses, analyse des expressions | `client/src/core/answers.ts`, `mathExpr.ts` | portés ligne à ligne, mêmes 81 vecteurs |
| Choix des questions, file hors connexion, sauvegarde | `client/src/core/questionService.ts`, `session.ts`, `save.ts` | portés, testés |
| Panneau de question | `client/src/ui/QuestionPanel.tsx` | QCM, nombre, expression, texte, ordre, vrai/faux ; indice, « Écouter », « Pas vu en classe » |
| Outils | `v2/tools/` | voix ElevenLabs, sons, niveaux du Sphinx, restauration, copie à la maison, paquets de test |

## 5. Ce qui reste à reprendre de la v1

Ces fonctions existent et marchent dans la v1 ; la v2 les reprendra une à une, dans l'ordre du plan :

- combat au tour par tour (`Encounter`), boss Effaceurs et leurs sceaux, coffre et page rendue ;
- intérieur des lieux de quête (salles, escaliers, énigmes) ;
- énigmes 3D : balance géante, stand de tir (rapporteur, droite), pont des fractions ;
- île du Sphinx et ses 180 niveaux de blocs (générés par `tools/make_sphinx_levels.py`, sortie à passer en JSON) ;
- village et quêtes des habitants, défi du jour (Pierre du Jour), Lice ;
- apparence du héros (`Wardrobe` : silhouettes, armes, capes et déblocages), sac d'objets ;
- prologue en cinq tableaux, voix enregistrées de Maître Ysaline, musique ;
- Archives (étoiles par notion), bestiaire, héros qui parle entre deux lieux ;
- widgets « vecteur », « droite graduée », « tableau de signes » et illustrations (courbe, carte, tableau, robot, balance) ;
- erreurs du jeu remontées à l'exploitant (`ErrorReport`).

## 6. Ce que la construction de la base v2 a déjà appris

- **Le renard de Jules** (Quaternius) s'affiche mal dans Babylon.js : ses pattes, oreilles et yeux s'étirent en pointes, alors que
  les poids de ses os sont corrects. Désactivé par défaut (`?renard=1` pour le voir) ; à réexporter ou à remplacer en phase 1.
- **La CSP stricte attrape de vrais problèmes** : Vite intégrait les petites polices de KaTeX en `data:` et l'écran de
  chargement de Babylon.js injectait une feuille de style. Les deux sont corrigés, et les tests dans le navigateur tournent
  avec la CSP de production.
- **Caméra de Babylon.js** : réaffecter `camera.target` à chaque image recalcule ses angles et annule la souris ; on modifie la
  cible en place.
- **Poids** : l'import global de Babylon.js pèse 8,2 Mo (1,8 Mo compressé). Les imports ciblés pourront le réduire si le
  premier chargement dépasse le budget du TRD.
- **WebGPU** demande de servir soi-même les outils de traduction des shaders (pas de CDN avec notre CSP) : WebGL 2 par défaut,
  WebGPU à évaluer en phase 0 (`?moteur=webgpu`).
