class_name PontScene
extends Node3D
## Pont des fractions (Jules) : six ravins à franchir, sans chrono. Jules choisit des planches
## de longueurs fractionnaires et les pose bout à bout (ChasmBridge) ; le pont tient si leur
## somme vaut exactement la largeur du ravin, sinon il s'effondre et Jules corrige. Seul le
## premier pont de chaque ravin compte comme réponse (la somme des planches posées, suivi des
## notions) ; les essais suivants servent à corriger. Paquet : `Session.start("arene", …)`
## (PontScene.params), comme au stand de tir.

const SCENE := "res://scenes/pont/pont.tscn"
const ROUNDS := 6
## Générateur du pont selon la classe (absent : pas de pont pour cette classe).
const GENERATORS := {"6e": "6e.fractions.pont"}
const VIEW := {"fov": 42.0, "distance": 25.0, "pitch": -56.0, "target": Vector3(0, -0.6, 5.2)}
const START := Vector3(-8.2, 0, 1.4)
const WALK_SPEED := 3.2

var _wt: WorldTheme
var _room: DungeonRoom
var _fx: CombatFx
var _hud: CombatHud
var _camera: Camera3D
var _hero: Fighter
var _pet: Companion
var _bridge: ChasmBridge
var _first_try := 0
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
	_room.chasm = ChasmBridge.HALF
	add_child(_room)
	_room.build()
	_bridge = ChasmBridge.new()
	add_child(_bridge)
	_camera = Camera3D.new()
	_camera.far = 120.0
	add_child(_camera)
	_camera.make_current()
	_point_camera()
	_fx = CombatFx.new()
	add_child(_fx)
	_fx.camera = _camera

	_hero = Fighter.create_hero(SaveManager.look(), _wt.hero_name, Progression.hero_max_hp(SaveManager.level()))
	add_child(_hero)
	_room.adapt_character(_hero)
	_place_hero()
	if _wt.companion:
		_pet = Companion.create(SaveManager.look())
		add_child(_pet)
		_room.adapt_character(_pet)
		_pet.follow(_hero)

	_hud = CombatHud.new()
	add_child(_hud)
	_hud.setup(_wt, _wt.hero_name)
	_hud.quit_requested.connect(_quit)
	_hud.show_actions(false)
	_hud.set_enemy_visible(false)
	_hud.set_hero_hp_visible(false)
	QuestionService.reset()
	_run()


func _point_camera() -> void:
	var pitch := deg_to_rad(float(VIEW["pitch"]))
	var target: Vector3 = VIEW["target"]
	_camera.fov = float(VIEW["fov"])
	_camera.position = target + Vector3(0, -sin(pitch) * float(VIEW["distance"]), cos(pitch) * float(VIEW["distance"]))
	_camera.rotation = Vector3(pitch, 0, 0)


func _place_hero() -> void:
	_hero.position = START
	_hero.rotation_degrees.y = 90.0  # tourné vers le ravin (est)
	_hero.idle()


## Développement, PC uniquement : `-- --pont=1/2+1/4|juste|go` passe l'introduction et pose ces
## planches sur le premier ravin (« juste » : une solution ; « go » : sans poser ; captures).
func _dev_planks() -> String:
	return Quality.option("pont") if not OS.has_feature("web") else ""


func _run() -> void:
	if _dev_planks() != "":
		get_tree().create_timer(0.4).timeout.connect(func() -> void:
			for b in _hud._overlay.find_children("*", "Button", true, false):
				(b as Button).pressed.emit()
				break)
	await _message("Le pont des fractions", _intro(), "Au premier ravin !")
	for round in ROUNDS:
		if Session.time_over():
			break
		var item := QuestionService.next_item("enigme")
		if item.is_empty() or not item.has("visual"):
			await _message("Le pont des fractions", "Les planches ne sont pas prêtes (connexion perdue ?). Reviens tout à l'heure.", "Retour")
			break
		_hud.set_status("Le pont des fractions", "Ravin %d / %d · %d du premier coup" % [round + 1, ROUNDS, _first_try])
		await _play_round(item, round)
		if Accessibility.pause_due():
			var stop := await _pause()
			if stop:
				break
	await _finish()


func _intro() -> String:
	return "Un gouffre coupe la salle. Pour passer, pose des planches bout à bout. Chaque planche mesure une fraction de perche. Le pont magique ne tient que si les planches couvrent exactement le ravin : ni plus court, ni plus long."


func _play_round(item: Dictionary, round: int) -> void:
	_bridge.setup(item["visual"], _wt)
	_place_hero()
	var panel := PontPanel.new().setup(item, _wt, "Ravin %d / %d" % [round + 1, ROUNDS])
	panel.changed.connect(_bridge.set_pile)
	_hud.show_panel(panel)
	var started := Time.get_ticks_msec()
	var tries := 0
	if round == 0 and _dev_planks() not in ["", "go"]:
		get_tree().create_timer(0.8).timeout.connect(func() -> void:
			var planks := Array(_dev_planks().split("+"))
			if _dev_planks() == "juste":
				planks = ChasmBridge.solve(item["visual"]["planks"], _bridge.gap)
			panel.choose(planks)
			panel.built.emit(panel.chosen()))
	while true:
		var lengths: Array = await panel.built
		tries += 1
		panel.lock(true)
		var sum := ChasmBridge.total(lengths)
		if tries == 1:
			QuestionService.submit(item, ChasmBridge.write(sum), Time.get_ticks_msec() - started, panel.hint_used, "pont")
		# Le panneau s'efface le temps de la pose : on voit le pont (téléphone : il couvre la scène).
		create_tween().tween_property(panel, "modulate:a", 0.0, 0.15)
		var outcome := await _bridge.build()
		if outcome == "juste":
			await _cross()
			if tries == 1:
				_first_try += 1
			var gain := 15 + Progression.answer_xp(int(item["difficulty"]))
			gain = gain if tries == 1 else ceili(gain / 2.0)
			_xp += gain
			SaveManager.add_xp(gain)
			create_tween().tween_property(panel, "modulate:a", 1.0, 0.2)
			var text := "Le pont tient ! +%d XP." % gain
			if tries > 1:
				text += " " + str(item.get("explanation", ""))
			panel.say(text, true)
			await get_tree().create_timer(2.4 if tries > 1 else 1.4).timeout
			_hud.clear_panel()
			return
		Sfx.play("wrong")
		if not Accessibility.on("calm"):
			_fx.shake(0.15, 0.3)
		await _bridge.collapse()
		_bridge.set_pile(lengths)  # les planches reviennent sur le tas : Jules corrige son choix
		create_tween().tween_property(panel, "modulate:a", 1.0, 0.2)
		var advice := _advice(lengths, outcome)
		if tries >= 3 and not panel.hint_used:
			advice += " " + str(item.get("hint", ""))
		panel.say(advice, false)
		panel.lock(false)


## Le héros traverse le pont, le renard derrière lui ; étincelles sur les joints.
func _cross() -> void:
	Sfx.play("crit")
	for point in _bridge.joints():
		_fx.burst(point, Color("#ffd447"), 14 if not Accessibility.on("calm") else 5, 2.0)
	var path: Array[Vector3] = [Vector3(-ChasmBridge.HALF - 0.6, 0, 0), _bridge.west_edge() + Vector3(-0.4, 0, 0),
		_bridge.east_edge() + Vector3(1.6, 0, 0)]
	_hero.loop_any(["Walking_A", "Walking_B"])
	for point in path:
		var seconds := _hero.position.distance_to(point) / WALK_SPEED
		_hero.rotation.y = atan2(point.x - _hero.position.x, point.z - _hero.position.z)
		var tween := create_tween()
		tween.tween_property(_hero, "position", point, seconds)
		await tween.finished
	_hero.play(["Cheer", "Interact"])
	if _pet:
		_pet.celebrate()


## Ce que montre le pont raté, sans donner la réponse : la somme posée et le sens de l'erreur.
func _advice(lengths: Array, outcome: String) -> String:
	var sum := ChasmBridge.write(ChasmBridge.total(lengths))
	var terms := " + ".join(lengths)
	var built := "Tes planches : %s = %s." % [terms, sum] if lengths.size() > 1 else "Ta planche mesure %s." % sum
	var gap := ChasmBridge.write(_bridge.gap)
	if outcome == "court":
		return "%s Trop court : le ravin mesure %s. Ajoute une planche ou prends-en une plus longue." % [built, gap]
	return "%s Trop long : la dernière planche bute sur l'autre rive (le ravin mesure %s). Retire une planche ou prends-en une plus courte." % [built, gap]


func _finish() -> void:
	if _ending:
		return
	_ending = true
	var text := "Ravins franchis du premier coup : %d. +%d XP." % [_first_try, _xp]
	if Session.time_over():
		text += " " + Session.rest_text()
	await _message("Fin de l'expédition", text, "Retour à la Citadelle")
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
