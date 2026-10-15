---
name: captures
description: Prendre des captures d'écran du jeu Aldoria sur PC (scènes, carte, seuils, salles de donjon, énigmes, boss, menus, galerie de questions, aménagements dys) et savoir quoi y vérifier. À utiliser pour toute vérification visuelle d'une modification du jeu.
---

# Captures d'écran du jeu

`godot` = `D:\developpement\tools\godot\4.7.2\Godot_v4.7.2-stable_win64_console.exe`. Toujours :
`godot --path game --rendering-driver opengl3 -- <options> --screenshot=<chemin.png> --shot-delay=<s> --perf=0`.
Enregistrer les captures dans le scratchpad, puis les ouvrir avec Read pour les regarder vraiment.

## Sans connexion

| Écran | Options |
| --- | --- |
| Étalonnage 3D | `--scene=calibration --quality=tablette` |
| Galerie de questions | `--scene=questions --level=6e --type=number_line [--visual=graph] [--index=0]` |
| Profils | `--scene=profils [--profil=N]` |

## Avec l'API locale (Docker, 127.0.0.1:8098)

Profils de test du banc local (famille 1) : `--autologin=<id> --pin=<code de test>` ; un PC neuf se relie une fois
par `--pair=<code>` (`docker exec aldoria-api-test python -m app.cli pairing-code --family 1 --name PC`).
Jamais les codes PIN de production.

| Écran | Options |
| --- | --- |
| Carte | `--seuil=aucun` ; positions des lieux : `--places=1` |
| Seuil d'un lieu | `--seuil=<code du donjon ou du lieu>` |
| Prologue | `--goto=prologue --tableau=N` (1 à 5) |
| Citadelle, apparence | `--goto=citadelle`, `--goto=apparence` |
| Défi, arène, archives, village | `--goto=defi|arene|archives|village` (`--npc=<code>` : quête d'un habitant ; `--autoaction=chapitre` à l'arène) |
| Salle de donjon | `--goto=donjon --dungeon=<code> --room=N` (0 à 5, même un donjon fermé) |
| Combat, énigme, boss | + `--approach=1` (héros mené au premier ennemi ou piédestal) |
| Escalier | + `--stairs=1` |
| Qualité | `--quality=haut|tablette|bas` ; interface de tablette sur PC : `--ui=tablette` |

`--shot-delay` : 1,5 s pour un menu, 4 s pour une salle, 6 s ou plus pour un boss qui parle.

## Aménagements « dys » (à tester pour toute interface modifiée)

`--acc=big_targets,readable_font,spacing --text-size=2` (et `read_aloud`, `math_tools`, `calm`… ;
`--tools=table`, `--wrong=1` pour le panneau d'explication).

## Quoi regarder

- Texte : aucun débordement ni mot coupé, même en `--text-size=2` ; pas de label « une lettre par ligne »
  (`Label` à retour à la ligne dans une `HBoxContainer`).
- Contraste ≥ 4,5:1 sur parchemin et sur pierre (monde `brouillard` : profil de Tom) ; juste/faux en `good_ink`/`bad_ink`.
- 3D : personnages et ennemis hors des murs, escalier collé au mur, rien ne masque le héros, pas de sol blanchi.
- Combat : bulle et panneaux sans chevauchement ; boss à la bonne taille.
- Comparer les deux mondes (Jules lumineux, Tom brouillard) quand l'écran est commun.
