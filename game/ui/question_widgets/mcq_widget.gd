class_name McqWidget
extends GridContainer
## QCM (2 à 4 choix). Émet `submitted(index)` au premier appui.

signal submitted(value: Variant)

var _locked := false


func setup(choices: Array) -> void:
	var short := choices.all(func(c: String) -> bool: return c.length() <= 3)
	columns = choices.size() if short else 2
	add_theme_constant_override("h_separation", 14)
	add_theme_constant_override("v_separation", 14)
	for i in choices.size():
		var b := UiKit.button(UiKit.pretty_math(str(choices[i])), 72.0)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		if short:
			b.add_theme_font_size_override("font_size", UiKit.font_size(40))
		b.pressed.connect(_choose.bind(i))
		add_child(b)


## Plume du sage : `count` mauvaises propositions disparaissent (au hasard).
func remove_wrong(correct: int, count: int) -> void:
	var wrong := range(get_child_count()).filter(func(i: int) -> bool:
		return i != correct and not (get_child(i) as Button).disabled)
	wrong.shuffle()
	for i in wrong.slice(0, count):
		var b := get_child(i) as Button
		b.disabled = true
		b.modulate.a = 0.25


func _choose(index: int) -> void:
	if _locked:
		return
	_locked = true
	submitted.emit(index)


func _unhandled_key_input(event: InputEvent) -> void:
	# Clavier du PC : touches 1 à 4.
	var key := event as InputEventKey
	if key and key.pressed and key.keycode >= KEY_1 and key.keycode < KEY_1 + get_child_count():
		_choose(key.keycode - KEY_1)
		get_viewport().set_input_as_handled()
