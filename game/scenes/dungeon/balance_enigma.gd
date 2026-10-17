class_name BalanceEnigma
extends PanelContainer
## Une manche de la balance géante (salle-énigme 3D) : la question se résout sur la balance
## elle-même. L'enfant peut enlever la même chose des deux côtés (la balance reste en
## équilibre : c'est le raisonnement de la pré-algèbre), puis essaie une masse pour une boîte.
## Chaque boîte affiche la masse essayée et le fléau penche : trop lourd, trop léger ou juste.
## Seul le premier essai est enregistré comme réponse (suivi des notions) ; les suivants
## servent à corriger, comme on le ferait avec une vraie balance.

signal changed(kind: String)  # "bille", "boite" (retirées des deux côtés) ou "essai"
signal solved(first_try: bool)

const MAX_GUESS := 40

var item: Dictionary
var _rig: BalanceRig
var _wt: WorldTheme
var _started := 0
var _hint_used := false
var _tries := 0
var _guess := 1
var _done := false
var _box: Array = ["boîte", "boîtes"]
var _unit: Array = ["bille", "billes"]
var _state: Label
var _feedback: Label
var _value: Label
var _remove_unit: Button
var _remove_box: Button
var _try: Button
var _minus: Button
var _plus: Button


func setup(question: Dictionary, rig: BalanceRig, wt: WorldTheme, heading: String) -> BalanceEnigma:
	item = question
	_rig = rig
	_wt = wt
	_started = Time.get_ticks_msec()
	var visual: Dictionary = question.get("visual", {})
	_box = visual.get("box", _box)
	_unit = visual.get("unit", _unit)
	var left: Dictionary = visual.get("left", {})
	var right: Dictionary = visual.get("right", {})
	_rig.set_names(_box, _unit)
	_rig.set_sides(int(left.get("boxes", 0)), int(left.get("units", 0)), int(right.get("boxes", 0)), int(right.get("units", 0)))
	_rig.tilt_to(0, true)
	_build(heading)
	# Boîtes d'un seul côté : le bouton « enlever une boîte » ne servirait jamais.
	_remove_box.visible = int(right.get("boxes", 0)) > 0
	_refresh()
	return self


func _article() -> String:
	return "Une" if str(_box[0]) == "boîte" else "Un"


func _build(heading: String) -> void:
	theme = UiKit.make_theme(_wt)
	custom_minimum_size = Vector2(1100, 0)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 10)
	add_child(column)

	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 12)
	var title := UiKit.title(heading, 26, _wt.accent)
	title.autowrap_mode = TextServer.AUTOWRAP_OFF
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(title)
	if Accessibility.can_speak():
		top.add_child(UiKit.listen_button(_wt, _spoken(), Accessibility.auto_read()))
	column.add_child(top)

	var all_same := "Toutes les %s ont la même masse." % _box[1] if _article() == "Une" else "Tous les %s ont la même masse." % _box[1]
	column.add_child(UiKit.label("Au départ, la balance est en équilibre. %s Combien de %s pèse %s %s ?" % [all_same, _unit[1], _article().to_lower(), _box[0]], 24))
	_state = UiKit.label("", 22, _wt.text_dim)
	column.add_child(_state)

	var tools := HBoxContainer.new()
	tools.add_theme_constant_override("separation", 12)
	_remove_unit = UiKit.button("Enlever 1 %s de chaque côté" % _unit[0], 56.0)
	_remove_unit.pressed.connect(_remove.bind("units"))
	_remove_box = UiKit.button("Enlever 1 %s de chaque côté" % _box[0], 56.0)
	_remove_box.pressed.connect(_remove.bind("boxes"))
	for b in [_remove_unit, _remove_box]:
		UiKit.style_secondary(b, _wt)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		tools.add_child(b)
	column.add_child(tools)

	var guess := HBoxContainer.new()
	guess.add_theme_constant_override("separation", 12)
	guess.alignment = BoxContainer.ALIGNMENT_CENTER
	guess.add_child(_inline("%s %s pèse" % [_article(), _box[0]], 26))
	_minus = UiKit.button("−", 64.0)
	_minus.custom_minimum_size.x = 72
	_minus.pressed.connect(_step.bind(-1))
	guess.add_child(_minus)
	_value = _inline("", 34, _wt.accent)
	_value.custom_minimum_size.x = 64
	_value.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	guess.add_child(_value)
	_plus = UiKit.button("+", 64.0)
	_plus.custom_minimum_size.x = 72
	_plus.pressed.connect(_step.bind(1))
	guess.add_child(_plus)
	guess.add_child(_inline(_unit[1], 26))
	_try = UiKit.button("Essayer sur la balance", 64.0)
	_try.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_try.pressed.connect(_attempt)
	guess.add_child(_try)
	column.add_child(guess)

	var bottom := HBoxContainer.new()
	bottom.add_theme_constant_override("separation", 12)
	var hint := UiKit.icon_button("Indice", "light-bulb", 52.0)
	UiKit.style_secondary(hint, _wt)
	hint.pressed.connect(_show_hint)
	bottom.add_child(hint)
	_feedback = UiKit.label("", 22, _wt.text)
	_feedback.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bottom.add_child(_feedback)
	column.add_child(bottom)


static func _inline(text: String, size: int, color := Color(0, 0, 0, 0)) -> Label:
	var l := UiKit.label(text, size, color)
	l.autowrap_mode = TextServer.AUTOWRAP_OFF  # dans une rangée
	l.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	return l


func _spoken() -> String:
	return "%s Combien de %s pèse %s %s ?" % [_describe(), _unit[1], _article().to_lower(), _box[0]]


func _describe() -> String:
	return "À gauche : %s. À droite : %s." % [_side_text("left"), _side_text("right")]


func _side_text(side: String) -> String:
	var s: Dictionary = _rig.sides[side]
	var parts: Array[String] = []
	if int(s["boxes"]) > 0:
		parts.append("%d %s" % [s["boxes"], _box[0 if int(s["boxes"]) == 1 else 1]])
	if int(s["units"]) > 0:
		parts.append("%d %s" % [s["units"], _unit[0 if int(s["units"]) == 1 else 1]])
	return " et ".join(parts) if not parts.is_empty() else "rien"


func _refresh() -> void:
	_state.text = _describe()
	_value.text = str(_guess)
	var left: Dictionary = _rig.sides["left"]
	var right: Dictionary = _rig.sides["right"]
	_remove_unit.disabled = _done or int(left["units"]) == 0 or int(right["units"]) == 0
	_remove_box.disabled = _done or int(left["boxes"]) == 0 or int(right["boxes"]) == 0
	_minus.disabled = _done or _guess <= 0
	_plus.disabled = _done or _guess >= MAX_GUESS
	_try.disabled = _done


## Enlever la même chose des deux côtés : la balance reste en équilibre.
func _remove(kind: String) -> void:
	if _done:
		return
	var left: Dictionary = _rig.sides["left"]
	var right: Dictionary = _rig.sides["right"]
	if int(left[kind]) == 0 or int(right[kind]) == 0:
		return
	left[kind] = int(left[kind]) - 1
	right[kind] = int(right[kind]) - 1
	_rig.set_sides(int(left["boxes"]), int(left["units"]), int(right["boxes"]), int(right["units"]))
	_feedback.add_theme_color_override("font_color", _wt.text)
	_feedback.text = "Même chose enlevée des deux côtés : la balance reste en équilibre."
	changed.emit("boite" if kind == "boxes" else "bille")
	_refresh()


func _step(delta: int) -> void:
	_guess = clampi(_guess + delta, 0, MAX_GUESS)
	_refresh()


func _show_hint() -> void:
	_hint_used = true
	_feedback.add_theme_color_override("font_color", _wt.text)
	_feedback.text = str(item.get("hint", ""))


## Essai : chaque boîte prend la masse choisie, le fléau penche du côté le plus lourd.
func _attempt() -> void:
	if _done:
		return
	_tries += 1
	var left: Dictionary = _rig.sides["left"]
	var right: Dictionary = _rig.sides["right"]
	var left_mass := int(left["boxes"]) * _guess + int(left["units"])
	var right_mass := int(right["boxes"]) * _guess + int(right["units"])
	var direction := 0 if left_mass == right_mass else (-1 if left_mass > right_mass else 1)
	if _tries == 1:
		# Première réponse : enregistrée comme une réponse à la question (suivi des notions).
		QuestionService.submit(item, str(_guess), Time.get_ticks_msec() - _started, _hint_used, "enigme")
	_rig.show_guess(_guess)
	_rig.tilt_to(direction, Accessibility.on("calm"))
	changed.emit("essai")
	_peek()
	if direction == 0:
		_done = true
		_feedback.add_theme_color_override("font_color", _wt.good_ink)
		_feedback.text = "En équilibre ! %s %s pèse %d %s." % [_article(), _box[0], _guess, _unit[1]]
		if _tries > 1:
			_feedback.text += " " + str(item.get("explanation", ""))
		_refresh()
		await get_tree().create_timer(2.2 if _tries > 1 else 1.4).timeout
		solved.emit(_tries == 1)
		return
	# Côté gauche plus lourd : les boîtes (plus nombreuses à gauche) sont trop lourdes.
	var too_heavy := direction == -1
	_feedback.add_theme_color_override("font_color", _wt.bad_ink)
	_feedback.text = "La balance penche %s : avec %d %s, %s %s est %s. Essaie %s." % [
		"à gauche" if too_heavy else "à droite", _guess, _unit[1], "la" if _article() == "Une" else "le", _box[0],
		"trop lourde" if too_heavy and _article() == "Une" else ("trop lourd" if too_heavy else ("trop légère" if _article() == "Une" else "trop léger")),
		"moins" if too_heavy else "plus"]
	if _tries >= 3 and not _hint_used:
		_feedback.text += " " + str(item.get("hint", ""))


## Le panneau s'efface un instant pour laisser voir le fléau pencher (sur téléphone, il couvre la
## balance), puis revient avec le message.
func _peek() -> void:
	var tween := create_tween()
	tween.tween_property(self, "modulate:a", 0.0, 0.15)
	tween.tween_interval(1.3)
	tween.tween_property(self, "modulate:a", 1.0, 0.2)


func _unhandled_key_input(event: InputEvent) -> void:
	# Clavier du PC : flèches pour la masse, Entrée pour essayer.
	var key := event as InputEventKey
	if key == null or not key.pressed or _done:
		return
	match key.keycode:
		KEY_UP, KEY_RIGHT, KEY_KP_ADD:
			_step(1)
		KEY_DOWN, KEY_LEFT, KEY_KP_SUBTRACT:
			_step(-1)
		KEY_ENTER, KEY_KP_ENTER:
			_attempt()
		_:
			return
	get_viewport().set_input_as_handled()
