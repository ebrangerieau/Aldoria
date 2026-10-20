---
name: nouveau-donjon
description: Ajouter un donjon (lieu de la carte) à une région d'Aldoria — DungeonDef, salles, ennemis, boss Effaceur, énigme, décor, place sur la carte, tests et captures de vérification.
---

# Ajouter un donjon

Exemples complets : `porte_origines()` et `porte_horizons()` dans `game/worlds/shared/dungeon_def.gd`.

## 1. `DungeonDef` (fonction statique dans `dungeon_def.gd`)

Champs : `code`, `title`, `subject` (code de matière = clé de `WorldMapDef.REGIONS`), `chapter_codes` (chapitres d'**une
seule** classe, au moins un avec générateur), `chapter_title` (affiché « Ce que tu vas travailler : … », première
lettre mise en minuscule seulement), `intro`, `outro`, `threshold` (texte du seuil sur la carte), `page`
(« la page de … »), `page_text` (au coffre), `map_piece` (bâtiment KayKit hexagon, `assets/kaykit/hexagon/building_*`),
`boss_intro` / `boss_defeat` (l'Effaceur parle), `enigma_generator` / `enigma_title` / `enigma_intro`,
`enigma_xp`, `chest_xp`, `rooms`, `decor`.

- Ajouter la fonction à `all_for_level(<classe>)` : **l'ordre compte**, les donjons d'une même matière s'ouvrent l'un
  après l'autre (`DungeonDef.previous`).
- Le donjon ne transmet que ses chapitres et son générateur d'énigme à `session/start` ; `api/tests/test_dungeon.py`
  vérifie qu'ils existent, et que chaque fabrique figure dans `all_for_level` (aucun nombre à mettre à jour).

## 2. Salles (`rooms`, 6 salles d'ordinaire)

`entree`, `combat` ×2, `enigme`, `combat`, `boss`. Ennemis : `_enemy(modèle, nom, pv, rang, xp, Vector2(x, z)[, échelle])`.
- Modèles : monstres Quaternius déclarés dans `Fighter.MONSTERS` (Mushnub, MushnubEvolved, GreenBlob, Goleling,
  GolelingEvolved, Cactoro, Armabee, Dragon, Ghost, GhostSkull, BlueDemon, Demon, Orc, Yeti) ou squelettes KayKit
  (`Skeleton_Warrior`, `Skeleton_Rogue`, `Skeleton_Mage`…). Les enfants veulent de la variété, pas que des squelettes.
- Donjon qui monte : quart est réservé à l'escalier et à la porte — **pas d'ennemi en x > 11 avec z de 7 à 13**.
- Valeurs habituelles : salle 1 (60 PV, rang 1), salle 2 (75, rang 2, deux ennemis), salle 4 (110, rang 3),
  boss (210, rang 4, échelle 1,25 à 1,4).

## 3. Boss = un Effaceur, complice de Malvrek

Ton de la bible `docs/histoire.md` (drôle, jamais effrayant pour Jules ; plus sombre pour Tom) ; il annonce ce qu'il a
abîmé et le reconnaît à sa défaite. Nom **provisoire**, à relire avec les enfants ; l'ajouter à la bible.

## 4. Décor (`decor`, lu par `DungeonLevel`)

`floor`, `floor_accent`, `walls` (facultatif), `banners`, `props` (`[pièce, Vector3, rotation, échelle]` près des murs,
hors du passage), `torch_color`. Pièces : `assets/kaykit/dungeon/` ; vérifier le nom exact avant de l'utiliser.
Rien d'éclairé en dur : la scène suit `Quality.settings()`.

## 5. Carte

Emplacement = prochain `slots` libre de la région dans `world_map_def.gd` (dans l'ordre des donjons). Région pleine :
ajouter un emplacement sur une case de terre libre, vérifié avec `--places=1`.

## 6. Tests et vérification

- GUT : `test_world_map.gd` (statut ouvert / fermé du lieu ; les totaux de pages se calculent seuls).
- Captures (skill `captures`) : seuil sur la carte (`--seuil=<code>`), chaque salle (`--dungeon=<code> --room=N`),
  énigme et boss (`--approach=1`), escalier (`--stairs=1`). Regarder : ennemis hors des murs et de l'escalier, texte
  du seuil sans débordement, boss à la bonne taille.
- Puis skill `livrer`.
