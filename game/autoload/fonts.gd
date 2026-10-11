extends Node
## Police de secours pour les symboles absents de la police par défaut de Godot
## (★ ☆ ⌫ ● ○…). Sur PC, Godot les empruntait aux polices de Windows ; sur le web,
## il n'a que sa police intégrée et affichait des carrés vides (constaté le 2026-10-11).
## Premier autoload : doit s'exécuter avant la création de toute interface.

const SYMBOLS_FONT := "res://assets/fonts/DejaVuSans.ttf"


func _init() -> void:
	# On complète la police par défaut existante (déjà référencée par le thème par
	# défaut) plutôt que de la remplacer.
	var base := ThemeDB.fallback_font
	var fallbacks := base.fallbacks.duplicate()
	fallbacks.append(load(SYMBOLS_FONT))
	base.fallbacks = fallbacks
