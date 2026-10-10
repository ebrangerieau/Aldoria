extends Control
## Écran titre. La première interaction débloque le son (les navigateurs bloquent
## la lecture automatique) puis oriente : profil déjà connecté → combat ;
## sinon → choix du profil. `?scene=calibration` ouvre la scène de mesure.

var _wt := WorldTheme.jules()
var _hint: Label
var _started := false


func _ready() -> void:
	if Quality.option("scene") == "calibration":
		get_tree().change_scene_to_file.call_deferred("res://scenes/calibration/calibration.tscn")
		return
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = UiKit.make_theme(_wt)
	var bg := ColorRect.new()
	bg.color = _wt.bg
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)

	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var box := VBoxContainer.new()
	box.custom_minimum_size = Vector2(900, 0)  # largeur pour le retour à la ligne
	box.add_theme_constant_override("separation", 18)
	center.add_child(box)
	var title := UiKit.label("Les Chroniques d'Aldoria", 64, _wt.panel_border)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title)
	var subtitle := UiKit.label("Le royaume perd sa mémoire. Les Archives t'attendent.", 26, _wt.panel)
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(subtitle)
	_hint = UiKit.label("Touche l'écran pour commencer", 28, Color.WHITE)
	_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(_hint)
	_dev_autologin()
	var pulse := create_tween().set_loops()
	pulse.tween_property(_hint, "modulate:a", 0.35, 0.9)
	pulse.tween_property(_hint, "modulate:a", 1.0, 0.9)


## Développement, PC uniquement : `-- --autologin=<id profil> --pin=<code>`.
## Jamais sur le web (le code apparaîtrait dans l'URL).
func _dev_autologin() -> void:
	var profile_id := Quality.option("autologin")
	if profile_id == "" or OS.has_feature("web"):
		return
	_started = true
	var res := await Session.login(int(profile_id), Quality.option("pin"))
	if res.ok:
		res = await Session.start()
	if res.ok:
		get_tree().change_scene_to_file("res://scenes/combat/combat.tscn")
	else:
		_hint.text = "Connexion auto impossible : %s" % res.error.get("message", "")
		printerr("[Aldoria/dev] autologin : ", res.error)


func _gui_input(event: InputEvent) -> void:
	if (event is InputEventMouseButton or event is InputEventScreenTouch) and event.is_pressed():
		_start()


func _unhandled_key_input(event: InputEvent) -> void:
	if event.is_pressed():
		_start()


func _start() -> void:
	if _started:
		return
	_started = true
	Sfx.play("click")
	if not Session.is_logged_in():
		get_tree().change_scene_to_file("res://scenes/profile/profile_select.tscn")
		return
	_hint.text = "Bon retour, %s !" % Session.profile.get("name", "")
	var res := await Session.start()
	if res.ok:
		get_tree().change_scene_to_file("res://scenes/combat/combat.tscn")
	elif res.status == 401:
		Session.logout()  # jeton expiré : on redemande le code
		get_tree().change_scene_to_file("res://scenes/profile/profile_select.tscn")
	else:
		_hint.text = "%s Touche pour réessayer." % res.error.get("message", "")
		_started = false
