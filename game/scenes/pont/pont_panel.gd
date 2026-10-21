class_name PontPanel
extends PanelContainer
## Panneau du pont des fractions, compact pour laisser voir le ravin : une touche par sorte de
## planche (sa couleur, sa longueur à l'échelle, ce qui reste), le choix en cours, « Retirer »,
## « Poser le pont », un indice et le retour de l'essai.

signal changed(lengths: Array)
signal built(lengths: Array)

var item: Dictionary
var hint_used := false
var _wt: WorldTheme
var _stock: Array = []  # [{length, count}] de la réserve
var _chosen: Array = []  # longueurs choisies, dans l'ordre de pose
var _buttons: Array[Button] = []
var _choice: Label
var _undo: Button
var _build: Button
var _feedback: Label
var _locked := false


func setup(question: Dictionary, wt: WorldTheme, heading: String) -> PontPanel:
	item = question
	_wt = wt
	var visual: Dictionary = question.get("visual", {})
	_stock = (visual.get("planks", []) as Array).duplicate(true)
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

	var planks := HBoxContainer.new()
	planks.add_theme_constant_override("separation", 8)
	planks.alignment = BoxContainer.ALIGNMENT_CENTER
	for i in _stock.size():
		var length := str(_stock[i]["length"])
		var b := UiKit.button("", 64.0)
		b.icon = plank_icon(length)
		# Couleurs vraies de la planche (le thème teinte les icônes à la couleur du texte).
		for state in ["icon_normal_color", "icon_hover_color", "icon_pressed_color", "icon_hover_pressed_color", "icon_focus_color"]:
			b.add_theme_color_override(state, Color.WHITE)
		b.add_theme_color_override("icon_disabled_color", Color(1, 1, 1, 0.35))
		b.custom_minimum_size.x = 150
		b.pressed.connect(_take.bind(i))
		planks.add_child(b)
		_buttons.append(b)
	column.add_child(planks)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	_choice = UiKit.label("", 24, wt.text)
	_choice.autowrap_mode = TextServer.AUTOWRAP_OFF
	_choice.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_choice.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(_choice)
	_undo = UiKit.icon_button("Retirer", "cancel", 60.0)
	UiKit.style_secondary(_undo, wt)
	_undo.pressed.connect(_put_back)
	row.add_child(_undo)
	_build = UiKit.icon_button("Poser le pont", "arch-bridge", 60.0)
	_build.pressed.connect(_on_build)
	row.add_child(_build)
	column.add_child(row)

	_feedback = UiKit.label("", 22, wt.text)
	column.add_child(_feedback)
	_refresh()
	return self


## Planche dessinée à l'échelle (une perche = 120 px), de la couleur de son dénominateur.
static func plank_icon(length: String) -> Texture2D:
	var f := ChasmBridge.parse(length)
	var w := maxi(12, roundi(120.0 * f.x / f.y))
	var image := Image.create(w, 20, false, Image.FORMAT_RGBA8)
	image.fill(ChasmBridge.color_for(length).darkened(0.35))
	image.fill_rect(Rect2i(2, 2, w - 4, 16), ChasmBridge.color_for(length))
	return ImageTexture.create_from_image(image)


func _remaining(i: int) -> int:
	var length := str(_stock[i]["length"])
	return int(_stock[i]["count"]) - _chosen.count(length)


func _refresh() -> void:
	for i in _buttons.size():
		var left := _remaining(i)
		_buttons[i].text = "%s  ×%d" % [_stock[i]["length"], left]
		_buttons[i].disabled = _locked or left <= 0
	_choice.text = "Ton pont : " + (" + ".join(_chosen) if not _chosen.is_empty() else "aucune planche")
	_undo.disabled = _locked or _chosen.is_empty()
	_build.disabled = _locked or _chosen.is_empty()


func _take(i: int) -> void:
	if _locked or _remaining(i) <= 0:
		return
	_chosen.append(str(_stock[i]["length"]))
	Sfx.play("click")
	_refresh()
	changed.emit(_chosen.duplicate())


func _put_back() -> void:
	if _locked or _chosen.is_empty():
		return
	_chosen.pop_back()
	_refresh()
	changed.emit(_chosen.duplicate())


## Choix en cours (développement, tests) : remplace les planches choisies.
func choose(lengths: Array) -> void:
	_chosen = lengths.duplicate()
	_refresh()
	changed.emit(_chosen.duplicate())


func chosen() -> Array:
	return _chosen.duplicate()


func _on_build() -> void:
	if not _locked and not _chosen.is_empty():
		built.emit(_chosen.duplicate())


func lock(locked: bool) -> void:
	_locked = locked
	_refresh()


func say(text: String, ok: bool) -> void:
	_feedback.add_theme_color_override("font_color", _wt.good_ink if ok else _wt.bad_ink)
	_feedback.text = text


func _show_hint() -> void:
	hint_used = true
	_feedback.add_theme_color_override("font_color", _wt.text)
	_feedback.text = str(item.get("hint", ""))


func _unhandled_key_input(event: InputEvent) -> void:
	# Clavier du PC : 1, 2, 3… prennent une planche, Retour arrière la remet, Entrée pose le pont.
	var key := event as InputEventKey
	if key == null or not key.pressed or _locked:
		return
	if key.keycode >= KEY_1 and key.keycode < KEY_1 + _buttons.size():
		_take(key.keycode - KEY_1)
	elif key.keycode == KEY_BACKSPACE:
		_put_back()
	elif key.keycode in [KEY_ENTER, KEY_KP_ENTER]:
		_on_build()
	else:
		return
	get_viewport().set_input_as_handled()
