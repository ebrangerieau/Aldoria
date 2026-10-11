class_name OrderWidget
extends VBoxContainer
## Remettre dans l'ordre : on touche les éléments l'un après l'autre (plus sûr qu'un
## glisser-déposer sur tablette). Chaque élément touché rejoint la rangée du haut, à sa
## place ; « Recommencer » vide la rangée. Émet la liste des indices dans l'ordre choisi.

signal submitted(value: Variant)

var _choices: Array = []
var _sequence: Array[int] = []
var _wt: WorldTheme
var _row: HBoxContainer
var _pool: HFlowContainer
var _buttons: Array[Button] = []
var _ok: Button
var _locked := false


func setup(choices: Array, wt: WorldTheme) -> void:
	_choices = choices
	_wt = wt
	add_theme_constant_override("separation", 12)

	var frame := PanelContainer.new()
	var box := StyleBoxFlat.new()
	box.bg_color = wt.panel.lerp(wt.bg, 0.12)
	box.border_color = wt.accent
	box.set_border_width_all(2)
	box.set_corner_radius_all(12)
	box.set_content_margin_all(8)
	frame.add_theme_stylebox_override("panel", box)
	frame.custom_minimum_size = Vector2(0, 76)
	_row = HBoxContainer.new()
	_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_row.add_theme_constant_override("separation", 10)
	frame.add_child(_row)
	add_child(frame)

	_pool = HFlowContainer.new()
	_pool.alignment = FlowContainer.ALIGNMENT_CENTER
	_pool.add_theme_constant_override("h_separation", 12)
	_pool.add_theme_constant_override("v_separation", 12)
	for i in choices.size():
		var b := UiKit.button(UiKit.pretty_math(str(choices[i])), 64.0)
		b.custom_minimum_size.x = 130
		b.add_theme_font_size_override("font_size", UiKit.font_size(30))
		b.pressed.connect(_pick.bind(i))
		_pool.add_child(b)
		_buttons.append(b)
	add_child(_pool)

	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 12)
	var reset := UiKit.button("Recommencer", 56.0)
	UiKit.style_secondary(reset, wt)
	reset.pressed.connect(_reset)
	actions.add_child(reset)
	_ok = UiKit.button("Valider", 56.0)
	_ok.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_ok.pressed.connect(_submit)
	actions.add_child(_ok)
	add_child(actions)
	_refresh()


func _pick(i: int) -> void:
	if _locked or i in _sequence:
		return
	_sequence.append(i)
	_refresh()


func _reset() -> void:
	if _locked:
		return
	_sequence.clear()
	_refresh()


func _submit() -> void:
	if _locked or _sequence.size() != _choices.size():
		return
	_locked = true
	submitted.emit(_sequence.duplicate())


func _refresh() -> void:
	for child in _row.get_children():
		child.queue_free()
	if _sequence.is_empty():
		_row.add_child(_inline("Touche le premier…", 24, _wt.text_dim))
	for n in _sequence.size():
		if n > 0:
			_row.add_child(_inline("→", 28, _wt.text_dim))  # neutre : croissant ou décroissant
		_row.add_child(_inline(UiKit.pretty_math(str(_choices[_sequence[n]])), 30, _wt.accent))
	for i in _buttons.size():
		_buttons[i].disabled = i in _sequence
	_ok.disabled = _sequence.size() != _choices.size()


## Texte d'une rangée : jamais de retour à la ligne (sinon une lettre par ligne).
static func _inline(text: String, size: int, color: Color) -> Label:
	var l := UiKit.label(text, size, color)
	l.autowrap_mode = TextServer.AUTOWRAP_OFF
	return l


func _unhandled_key_input(event: InputEvent) -> void:
	# Clavier du PC : touches 1 à 5 dans l'ordre voulu, Entrée pour valider.
	var key := event as InputEventKey
	if key == null or not key.pressed or _locked:
		return
	if key.keycode >= KEY_1 and key.keycode < KEY_1 + _choices.size():
		_pick(key.keycode - KEY_1)
	elif key.keycode in [KEY_ENTER, KEY_KP_ENTER]:
		_submit()
	elif key.keycode == KEY_BACKSPACE:
		_reset()
	else:
		return
	get_viewport().set_input_as_handled()
