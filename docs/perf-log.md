# Journal des performances

Budgets (TRD §2.2) : PC 60 fps, tablette 30 fps minimum ; premier chargement < 10 s (PC) et < 15 s (tablette) ; < 25 Mo compressés ; appels de dessin < 150 (PC) et < 100 (tablette) ; triangles < 150 000 (PC) et < 60 000 (tablette) ; mémoire < 600 Mo (PC) et < 400 Mo (tablette).

## Protocole de mesure (scène d'étalonnage)

1. Ouvrir `https://aldoria.bandtrack.fr/?perf&quality=haut` (puis `tablette`, puis `bas`) dans Chrome. Options de diagnostic : `scale=0.5`, `shadows=0`, `lights=fake|real|0`, `vertex=0|1`, `particles=0`, `chars=0`, `merge=0`.
2. Attendre 20 s sans toucher l'écran : l'overlay affiche la moyenne et le « 1 % bas » sur 10 s.
3. Noter les valeurs de l'overlay dans le tableau ci-dessous.
4. Recharger la page pour mesurer le chargement « en cache » (ligne « Démarrage (navigateur) »).
5. Optionnel sur tablette : brancher en USB, ouvrir `chrome://inspect` sur le PC, filtrer la console sur `[Aldoria/perf]`.

## Mesures

| Date | Appareil | Navigateur | Qualité | Fusion | FPS moy. | 1 % bas | Appels | Triangles | Mém. vidéo | Chargement 1er / cache | Remarques |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-10 | PC dev (Intel Arc 140T), natif | — | haut | non | — | — | 171 | 75 220 | 141 Mo | — | Avant fusion de la géométrie statique |
| 2026-10-10 | PC dev (Intel Arc 140T), natif | — | haut | oui | — | — | 59 | 75 218 | 48 Mo | — | Ombres : la passe d'ombre double les triangles |
| 2026-10-10 | PC dev (Intel Arc 140T), natif | — | bas | oui | — | — | 33 | 37 669 | 36 Mo | — | Sans ombres |
| 2026-10-10 | PC dev, build web local (nginx + CSP) | Edge headless | haut | oui | 58,0 | 60,0 | 59 | 75 242 | 50 Mo | 2,7 s (localhost) | Aucune erreur console ni violation CSP |
| 2026-10-10 | PC dev, build web local (nginx + CSP) | Edge headless | bas | oui | 57,9 | 60,0 | 33 | 37 695 | 40 Mo | 2,6 s (localhost) | |
| 2026-10-10 | PC dev, production aldoria.bandtrack.fr | Edge headless | haut | oui | 58,0 | 60,0 | 59 | 75 218 | 50 Mo | 3,6 s (profil vierge) | Via Internet, Traefik + Let's Encrypt |

**Poids de l'export web** (2026-10-10, template officiel) : `index.wasm` 39,5 Mo → 10,1 Mo gzip ; `index.pck` 4,5 Mo → 4,4 Mo ; total **14,5 Mo compressés** (budget 25 Mo).

**Poids de l'export web, phase 3** (2026-10-11, six donjons) : avec deux squelettes de plus (mage, voleur), le
`index.pck` atteignait 13,4 Mo (**23,3 Mo compressés** au total, budget 25 Mo). Chaque personnage KayKit embarquait
sa propre copie des animations (1,3 à 1,8 Mo, presque incompressible). Tous partagent le même squelette :
seuls le Guerrier squelette et le Chevalier importent maintenant leurs animations, les autres modèles les
empruntent (`Fighter.ANIMATION_DONORS`). Résultat : `index.pck` **7,3 Mo**, total **≈ 17,3 Mo compressés**,
et 20 Mo de mémoire statique en moins en jeu.

**Donjons de la phase 3, profil `tablette`** (PC dev, salle 2 de chaque donjon, 2026-10-11) : la Tour des
Fractions (référence de la phase 2) est à 72 appels de dessin et 66 600 triangles ; Atelier des Balances 74 et
75 900 (parquet, table garnie) ; Observatoire des Angles 72 et 59 400 ; Forge de l'Algèbre 71 et 70 200 ;
Citadelle des Fonctions 71 et 57 500. Les pièces les plus lourdes (pile de boîtes à 2 200 triangles, murs à
étagères dans l'Atelier) ont été écartées. **À vérifier sur la tablette** (`?perf`) : la limite observée vient des
lumières, pas des triangles, mais l'Atelier dépasse la cible de 60 000.

## Tablette (Android 10, Chrome 138) — 2026-10-10

Mesures d'Eric, FPS moyen sur 10 s, scène d'étalonnage. Le navigateur se cale sur la synchronisation écran : une image de plus de 16,7 ms fait tomber à 30 fps, d'où le plafond observé.

| Réglage | FPS |
| --- | --- |
| haut (ombres 2048, MSAA 2x, 2 OmniLight3D) | 9 |
| moyen (ombres 1024, résolution 85 %) | 14 |
| bas (sans ombres, résolution 75 %) | 19 |
| bas + résolution 50 % | 26 |
| bas + résolution 35 % | 30 |
| bas + **sans lumières de torche** | 28 |
| bas + sans particules | 19 |
| bas + sans personnages | 19 |
| A : bas + fausses lumières + résolution 50 % | 30 |
| B : A + éclairage par sommet | 29 |
| C : bas + fausses lumières + éclairage par sommet + résolution 65 % | 29 |
| **D : bas + fausses lumières + éclairage par sommet, pleine résolution** | **30** |
| E : moyen (ombres) + fausses lumières + éclairage par sommet + résolution 65 % | 23 |

**Diagnostic** : la carte graphique sature, pas le moteur (le plan B Babylon.js, qui utilise le même WebGL 2, n'apporterait rien). Avec le renderer Compatibility, chaque `OmniLight3D` redessine tous les objets qu'elle touche ; la salle fusionnée étant un seul objet, chaque torche refait peindre toute la salle. Les ombres temps réel sont aussi hors budget.

**Décision** (2026-10-10, choix visuel d'Eric entre C et D) : profil `tablette` = réglage D, plus une résolution dynamique qui descend jusqu'à 65 % (réglage C) si une scène passe sous 27 fps. Godot 4 est confirmé, le plan B n'est pas déclenché.

**Règles qui en découlent pour tout le jeu** :
- pas d'`OmniLight3D`/`SpotLight3D` hors profil `haut` : fausses lumières via `MobileLighting.make_fake_light` ;
- éclairage par sommet sur tablette (`MobileLighting.apply_vertex_shading`) ;
- pas d'ombres temps réel sur tablette (ombres « peintes » ou blobs sous les personnages si besoin) ;
- particules et personnages animés : coût négligeable à ce niveau, pas de contrainte particulière.
