---
name: captures
description: Prendre des captures d'écran de l'île d'Aldoria v2 (client Babylon.js) et savoir quoi y vérifier. À utiliser pour toute vérification visuelle d'une modification du monde, du rendu ou de l'interface de la v2.
---

# Captures de l'île (v2)

1. Construire et lancer la prévisualisation (même CSP que la production) :
   `npm --prefix v2/client run build`, puis `npm --prefix v2/client run preview` en arrière-plan (port 4173).
2. Vues prêtes à l'emploi : `E2E_OUT=<scratchpad>/vues npm --prefix v2/client run captures [-- depart panorama cimes lieu
   foret cote sphinx brouillard]`. Sans carte graphique (conteneur, CI) : `E2E_QUALITE=moyen` (le profil `haut` dépasse
   les délais en rendu logiciel). Sur le PC d'Eric : `haut`.
3. Vue sur mesure : ajouter une entrée à `VIEWS` dans `v2/client/e2e/captures.mjs` (`at` : où poser le héros, `face` : vers
   où il regarde, `beta`, `radius`, `turn` : caméra), ou dans un script Playwright :
   `?decouverte&e2e&qualite=moyen[&classe=2nde][&monde=brouillard][&interface=0]`, puis
   `window.__aldoria.world.teleport(x, z, versX, versZ)` et `world.frame(world.camera.alpha + décalage, beta, distance)`.
4. Ouvrir chaque capture avec Read et la regarder vraiment.

## Quoi vérifier

- Le héros touche le sol (ni flottant ni enfoncé), son ombre est là, ses armes sont celles choisies (une par main).
- Monde lumineux : le renard suit le héros, entier (aucune partie étirée), les pattes au sol.
- Le ciel se fond dans le brouillard à l'horizon ; pas de bande noire, pas de surexposition (sable, pierre).
- Les lieux de quête sont sur un replat, porte tournée vers le départ, seuil lumineux (doré : ouvert ; gris : fermé).
- Aucun arbre dans un bâtiment, sur un seuil, sur la plage ou sur l'île du Sphinx.
- Monde Brouillard : plus sombre et voilé, mais le héros et l'interface restent lisibles.
- Interface : texte lisible sur le parchemin (contraste ≥ 4,5:1), rien de coupé à 1280 × 720, aménagements forcés si besoin
  (attributs `data-text-size="2"`, `data-readable-font="true"` sur `<html>`).
