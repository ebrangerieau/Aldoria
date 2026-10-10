# Journal des performances

Budgets (TRD §2.2) : PC 60 fps, tablette 30 fps minimum ; premier chargement < 10 s (PC) et < 15 s (tablette) ; < 25 Mo compressés ; appels de dessin < 150 (PC) et < 100 (tablette) ; triangles < 150 000 (PC) et < 60 000 (tablette) ; mémoire < 600 Mo (PC) et < 400 Mo (tablette).

## Protocole de mesure (scène d'étalonnage)

1. Ouvrir `https://aldoria.bandtrack.fr/?quality=haut` (puis `moyen`, puis `bas`) dans Chrome.
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
