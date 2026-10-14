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
var _hint_used := false  # indice ordinaire (puissance réduite en combat)
var _assisted := false  # objet du sac utilisé (plume, parchemin) : aide sans baisse de puissance
var _widget: Control
var _bonus: Label
var _hint_label: Label
var _hint_button: Button
var _done := false
var _visual: Control
var _tools: MathTools
var _tools_layer: CanvasLayer


## `with_items` : plume et parchemin du sac proposés (pas au défi du jour).
func setup(question: Dictionary, title: String, wt: WorldTheme, with_items := true) -> void:
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
	# Le titre se raccourcit (« … ») plutôt que d'élargir le panneau : avec un texte
	# agrandi et aéré (aménagements), l'en-tête doit tenir dans la colonne.
	var title_label := UiKit.title(title, 22, wt.accent)
	title_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	title_label.clip_text = true
	title_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	title_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title_label.custom_minimum_size.x = 80
	header.add_child(title_label)
	var stars := UiKit.label(_stars(int(question["difficulty"])), 22, wt.accent)
	stars.autowrap_mode = TextServer.AUTOWRAP_OFF
	header.add_child(stars)
	_bonus = UiKit.label("⚡ Bonus éclair", 20, wt.good)
	_bonus.autowrap_mode = TextServer.AUTOWRAP_OFF
	# Aménagement « sans pénalité de lenteur » : aucune récompense liée à la vitesse.
	_bonus.visible = not Accessibility.on("no_speed")
	header.add_child(_bonus)
	if Accessibility.can_speak():
		header.add_child(UiKit.listen_button(wt, Accessibility.question_parts(question), Accessibility.auto_read()))
	var glow := create_tween().set_loops()
	glow.tween_property(_bonus, "modulate:a", 0.55, 0.6)
	glow.tween_property(_bonus, "modulate:a", 1.0, 0.6)
	box.add_child(header)

	box.add_child(UiKit.label(str(question["prompt"]), 26))
	if question.get("listen") is Dictionary:
		box.add_child(_listen_exercise(question["listen"], wt))

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
	if visual is Dictionary and not question["type"] in ["number_line", "sign_table"] and (
			question.get("role") == "enigme" or visual.get("kind") in ["graph", "number_line", "robot"]):
		_visual = _make_visual(visual, wt)
		if _visual:
			# La grille du robot va à droite : le programme à lire est déjà long à gauche.
			(columns if visual.get("kind") == "robot" else box).add_child(_visual)

	var widget: Control
	if question["type"] == "number_line":
		var line := NumberLineWidget.new()
		line.setup(question.get("visual", {}), wt)
		widget = line
		_visual = line
		box.add_child(widget)
	elif question["type"] == "true_false":
		var verdict := TrueFalseWidget.new()
		verdict.setup(question["choices"], wt)
		widget = verdict
		box.add_child(widget)
	elif question["type"] == "sign_table":
		var table := SignTableWidget.new()
		table.setup(question.get("visual", {}), wt)
		widget = table
		_visual = table
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
	elif question["type"] == "text":
		var typing := TextAnswerWidget.new()
		typing.setup(wt, bool(question["answer"].get("accents", true)))
		typing.custom_minimum_size = Vector2(600, 0)
		widget = typing
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
	_widget = widget
	if Accessibility.on("math_tools") and question["type"] in ["numeric", "mcq", "expression", "order"]:
		_build_tools(wt, widget as KeypadWidget)

	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_child(spacer)
	var footer := HBoxContainer.new()
	footer.add_theme_constant_override("separation", 12)
	_hint_button = UiKit.icon_button("Indice", "light-bulb", 52.0)
	UiKit.style_secondary(_hint_button, wt)
	_hint_button.pressed.connect(_show_hint)
	footer.add_child(_hint_button)
	if with_items:
		_add_item_buttons(footer, question, wt)
	if _tools:
		var tools_button := UiKit.icon_button("Outils", "crystal-ball", 52.0)
		UiKit.style_secondary(tools_button, wt)
		tools_button.pressed.connect(func() -> void: _tools_layer.visible = not _tools_layer.visible)
		footer.add_child(tools_button)
	_hint_label = UiKit.label(str(question.get("hint", "")), 20, wt.text_dim)
	_hint_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_hint_label.visible = false
	footer.add_child(_hint_label)
	box.add_child(footer)

	_started_ms = Time.get_ticks_msec()


## Exercice d'écoute : le mot ou la phrase est prononcé dans sa langue (pas affiché),
## une fois à l'arrivée de la question (après l'énoncé s'il est lu), puis à volonté.
## Toujours actif : c'est la question elle-même, pas un aménagement.
func _listen_exercise(listen: Dictionary, wt: WorldTheme) -> Button:
	var text := str(listen.get("text", ""))
	var lang := str(listen.get("lang", "en-GB"))
	var names := {"en-GB": "anglais", "en-US": "anglais", "es-ES": "espagnol", "de-DE": "allemand", "fr-FR": "français"}
	var b := UiKit.icon_button("Écouter (%s)" % names.get(lang, lang), "speaker", 64.0)
	b.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	b.custom_minimum_size.x = 300
	b.pressed.connect(func() -> void: Accessibility.say(text, lang, true, 0.85))
	b.tree_exiting.connect(Accessibility.stop_speaking)
	b.ready.connect(func() -> void: Accessibility.say(text, lang, false, 0.85), CONNECT_ONE_SHOT)
	return b


## Outils de calcul (aménagement « dyscalculie ») : volet flottant en haut à gauche de
## l'écran, pour ne pas agrandir le panneau ni cacher le pavé de saisie.
func _build_tools(wt: WorldTheme, keypad: KeypadWidget) -> void:
	_tools_layer = CanvasLayer.new()
	_tools_layer.layer = 15
	_tools_layer.visible = false
	add_child(_tools_layer)
	var holder := MarginContainer.new()
	holder.set_anchors_preset(Control.PRESET_TOP_LEFT)
	holder.add_theme_constant_override("margin_top", 10)
	holder.add_theme_constant_override("margin_left", 10)
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_tools_layer.add_child(holder)
	var frame := PanelContainer.new()
	frame.theme = UiKit.make_theme(wt)
	holder.add_child(frame)
	_tools = MathTools.new()
	_tools.setup(wt, keypad)
	frame.add_child(_tools)


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
		"robot":
			var robot := RobotView.new()
			robot.setup(visual, wt)
			return robot
		"map":
			var map := MapView.new()
			map.setup(visual, wt)
			return map
		"table":
			var table := TableView.new()
			table.setup(visual, wt)
			return table
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


## Objets du sac utilisables sur cette question : plume (QCM d'au moins trois choix),
## parchemin (s'il y a un indice).
func _add_item_buttons(footer: HBoxContainer, question: Dictionary, wt: WorldTheme) -> void:
	var usable := {
		"plume": _widget is McqWidget and (question.get("choices", []) as Array).size() >= 3,
		"parchemin": str(question.get("hint", "")) != "",
	}
	for id in ["plume", "parchemin"]:
		if not usable[id] or SaveManager.item_count(id) <= 0:
			continue
		var b := UiKit.icon_button("%s ×%d" % [Inventory.ITEMS[id]["short"], SaveManager.item_count(id)], Inventory.ICONS[id], 52.0)
		UiKit.style_secondary(b, wt)
		b.tooltip_text = Inventory.ITEMS[id]["help"]
		b.pressed.connect(_use_item.bind(id, b))
		footer.add_child(b)


func _use_item(id: String, button: Button) -> void:
	if _done or not SaveManager.use_item(id):
		return
	_assisted = true
	button.visible = false
	Sfx.play("spell", 1.2)
	if id == "plume":
		(_widget as McqWidget).remove_wrong(int(item["answer"].get("index", -1)), 2)
	else:
		_hint_label.visible = true
		_hint_button.visible = false


## Vrai si l'indice ordinaire a été pris (la puissance du coup baisse) ; les objets du
## sac aident sans cette baisse.
func penalized_hint() -> bool:
	return _hint_used


func _show_hint() -> void:
	_hint_used = true
	_bonus.visible = false  # pas de coup critique avec un indice
	_hint_label.visible = true
	_hint_button.visible = false


func _on_submitted(value: Variant) -> void:
	if _done:
		return
	_done = true
	# Pour le suivi des notions, une aide reste une aide (indice ou objet).
	answered.emit(value, elapsed_ms(), _hint_used or _assisted)


static func _stars(difficulty: int) -> String:
	return "★".repeat(difficulty) + "☆".repeat(5 - difficulty)


## Réponse attendue lisible (pour le panneau d'explication).
static func expected_text(question: Dictionary) -> String:
	var answer: Dictionary = question["answer"]
	if answer["kind"] == "choice":
		return UiKit.pretty_math(str(question["choices"][int(answer["index"])]))
	if answer["kind"] == "true_false":
		var reason: String = str(question["choices"][int(answer["reason"])])
		return "%s, car %s" % ["Vrai" if answer["value"] else "Faux", UiKit.pretty_math(reason)]
	if answer["kind"] == "signs":
		var signs := PackedStringArray()
		for sign in answer["value"]:
			signs.append("−" if str(sign) == "-" else "+")
		return " ".join(signs)
	if answer["kind"] == "order":
		var labels := PackedStringArray()
		for i in answer["value"]:
			labels.append(UiKit.pretty_math(str(question["choices"][int(i)])))
		return " → ".join(labels)
	if answer["kind"] == "vector":
		return UiKit.pretty_math("(%s ; %s)" % [answer["value"][0], answer["value"][1]])
	if answer["kind"] == "text":
		return str(answer["value"][0])
	return UiKit.pretty_math(str(answer["value"]))
