class_name TirScene
extends Node3D
## Stand de tir de la Lice : six tirs calculés, sans réflexe ni chrono. Jules mesure un angle
## sur un rapporteur géant (ProtractorRange) ; Tom donne le coefficient directeur de la droite
## de son arbalète (LineRange). On voit où part le tir et on corrige soi-même. Seul le premier
## tir de chaque cible compte comme réponse (suivi des notions) ; les suivants servent à
## corriger. Le paquet vient de `Session.start("arene", {enigma: …})` (TirScene.params).

const SCENE := "res://scenes/tir/tir.tscn"
const ROUNDS := 6
## Générateur du stand selon la classe ("" : pas encore de stand pour cette classe).
const GENERATORS := {"6e": "6e.angles.tir", "2nde": "2nde.droites.tir"}
const ANGLE_VIEW := {"fov": 40.0, "distance": 20.0, "pitch": -62.0, "target": Vector3(0, 0, 4.9)}
const LINE_VIEW := {"fov": 40.0, "distance": 24.0, "pitch": -4.0, "target": Vector3(0, 1.2, -5.2)}

var _wt: WorldTheme
var _room: DungeonRoom
var _fx: CombatFx
var _hud: CombatHud
var _camera: Camera3D
var _hero: Fighter
var _pet: Companion
var _angle_range: ProtractorRange
var _line_range: LineRange
var _first_try := 0
var _shots := 0
var _xp := 0
var _ending := false


static func generator_for(level: String) -> String:
	return str(GENERATORS.get(level, ""))


static func params(level: String) -> Dictionary:
	return {"enigma": {"generator": generator_for(level), "count": ROUNDS + 2}}


func _ready() -> void:
	_wt = WorldTheme.for_world(Session.world())
	_room = DungeonRoom.new().use_theme(_wt)
	_room.front_rows = 2
	_room.plain_floor = true
	add_child(_room)
	_room.build()
	_camera = Camera3D.new()
	add_child(_camera)
	_camera.make_current()
	_fx = CombatFx.new()
	add_child(_fx)
	_fx.camera = _camera

	_hero = Fighter.create_hero(SaveManager.look(), _wt.hero_name, Progression.hero_max_hp(SaveManager.level()))
	add_child(_hero)
	_room.adapt_character(_hero)
	var line := generator_for(Session.level()) == "2nde.droites.tir"
	var view: Dictionary = LINE_VIEW if line else ANGLE_VIEW
	if line:
		_line_range = LineRange.new()
		_line_range.position = Vector3(0, 0, -5.2)
		add_child(_line_range)
		_hero.position = Vector3(-5.9, 0, -4.2)
		_hero.rotation_degrees.y = 160.0  # tourné vers le mur de tir
	else:
		_angle_range = ProtractorRange.new()
		_angle_range.position = Vector3(0, 0, 3.4)
		add_child(_angle_range)
		_hero.position = _angle_range.position + Vector3(0, 0, 0.9)  # juste derrière le centre
		_hero.rotation_degrees.y = 180.0
	if _wt.companion:
		_pet = Companion.create(SaveManager.look())
		_pet.position = _hero.position + (Vector3(1.0, 0, 1.2) if line else Vector3(-1.2, 0, 1.1))
		add_child(_pet)
		_room.adapt_character(_pet)
	_point_camera(view)

	_hud = CombatHud.new()
	add_child(_hud)
	_hud.setup(_wt, _wt.hero_name)
	_hud.quit_requested.connect(_quit)
	_hud.show_actions(false)
	_hud.set_enemy_visible(false)
	_hud.set_hero_hp_visible(false)
	QuestionService.reset()
	_run()


func _point_camera(view: Dictionary) -> void:
	var pitch := deg_to_rad(float(view["pitch"]))
	var target: Vector3 = view["target"]
	_camera.fov = float(view["fov"])
	_camera.position = target + Vector3(0, -sin(pitch) * float(view["distance"]), cos(pitch) * float(view["distance"]))
	_camera.rotation = Vector3(pitch, 0, 0)


## Développement, PC uniquement : `-- --tir=<valeur>` passe l'introduction et tire cette valeur
## sur la première cible (« go » : sans tirer ; captures d'écran).
func _dev_shot() -> String:
	return Quality.option("tir") if not OS.has_feature("web") else ""


func _run() -> void:
	if _dev_shot() != "":
		get_tree().create_timer(0.4).timeout.connect(func() -> void:
			for b in _hud._overlay.find_children("*", "Button", true, false):
				(b as Button).pressed.emit()
				break)
	await _message("Le stand de tir", _intro(), "À mes cibles !")
	for round in ROUNDS:
		if Session.time_over():
			break
		var item := QuestionService.next_item("enigme")
		if item.is_empty() or not item.has("visual"):
			await _message("Le stand de tir", "Les cibles ne sont pas prêtes (connexion perdue ?). Reviens tout à l'heure.", "Retour")
			break
		_hud.set_status("Le stand de tir", "Cible %d / %d · %d du premier coup" % [round + 1, ROUNDS, _first_try])
		await _play_round(item, round)
		if Accessibility.pause_due():
			var stop := await _pause()
			if stop:
				break
	await _finish()


func _intro() -> String:
	if _angle_range != null:
		return "Un rapporteur géant est peint au sol. Mesure l'angle entre la ligne de départ et la cible, puis tire. Ta flèche part exactement dans la direction choisie : si tu rates, regarde où elle est allée et corrige."
	return "Le mur de tir est un repère. Ton arbalète est sur l'axe des ordonnées ; le carreau file en ligne droite. Donne le coefficient directeur qui mène à la cible. Si tu rates, regarde sa trace et corrige."


func _play_round(item: Dictionary, round: int) -> void:
	var visual: Dictionary = item["visual"]
	if _angle_range != null:
		_angle_range.setup(visual, _wt)
		_hero.rotation_degrees.y = 180.0
	else:
		_line_range.setup(visual, _wt)
	var panel := TirPanel.new().setup(item, _wt, "Cible %d / %d" % [round + 1, ROUNDS])
	_hud.show_panel(panel)
	var started := Time.get_ticks_msec()
	var tries := 0
	if round == 0 and _dev_shot() not in ["", "go"]:
		get_tree().create_timer(0.8).timeout.connect(func() -> void: panel.fired.emit(_dev_shot()))
	while true:
		var value: String = await panel.fired
		tries += 1
		panel.lock(true)
		if tries == 1:
			QuestionService.submit(item, value, Time.get_ticks_msec() - started, panel.hint_used, "tir")
		# Le panneau s'efface le temps du tir : on voit partir la flèche (téléphone : il couvre la scène).
		create_tween().tween_property(panel, "modulate:a", 0.0, 0.15)
		var hit := await _shoot(value)
		await get_tree().create_timer(0.6).timeout
		create_tween().tween_property(panel, "modulate:a", 1.0, 0.2)
		if hit:
			if tries == 1:
				_first_try += 1
			var gain := 15 + Progression.answer_xp(int(item["difficulty"]))
			gain = gain if tries == 1 else ceili(gain / 2.0)
			_xp += gain
			SaveManager.add_xp(gain)
			Sfx.play("crit")
			_fx.burst(_target_position(), Color("#ffd447"), 40 if not Accessibility.on("calm") else 12, 3.0)
			if _pet:
				_pet.celebrate()
			var text := "En plein cœur ! +%d XP." % gain
			if tries > 1:
				text += " " + str(item.get("explanation", ""))
			panel.say(text, true)
			await get_tree().create_timer(2.4 if tries > 1 else 1.4).timeout
			_hud.clear_panel()
			return
		Sfx.play("wrong")
		var advice := _advice(item, value)
		if tries >= 3 and not panel.hint_used:
			advice += " " + str(item.get("hint", ""))
		panel.say(advice, false)
		panel.lock(false)


func _shoot(value: String) -> bool:
	_hero.play(["1H_Ranged_Shoot", "2H_Ranged_Shoot", "Throw", "Interact"])
	Sfx.play("spell", 0.7)
	if _angle_range != null:
		_hero.rotation_degrees.y = _angle_range.facing(float(value))
		await get_tree().create_timer(0.25).timeout
		return await _angle_range.shoot(int(value))
	var parts := value.split("/")
	var numerator := int(parts[0])
	var denominator := int(parts[1]) if parts.size() > 1 else 1
	await get_tree().create_timer(0.2).timeout
	return await _line_range.shoot(numerator, denominator)


func _target_position() -> Vector3:
	return _angle_range.target_position() if _angle_range != null else _line_range.target_position()


## Ce que montre le tir raté, et dans quel sens corriger.
func _advice(item: Dictionary, value: String) -> String:
	var visual: Dictionary = item["visual"]
	if _angle_range != null:
		var shot := int(value)
		var angle := int(visual["angle"])
		if _angle_range.reference_left and shot == 180 - angle:
			return "Ta flèche est partie à %d° de l'autre côté : tu as lu la graduation qui part de la droite. Pars du 0 de la ligne de départ, à gauche." % shot
		if shot < angle:
			return "Ta flèche est partie à %d° : la cible est plus loin de la ligne de départ. Essaie un angle plus grand." % shot
		return "Ta flèche est partie à %d° : la cible est plus près de la ligne de départ. Essaie un angle plus petit." % shot
	var parts := value.split("/")
	var numerator := int(parts[0])
	var denominator := int(parts[1]) if parts.size() > 1 else 1
	var t := _line_range.target
	var y := LineRange.height_at(numerator, denominator, _line_range.start.y, t.x)
	var shown := str(y.x) if y.y == 1 else "%d/%d" % [y.x, y.y]
	var high := y.x > t.y * y.y
	return "À x = %d, ton carreau passe à y = %s : trop %s (la cible est à y = %d). Essaie un coefficient plus %s." % [
		t.x, shown, "haut" if high else "bas", t.y, "petit" if high else "grand"]


func _finish() -> void:
	if _ending:
		return
	_ending = true
	var text := "Cibles touchées du premier coup : %d. +%d XP." % [_first_try, _xp]
	if Session.time_over():
		text += " " + Session.rest_text()
	await _message("Fin de la série", text, "Retour à la Citadelle")
	_quit()


func _pause() -> bool:
	var panel := UiKit.pause_panel(_wt)
	_hud.show_panel(panel[0])
	var choice: Array = []
	(panel[1] as Button).pressed.connect(func() -> void: choice.append(false))
	(panel[2] as Button).pressed.connect(func() -> void: choice.append(true))
	while choice.is_empty():
		await get_tree().process_frame
	_hud.clear_panel()
	if not choice[0]:
		Accessibility.snooze_pause()
	return choice[0]


func _message(title: String, body: String, button_text: String) -> void:
	var panel := UiKit.message_panel(_wt, title, body, button_text)
	_hud.show_panel(panel[0])
	await (panel[1] as Button).pressed
	_hud.clear_panel()


func _quit() -> void:
	_hud.clear_panel()
	await Session.end()
	get_tree().change_scene_to_file(Departure.CITADEL_SCENE)
