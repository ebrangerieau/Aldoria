# Les Chroniques d'Aldoria, v2

Une île à explorer en 3D, à la troisième personne, dans le navigateur du PC : chaque pierre de savoir, chaque habitant et
chaque lieu de quête repose sur une notion du programme de l'enfant. Projet familial, sans publicité ni collecte de données
hors du foyer.

Cette v2 repart du meilleur du prototype (le moteur pédagogique, l'espace parent, les contenus, l'histoire) avec un autre
monde : une île continue et immersive au lieu de salles vues d'en haut, et un moteur fait pour le navigateur (Babylon.js).

| Document | Pour quoi |
| --- | --- |
| [docs/BILAN-V1.md](docs/BILAN-V1.md) | ce que le prototype a appris : ce qu'on garde, ce qu'on ne refait pas |
| [docs/PRD.md](docs/PRD.md) | la vision et le jeu |
| [docs/TRD.md](docs/TRD.md) | l'architecture |
| [docs/decisions.md](docs/decisions.md) | les décisions et leurs raisons |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | les phases, où on en est, les critères de passage |
| [CLAUDE.md](CLAUDE.md) | commandes et règles de développement |
| [docs/histoire.md](docs/histoire.md) | la bible de l'histoire (reprise de la v1) |
| [docs/exploitation.md](docs/exploitation.md) | comptes, sauvegardes, voix (repris de la v1, plus la v2) |

Démarrage rapide :

```bash
npm --prefix client install
```

```bash
npm --prefix client run dev
```

Puis ouvrir http://localhost:5173/?decouverte pour se promener dans l'île sans compte.

Assets 3D : [KayKit](https://kaylousberg.itch.io/) par Kay Lousberg et [Quaternius](https://quaternius.com) (CC0). Détail
dans [client/public/ressources/LICENSES.md](client/public/ressources/LICENSES.md).
