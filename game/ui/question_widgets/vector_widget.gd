class_name VectorWidget
extends VBoxContainer
## Saisie des coordonnées d'un vecteur ou d'un point : ( x ; y ).
## Toucher une case pour la choisir ; « ; » ou Tab passe à la suivante.
## Émet `submitted([x, y])` (textes), validé par AnswerChecker (`kind: vector`).

signal submitted(value: Variant)

const KEYS := [
	["7", "8", "9", "⌫"],
	["4", "5", "6", "−"],
	["1", "2", "3", ";"],
	["0", ",", "OK"],
]
const MAX_LENGTH := 6

var _values := ["", ""]
var _slot := 0
var _slots: Array[Button] = []
var _ok: Button
var _locked := false
var _wt: WorldTheme


func setup(wt: WorldTheme) -> void:
	_wt = wt
	add_theme_constant_override("separation", 10)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 8)
	row.add_child(_paren("("))
	for i in 2:
		var slot := UiKit.button("", 64.0)
		slot.custom_minimum_size.x = 130
		slot.add_theme_font_size_override("font_size", UiKit.font_size(34))
		slot.pressed.connect(_select.bind(i))
		_slots.append(slot)
		row.add_child(slot)
		if i == 0:
			row.add_child(_paren(";"))
	row.add_child(_paren(")"))
	add_child(row)
	for keys in KEYS:
		var line := HBoxContainer.new()
		line.add_theme_constant_override("separation", 10)
		for key in keys:
			var b := UiKit.button(key, 56.0)
			b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			if key == "OK":
				b.size_flags_stretch_ratio = 2.0
				_ok = b
			elif key == "⌫":
				UiKit.style_secondary(b, wt)
			b.pressed.connect(_press.bind(key))
			line.add_child(b)
		add_child(line)
	_refresh()


func _paren(text: String) -> Label:
	var l := UiKit.label(text, 40, _wt.text)
	l.autowrap_mode = TextServer.AUTOWRAP_OFF
	return l


func _select(i: int) -> void:
	_slot = i
	_refresh()


func _press(key: String) -> void:
	if _locked:
		return
	match key:
		"⌫":
			if _values[_slot] == "" and _slot == 1:
				_slot = 0
			_values[_slot] = _values[_slot].substr(0, _values[_slot].length() - 1)
		";":
			_slot = 1 - _slot
		"OK":
			if _values[0] == "" or _values[1] == "":
				_slot = 0 if _values[0] == "" else 1
				_refresh()
				return
			_locked = true
			submitted.emit([_values[0], _values[1]])
			return
		"−":
			# Le signe moins se place en tête, une seule fois.
			_values[_slot] = _values[_slot].substr(1) if _values[_slot].begins_with("−") else "−" + _values[_slot]
		_:
			if _values[_slot].length() < MAX_LENGTH:
				_values[_slot] += key
	_refresh()


func _refresh() -> void:
	for i in 2:
		var text: String = _values[i]
		_slots[i].text = text if text != "" else ("x" if i == 0 else "y")
		_slots[i].modulate.a = 1.0 if text != "" else 0.55
		if i == _slot:
			_slots[i].remove_theme_stylebox_override("normal")
			_slots[i].remove_theme_stylebox_override("hover")
			_slots[i].remove_theme_color_override("font_color")
		else:
			UiKit.style_secondary(_slots[i], _wt)
	_ok.disabled = _values[0] == "" or _values[1] == ""


func _unhandled_key_input(event: InputEvent) -> void:
	var key := event as InputEventKey
	if key == null or not key.pressed or _locked:
		return
	var handled := true
	match key.keycode:
		KEY_BACKSPACE:
			_press("⌫")
		KEY_ENTER, KEY_KP_ENTER:
			_press("OK")
		KEY_TAB:
			_press(";")
		_:
			var ch := char(key.unicode) if key.unicode > 0 else ""
			if ch != "" and ch in "0123456789,.-;":
				_press({"-": "−", ".": ","}.get(ch, ch))
			else:
				handled = false
	if handled:
		get_viewport().set_input_as_handled()
