# Journal des performances (v2)

Budgets : `docs/TRD.md` §8 (PC : 60 images par seconde au profil `haut`, île jouable en moins de 15 s, moins de 25 Mo
téléchargés, moins de 400 appels de dessin, moins de 2 millions de triangles visibles).

## Protocole

Le jeu mesure lui-même (`?mesure`). Il fait faire au héros un tour fixe de l'île (le départ, le village, puis chaque région, vue
depuis un peu avant son cœur), avec un tour complet de caméra à chaque arrêt, et relève la durée de chaque image, le temps du
processeur (`scene.render`) et celui de la carte graphique quand le navigateur le permet.

1. Ouvrir `https://aldoria2.bandtrack.fr/?decouverte&mesure&qualite=haut&moteur=webgl2` dans Chrome ou Edge, en plein écran,
   sans autre onglet ni programme gourmand. Ne toucher ni la souris ni le clavier pendant les 40 secondes du tour
   (`&mesure=60` pour un tour plus long).
2. Le panneau final donne les résultats et **une ligne prête à copier** (« Copier la ligne ») pour le tableau ci-dessous. Si
   le panneau dit « moins de 60 images relevées », **ne pas recopier** : le rendu est trop lent pour conclure.
3. « Mesurer en WebGPU » refait la même mesure avec l'autre moteur. Toujours mesurer **les deux moteurs, les trois profils**
   (`haut`, `moyen`, `bas`), **deux fois** (la première chauffe le cache et compile les shaders).
4. Noter à la main ce que le navigateur masque : le nom exact de la carte graphique (Gestionnaire des tâches, onglet
   Performances ; le panneau n'en donne souvent que le fabricant en WebGPU) et, sous le tableau, le poids téléchargé et le temps de
   chargement à froid (outils de développement, onglet Réseau, cache désactivé).

Le conteneur de développement n'a pas de carte graphique (rendu logiciel SwiftShader) : ses chiffres servent à suivre les appels
de dessin et les triangles, jamais à comparer deux moteurs ni à juger la fluidité.

## Banc de mesure (`?mesure`)

Une ligne par moteur, profil et passage, telle que le panneau la donne. Les temps de la carte graphique sont « n. d. » quand le
navigateur ne les fournit pas.

| Date | Carte | Navigateur | Moteur | Profil | Rendu | Images/s | 95e centile | Saccades | Processeur | Carte graphique | Appels | Triangles | Île prête | Mémoire JS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| à faire | PC familial | Chrome / Edge | WebGL 2 et WebGPU | haut, moyen, bas | | | | | | | | | | étape 0.5 du plan |

## Relevés à la main du 7 novembre (avant le banc)

| Date | Appareil | Navigateur | Profil | Images/s | Appels | Triangles | Téléchargé | Île prête | Remarques |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-07 | conteneur de développement, sans carte graphique (SwiftShader) | Chromium 1243 sans tête | bas | 14 | 172 | 0,32 M | 11,9 Mo | 1,5 s (serveur local) | images/s sans valeur hors carte graphique ; sert à suivre appels et triangles |
| 2026-11-07 | idem | idem | moyen | 4 | 218 | 0,85 M | idem | idem | |
| 2026-11-07 | idem | idem | haut | 3 | 290 | 1,44 M | idem | idem | végétation réduite à 60 % : à 100 %, 2,59 M triangles |

**Poids du build** (7 novembre) : Babylon.js 8,2 Mo (1,8 Mo compressé, chargé seulement à l'entrée dans l'île), interface 0,35 Mo
(0,1 Mo compressé), KaTeX 0,26 Mo et ses polices. Modèles 3D téléchargés pour l'île : 9,8 Mo, dont 3,7 Mo pour le chevalier
(héros) et 3,6 Mo pour la mage (Maître Ysaline) : chacun porte les 76 animations KayKit. Piste : un seul fichier d'animations
partagé, comme `ANIMATION_DONORS` dans la v1.
