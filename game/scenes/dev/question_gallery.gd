extends Control
## Galerie de questions (développement, PC uniquement) : affiche une question d'un type
## donné, tirée des paquets de test, dans le vrai panneau du jeu. Sert à vérifier le
## rendu des widgets et des illustrations, captures d'écran comprises.
## `-- --scene=questions --level=6e|2nde --type=number_line|order|numeric|mcq|… [--visual=graph] [--index=0]`

const PACKS := "res://tests/fixtures/pack_%s.json"


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	var level := Quality.option("level", "6e")
	var world := "tom" if level == "2nde" else "jules"
	var wt := WorldTheme.for_world(world)
	var bg := ColorRect.new()
	bg.color = wt.background
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var pack: Variant = JSON.parse_string(FileAccess.get_file_as_string(PACKS % level))
	if not pack is Dictionary:
		add_child(UiKit.label("Paquet de test introuvable (galerie réservée au PC).", 28, Color.WHITE))
		return
	Session._apply_pack(pack)
	var wanted_type := Quality.option("type", "number_line")
	var wanted_visual := Quality.option("visual")
	var matches: Array = Session.items.filter(func(it: Dictionary) -> bool:
		var visual: Variant = it.get("visual")
		var kind: String = visual.get("kind", "") if visual is Dictionary else ""
		return it["type"] == wanted_type and (wanted_visual == "" or kind == wanted_visual))
	if matches.is_empty():
		add_child(UiKit.label("Aucune question de ce type dans le paquet %s." % level, 28, Color.WHITE))
		return
	var item: Dictionary = matches[clampi(int(Quality.option("index", "0")), 0, matches.size() - 1)]
	var panel := QuestionPanel.new()
	panel.setup(item, "Galerie · %s" % item["generator"], wt)
	var column := VBoxContainer.new()
	column.set_anchors_preset(Control.PRESET_FULL_RECT)
	column.alignment = BoxContainer.ALIGNMENT_END
	var center := CenterContainer.new()
	center.add_child(panel)
	column.add_child(center)
	add_child(column)
	panel.answered.connect(func(value: Variant, _ms: int, _hint: bool) -> void:
		var ok := AnswerChecker.check(item["answer"], value)
		print("[Aldoria/galerie] réponse %s : %s" % [str(value), "juste" if ok else "fausse"])
		panel.reveal(ok))
