extends Control
## Choix du profil puis code PIN (PRD US-01 : retrouver sa partie sans mot de
## passe compliqué). Les profils sont créés par le parent (CLI, puis éditeur en phase 2).

const PIN_LENGTH := 4

var _wt := WorldTheme.jules()
var _root: VBoxContainer
var _message: Label
var _profile: Dictionary
var _pin := ""
var _dots: Label
var _busy := false


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_build_frame()
	_load_profiles()


func _build_frame() -> void:
	for child in get_children():
		child.queue_free()
	theme = UiKit.make_theme(_wt)
	var bg := ColorRect.new()
	bg.color = _wt.bg
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(620, 0)
	center.add_child(panel)
	_root = VBoxContainer.new()
	_root.add_theme_constant_override("separation", 16)
	panel.add_child(_root)


func _load_profiles() -> void:
	_root.add_child(_title("Qui part à l'aventure ?"))
	_message = UiKit.label("Chargement…", 22, _wt.text_dim)
	_root.add_child(_message)
	var res := await ApiClient.get_json("/play/profiles", false)
	if not res.ok:
		_message.text = res.error.get("message", "Erreur.")
		var retry := UiKit.button("Réessayer")
		retry.pressed.connect(func() -> void:
			_build_frame()
			_load_profiles())
		_root.add_child(retry)
		return
	_message.text = ""
	for p in res.data:
		var label := "%s   ·   %s" % [p["name"], "6ème" if p["level"] == "6e" else "Seconde"]
		var b := UiKit.button(label, 88.0)
		b.add_theme_font_size_override("font_size", UiKit.font_size(32))
		b.pressed.connect(_choose.bind(p))
		_root.add_child(b)


func _choose(profile: Dictionary) -> void:
	_profile = profile
	_wt = WorldTheme.for_world(profile["world"])
	_pin = ""
	_build_frame()
	_root.add_child(_title("Code secret de %s" % profile["name"]))
	_dots = UiKit.label("", 56, _wt.accent)
	_dots.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_root.add_child(_dots)
	_message = UiKit.label("", 22, _wt.bad)
	_message.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_root.add_child(_message)
	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	for key in ["1", "2", "3", "4", "5", "6", "7", "8", "9", "Retour", "0", "Effacer"]:
		var b := UiKit.button(key, 72.0)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		if key.length() > 1:
			UiKit.style_secondary(b, _wt)
		else:
			b.add_theme_font_size_override("font_size", UiKit.font_size(34))
		b.pressed.connect(_key.bind(key))
		grid.add_child(b)
	_root.add_child(grid)
	_refresh_dots()


func _key(key: String) -> void:
	if _busy:
		return
	match key:
		"Retour":
			_wt = WorldTheme.jules()
			_build_frame()
			_load_profiles()
		"Effacer":
			_pin = _pin.substr(0, _pin.length() - 1)
			_refresh_dots()
		_:
			if _pin.length() < PIN_LENGTH:
				_pin += key
				_refresh_dots()
				if _pin.length() == PIN_LENGTH:
					_submit()


func _unhandled_key_input(event: InputEvent) -> void:
	var key := event as InputEventKey
	if key == null or not key.pressed or _dots == null:
		return
	if key.keycode >= KEY_0 and key.keycode <= KEY_9:
		_key(str(key.keycode - KEY_0))
	elif key.keycode >= KEY_KP_0 and key.keycode <= KEY_KP_9:
		_key(str(key.keycode - KEY_KP_0))
	elif key.keycode == KEY_BACKSPACE:
		_key("Effacer")


func _submit() -> void:
	_busy = true
	_message.text = ""
	var res := await Session.login(int(_profile["id"]), _pin)
	if res.ok:
		_message.add_theme_color_override("font_color", _wt.good)
		_message.text = "C'est parti !"
		get_tree().change_scene_to_file("res://scenes/hub/hub.tscn")
		return
	_message.add_theme_color_override("font_color", _wt.bad)
	match res.error.get("code", ""):
		"wrong_pin":
			var left := int(res.error.get("details", {}).get("remaining_attempts", 0))
			_message.text = "Code incorrect. Encore %d essai%s." % [left, "s" if left > 1 else ""]
			Sfx.play("wrong")
		"locked":
			var wait := int(res.error.get("details", {}).get("retry_after_s", 300))
			_message.text = "Trop d'essais : attends %d minute%s." % [ceili(wait / 60.0), "s" if wait > 60 else ""]
		_:
			_message.text = res.error.get("message", "Erreur.")
	_pin = ""
	_refresh_dots()
	_busy = false


func _refresh_dots() -> void:
	var dots := PackedStringArray()
	for i in PIN_LENGTH:
		dots.append("●" if i < _pin.length() else "○")
	_dots.text = " ".join(dots)


func _title(text: String) -> Label:
	var l := UiKit.label(text, 34, _wt.accent)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return l
