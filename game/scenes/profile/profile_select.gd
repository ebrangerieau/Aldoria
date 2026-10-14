extends Control
## Choix du profil puis code PIN (PRD US-01 : retrouver sa partie sans mot de passe
## compliqué). Les enfants sont ceux de la famille de l'appareil : un appareil pas
## encore relié (ou retiré par un parent) demande d'abord le code de liaison à
## 8 chiffres créé dans l'espace parent (Famille → Appareils).

const PIN_LENGTH := 4
const PAIRING_LENGTH := 8

var _wt := WorldTheme.lumineux()
var _root: VBoxContainer
var _message: Label
var _profile: Dictionary
var _digits := ""
var _length := PIN_LENGTH
var _pairing := false  # saisie du code de liaison (chiffres visibles) plutôt que du PIN
var _dots: Label
var _busy := false


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_build_frame()
	_load_profiles()


func _build_frame() -> void:
	for child in get_children():
		child.queue_free()
	_dots = null
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
	if not res.ok and res.status == 401:
		ApiClient.forget_device()
		_show_pairing()
		return
	if not res.ok:
		_message.text = res.error.get("message", "Erreur.")
		var retry := UiKit.button("Réessayer")
		retry.pressed.connect(func() -> void:
			_build_frame()
			_load_profiles())
		_root.add_child(retry)
		return
	_message.text = "" if not res.data.is_empty() else \
		"Aucun enfant dans cette famille pour l'instant : un parent peut en ajouter dans l'espace parent (onglet Famille)."
	for p in res.data:
		var label := "%s   ·   %s" % [p["name"], p.get("level_label", p["level"])]
		var b := UiKit.button(label, 88.0)
		b.add_theme_font_size_override("font_size", UiKit.font_size(32))
		b.pressed.connect(_choose.bind(p))
		_root.add_child(b)


## Appareil pas encore relié : le code à 8 chiffres de l'espace parent.
func _show_pairing() -> void:
	_wt = WorldTheme.lumineux()
	_pairing = true
	_build_frame()
	_root.add_child(_title("Relier cet appareil"))
	var help := UiKit.label("Demande à un parent le code à 8 chiffres : espace parent, onglet Famille, Appareils.", 22, _wt.text)
	help.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_root.add_child(help)
	_keypad(PAIRING_LENGTH, false)


func _choose(profile: Dictionary) -> void:
	_profile = profile
	_wt = WorldTheme.for_world(profile["world"])
	_pairing = false
	_build_frame()
	_root.add_child(_title("Code secret de %s" % profile["name"]))
	_keypad(PIN_LENGTH, true)


## Pavé numérique (PIN ou code de liaison) ; « Retour » ne sert qu'au PIN.
func _keypad(length: int, with_back: bool) -> void:
	_length = length
	_digits = ""
	_dots = UiKit.label("", 56 if length == PIN_LENGTH else 48, _wt.accent)
	_dots.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_root.add_child(_dots)
	_message = UiKit.label("", 22, _wt.bad)
	_message.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_root.add_child(_message)
	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	for key in ["1", "2", "3", "4", "5", "6", "7", "8", "9", "Retour" if with_back else "", "0", "Effacer"]:
		if key == "":
			grid.add_child(Control.new())
			continue
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
			_wt = WorldTheme.lumineux()
			_build_frame()
			_load_profiles()
		"Effacer":
			_digits = _digits.substr(0, _digits.length() - 1)
			_refresh_dots()
		_:
			if _digits.length() < _length:
				_digits += key
				_refresh_dots()
				if _digits.length() == _length and _pairing:
					_submit_pairing()
				elif _digits.length() == _length:
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


func _submit_pairing() -> void:
	_busy = true
	_message.text = ""
	var res := await ApiClient.pair(_digits)
	_busy = false
	if res.ok:
		_pairing = false
		_build_frame()
		_load_profiles()
		return
	_message.add_theme_color_override("font_color", _wt.bad)
	_message.text = res.error.get("message", "Erreur.")
	Sfx.play("wrong")
	_digits = ""
	_refresh_dots()


func _submit() -> void:
	_busy = true
	_message.text = ""
	var res := await Session.login(int(_profile["id"]), _digits)
	if res.ok:
		_message.add_theme_color_override("font_color", _wt.good)
		_message.text = "C'est parti !"
		get_tree().change_scene_to_file(Departure.MAP_SCENE)
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
		"device_unknown":
			_busy = false
			ApiClient.forget_device()
			_show_pairing()
			return
		_:
			_message.text = res.error.get("message", "Erreur.")
	_digits = ""
	_refresh_dots()
	_busy = false


func _refresh_dots() -> void:
	if _pairing:
		# Code de liaison : chiffres visibles, groupés par 4 comme dans l'espace parent.
		var shown := ""
		for i in _length:
			shown += _digits[i] if i < _digits.length() else "_"
			if i == 3:
				shown += "  "
		_dots.text = shown
		return
	var dots := PackedStringArray()
	for i in _length:
		dots.append("●" if i < _digits.length() else "○")
	_dots.text = " ".join(dots)


func _title(text: String) -> Label:
	var l := UiKit.label(text, 34, _wt.accent)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return l
