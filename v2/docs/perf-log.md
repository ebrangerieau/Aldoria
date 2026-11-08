# Journal des performances (v2)

Budgets : `docs/TRD.md` §8 (PC : 60 images par seconde au profil `haut`, île jouable en moins de 15 s, moins de 25 Mo
téléchargés, moins de 400 appels de dessin, moins de 2 millions de triangles visibles).

## Protocole

1. Ouvrir le jeu avec `?decouverte&perf&qualite=haut` (puis `moyen`, `bas`) dans Chrome ou Edge, en plein écran.
2. Attendre 20 s sans toucher la souris au point de départ, puis 20 s en courant vers les Cimes Fractales.
3. Noter le compteur en bas à droite (images par seconde, appels de dessin, triangles) et, dans les outils de développement
   (onglet Réseau, cache désactivé), le poids téléchargé et le temps jusqu'à l'île prête.
4. Recharger pour mesurer le chargement en cache.
5. Refaire 1 à 3 avec `&moteur=webgpu` (le compteur indique le moteur actif).

Sur un poste qui a le dépôt : `npm --prefix client run perf` mesure tout cela seul (moteurs, profils, deux vues ; voir
l'en-tête de `client/e2e/perf.mjs`), avec `PERF_SYNCHRO=1` pour la synchronisation normale.

## Mesures

| Date | Appareil | Navigateur | Profil | Images/s | Appels | Triangles | Téléchargé | Île prête | Remarques |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-07 | conteneur de développement, sans carte graphique (SwiftShader) | Chromium 1243 sans tête | bas | 14 | 172 | 0,32 M | 11,9 Mo | 1,5 s (serveur local) | images/s sans valeur hors carte graphique ; sert à suivre appels et triangles |
| 2026-11-07 | idem | idem | moyen | 4 | 218 | 0,85 M | idem | idem | |
| 2026-11-07 | idem | idem | haut | 3 | 290 | 1,44 M | idem | idem | végétation réduite à 60 % : à 100 %, 2,59 M triangles |
| à faire | PC familial | Chrome / Edge | haut, moyen, bas | | | | | | étape 0.5 du plan ; comparer aussi `&moteur=webgpu` |

## WebGL 2 face à WebGPU (8 novembre, étape 0.4)

Mesuré par `npm --prefix client run perf` (`client/e2e/perf.mjs`, serveur de prévisualisation lancé) : Edge 152 sans fenêtre,
carte graphique du PC de développement d'Eric (puce Intel intégrée, architecture Xe-LPG), 1920 × 1080, mode découverte,
vues « départ » et « panorama », 10 s par vue après 4 s de mise en route. Le compteur `?perf` affiche le moteur actif.

**Sans synchronisation verticale** (ce que la machine peut rendre) :

| Profil | WebGL 2 | WebGPU | Appels | Triangles |
| --- | --- | --- | --- | --- |
| haut | 98 à 99 i/s | 95 à 96 i/s | 319 à 325 | 1,46 M |
| moyen | 178 à 189 i/s | 106 à 138 i/s | 242 à 248 | 0,86 M |
| bas | 566 à 591 i/s | 320 à 340 i/s | 189 à 192 | 0,33 M |

**Synchronisation normale (60 Hz)**, profil `haut`, quatre passages en alternant l'ordre des moteurs :

| Moteur | Images/s | 95 % des images en moins de | Calcul d'une image (processeur) |
| --- | --- | --- | --- |
| WebGL 2 | 55 à 60 | 18 à 28 ms (à-coups dans 3 passages sur 4) | 2,7 ms |
| WebGPU | 60 | 17,5 à 18 ms | 4 ms |

Aux profils `moyen` et `bas`, les deux moteurs tiennent 60 i/s sans à-coups (95 % des images en moins de 17,7 ms).
Île prête en 0,9 à 1,7 s avec les deux (serveur local). Monde Brouillard : mêmes ordres de grandeur, aucune erreur.

**En WebGPU, aucun fichier ne vient du CDN** de Babylon.js : ni glslang ni twgsl ne sont demandés (Babylon.js 9 a une version WGSL
de tous les shaders de l'île), aucune violation de la CSP, aucune erreur, dans les deux mondes. Servir twgsl (1,7 Mo) et glslang
(0,9 Mo) depuis le site n'est donc pas utile tant qu'aucun matériau seulement GLSL n'est ajouté.

Lecture : sur cette machine, WebGL 2 rend plus d'images quand rien ne le limite, mais WebGPU est plus régulier au profil `haut`
à 60 Hz. L'écart est faible et ne vaut que pour ce PC ; décision dans `docs/decisions.md` (D9).

**Poids du build** (7 novembre) : Babylon.js 8,2 Mo (1,8 Mo compressé, chargé seulement à l'entrée dans l'île), interface 0,35 Mo
(0,1 Mo compressé), KaTeX 0,26 Mo et ses polices. Modèles 3D téléchargés pour l'île : 9,8 Mo, dont 3,7 Mo pour le chevalier
(héros) et 3,6 Mo pour la mage (Maître Ysaline) : chacun porte les 76 animations KayKit. Piste : un seul fichier d'animations
partagé, comme `ANIMATION_DONORS` dans la v1.
