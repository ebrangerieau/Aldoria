# Journal des tests avec Jules et Tom (v2)

Chaque phase se termine par une séance observée avec chaque enfant (`IMPLEMENTATION_PLAN.md`). Le journal de la v1
(`docs/journal-tests.md` à la racine) garde les séances et les souhaits d'octobre 2026.

| Date | Phase | Enfant | Durée | Ce qui a plu | Ce qui a bloqué | A demandé à rejouer ? | Décision |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Grille de la première séance (fin de la phase 0)

Environ 20 minutes par enfant, sur le PC familial. **Pendant les deux premières minutes, ne rien expliquer** : on regarde
s'il comprend seul comment bouger et quoi faire.

**Avant les enfants : Eric seul, sur le PC familial (environ 20 minutes)**. Ce sont les étapes 0.1, 0.3, 0.5 et 0.7 du plan.

- [ ] **Relier le PC** : ouvrir `aldoria2.bandtrack.fr`, puis entrer un code créé dans l'espace parent (Famille → Appareils).
  L'appareil est mémorisé pour ce site.
- [ ] **0.1, jouer avec un vrai profil** : se connecter avec le profil d'un enfant, éveiller une ou deux pierres de savoir,
  répondre à quelques questions, puis quitter.
- [ ] **0.1, vérifier dans l'espace parent** : le tableau de bord montre une séance « Exploration » avec ces réponses.
- [ ] **0.7, erreurs du jeu** : regarder Exploitation → Erreurs du jeu. Noter s'il y en a, avec leur version (sept caractères).
- [ ] **0.3, clavier et souris** : ZQSD et les flèches (clavier AZERTY ; QWERTY si un autre clavier est branché), E pour agir,
  souris pour faire tourner la caméra, molette pour s'approcher. Noter tout ce qui gêne.
- [ ] **0.5, mesures** : ajouter `?perf` à l'adresse (puis `&qualite=moyen`, `&qualite=bas`), attendre 20 s au point de départ,
  puis 20 s en courant. Recommencer avec `&moteur=webgpu`. Le compteur en bas à droite affiche les images par seconde et le
  moteur actif. Noter ci-dessous ; un à-coup visible compte autant que le chiffre.

| Profil | Moteur | Images/s au départ | Images/s en courant | À-coups ? | Appels | Triangles |
| --- | --- | --- | --- | --- | --- | --- |
| haut | WebGL 2 | | | | | |
| haut | WebGPU | | | | | |
| moyen | WebGL 2 | | | | | |
| moyen | WebGPU | | | | | |
| bas | WebGL 2 | | | | | |
| bas | WebGPU | | | | | |

Ces notes vont dans `docs/perf-log.md`. Elles décident du profil et du moteur par défaut (D9).

**Avant de commencer avec chaque enfant**
- [ ] Rouvrir `aldoria2.bandtrack.fr` sans `?perf`. Si les mesures l'ont montré, ajouter le meilleur réglage à l'adresse :
  `?qualite=moyen`, et/ou `&moteur=webgpu`. Le réglage par défaut changera ensuite dans le jeu.

| Quoi | Ce qu'on regarde | Noté |
| --- | --- | --- |
| ★ Se déplacer | Trouve-t-il ZQSD ou les flèches seul ? La souris pour regarder ? Le clic sur le sol ? Se sent-il mal (caméra) ? | |
| ★ Se repérer | Lit-il le nom de la région ? Va-t-il vers la Citadelle, les montagnes, la mer ? Se perd-il ? Regarde-t-il la mini-carte (en haut à droite) pour choisir où aller ? La cache-t-il (M) ou la rouvre-t-il ? | |
| ★ Pierres de savoir | Les remarque-t-il ? Comprend-il « E : Toucher la pierre » ? Combien en éveille-t-il ? | |
| Maître Ysaline | Lui parle-t-il ? Écoute-t-il ou lit-il ? | |
| Musique | Joue dès l'entrée dans l'île, se tait pendant une question | Plaît-elle ou gêne-t-elle ? Trouve-t-il seul le bouton « Musique » (en haut à droite) ? Le volume est-il bon sous la voix de Maître Ysaline ? | |
| Seuils des lieux | Approche-t-il d'une tour qui brille ? Entre-t-il (« J'y vais ») ? | |
| Combat | Comprend-il les trois actions (Frappe, Sort, Soin) et qu'une question suit ? Lit-il les barres de PV ? Que dit-il quand l'ennemi tombe, quand la porte s'ouvre, quand il se replie ? Les touches 1, 2, 3 ? Les monstres lui plaisent-ils (tailles, noms) ? | |
| Intérieur d'un lieu | Monte-t-il les étages seul (porte, escalier) ? Trouve-t-il la sortie ? Le mur cache-t-il le héros quand il passe une porte ? Quel étage dit-il être en train de faire ? | |
| Le monde | Que trouve-t-il beau, vide, ennuyeux ? Brouillard (Tom) : assez différent ? | |

**À la fin** : les cinq questions de `IMPLEMENTATION_PLAN.md` (« Questions à poser aux enfants »), puis une ligne par enfant
dans le tableau du haut.
