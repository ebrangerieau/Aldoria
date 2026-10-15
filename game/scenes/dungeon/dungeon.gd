extends Node3D
## Donjon : salles en enfilade à explorer, combats au contact des ennemis, énigme
## (balance, carte, robot pour Jules ; miroirs, tableau de signes, courbes pour Tom),
## boss de synthèse puis coffre et note de 1 à 5. Chaque salle franchie devient un
## point de reprise (sauvegarde) ; un repli à 0 PV ramène à l'entrée de la salle,
## sans perte.
##
## Le donjon (DungeonDef choisi au camp : `Session.dungeon_code`) fixe les chapitres
## et l'énigme ; le paquet de questions a été composé par le serveur au lancement
## (`Session.start("donjon", …)`).

const EXPLORE := {"fov": 36.0, "distance": 21.0, "pitch": -50.0}
const COMBAT := {"fov": 22.0, "distance": 22.0, "pitch": -20.0}
## Cadrage du combat depuis la place du héros : combattants dans le haut de l'écran.
const COMBAT_TARGET_OFFSET := Vector3(2.4, -0.9, 2.7)
const CAMERA_SMOOTH := 5.0
const FIGHT_GAP := 4.8  # distance héros – ennemi pendant un combat
const AGGRO_DISTANCE := 3.6
const PEDESTAL_DISTANCE := 1.7
const PEDESTAL_REARM := 2.6
const CHEST_DISTANCE := 1.9
const PEDESTALS := [Vector3(4, 0, 6), Vector3(8, 0, 5), Vector3(12, 0, 6)]
const CHEST_AT := Vector3(12.5, 0, 10)
const BALANCE_AT := Vector3(7, 0, 5)  # balance géante : au fond de la salle, loin de l'escalier
const BALANCE_DISTANCE := 3.4  # depuis le centre de la balance
const BALANCE_ROUNDS := 3
const BALANCE_VIEW := {"fov": 30.0, "distance": 15.0, "pitch": -20.0}
## Place du héros pendant l'énigme : de côté, pour ne pas cacher la balance.
const BALANCE_SPOT := Vector3(-4.4, 0, 0.4)

var _def: DungeonDef
var _wt: WorldTheme
var _level: DungeonLevel
var _hero: HeroController
var _pet: Companion  # renard du monde de Jules (null pour Tom)
var _camera: Camera3D
var _fx: CombatFx
var _hud: CombatHud
var _stick: TouchStick
var _encounter: Encounter
var _enemies: Array[Dictionary] = []  # {node, room, spec, boss, defeated}
var _pedestals: Array[Dictionary] = []  # {node, crystal, room, solved, armed}
var _balance: Dictionary = {}  # salle-énigme 3D : {node: BalanceRig, room, rounds, armed}
var _chest: Node3D
var _busy := true
var _room := -1
var _visited: Dictionary = {}
var _cam := {}  # paramètres courants de la caméra
var _cam_goal := {}
var _ending := false


func _ready() -> void:
	_wt = WorldTheme.for_world(Session.world())
	_def = DungeonDef.by_code(Session.level(), chosen_code())
	QuestionService.reset()

	# Donjon qui monte (souhait des enfants) : chaque salle un étage plus haut.
	_level = DungeonLevel.new().use_theme(_wt).use_decor(_def.decor).use_climb()
	add_child(_level)
	_level.build(_def.room_count())

	_hero = HeroController.create(SaveManager.look(), _wt.hero_name, Progression.hero_max_hp(SaveManager.level()))
	_hero.floor_height = _level.height_at
	add_child(_hero)
	_level.adapt_character(_hero)

	_camera = Camera3D.new()
	_camera.far = 200.0
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
	_hero.fighter.hp_changed.connect(_hud.set_hero_hp)
	_hud.set_hero_hp(_hero.fighter.hp, _hero.fighter.max_hp)

	var stick_layer := CanvasLayer.new()
	stick_layer.layer = 5  # sous l'interface (layer 10) : les boutons gardent leurs appuis
	add_child(stick_layer)
	_stick = TouchStick.new()
	_stick.setup(_wt.accent)
	_stick.tapped.connect(_on_tap)
	stick_layer.add_child(_stick)

	_encounter = Encounter.new().setup(_hero.fighter, _hud, _fx, _wt)
	add_child(_encounter)
	_encounter.xp_gained.connect(SaveManager.add_xp)
	SaveManager.changed.connect(_refresh_status)
	SaveManager.level_up.connect(_on_level_up)

	_populate()
	if _wt.companion:
		_pet = Companion.create(SaveManager.look())
		add_child(_pet)
		_level.adapt_character(_pet)
		_pet.floor_height = _level.height_at
		_pet.follow(_hero)
	_set_camera_goal(EXPLORE, _explore_target(), true)
	_refresh_status()
	_start()


func _start() -> void:
	var checkpoint := _checkpoint()
	if checkpoint == 0:
		await _message(_def.title, _def.intro, "En avant !")
	else:
		_hud.banner("Reprise : %s" % _def.rooms[checkpoint]["title"], Color.WHITE, 1.2)
	_hud.say(HeroVoice.before_room(_wt.id, _def.rooms, maxi(1, checkpoint), true))
	_explore()
	_dev_approach()


## Développement, PC uniquement : `-- --approach` mène le héros au premier ennemi ou
## piédestal de la salle de départ (captures d'écran d'un combat ou d'une énigme).
func _dev_approach() -> void:
	if Quality.option("stairs") != "" and not OS.has_feature("web"):
		# Capture de l'escalier : porte ouverte, le héros monte vers la salle suivante.
		var from := _level.room_at(_hero.position.x)
		for entry in _enemies:
			if entry["room"] == from:
				entry["defeated"] = true
				(entry["node"] as Node3D).visible = false
		_level.open_door(from, false)
		_hero.position = _level.room_origin(from) + Vector3(DungeonLevel.ROOM_W - DungeonLevel.STAIR_RUN - 3.0, 0, DungeonLevel.DOOR_Z + 1.0)
		_hero.go_to(_level.path(_hero.position, _level.entry_point(from + 1)))
		return
	if Quality.option("approach") == "" or OS.has_feature("web"):
		return
	await get_tree().create_timer(0.5).timeout
	for button in _hud._overlay.find_children("*", "Button", true, false):
		(button as Button).pressed.emit()  # présentation de l'énigme
		break
	while _busy:
		await get_tree().process_frame
	var room := _level.room_at(_hero.position.x)
	for entry in _enemies:
		if entry["room"] == room:
			_hero.go_to(_level.path(_hero.position, entry["node"].position - Vector3(3, 0, 0)))
			return
	for p in _pedestals:
		if p["room"] == room:
			_hero.go_to(_level.path(_hero.position, p["node"].position + Vector3(0, 0, 1.2)))
			return
	if not _balance.is_empty() and _balance["room"] == room:
		_hero.go_to(_level.path(_hero.position, (_balance["node"] as Node3D).position + Vector3(0, 0, BALANCE_DISTANCE - 0.4)))


# --- Mise en place --------------------------------------------------------------------

## Donjon choisi au camp. Développement, PC uniquement : `-- --dungeon=<code>`.
static func chosen_code() -> String:
	if Quality.option("dungeon") != "" and not OS.has_feature("web"):
		return Quality.option("dungeon")
	return Session.dungeon_code


func _checkpoint() -> int:
	var room := int(SaveManager.dungeon(_def.code)["checkpoint"])
	# Développement, PC uniquement : `-- --room=N` pour démarrer dans une salle.
	if Quality.option("room") != "" and not OS.has_feature("web"):
		room = int(Quality.option("room"))
	return clampi(room, 0, _def.room_count() - 1)


## Ennemis, piédestaux et portes selon le point de reprise : les salles d'avant
## sont déjà franchies (portes ouvertes, ennemis vaincus).
func _populate() -> void:
	var checkpoint := _checkpoint()
	for i in _def.room_count():
		var room: Dictionary = _def.rooms[i]
		if i < checkpoint or room["kind"] == "entree":
			_level.open_door(i, false)
		if i < checkpoint:
			continue
		for spec in room.get("enemies", []):
			_spawn_enemy(i, spec, room["kind"] == "boss")
		if room["kind"] == "enigme":
			if _def.enigma_mode == "balance":
				_spawn_balance(i)
			else:
				for local in PEDESTALS:
					_spawn_pedestal(i, local)
	_hero.position = _level.entry_point(checkpoint) if checkpoint > 0 else _level.room_origin(0) + Vector3(3, 0, 10)
	_hero.fighter.rotation_degrees.y = 90.0


func _spawn_enemy(room: int, spec: Dictionary, boss: bool) -> void:
	var enemy := Fighter.create(spec["model"], spec["name"], int(spec["hp"]), "Idle_Combat")
	var at: Vector2 = spec["at"]
	enemy.position = _level.room_origin(room) + Vector3(at.x, 0, at.y)
	enemy.rotation_degrees.y = -90.0  # tourné vers l'ouest, d'où vient le héros
	enemy.scale = Vector3.ONE * float(spec.get("scale", 1.0))
	add_child(enemy)
	_level.adapt_character(enemy)
	# Endormi : couché (sbires) ou figé debout (gardiens), il se réveille à l'approche.
	enemy.play(["Skeletons_Inactive_Floor_Pose"] if spec["model"] == "Skeleton_Minion" else ["Skeleton_Inactive_Standing_Pose"])
	_level.add_obstacle(room, Vector3(at.x, 0, at.y), 0.5)
	_enemies.append({"node": enemy, "room": room, "spec": spec, "boss": boss, "defeated": false})


func _spawn_pedestal(room: int, local: Vector3) -> void:
	var node := Node3D.new()
	node.position = _level.room_origin(room) + local
	var stone := MeshInstance3D.new()
	var column := CylinderMesh.new()
	column.top_radius = 0.42
	column.bottom_radius = 0.55
	column.height = 1.0
	var stone_mat := StandardMaterial3D.new()
	stone_mat.albedo_color = Color(0.42, 0.4, 0.46)
	stone_mat.roughness = 0.9
	if _level.built_settings.vertex_shading:
		stone_mat.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
	column.material = stone_mat
	stone.mesh = column
	stone.position.y = 0.5
	node.add_child(stone)
	var crystal := MeshInstance3D.new()
	var prism := SphereMesh.new()
	prism.radius = 0.22
	prism.height = 0.7
	prism.radial_segments = 6
	prism.rings = 2
	var crystal_mat := StandardMaterial3D.new()
	crystal_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	crystal_mat.albedo_color = _wt.accent
	prism.material = crystal_mat
	crystal.mesh = prism
	crystal.position.y = 1.45
	node.add_child(crystal)
	var spin := crystal.create_tween().set_loops()
	spin.tween_property(crystal, "rotation:y", TAU, 4.0).from(0.0)
	add_child(node)
	_level.add_obstacle(room, local, 0.55)
	_pedestals.append({"node": node, "crystal": crystal, "room": room, "solved": false, "armed": true})


func _spawn_balance(room: int) -> void:
	var rig := BalanceRig.create(_wt, _level.built_settings.vertex_shading)
	rig.position = _level.room_origin(room) + BALANCE_AT
	add_child(rig)
	for dx in [-BalanceRig.ARM, 0.0, BalanceRig.ARM]:
		_level.add_obstacle(room, BALANCE_AT + Vector3(dx, 0, 0), BalanceRig.PLATE_R if dx != 0.0 else 0.9)
	_balance = {"node": rig, "room": room, "rounds": 0, "armed": true}


func _balance_done() -> bool:
	return _balance.is_empty() or int(_balance["rounds"]) >= BALANCE_ROUNDS


# --- Exploration ------------------------------------------------------------------------

func _explore() -> void:
	_busy = false
	_hero.controls_enabled = true
	_stick.set_enabled(true)
	_hud.set_enemy_visible(false)
	_hud.show_actions(false)
	_set_camera_goal(EXPLORE, _explore_target())


func _pause_exploration() -> void:
	_busy = true
	_hero.controls_enabled = false
	_hero.stop()
	_stick.set_enabled(false)


func _process(delta: float) -> void:
	if not _busy:
		_hero.stick_vector = _stick.vector
		_update_room()
		_check_triggers()
		if Session.time_over():
			_session_end()
		elif Accessibility.pause_due():
			_pause_reminder()
		_cam_goal["target"] = _explore_target()
	_update_camera(delta)


func _update_room() -> void:
	var room := _level.room_at(_hero.position.x)
	if room == _room:
		return
	_room = room
	_level.set_active_room(room)
	_refresh_status()
	if _visited.has(room):
		return
	_visited[room] = true
	var spec: Dictionary = _def.rooms[room]
	match spec["kind"]:
		"enigme":
			if _pedestals.any(func(p: Dictionary) -> bool: return p["room"] == room and not p["solved"]) 					or not _balance_done() and _balance["room"] == room:
				_pause_exploration()
				await _message(_def.enigma_title, _def.enigma_intro, "C'est parti")
				_explore()
		"boss":
			_hud.banner(spec["title"], _wt.bad, 1.4)
		_:
			if room > 0:
				_hud.banner(spec["title"], Color.WHITE, 1.0)


func _check_triggers() -> void:
	var at := _hero.position
	for entry in _enemies:
		if not entry["defeated"] and entry["room"] == _room and _flat_distance(at, entry["node"].position) < AGGRO_DISTANCE:
			_fight(entry)
			return
	for p in _pedestals:
		if p["solved"] or p["room"] != _room:
			continue
		var d := _flat_distance(at, p["node"].position)
		if not p["armed"]:
			p["armed"] = d > PEDESTAL_REARM  # s'éloigner pour réessayer
		elif d < PEDESTAL_DISTANCE:
			_solve_pedestal(p)
			return
	if not _balance_done() and _balance["room"] == _room:
		var d := _flat_distance(at, (_balance["node"] as Node3D).position)
		if not _balance["armed"]:
			_balance["armed"] = d > BALANCE_DISTANCE + 1.0  # s'éloigner pour revenir plus tard
		elif d < BALANCE_DISTANCE:
			_solve_balance()
			return
	if _chest != null and _flat_distance(at, _chest.position) < CHEST_DISTANCE:
		_open_chest()


static func _flat_distance(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x - b.x, a.z - b.z).length()


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


func _refresh_status() -> void:
	if _room < 0:
		return
	var xp := SaveManager.xp()
	_hud.set_status(_def.rooms[_room]["title"], "%s · Niveau %d · %d XP" % [_level.floor_label(_room), Progression.level_for_xp(xp), xp])


func _on_level_up(level: int) -> void:
	_hud.banner("Niveau %d !" % level, Color("#ffd447"), 1.4)
	Sfx.play("victory", 1.2)
	var fighter := _hero.fighter
	fighter.max_hp = Progression.hero_max_hp(level)
	fighter.heal(fighter.max_hp)
	_fx.rising_sparkles(_hero.global_position + Vector3(0, 0.8, 0), Color("#ffd447"))


# --- Combats ----------------------------------------------------------------------------

func _fight(entry: Dictionary) -> void:
	_pause_exploration()
	var enemy: Fighter = entry["node"]
	var spec: Dictionary = entry["spec"]
	var room_x := _level.room_origin(entry["room"]).x
	var spot := enemy.position - Vector3(FIGHT_GAP, 0, 0)
	spot.x = maxf(spot.x, room_x + 1.2)
	# Le héros se met en place pendant que l'ennemi se réveille.
	Sfx.play("hurt", 0.6)
	enemy.play(["Skeletons_Awaken_Floor", "Skeletons_Awaken_Standing", "Spawn_Ground"])
	_hero.fighter.loop("Running_A")
	var tween := create_tween()
	tween.tween_property(_hero, "position", spot, 0.45)
	_set_camera_goal(COMBAT, spot + COMBAT_TARGET_OFFSET)
	await tween.finished
	_hero.fighter.idle()
	_hero.fighter.rotation_degrees.y = 65.0
	enemy.rotation_degrees.y = -65.0
	_hud.set_enemy_visible(true)
	if entry["boss"]:
		# Grand combat : le héros l'aborde avec toutes ses forces.
		if _hero.fighter.hp < _hero.fighter.max_hp:
			_hero.fighter.restore()
			Sfx.play("heal")
			_fx.rising_sparkles(_hero.fighter.global_position + Vector3(0, 0.8, 0), _wt.good)
		_hud.banner(spec["name"], _wt.bad, 1.2)
		enemy.play(["Taunt", "Idle_Combat"])
		if _def.boss_intro != "" and not entry.get("taunted", false):
			# L'Effaceur se présente (une fois par partie, pas après un repli).
			entry["taunted"] = true
			await get_tree().create_timer(0.6).timeout
			await _message(spec["name"], _def.boss_intro, "En garde !")
	await get_tree().create_timer(0.9).timeout

	var outcome := await _encounter.fight(enemy, int(spec["tier"]), int(spec["xp"]), entry["boss"])
	match outcome:
		"victory":
			entry["defeated"] = true
			SaveManager.record_defeat(spec["name"])
			if _pet:
				_pet.celebrate()
			_hud.set_enemy_visible(false)
			if entry["boss"]:
				await _boss_defeated(entry["room"])
			else:
				# Souffle repris entre deux combats : la moitié des PV manquants.
				var fighter := _hero.fighter
				fighter.heal(ceili((fighter.max_hp - fighter.hp) / 2.0))
				_check_room_cleared(entry["room"])
		"retreat":
			await _message("Repli", _wt.retreat_text, "Reprendre l'exploration")
			_hero.fighter.restore()
			# Les coups portés restent acquis (rien n'est perdu) : l'ennemi, boss compris,
			# garde ses blessures et le combat reprend là où il en était.
			enemy.rotation_degrees.y = -90.0
			_hero.position = _level.entry_point(entry["room"]) if entry["room"] > 0 else _level.room_origin(0) + Vector3(3, 0, 10)
			Sfx.play("heal")
			_fx.rising_sparkles(_hero.global_position + Vector3(0, 0.8, 0), _wt.good)
		_:
			_session_end()
			return
	_explore()


func _check_room_cleared(room: int) -> void:
	var kind: String = _def.rooms[room]["kind"]
	var cleared := false
	match kind:
		"combat":
			cleared = _enemies.all(func(e: Dictionary) -> bool: return e["room"] != room or e["defeated"])
		"enigme":
			cleared = _pedestals.all(func(p: Dictionary) -> bool: return p["room"] != room or p["solved"]) and _balance_done()
	if not cleared:
		return
	_level.open_door(room)
	Sfx.play("spell", 0.8)
	_hud.banner("La porte s'ouvre !", _wt.accent, 1.2)
	SaveManager.set_checkpoint(_def.code, room + 1)
	if kind == "enigme":
		# Énigme résolue : un objet attendait sur le dernier piédestal.
		var found := SaveManager.give_items(1)
		if not found.is_empty():
			_hud.banner("Trouvé : %s !" % Inventory.describe(found), Color("#ffd447"), 1.6)
	_hud.say(HeroVoice.before_room(_wt.id, _def.rooms, room + 1))


func _boss_defeated(room: int) -> void:
	await get_tree().create_timer(0.4).timeout
	var boss: Array = _def.rooms[room].get("enemies", [])
	if _def.boss_defeat != "" and not boss.is_empty():
		await _message(str(boss[0]["name"]), _def.boss_defeat, "Reprendre la page")
	_chest = (load(DungeonLevel.DUNGEON % "chest_gold") as PackedScene).instantiate()
	_chest.position = _level.room_origin(room) + CHEST_AT
	_chest.rotation_degrees.y = -30.0
	_chest.scale = Vector3.ONE * 0.2
	add_child(_chest)
	_level.adapt_character(_chest)
	create_tween().tween_property(_chest, "scale", Vector3.ONE * 1.3, 0.5).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_fx.burst(_chest.position + Vector3(0, 0.8, 0), Color("#ffd447"), 50, 4.0)
	_hud.banner("Un coffre est apparu !", Color("#ffd447"), 1.4)


func _open_chest() -> void:
	_pause_exploration()
	var chest := _chest
	_chest = null
	_hero.fighter.play(["Interact", "PickUp", "Cheer"])
	Sfx.play("victory")
	_fx.burst(chest.position + Vector3(0, 1.0, 0), Color("#ffd447"), 80, 5.0)
	_fx.rising_sparkles(chest.position, Color("#ffd447"))
	if _pet:
		_pet.celebrate()
	var before := Vector2i(SaveManager.level(), SaveManager.dungeons_done())
	var first_time := int(SaveManager.dungeon(_def.code)["completed"]) == 0
	SaveManager.add_xp(_def.chest_xp)
	SaveManager.complete_dungeon(_def.code)
	var found := SaveManager.give_items(2)
	var unlocked := Wardrobe.newly_unlocked(before, Vector2i(SaveManager.level(), SaveManager.dungeons_done()), _wt.companion)
	await get_tree().create_timer(1.2).timeout
	# Première fois : la page rendue à la Grande Chronique ; ensuite, le mot de la fin du donjon.
	var story := _def.page_text if first_time and _def.page_text != "" else _def.outro
	var text := "%s\n%d bonnes réponses sur %d. +%d XP dans le coffre." % [story, QuestionService.correct_count, QuestionService.answered, _def.chest_xp]
	if not found.is_empty():
		text += "\n" + Inventory.found_text(found)
	if not unlocked.is_empty():
		text += "\nNouveau dans l'apparence (à la Citadelle) : %s." % ", ".join(unlocked)
	var title := "%s retrouvée !" % (_def.page.left(1).to_upper() + _def.page.substr(1)) if first_time and _def.page != "" \
		else "%s : terminé !" % _def.title
	await _message(title, text, "Continuer")
	var rating := RatingPanel.new()
	rating.setup(_wt, _def.title)
	_hud.show_panel(rating)
	_quit(await rating.rated)


# --- Énigme ------------------------------------------------------------------------------

func _solve_pedestal(p: Dictionary) -> void:
	_pause_exploration()
	var item := QuestionService.next_item("enigme")
	if item.is_empty():
		_hud.banner("Énigme indisponible hors connexion", _wt.bad)
		p["armed"] = false
		_explore()
		return
	_hero.fighter.play(["Interact", "Use_Item"])
	var panel := QuestionPanel.new()
	panel.setup(item, _def.enigma_title, _wt)
	_hud.show_panel(panel)
	var res: Array = await panel.answered
	var result := QuestionService.submit(item, res[0], res[1], res[2], "enigme")
	panel.reveal(result.correct)
	if result.correct:
		Sfx.play("crit")
		await get_tree().create_timer(1.3).timeout
		_hud.clear_panel()
		p["solved"] = true
		var crystal: MeshInstance3D = p["crystal"]
		(crystal.mesh.surface_get_material(0) as StandardMaterial3D).albedo_color = _wt.good.lightened(0.3)
		var glow := MobileLighting.make_fake_light(_wt.good, 1.45, Vector2.ZERO, 1.6, 3.5)
		glow.position = crystal.position
		(p["node"] as Node3D).add_child(glow)
		_fx.rising_sparkles(crystal.global_position, _wt.good)
		_hud.banner(_wt.encouragements.pick_random(), _wt.good, 0.8)
		SaveManager.add_xp(_def.enigma_xp + Progression.answer_xp(int(item["difficulty"])))
		_check_room_cleared(p["room"])
	else:
		Sfx.play("wrong")
		await get_tree().create_timer(0.9).timeout
		_hud.clear_panel()
		var explanation := ExplanationPanel.new()
		explanation.setup(item, _wt)
		_hud.show_panel(explanation)
		await explanation.closed
		_hud.clear_panel()
		p["armed"] = false
	_explore()


## Balance géante : le héros se place devant, la caméra cadre la balance, et les manches
## s'enchaînent sur la balance elle-même (pas de panneau de question) jusqu'à la troisième.
func _solve_balance() -> void:
	_pause_exploration()
	var rig: BalanceRig = _balance["node"]
	var spot := rig.position + BALANCE_SPOT
	_hero.fighter.loop("Running_A")
	var tween := create_tween()
	tween.tween_property(_hero, "position", spot, 0.35)
	_set_camera_goal(BALANCE_VIEW, rig.position + Vector3(-0.3, 0.1, 0.9))
	await tween.finished
	_hero.fighter.idle()
	_hero.fighter.rotation_degrees.y = 90.0  # tourné vers la balance
	while not _balance_done():
		var item := QuestionService.next_item("enigme")
		if item.is_empty() or not item.has("visual"):
			_hud.banner("Énigme indisponible hors connexion", _wt.bad)
			_balance["armed"] = false
			_explore()
			return
		var round_title := "%s · %d / %d" % [_def.enigma_title, int(_balance["rounds"]) + 1, BALANCE_ROUNDS]
		var enigma := BalanceEnigma.new().setup(item, rig, _wt, round_title)
		enigma.changed.connect(_on_balance_changed.bind(rig))
		_hud.show_panel(enigma)
		var first_try: bool = await enigma.solved
		_hud.clear_panel()
		_balance["rounds"] = int(_balance["rounds"]) + 1
		_fx.rising_sparkles(rig.global_position + Vector3(0, BalanceRig.PIVOT_H, 0), _wt.good)
		Sfx.play("crit")
		_hud.banner(_wt.encouragements.pick_random(), _wt.good, 0.8)
		# Trouvé du premier coup : toute l'expérience de l'énigme ; après correction, la moitié.
		var xp := _def.enigma_xp + Progression.answer_xp(int(item["difficulty"]))
		SaveManager.add_xp(xp if first_try else ceili(xp / 2.0))
		await get_tree().create_timer(0.8).timeout
	_check_room_cleared(_balance["room"])
	_explore()


func _on_balance_changed(kind: String, rig: BalanceRig) -> void:
	if kind == "essai":
		Sfx.play("spell", 0.7)
		return
	Sfx.play("heal", 0.8)
	for left in [true, false]:
		_fx.burst(rig.plate_position(left) + Vector3(0, 0.3, 0), _wt.accent, 14, 1.6)


# --- Caméra ------------------------------------------------------------------------------

func _explore_target() -> Vector3:
	var length := _def.room_count() * DungeonLevel.ROOM_W
	return Vector3(clampf(_hero.position.x, 8.0, length - 8.0), _level.height_at(_hero.position), clampf(_hero.position.z, 6.0, 12.0))


func _set_camera_goal(params: Dictionary, target: Vector3, snap := false) -> void:
	_cam_goal = params.duplicate()
	_cam_goal["target"] = target
	if snap or _cam.is_empty():
		_cam = _cam_goal.duplicate()
		_update_camera(0.0)


func _update_camera(delta: float) -> void:
	# Temps réel : la caméra continue de glisser pendant un ralenti ou un arrêt sur image.
	var k := 1.0 - exp(-CAMERA_SMOOTH * delta / maxf(Engine.time_scale, 0.05))
	for key in ["fov", "distance", "pitch"]:
		_cam[key] = lerpf(_cam[key], _cam_goal[key], k)
	_cam["target"] = (_cam["target"] as Vector3).lerp(_cam_goal["target"], k)
	var pitch := deg_to_rad(_cam["pitch"])
	var distance: float = _cam["distance"]
	_camera.fov = _cam["fov"]
	_camera.position = _cam["target"] + Vector3(0, -sin(pitch) * distance, cos(pitch) * distance)
	_camera.rotation = Vector3(pitch, 0, 0)


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
	await _message("Belle session !",
		"%d bonnes réponses sur %d. %s" % [QuestionService.correct_count, QuestionService.answered, Session.rest_text()],
		"Terminer")
	_quit()


func _quit(rating := 0) -> void:
	_pause_exploration()
	_hud.show_actions(false)
	_hud.clear_panel()
	Engine.time_scale = 1.0
	await Session.end(rating)
	get_tree().change_scene_to_file(Departure.MAP_SCENE)
