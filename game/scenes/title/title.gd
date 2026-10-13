extends Control
## Écran titre. La première interaction débloque le son (les navigateurs bloquent
## la lecture automatique). Sans joueur connecté : toucher l'écran → choix du profil.
## Joueur déjà connecté (appareil partagé) : « Continuer avec X » ou « Changer de
## joueur » ; toucher le fond ne lance rien, pour qu'un frère n'entre pas dans la
## partie de l'autre. `?scene=calibration` ouvre la scène de mesure.

var _wt := WorldTheme.lumineux()
var _hint: Label
var _started := false


func _ready() -> void:
	if Quality.option("scene") == "calibration":
		get_tree().change_scene_to_file.call_deferred("res://scenes/calibration/calibration.tscn")
		return
	# Développement, PC uniquement (les paquets de test ne sont pas exportés).
	if Quality.option("scene") == "questions" and not OS.has_feature("web"):
		get_tree().change_scene_to_file.call_deferred("res://scenes/dev/question_gallery.tscn")
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
	if Session.is_logged_in():
		_build_returning_player(box)
	else:
		var pulse := create_tween().set_loops()
		pulse.tween_property(_hint, "modulate:a", 0.35, 0.9)
		pulse.tween_property(_hint, "modulate:a", 1.0, 0.9)
	_dev_autologin()


func _build_returning_player(box: VBoxContainer) -> void:
	var player_name: String = Session.profile.get("name", "")
	_hint.text = "Content de te revoir, %s !" % player_name
	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	buttons.add_theme_constant_override("separation", 20)
	var resume := UiKit.button("Continuer avec %s" % player_name, 80.0)
	resume.custom_minimum_size.x = 360
	resume.pressed.connect(_continue)
	buttons.add_child(resume)
	var switch := UiKit.button("Changer de joueur", 80.0)
	switch.custom_minimum_size.x = 300
	UiKit.style_secondary(switch, _wt)
	switch.pressed.connect(_switch_player)
	buttons.add_child(switch)
	box.add_child(buttons)


## Développement, PC uniquement : `-- --autologin=<id profil> --pin=<code>`
## (puis `--goto=donjon|arene|archives`, voir le camp) ; `--pair=<code à 8 chiffres>`
## relie d'abord ce PC à la famille (`python -m app.cli pairing-code`). Jamais sur le
## web (le code apparaîtrait dans l'URL).
func _dev_autologin() -> void:
	var profile_id := Quality.option("autologin")
	if profile_id == "" or OS.has_feature("web"):
		return
	_started = true
	if Quality.option("pair") != "":
		var paired := await ApiClient.pair(Quality.option("pair"))
		if not paired.ok:
			printerr("[Aldoria/dev] pair : ", paired.error)
	var res := await Session.login(int(profile_id), Quality.option("pin"))
	if res.ok:
		get_tree().change_scene_to_file("res://scenes/hub/hub.tscn")
	else:
		_hint.text = "Connexion auto impossible : %s" % res.error.get("message", "")
		printerr("[Aldoria/dev] autologin : ", res.error)


func _gui_input(event: InputEvent) -> void:
	if (event is InputEventMouseButton or event is InputEventScreenTouch) and event.is_pressed():
		_choose_player()


func _unhandled_key_input(event: InputEvent) -> void:
	if event.is_pressed():
		_choose_player()


## Sans joueur connecté : toucher l'écran mène au choix du profil.
func _choose_player() -> void:
	if _started or Session.is_logged_in():
		return
	_started = true
	Sfx.play("click")
	get_tree().change_scene_to_file("res://scenes/profile/profile_select.tscn")


func _switch_player() -> void:
	if _started:
		return
	_started = true
	_hint.text = "À tout bientôt, %s !" % Session.profile.get("name", "")
	await Session.logout()
	get_tree().change_scene_to_file("res://scenes/profile/profile_select.tscn")


func _continue() -> void:
	if _started:
		return
	_started = true
	_hint.text = "C'est reparti !"
	get_tree().change_scene_to_file("res://scenes/hub/hub.tscn")
