class_name TrueFalseWidget
extends VBoxContainer
## Vrai ou faux justifié, en deux temps : « Vrai » / « Faux », puis la justification
## parmi trois. Émet {value: bool, reason: indice}. Un verdict juste avec une mauvaise
## justification compte comme une erreur (le hasard ne suffit pas).

signal submitted(value: Variant)

var _reasons: Array = []
var _wt: WorldTheme
var _verdict_buttons: Dictionary = {}
var _reasons_box: VBoxContainer
var _verdict: Variant = null
var _locked := false


func setup(reasons: Array, wt: WorldTheme) -> void:
	_reasons = reasons
	_wt = wt
	add_theme_constant_override("separation", 12)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	for verdict in [true, false]:
		var b := UiKit.button("Vrai" if verdict else "Faux", 72.0)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.add_theme_font_size_override("font_size", UiKit.font_size(32))
		b.pressed.connect(_choose_verdict.bind(verdict))
		row.add_child(b)
		_verdict_buttons[verdict] = b
	add_child(row)
	_reasons_box = VBoxContainer.new()
	_reasons_box.add_theme_constant_override("separation", 10)
	_reasons_box.visible = false
	_reasons_box.add_child(UiKit.label("Pourquoi ?", 24, wt.accent))
	for i in reasons.size():
		var b := UiKit.button(UiKit.pretty_math(str(reasons[i])), 60.0)
		b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.add_theme_font_size_override("font_size", UiKit.font_size(22))
		b.pressed.connect(_choose_reason.bind(i))
		_reasons_box.add_child(b)
	add_child(_reasons_box)


func _choose_verdict(verdict: bool) -> void:
	if _locked:
		return
	_verdict = verdict
	for key in _verdict_buttons:
		var b: Button = _verdict_buttons[key]
		if key == verdict:
			b.remove_theme_stylebox_override("normal")
			b.remove_theme_stylebox_override("hover")
			b.remove_theme_color_override("font_color")
		else:
			UiKit.style_secondary(b, _wt)
	_reasons_box.visible = true


func _choose_reason(index: int) -> void:
	if _locked or _verdict == null:
		return
	_locked = true
	submitted.emit({"value": _verdict, "reason": index})


func _unhandled_key_input(event: InputEvent) -> void:
	# Clavier du PC : V ou F, puis 1 à 3.
	var key := event as InputEventKey
	if key == null or not key.pressed or _locked:
		return
	match key.physical_keycode:
		KEY_V:
			_choose_verdict(true)
		KEY_F:
			_choose_verdict(false)
		_:
			if key.keycode >= KEY_1 and key.keycode < KEY_1 + _reasons.size():
				_choose_reason(key.keycode - KEY_1)
			else:
				return
	get_viewport().set_input_as_handled()
