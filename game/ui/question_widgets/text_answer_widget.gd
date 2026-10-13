class_name TextAnswerWidget
extends VBoxContainer
## Réponse écrite (mot, courte expression) : clavier AZERTY à l'écran, grandes touches,
## et clavier du PC. Comme le pavé numérique : pas de clavier virtuel du système, qui
## masquerait la question sur tablette. Les lettres accentuées ne sont proposées que
## quand elles comptent (orthographe) ; la comparaison ignore casse, espaces et point
## final (AnswerChecker.normalize_text).

signal submitted(value: Variant)

const ROWS := [
	["a", "z", "e", "r", "t", "y", "u", "i", "o", "p"],
	["q", "s", "d", "f", "g", "h", "j", "k", "l", "m"],
	["w", "x", "c", "v", "b", "n", "'", "-", "⌫"],
]
const ACCENT_ROW := ["é", "è", "ê", "à", "â", "ç", "ù", "û", "ô", "î", "ï", "œ"]
const MAX_LENGTH := 60

var _text := ""
var _display: Label
var _locked := false


func setup(wt: WorldTheme, accents := true) -> void:
	add_theme_constant_override("separation", 8)
	_display = UiKit.label("", 34, wt.text)
	_display.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_display.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_display.custom_minimum_size = Vector2(0, 60)
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

	var rows: Array = ROWS.duplicate()
	if accents:
		rows.append(ACCENT_ROW)
	for row: Array in rows:
		var line := HBoxContainer.new()
		line.add_theme_constant_override("separation", 6)
		for key: String in row:
			line.add_child(_key(key, wt))
		add_child(line)
	var last := HBoxContainer.new()
	last.add_theme_constant_override("separation", 6)
	var space := _key("espace", wt)
	space.size_flags_stretch_ratio = 4.0
	last.add_child(space)
	var ok := _key("OK", wt)
	ok.size_flags_stretch_ratio = 2.0
	last.add_child(ok)
	add_child(last)
	_refresh()


func _key(key: String, wt: WorldTheme) -> Button:
	var b := UiKit.button(key, 52.0)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.custom_minimum_size.x = 0
	b.add_theme_font_size_override("font_size", UiKit.font_size(24))
	if key in ["⌫", "espace"]:
		UiKit.style_secondary(b, wt)
	b.pressed.connect(press.bind(key))
	return b


func press(key: String) -> void:
	if _locked:
		return
	match key:
		"⌫":
			_text = _text.substr(0, _text.length() - 1)
		"OK":
			if _text.strip_edges() == "":
				return
			_locked = true
			submitted.emit(_text.strip_edges())
			return
		"espace":
			if _text != "" and not _text.ends_with(" ") and _text.length() < MAX_LENGTH:
				_text += " "
		_:
			if _text.length() < MAX_LENGTH:
				_text += key
	_refresh()


func text() -> String:
	return _text


func _refresh() -> void:
	_display.text = _text if _text != "" else "…"
	_display.modulate.a = 1.0 if _text != "" else 0.4


func _unhandled_key_input(event: InputEvent) -> void:
	var key := event as InputEventKey
	if key == null or not key.pressed or _locked:
		return
	match key.keycode:
		KEY_BACKSPACE:
			press("⌫")
		KEY_ENTER, KEY_KP_ENTER:
			press("OK")
		KEY_SPACE:
			press("espace")
		_:
			if key.unicode <= 0:
				return
			var ch := char(key.unicode).to_lower()
			# Lettres (y compris accentuées), apostrophe et trait d'union.
			if ch == "'" or ch == "-" or ch == "’" or ch.to_upper() != ch:
				press("'" if ch == "’" else ch)
			else:
				return
	get_viewport().set_input_as_handled()
