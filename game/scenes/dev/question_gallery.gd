extends Control
## Galerie de questions (développement, PC uniquement) : affiche une question d'un type
## donné, tirée des paquets de test, dans le vrai panneau du jeu. Sert à vérifier le
## rendu des widgets et des illustrations, captures d'écran comprises.
## `-- --scene=questions --level=6e|2nde --type=number_line|order|numeric|mcq|… [--visual=graph] [--index=0]`
## `[--acc=read_aloud,spacing,readable_font,math_tools,…] [--text-size=0|1|2] [--tools=1] [--wrong=1]` :
## aménagements d'accessibilité, outils de calcul ouverts, panneau d'explication.

const PACKS := "res://tests/fixtures/pack_%s.json"


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_dev_accommodations()
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
	_dev_show(panel, item, wt, column)
	panel.answered.connect(func(value: Variant, _ms: int, _hint: bool) -> void:
		var ok := AnswerChecker.check(item["answer"], value)
		print("[Aldoria/galerie] réponse %s : %s" % [str(value), "juste" if ok else "fausse"])
		panel.reveal(ok))


func _dev_accommodations() -> void:
	var settings := Accessibility.DEFAULTS.duplicate()
	for key in Quality.option("acc").split(",", false):
		settings[key] = true
	settings["text_size"] = int(Quality.option("text-size", "0"))
	Accessibility.apply_parent(settings)


## Développement : outils de calcul ouverts ou panneau d'explication (captures d'écran).
func _dev_show(panel: QuestionPanel, item: Dictionary, wt: WorldTheme, column: Control) -> void:
	if Quality.option("tools") != "" and panel._tools:
		panel._tools_layer.visible = true
		panel._tools.call("_show", "table" if Quality.option("tools") == "table" else "numeration")
		panel._tools.show_number("2,15")
	if Quality.option("wrong") != "":
		panel.queue_free()
		var explanation := ExplanationPanel.new()
		explanation.setup(item, wt)
		var center := CenterContainer.new()
		center.add_child(explanation)
		column.add_child(center)
