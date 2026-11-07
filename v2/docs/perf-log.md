# Journal des performances (v2)

Budgets : `docs/TRD.md` §8 (PC : 60 images par seconde au profil `haut`, île jouable en moins de 15 s, moins de 25 Mo
téléchargés, moins de 400 appels de dessin, moins de 2 millions de triangles visibles).

## Protocole

1. Ouvrir le jeu avec `?decouverte&perf&qualite=haut` (puis `moyen`, `bas`) dans Chrome ou Edge, en plein écran.
2. Attendre 20 s sans toucher la souris au point de départ, puis 20 s en courant vers les Cimes Fractales.
3. Noter le compteur en bas à droite (images par seconde, appels de dessin, triangles) et, dans les outils de développement
   (onglet Réseau, cache désactivé), le poids téléchargé et le temps jusqu'à l'île prête.
4. Recharger pour mesurer le chargement en cache.

## Mesures

| Date | Appareil | Navigateur | Profil | Images/s | Appels | Triangles | Téléchargé | Île prête | Remarques |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-07 | conteneur de développement, sans carte graphique (SwiftShader) | Chromium 1243 sans tête | bas | 14 | 172 | 0,32 M | 11,9 Mo | 1,5 s (serveur local) | images/s sans valeur hors carte graphique ; sert à suivre appels et triangles |
| 2026-11-07 | idem | idem | moyen | 4 | 218 | 0,85 M | idem | idem | |
| 2026-11-07 | idem | idem | haut | 3 | 290 | 1,44 M | idem | idem | végétation réduite à 60 % : à 100 %, 2,59 M triangles |
| à faire | PC familial | Chrome / Edge | haut, moyen, bas | | | | | | étape 0.5 du plan |

**Poids du build** (7 novembre) : Babylon.js 8,2 Mo (1,8 Mo compressé, chargé seulement à l'entrée dans l'île), interface 0,35 Mo
(0,1 Mo compressé), KaTeX 0,26 Mo et ses polices. Modèles 3D téléchargés pour l'île : 9,8 Mo, dont 3,7 Mo pour le chevalier
(héros) et 3,6 Mo pour la mage (Maître Ysaline) : chacun porte les 76 animations KayKit. Piste : un seul fichier d'animations
partagé, comme `ANIMATION_DONORS` dans la v1.
