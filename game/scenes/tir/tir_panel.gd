class_name TirPanel
extends PanelContainer
## Panneau de visée du stand de tir, compact pour laisser voir la scène : l'angle (Jules) ou le
## coefficient directeur en fraction (Tom), le bouton « Tirer », un indice et le retour du tir.

signal fired(value: String)

var item: Dictionary
var mode := "angle"  # "angle" (rapporteur) ou "droite" (arbalète)
var _wt: WorldTheme
var _value := 0
var _numerator := 1
var _denominator := 1
var _step := 10
var _shown: Label
var _shown_den: Label
var _fire: Button
var _feedback: Label
var _locked := false
var hint_used := false


func setup(question: Dictionary, wt: WorldTheme, heading: String) -> TirPanel:
	item = question
	_wt = wt
	var visual: Dictionary = question.get("visual", {})
	mode = "droite" if str(visual.get("kind", "")) == "repere_tir" else "angle"
	_step = int(visual.get("minor", 10))
	theme = UiKit.make_theme(wt)
	custom_minimum_size = Vector2(1100, 0)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8)
	add_child(column)

	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 12)
	var title := UiKit.title(heading, 24, wt.accent)
	title.autowrap_mode = TextServer.AUTOWRAP_OFF
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(title)
	if Accessibility.can_speak():
		top.add_child(UiKit.listen_button(wt, str(question.get("prompt", "")), Accessibility.auto_read()))
	var hint := UiKit.icon_button("Indice", "light-bulb", 52.0)
	UiKit.style_secondary(hint, wt)
	hint.pressed.connect(_show_hint)
	top.add_child(hint)
	column.add_child(top)
	column.add_child(UiKit.label(str(question.get("prompt", "")), 22))

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	if mode == "angle":
		row.add_child(_inline("Angle :", 26))
		_shown = _stepper(row, _change_angle, 96)
	else:
		row.add_child(_inline("a =", 26))
		_shown = _stepper(row, _change_num, 64)
		row.add_child(_inline("/", 30))
		_shown_den = _stepper(row, _change_den, 48)
	_fire = UiKit.icon_button("Tirer", "round-star", 64.0)
	_fire.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_fire.pressed.connect(_on_fire)
	row.add_child(_fire)
	column.add_child(row)

	_feedback = UiKit.label("", 22, wt.text)
	column.add_child(_feedback)
	_refresh()
	return self


## « − », le nombre, « + » ; renvoie l'étiquette du nombre.
func _stepper(row: HBoxContainer, change: Callable, width: int) -> Label:
	var minus := UiKit.button("−", 64.0)
	minus.custom_minimum_size.x = 64
	minus.pressed.connect(change.bind(-1))
	row.add_child(minus)
	var shown := _inline("", 34, _wt.accent)
	shown.custom_minimum_size.x = width
	shown.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	row.add_child(shown)
	var plus := UiKit.button("+", 64.0)
	plus.custom_minimum_size.x = 64
	plus.pressed.connect(change.bind(1))
	row.add_child(plus)
	return shown


static func _inline(text: String, size: int, color := Color(0, 0, 0, 0)) -> Label:
	var l := UiKit.label(text, size, color)
	l.autowrap_mode = TextServer.AUTOWRAP_OFF  # dans une rangée
	l.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	return l


func _change_angle(direction: int) -> void:
	_value = clampi(_value + direction * _step, 0, 180)
	_refresh()


func _change_num(direction: int) -> void:
	_numerator = clampi(_numerator + direction, -12, 12)
	_refresh()


func _change_den(direction: int) -> void:
	_denominator = clampi(_denominator + direction, 1, 6)
	_refresh()


func _refresh() -> void:
	if mode == "angle":
		_shown.text = "%d°" % _value
	else:
		_shown.text = str(_numerator)
		_shown_den.text = str(_denominator)


## Valeur visée, telle qu'enregistrée : « 70 », « -3/4 », « 2 ».
func value() -> String:
	if mode == "angle":
		return str(_value)
	return str(_numerator) if _denominator == 1 else "%d/%d" % [_numerator, _denominator]


func set_aim(v: int, numerator := 1, denominator := 1) -> void:
	_value = v
	_numerator = numerator
	_denominator = denominator
	_refresh()


func _on_fire() -> void:
	if not _locked:
		fired.emit(value())


func lock(locked: bool) -> void:
	_locked = locked
	_fire.disabled = locked


func say(text: String, ok: bool) -> void:
	_feedback.add_theme_color_override("font_color", _wt.good_ink if ok else _wt.bad_ink)
	_feedback.text = text


func _show_hint() -> void:
	hint_used = true
	_feedback.add_theme_color_override("font_color", _wt.text)
	_feedback.text = str(item.get("hint", ""))


func _nudge(direction: int) -> void:
	if mode == "angle":
		_change_angle(direction)
	else:
		_change_num(direction)


func _unhandled_key_input(event: InputEvent) -> void:
	# Clavier du PC : flèches pour viser, Entrée pour tirer.
	var key := event as InputEventKey
	if key == null or not key.pressed or _locked:
		return
	match key.keycode:
		KEY_UP, KEY_RIGHT:
			_nudge(1)
		KEY_DOWN, KEY_LEFT:
			_nudge(-1)
		KEY_ENTER, KEY_KP_ENTER:
			_on_fire()
		_:
			return
	get_viewport().set_input_as_handled()
