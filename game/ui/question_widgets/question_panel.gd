class_name QuestionPanel
extends PanelContainer
## Affiche un item normalisé (énoncé, formule, widget de réponse) et renvoie la
## réponse brute, le temps et l'usage de l'indice. Ne valide rien lui-même :
## c'est le rôle de QuestionService (TRD §2.3).
##
## La barre du haut montre le « bonus de vitesse » (coup critique si réponse juste
## en moins de la moitié du temps cible). Elle n'est jamais punitive : une fois
## vide, la question reste ouverte sans limite.

signal answered(user_input: Variant, time_ms: int, hint_used: bool)

const CRIT_RATIO := 0.5

var item: Dictionary
var _wt: WorldTheme
var _started_ms := 0
var _hint_used := false
var _speed_bar: ProgressBar
var _speed_fill: StyleBoxFlat
var _hint_label: Label
var _hint_button: Button
var _done := false


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
	_speed_bar = ProgressBar.new()
	_speed_bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_speed_bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_speed_bar.custom_minimum_size = Vector2(0, 14)
	_speed_bar.max_value = 1.0
	_speed_bar.value = 1.0
	_speed_bar.show_percentage = false
	_speed_fill = StyleBoxFlat.new()
	_speed_fill.set_corner_radius_all(8)
	_speed_bar.add_theme_stylebox_override("fill", _speed_fill)
	header.add_child(_speed_bar)
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

	var widget: Control
	if question["type"] == "mcq":
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


func elapsed_ms() -> int:
	return Time.get_ticks_msec() - _started_ms


func _process(_delta: float) -> void:
	if _done or _speed_bar == null:
		return
	var target := maxf(1.0, float(item.get("time_target_ms", 20000)))
	var ratio := elapsed_ms() / target
	_speed_bar.value = clampf(1.0 - ratio, 0.0, 1.0)
	_speed_fill.bg_color = _wt.good if ratio < CRIT_RATIO else _wt.accent


func _show_hint() -> void:
	_hint_used = true
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
	return UiKit.pretty_math(str(answer["value"]))
