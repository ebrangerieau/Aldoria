extends GutTest
## Donjon joué comme le ferait un enfant, hors réseau : exploration, combat au
## contact, porte qui s'ouvre et point de reprise, énigme, repli sans perte, boss
## et coffre. Les réponses et la progression restent en mémoire (pas de jeton).

const DUNGEON := "res://scenes/dungeon/dungeon.tscn"

var _scene: Node
var _saved_token := ""


func before_each() -> void:
	_saved_token = ApiClient.token
	ApiClient.token = ""
	Session._queue.clear()
	Session.played_seconds = 0.0
	SaveManager._profile_id = 0
	SaveManager.data = SaveManager.default_data()


func after_each() -> void:
	Engine.time_scale = 1.0
	if is_instance_valid(_scene):
		_scene.queue_free()
	await wait_process_frames(2)
	ApiClient.token = _saved_token
	Session._queue.clear()
	Session._save_json(Session.QUEUE_FILE, Session._queue)  # ne pas laisser de fausses réponses
	Session.items = []
	Session.profile = {}
	Session.dungeon_code = ""
	SaveManager.data = SaveManager.default_data()


func _open(world: String, checkpoint := 0, dungeon := "") -> void:
	var level := "2nde" if world == "tom" else "6e"
	Session.profile = {"name": "Test", "world": "brouillard" if world == "tom" else "lumineux", "level": level}
	Session.dungeon_code = dungeon
	Session._apply_pack(JSON.parse_string(FileAccess.get_file_as_string("res://tests/fixtures/pack_%s.json" % level)))
	if checkpoint > 0:
		SaveManager.set_checkpoint(DungeonDef.by_code(level, dungeon).code, checkpoint)
	_scene = (load(DUNGEON) as PackedScene).instantiate()
	add_child(_scene)
	await wait_process_frames(3)
	if checkpoint == 0:
		var start := await _wait_button()
		assert_not_null(start, "message d'introduction")
		start.pressed.emit()
	await wait_until(func() -> bool: return not _scene._busy, 5.0)


func test_builds_rooms_and_starts_at_the_entrance() -> void:
	await _open("jules")
	var level: DungeonLevel = _scene._level
	assert_eq(level.room_count, 6)
	assert_true(level.is_door_open(0), "porte de l'entrée ouverte")
	assert_false(level.is_door_open(1), "porte de la 1re salle de combat fermée")
	assert_eq(level.room_at(_scene._hero.position.x), 0)
	assert_eq(_scene._enemies.size(), 5)
	assert_eq(_scene._pedestals.size(), 3)


func test_walking_into_an_enemy_starts_a_fight_and_victory_opens_the_door() -> void:
	await _open("jules")
	var entry: Dictionary = _scene._enemies[0]
	_scene._hero.position = entry["node"].position - Vector3(3.0, 0, 0)
	await wait_until(func() -> bool: return _actions_visible(), 6.0)
	assert_true(_actions_visible(), "le combat commence au contact")
	(entry["node"] as Fighter).hp = 1
	await _answer("automatisme", true)
	await wait_until(func() -> bool: return not _scene._busy, 8.0)
	assert_true(entry["defeated"])
	assert_true(_scene._level.is_door_open(1), "salle vidée : la porte s'ouvre")
	assert_eq(int(SaveManager.dungeon("tour_fractions")["checkpoint"]), 2, "point de reprise")
	assert_gt(SaveManager.xp(), 0)
	assert_eq(int(SaveManager.bestiary().get(entry["spec"]["name"], 0)), 1, "bestiaire")


func test_retreat_brings_back_to_room_entrance_without_loss() -> void:
	await _open("jules")
	var entry: Dictionary = _scene._enemies[0]
	_scene._hero.position = entry["node"].position - Vector3(3.0, 0, 0)
	await wait_until(func() -> bool: return _actions_visible(), 6.0)
	var fighter: Fighter = _scene._hero.fighter
	fighter.hp = 1
	await _answer("chapitre", false)
	var button := await _wait_button()
	assert_not_null(button, "panneau de repli")
	button.pressed.emit()
	await wait_until(func() -> bool: return not _scene._busy, 5.0)
	assert_eq(fighter.hp, fighter.max_hp, "PV restaurés")
	assert_almost_eq(_scene._hero.position.x, _scene._level.entry_point(1).x, 0.5, "à l'entrée de la salle")
	assert_false(entry["defeated"], "l'ennemi attend toujours")


func test_balance_enigma_lights_a_pedestal() -> void:
	await _open("jules", 3)
	assert_true(_scene._level.is_door_open(2), "salles précédentes déjà franchies")
	var intro := await _wait_button()  # présentation de l'énigme à l'arrivée dans la salle
	if intro:
		intro.pressed.emit()
	await wait_until(func() -> bool: return not _scene._busy, 5.0)
	var pedestal: Dictionary = _scene._pedestals[0]
	_scene._hero.position = pedestal["node"].position + Vector3(0, 0, 1.2)
	var panel: QuestionPanel = await _wait_for(QuestionPanel)
	assert_not_null(panel, "question de l'énigme")
	assert_eq(panel.item["role"], "enigme")
	assert_eq(panel.find_children("*", "BalanceView", true, false).size(), 1, "balance dessinée")
	panel.answered.emit(str(panel.item["answer"]["value"]), 4000, false)
	await wait_until(func() -> bool: return pedestal["solved"], 5.0)
	assert_true(pedestal["solved"])


func test_mirror_enigma_takes_vector_coordinates() -> void:
	await _open("tom", 3)
	var intro := await _wait_button()
	if intro:
		intro.pressed.emit()
	await wait_until(func() -> bool: return not _scene._busy, 5.0)
	for i in 3:
		var pedestal: Dictionary = _scene._pedestals[i]
		_scene._hero.position = pedestal["node"].position + Vector3(0, 0, 1.2)
		var panel: QuestionPanel = await _wait_for(QuestionPanel)
		assert_not_null(panel)
		assert_eq(panel.find_children("*", "VectorWidget", true, false).size(), 1, "saisie (x ; y)")
		panel.answered.emit(panel.item["answer"]["value"], 4000, false)
		await wait_until(func() -> bool: return pedestal["solved"] and not _scene._busy, 6.0)
		_scene._hero.position = _scene._level.room_origin(3) + Vector3(8, 0, 15)
		await wait_process_frames(2)
	assert_true(_scene._level.is_door_open(3), "trois cristaux : la porte s'ouvre")


func test_boss_then_chest_completes_the_dungeon() -> void:
	await _open("jules", 5)
	var boss: Dictionary = _scene._enemies.filter(func(e: Dictionary) -> bool: return e["boss"])[0]
	_scene._hero.position = boss["node"].position - Vector3(3.0, 0, 0)
	await wait_until(func() -> bool: return _actions_visible(), 6.0)
	(boss["node"] as Fighter).hp = 1
	await _answer("chapitre", true)
	await wait_until(func() -> bool: return _scene._chest != null and not _scene._busy, 12.0)
	assert_not_null(_scene._chest, "coffre apparu")
	_scene._hero.position = _scene._chest.position + Vector3(-1.0, 0, 0)
	var button := await _wait_button(10.0)
	assert_not_null(button, "fin du donjon")
	assert_eq(int(SaveManager.dungeon("tour_fractions")["completed"]), 1)
	assert_eq(int(SaveManager.dungeon("tour_fractions")["checkpoint"]), 0, "rejouable depuis l'entrée")


func test_every_dungeon_builds_with_its_own_decor_and_enemies() -> void:
	for level in ["6e", "2nde"]:
		for def in DungeonDef.all_for_level(level):
			await _open("tom" if level == "2nde" else "jules", 0, def.code)
			assert_eq(_scene._def.code, def.code)
			assert_eq(_scene._level.room_count, def.room_count())
			assert_eq(_scene._enemies.size(), def.enemy_count(), def.code)
			assert_eq(_scene._pedestals.size(), 3, def.code)
			var pieces: Array = def.decor.get("walls", []) + def.decor.get("banners", [])
			for key in ["floor", "floor_accent"]:
				if def.decor.has(key):
					pieces.append(def.decor[key])
			for prop in def.decor.get("props", []):
				pieces.append(prop[0])
			for piece in pieces:
				assert_true(ResourceLoader.exists(DungeonLevel.DUNGEON % piece), "pièce de décor %s" % piece)
			for room in def.rooms:
				for enemy in room.get("enemies", []):
					assert_true(ResourceLoader.exists(Fighter.model_path(enemy["model"])), enemy["model"])
			_scene.queue_free()
			await wait_process_frames(2)


func test_dungeon_session_params_name_its_chapters_and_enigma() -> void:
	var forge := DungeonDef.by_code("2nde", "forge_algebre")
	var params := forge.session_params()
	assert_eq(params["mode"], "donjon")
	assert_eq(params["focus_chapters"], ["2nde.maths.calcul_litteral", "2nde.maths.equations", "2nde.maths.valeur_absolue"])
	assert_eq(params["enigma"]["generator"], "2nde.equations.signe")
	assert_eq(DungeonDef.by_code("6e", "inconnu").code, "tour_fractions", "code inconnu : premier donjon")


func test_rating_panel_returns_the_stars_or_zero() -> void:
	var panel := RatingPanel.new()
	panel.setup(WorldTheme.lumineux(), "Test")
	add_child_autofree(panel)
	watch_signals(panel)
	panel._choose(4)
	panel._choose(2)  # déjà noté : ignoré
	await wait_for_signal(panel.rated, 2.0)
	assert_signal_emitted_with_parameters(panel, "rated", [4])
	var skipped := RatingPanel.new()
	skipped.setup(WorldTheme.brouillard(), "Test")
	add_child_autofree(skipped)
	watch_signals(skipped)
	skipped._finish(0)
	assert_signal_emitted_with_parameters(skipped, "rated", [0])


func test_tap_path_goes_through_open_doors_only() -> void:
	await _open("jules")
	var level: DungeonLevel = _scene._level
	var to_room_1 := level.path(Vector3(3, 0, 4), level.room_origin(1) + Vector3(8, 0, 4))
	assert_eq(to_room_1.size(), 4, "porte ouverte : pied de l'escalier, passage, destination")
	assert_almost_eq(to_room_1[0].z, DungeonLevel.DOOR_Z, 0.01)
	var to_room_2 := level.path(Vector3(3, 0, 4), level.room_origin(2) + Vector3(8, 0, 4))
	assert_eq(to_room_2.size(), 5, "arrêt devant la porte fermée (en haut du 2e escalier)")


func test_dungeon_climbs_one_floor_per_room() -> void:
	await _open("jules")
	var level: DungeonLevel = _scene._level
	var rise := DungeonLevel.CLIMB_RISE
	assert_eq(level.room_origin(3).y, 3 * rise)
	var door_z := DungeonLevel.DOOR_Z
	var foot := level.room_origin(1) + Vector3(DungeonLevel.ROOM_W - DungeonLevel.STAIR_RUN, 0, door_z)
	assert_almost_eq(level.height_at(foot), rise, 0.01, "pied de l'escalier : sol de la salle")
	assert_almost_eq(level.height_at(foot + Vector3(DungeonLevel.STAIR_RUN / 2.0, 0, 0)), 1.5 * rise, 0.01, "à mi-hauteur")
	assert_almost_eq(level.height_at(foot + Vector3(0, 0, 4.0)), rise, 0.01, "à côté de l'escalier : sol plat")
	assert_eq(level.height_at(level.room_origin(5) + Vector3(15, 0, door_z)), 5 * rise, "pas d'escalier dans la dernière salle")
	assert_string_contains(level.floor_label(2), "Étage 3 / 6")


# --- Aides ----------------------------------------------------------------------

func _answer(action: String, correct: bool) -> void:
	_scene._hud.action_chosen.emit(action)
	var panel: QuestionPanel = await _wait_for(QuestionPanel)
	assert_not_null(panel, "panneau de question")
	var answer: Dictionary = panel.item["answer"]
	var value: Variant = AnswerInputs.correct_for(answer) if correct else "0/7"
	if not correct and answer["kind"] == "choice":
		value = 99
	panel.answered.emit(value, 1500, false)
	if not correct:
		var explanation: ExplanationPanel = await _wait_for(ExplanationPanel)
		assert_not_null(explanation, "explication après une erreur")
		explanation.closed.emit()


func _wait_for(type: Variant, timeout := 8.0) -> Node:
	var found: Array = []
	await wait_until(func() -> bool:
		found.clear()
		found.append_array(_scene._hud.find_children("*", "", true, false).filter(
			func(n: Node) -> bool: return is_instance_of(n, type) and not n.is_queued_for_deletion()))
		return not found.is_empty(), timeout)
	return found[0] if not found.is_empty() else null


## Bouton principal d'un panneau de message (intro, repli, fin).
func _wait_button(timeout := 3.0) -> Button:
	var found: Array = []
	await wait_until(func() -> bool:
		found.clear()
		for panel in _scene._hud._overlay.find_children("*", "PanelContainer", true, false):
			if panel is QuestionPanel or panel is ExplanationPanel or panel.is_queued_for_deletion():
				continue
			found.append_array(panel.find_children("*", "Button", true, false))
		return not found.is_empty(), timeout)
	return found[0] if not found.is_empty() else null


func _actions_visible() -> bool:
	return _scene._hud != null and _scene._hud._actions.visible
