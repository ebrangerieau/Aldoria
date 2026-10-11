class_name QuestionPanel
extends PanelContainer
## Affiche un item normalisé (énoncé, formule, widget de réponse) et renvoie la
## réponse brute, le temps et l'usage de l'indice. Ne valide rien lui-même :
## c'est le rôle de QuestionService (TRD §2.3).
##
## Aucune limite de temps. Un badge « Bonus éclair » brille pendant la fenêtre du
## coup critique (réponse juste en moins de la moitié du temps cible), puis s'efface
## discrètement : pas de barre qui se vide, perçue comme un chrono par les enfants
## (retour du 2026-10-11).

signal answered(user_input: Variant, time_ms: int, hint_used: bool)

const CRIT_RATIO := 0.5

var item: Dictionary
var _wt: WorldTheme
var _started_ms := 0
var _hint_used := false
var _bonus: Label
var _hint_label: Label
var _hint_button: Button
var _done := false
var _visual: Control


func setup(question: Dictionary, title: String, wt: WorldTheme) -> void:
	item = question
	_wt = wt
	theme = UiKit.make_theme(wt)
	custom_minimum_size = Vector2(1100, 0)

	# Deux colonnes pour rester bas à l'écran (les combattants restent visibles au-dessus) :
	# à gauche l'énoncé et la formule, à droite le pavé de saisie. Le QCM reste à gauche.
	var columns := HBoxContainer.new()
	columns.add_theme_constant_override("separation", 24)
	add_child(columns)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 12)
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	columns.add_child(box)

	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 16)
	var title_label := UiKit.label(title, 22, wt.accent)
	title_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	header.add_child(title_label)
	var stars := UiKit.label(_stars(int(question["difficulty"])), 22, wt.accent)
	stars.autowrap_mode = TextServer.AUTOWRAP_OFF
	header.add_child(stars)
	var header_gap := Control.new()
	header_gap.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(header_gap)
	_bonus = UiKit.label("⚡ Bonus éclair", 20, wt.good)
	_bonus.autowrap_mode = TextServer.AUTOWRAP_OFF
	header.add_child(_bonus)
	var glow := create_tween().set_loops()
	glow.tween_property(_bonus, "modulate:a", 0.55, 0.6)
	glow.tween_property(_bonus, "modulate:a", 1.0, 0.6)
	box.add_child(header)

	box.add_child(UiKit.label(str(question["prompt"]), 26))

	if question.has("latex_hash"):
		var texture := Session.formula_texture(question["latex_hash"], 1.25)
		if texture:
			var formula := TextureRect.new()
			formula.texture = texture
			formula.modulate = wt.formula
			formula.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			formula.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			formula.custom_minimum_size = Vector2(0, clampf(texture.get_height(), 60, 130))
			box.add_child(formula)
		elif question.get("latex"):
			box.add_child(UiKit.label(str(question["latex"]), 28))  # repli : texte brut

	# Illustration : celles des énigmes (balance, repère), et partout la courbe d'une
	# lecture graphique ou la droite graduée où lire un point.
	var visual: Variant = question.get("visual")
	if visual is Dictionary and question["type"] != "number_line" and (
			question.get("role") == "enigme" or visual.get("kind") in ["graph", "number_line"]):
		_visual = _make_visual(visual, wt)
		if _visual:
			box.add_child(_visual)

	var widget: Control
	if question["type"] == "number_line":
		var line := NumberLineWidget.new()
		line.setup(question.get("visual", {}), wt)
		widget = line
		_visual = line
		box.add_child(widget)
	elif question["type"] == "order":
		var order := OrderWidget.new()
		order.setup(question["choices"], wt)
		widget = order
		box.add_child(widget)
	elif question["type"] == "vector":
		var vector := VectorWidget.new()
		vector.setup(wt)
		vector.custom_minimum_size = Vector2(420, 0)
		widget = vector
		columns.add_child(widget)
	elif question["type"] == "mcq":
		var mcq := McqWidget.new()
		mcq.setup(question["choices"])
		widget = mcq
		box.add_child(widget)
	else:
		var keypad := KeypadWidget.new()
		keypad.setup("expression" if question["type"] == "expression" else "numeric", wt)
		keypad.custom_minimum_size = Vector2(480 if question["type"] == "expression" else 400, 0)
		widget = keypad
		columns.add_child(widget)
	widget.connect("submitted", _on_submitted)

	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_child(spacer)
	var footer := HBoxContainer.new()
	footer.add_theme_constant_override("separation", 12)
	_hint_button = UiKit.button("Indice", 52.0)
	UiKit.style_secondary(_hint_button, wt)
	_hint_button.pressed.connect(_show_hint)
	footer.add_child(_hint_button)
	_hint_label = UiKit.label(str(question.get("hint", "")), 20, wt.text_dim)
	_hint_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_hint_label.visible = false
	footer.add_child(_hint_label)
	box.add_child(footer)

	_started_ms = Time.get_ticks_msec()


## Après la validation : l'illustration montre le résultat (rayon tiré, masse révélée).
func reveal(correct: bool) -> void:
	if _visual and _visual.has_method("reveal"):
		_visual.call("reveal", correct, expected_text(item))


static func _make_visual(visual: Dictionary, wt: WorldTheme) -> Control:
	match visual.get("kind"):
		"balance":
			var balance := BalanceView.new()
			balance.setup(visual, wt)
			return balance
		"grid":
			var grid := GridView.new()
			grid.setup(visual, wt)
			return grid
		"graph":
			var graph := GraphView.new()
			graph.setup(visual, wt)
			return graph
		"number_line":
			var line := NumberLineWidget.new()
			line.setup(visual, wt, false)
			return line
	return null


func elapsed_ms() -> int:
	return Time.get_ticks_msec() - _started_ms


func _process(_delta: float) -> void:
	if _done or _bonus == null or not _bonus.visible:
		return
	var target := maxf(1.0, float(item.get("time_target_ms", 20000)))
	var ratio := elapsed_ms() / target
	if ratio >= CRIT_RATIO:
		_bonus.visible = false


func _show_hint() -> void:
	_hint_used = true
	_bonus.visible = false  # pas de coup critique avec un indice
	_hint_label.visible = true
	_hint_button.visible = false


func _on_submitted(value: Variant) -> void:
	if _done:
		return
	_done = true
	answered.emit(value, elapsed_ms(), _hint_used)


static func _stars(difficulty: int) -> String:
	return "★".repeat(difficulty) + "☆".repeat(5 - difficulty)


## Réponse attendue lisible (pour le panneau d'explication).
static func expected_text(question: Dictionary) -> String:
	var answer: Dictionary = question["answer"]
	if answer["kind"] == "choice":
		return UiKit.pretty_math(str(question["choices"][int(answer["index"])]))
	if answer["kind"] == "order":
		var labels := PackedStringArray()
		for i in answer["value"]:
			labels.append(UiKit.pretty_math(str(question["choices"][int(i)])))
		return " → ".join(labels)
	if answer["kind"] == "vector":
		return UiKit.pretty_math("(%s ; %s)" % [answer["value"][0], answer["value"][1]])
	return UiKit.pretty_math(str(answer["value"]))
