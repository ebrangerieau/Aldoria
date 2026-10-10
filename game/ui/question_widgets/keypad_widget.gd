class_name KeypadWidget
extends VBoxContainer
## Saisie au pavé tactile (et au clavier du PC) : nombres et fractions (`numeric`)
## ou expressions algébriques (`expression`). Pas de clavier virtuel du système :
## sur tablette, le pavé intégré est plus grand et ne masque pas la question.

signal submitted(value: Variant)

const NUMERIC_KEYS := [
	["7", "8", "9", "⌫"],
	["4", "5", "6", "/"],
	["1", "2", "3", "−"],
	["0", ",", "OK"],
]
const EXPRESSION_KEYS := [
	["7", "8", "9", "x", "x²", "⌫"],
	["4", "5", "6", "+", "−", "("],
	["1", "2", "3", "×", "^", ")"],
	["0", ",", "OK"],
]
const MAX_LENGTH := 40

var _text := ""
var _display: Label
var _locked := false
var _wt: WorldTheme


func setup(mode: String, wt: WorldTheme) -> void:
	_wt = wt
	add_theme_constant_override("separation", 10)
	_display = UiKit.label("", 40, wt.text)
	_display.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_display.custom_minimum_size = Vector2(0, 64)
	_display.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	var frame := PanelContainer.new()
	var box := StyleBoxFlat.new()
	box.bg_color = wt.panel.lerp(wt.bg, 0.12)
	box.border_color = wt.accent
	box.set_border_width_all(2)
	box.set_corner_radius_all(12)
	box.set_content_margin_all(6)
	frame.add_theme_stylebox_override("panel", box)
	frame.add_child(_display)
	add_child(frame)
	_refresh()

	for row in (EXPRESSION_KEYS if mode == "expression" else NUMERIC_KEYS):
		var line := HBoxContainer.new()
		line.add_theme_constant_override("separation", 10)
		for key in row:
			var b := UiKit.button(key, 56.0)
			b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			if key == "OK":
				b.size_flags_stretch_ratio = 2.0
			elif key == "⌫":
				UiKit.style_secondary(b, wt)
			b.pressed.connect(_press.bind(key))
			line.add_child(b)
		add_child(line)


func _press(key: String) -> void:
	if _locked:
		return
	match key:
		"⌫":
			_text = _text.substr(0, _text.length() - 1)
		"OK":
			if _text.strip_edges() == "":
				return
			_locked = true
			submitted.emit(_text)
			return
		_:
			if _text.length() < MAX_LENGTH:
				_text += key
	_refresh()


func _refresh() -> void:
	_display.text = UiKit.pretty_math(_text) if _text != "" else "…"
	_display.modulate.a = 1.0 if _text != "" else 0.4


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
		_:
			var ch := char(key.unicode) if key.unicode > 0 else ""
			if ch != "" and ch in "0123456789,./+-*()^xX":
				_press({"-": "−", "*": "×", ".": ",", "X": "x"}.get(ch, ch))
			else:
				handled = false
	if handled:
		get_viewport().set_input_as_handled()
