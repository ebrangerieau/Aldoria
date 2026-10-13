extends Node3D
## Village (phase 3) : une halle en deux salles, sans combat. Les habitants qui ont
## besoin d'aide portent un « ! » ; s'approcher ouvre le dialogue, puis une quête de
## trois questions (VillageDef : révision espacée, veille de contrôle, enquête sur un
## document). Une quête par habitant et par jour (SaveManager.quest_done).
##
## Le paquet de questions a été composé par le serveur au lancement
## (`Session.start("village", VillageDef.session_params())`).

const CAMERA := {"fov": 36.0, "distance": 21.0, "pitch": -50.0}
const CAMERA_SMOOTH := 5.0
const TALK_DISTANCE := 2.3
const TALK_REARM := 3.2
const GAME_MODE := "village"

var _def: VillageDef
var _wt: WorldTheme
var _level: DungeonLevel
var _hero: HeroController
var _camera: Camera3D
var _fx: CombatFx
var _hud: CombatHud
var _stick: TouchStick
var _npcs: Array[Dictionary] = []  # {spec, node: Fighter, marker: Label3D, armed}
var _busy := true
var _room := -1
var _target := Vector3.ZERO
var _today := ""
var _ending := false


func _ready() -> void:
	_wt = WorldTheme.for_world(Session.world())
	_def = VillageDef.for_level(Session.level())
	_today = DailyChallenge.today()
	QuestionService.reset()

	_level = DungeonLevel.new().use_theme(_wt).use_decor(_def.decor)
	add_child(_level)
	_level.build(_def.room_count())
	for i in _def.room_count():
		_level.open_door(i, false)

	_hero = HeroController.create(SaveManager.look(), _wt.hero_name, Progression.hero_max_hp(SaveManager.level()))
	add_child(_hero)
	_level.adapt_character(_hero)
	_hero.position = _level.room_origin(0) + Vector3(3, 0, 10)
	_hero.fighter.rotation_degrees.y = 90.0
	if _wt.companion:
		var pet := Companion.create(SaveManager.look())
		add_child(pet)
		_level.adapt_character(pet)
		pet.follow(_hero)

	_camera = Camera3D.new()
	_camera.far = 200.0
	_camera.fov = CAMERA["fov"]
	add_child(_camera)
	_camera.make_current()
	_fx = CombatFx.new()
	add_child(_fx)
	_fx.camera = _camera

	_hud = CombatHud.new()
	add_child(_hud)
	_hud.setup(_wt, _wt.hero_name)
	_hud.quit_requested.connect(_quit)
	_hud.show_actions(false)
	_hud.set_enemy_visible(false)
	_hud.set_hero_hp_visible(false)

	var stick_layer := CanvasLayer.new()
	stick_layer.layer = 5  # sous l'interface (layer 10) : les boutons gardent leurs appuis
	add_child(stick_layer)
	_stick = TouchStick.new()
	_stick.setup(_wt.accent)
	_stick.tapped.connect(_on_tap)
	stick_layer.add_child(_stick)
	SaveManager.changed.connect(_refresh_status)

	for spec in _def.npcs:
		_spawn_npc(spec)
	_target = _camera_target()
	_update_camera(0.0, true)
	_start()


func _start() -> void:
	if not _dev_npc():
		await _message(_def.title, _def.intro, "Entrer dans le village")
	_explore()


## Développement, PC uniquement : `-- --npc=<code>` place le héros devant cet habitant
## et accepte sa quête (captures d'écran d'un dialogue ou d'une quête).
func _dev_npc() -> bool:
	var wanted := Quality.option("npc")
	if wanted == "" or OS.has_feature("web"):
		return false
	for npc in _npcs:
		if npc["spec"]["code"] == wanted:
			_hero.position = npc["node"].position + Vector3(0, 0, 1.6)
	return true


# --- Habitants --------------------------------------------------------------------

func _spawn_npc(spec: Dictionary) -> void:
	var node := Fighter.create(spec["model"], spec["name"], 1, "Idle")
	var at: Vector2 = spec["at"]
	var room := int(spec["room"])
	node.position = _level.room_origin(room) + Vector3(at.x, 0, at.y)
	add_child(node)
	_level.adapt_character(node)
	_level.add_obstacle(room, Vector3(at.x, 0, at.y), 0.6)

	var name_label := _label3d(spec["name"], 40, Color.WHITE)
	name_label.position.y = 2.35
	node.add_child(name_label)
	var marker := _label3d("!", 120, Color("#ffd447"))
	marker.position.y = 3.1
	node.add_child(marker)
	var bob := marker.create_tween().set_loops()
	bob.tween_property(marker, "position:y", 3.3, 0.6).set_trans(Tween.TRANS_SINE)
	bob.tween_property(marker, "position:y", 3.1, 0.6).set_trans(Tween.TRANS_SINE)
	marker.visible = not SaveManager.quest_done(spec["code"], _today)
	_npcs.append({"spec": spec, "node": node, "marker": marker, "armed": true})


func _label3d(text: String, font_size: int, color: Color) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font_size = font_size
	l.pixel_size = 0.006
	l.modulate = color
	l.outline_size = 14
	l.outline_modulate = Color(0, 0, 0, 0.85)
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	return l


# --- Exploration --------------------------------------------------------------------

func _explore() -> void:
	_busy = false
	_hero.controls_enabled = true
	_stick.set_enabled(true)


func _pause_exploration() -> void:
	_busy = true
	_hero.controls_enabled = false
	_hero.stop()
	_stick.set_enabled(false)


func _process(delta: float) -> void:
	if not _busy:
		_hero.stick_vector = _stick.vector
		_update_room()
		_check_npcs()
		if Session.time_over():
			_session_end()
		elif Accessibility.pause_due():
			_pause_reminder()
		_target = _camera_target()
	_update_camera(delta)


func _update_room() -> void:
	var room := _level.room_at(_hero.position.x)
	if room == _room:
		return
	_room = room
	_level.set_active_room(room)
	_refresh_status()
	if room > 0:
		_hud.banner(_def.rooms[room]["title"], Color.WHITE, 1.0)


func _refresh_status() -> void:
	if _room < 0:
		return
	var xp := SaveManager.xp()
	_hud.set_status(_def.rooms[_room]["title"], "Niveau %d · %d XP" % [Progression.level_for_xp(xp), xp])


func _check_npcs() -> void:
	for npc in _npcs:
		var d := Vector2(_hero.position.x - npc["node"].position.x, _hero.position.z - npc["node"].position.z).length()
		if not npc["armed"]:
			npc["armed"] = d > TALK_REARM  # s'éloigner pour reparler
		elif d < TALK_DISTANCE:
			_talk(npc)
			return


func _on_tap(screen_position: Vector2) -> void:
	if _busy:
		return
	var origin := _camera.project_ray_origin(screen_position)
	var direction := _camera.project_ray_normal(screen_position)
	if direction.y > -0.01:
		return
	var point := origin + direction * (-origin.y / direction.y)
	_hero.go_to(_level.path(_hero.position, point))
	_fx.burst(point + Vector3(0, 0.15, 0), _wt.accent, 10, 1.5)


# --- Dialogue et quête ----------------------------------------------------------------

func _talk(npc: Dictionary) -> void:
	_pause_exploration()
	npc["armed"] = false
	var spec: Dictionary = npc["spec"]
	var node: Fighter = npc["node"]
	_hero.fighter.look_at(Vector3(node.global_position.x, _hero.fighter.global_position.y, node.global_position.z), Vector3.UP, true)
	node.look_at(Vector3(_hero.global_position.x, node.global_position.y, _hero.global_position.z), Vector3.UP, true)
	node.play(["Interact", "Cheer"])
	if SaveManager.quest_done(spec["code"], _today):
		await _message(spec["name"], "Merci encore pour ton aide ! Reviens demain : j'aurai sûrement de nouveau besoin de toi.", "À demain !")
		_explore()
		return
	var accepted := await _ask(spec["name"], _ask_text(spec))
	if accepted:
		await _run_quest(npc)
	_explore()


## Texte de la demande ; la veille de contrôle nomme le chapitre choisi par le parent.
func _ask_text(spec: Dictionary) -> String:
	if spec["quest"] != "veille":
		return spec["ask"]
	var soon: Array = Session.context.get("test_soon", [])
	if not soon.is_empty():
		return "Ton contrôle sur « %s » approche, n'est-ce pas ? Entraînons-nous ensemble, tu seras prêt." % soon[0]["title"]
	var current: Array = Session.context.get("current", [])
	if not current.is_empty():
		return "En classe, tu travailles « %s » en ce moment. Voyons si tout est clair." % current[0]["title"]
	return spec["ask"]


func _veille_chapters() -> Array:
	var chosen: Array = Session.context.get("test_soon", [])
	if chosen.is_empty():
		chosen = Session.context.get("current", [])
	return chosen.map(func(c: Dictionary) -> String: return c["code"])


func _run_quest(npc: Dictionary) -> void:
	var spec: Dictionary = npc["spec"]
	var chapters := _veille_chapters()
	var correct := 0
	for i in VillageDef.QUEST_SIZE:
		var item := QuestionService.next_quest_item(spec["quest"], spec.get("generator", ""), chapters)
		if item.is_empty():
			await _message(spec["name"], "Hum… mes papiers sont restés à l'abri. Reviens quand le royaume sera de nouveau connecté.", "D'accord")
			return
		var panel := QuestionPanel.new()
		panel.setup(item, "%s · %d / %d" % [spec["title"], i + 1, VillageDef.QUEST_SIZE], _wt)
		_hud.show_panel(panel)
		var res: Array = await panel.answered
		var result := QuestionService.submit(item, res[0], res[1], res[2], GAME_MODE)
		panel.reveal(result.correct)
		if result.correct:
			correct += 1
			Sfx.play("correct")
			_hud.banner(_wt.encouragements.pick_random(), _wt.good, 0.8)
			await get_tree().create_timer(1.1).timeout
			_hud.clear_panel()
		else:
			Sfx.play("wrong")
			await get_tree().create_timer(0.9).timeout
			_hud.clear_panel()
			var explanation := ExplanationPanel.new()
			explanation.setup(item, _wt)
			_hud.show_panel(explanation)
			await explanation.closed
			_hud.clear_panel()
	var xp := VillageDef.QUEST_XP + VillageDef.ANSWER_XP * correct
	SaveManager.add_xp(xp)
	SaveManager.record_quest(spec["code"], _today)
	(npc["marker"] as Label3D).visible = false
	var node: Fighter = npc["node"]
	node.play(["Cheer", "Interact"])
	Sfx.play("victory")
	_fx.rising_sparkles(node.global_position + Vector3(0, 0.8, 0), Color("#ffd447"))
	await _message(spec["name"], "%s\n%d bonne%s réponse%s sur %d. +%d XP" % [
		spec["thanks"], correct, "s" if correct > 1 else "", "s" if correct > 1 else "", VillageDef.QUEST_SIZE, xp], "Avec plaisir !")


## Demande d'un habitant : vrai si le joueur accepte la quête.
func _ask(title: String, body: String) -> bool:
	var panel := UiKit.message_panel(_wt, title, body, "Je t'aide !")
	var box: VBoxContainer = (panel[0] as PanelContainer).get_child(0)
	var later := UiKit.button("Plus tard", 56.0)
	UiKit.style_secondary(later, _wt)
	box.add_child(later)
	_hud.show_panel(panel[0])
	var choice: Array = []
	(panel[1] as Button).pressed.connect(func() -> void: choice.append(true))
	later.pressed.connect(func() -> void: choice.append(false))
	if _dev_accepts():
		choice.append(true)
	while choice.is_empty():
		await get_tree().process_frame
	_hud.clear_panel()
	return choice[0]


func _dev_accepts() -> bool:
	return Quality.option("npc") != "" and not OS.has_feature("web")


# --- Caméra ---------------------------------------------------------------------------

func _camera_target() -> Vector3:
	var length := _def.room_count() * DungeonLevel.ROOM_W
	return Vector3(clampf(_hero.position.x, 8.0, length - 8.0), 0, clampf(_hero.position.z, 6.0, 12.0))


func _update_camera(delta: float, snap := false) -> void:
	var current := _camera.position - _camera_offset()
	var k := 1.0 if snap else 1.0 - exp(-CAMERA_SMOOTH * delta)
	_camera.position = current.lerp(_target, k) + _camera_offset()
	_camera.rotation = Vector3(deg_to_rad(CAMERA["pitch"]), 0, 0)


func _camera_offset() -> Vector3:
	var pitch := deg_to_rad(CAMERA["pitch"])
	return Vector3(0, -sin(pitch) * CAMERA["distance"], cos(pitch) * CAMERA["distance"])


# --- Fin --------------------------------------------------------------------------------

func _message(title: String, body: String, button_text: String) -> void:
	var panel := UiKit.message_panel(_wt, title, body, button_text)
	_hud.show_panel(panel[0])
	await (panel[1] as Button).pressed
	_hud.clear_panel()


## Rappel de pause (bien-être) : l'enfant continue ou rentre au camp.
func _pause_reminder() -> void:
	_pause_exploration()
	var panel := UiKit.pause_panel(_wt)
	_hud.show_panel(panel[0])
	var choice: Array = []
	(panel[1] as Button).pressed.connect(func() -> void: choice.append("continuer"))
	(panel[2] as Button).pressed.connect(func() -> void: choice.append("pause"))
	while choice.is_empty():
		await get_tree().process_frame
	_hud.clear_panel()
	if choice[0] == "pause":
		_quit()
		return
	Accessibility.snooze_pause()
	_explore()


func _session_end() -> void:
	if _ending:
		return
	_ending = true
	_pause_exploration()
	await _message("Belle session !", Session.rest_text(), "Terminer")
	_quit()


func _quit() -> void:
	_pause_exploration()
	_hud.clear_panel()
	await Session.end()
	get_tree().change_scene_to_file("res://scenes/hub/hub.tscn")
