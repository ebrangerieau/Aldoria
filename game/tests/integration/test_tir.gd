extends GutTest
## Stand de tir de la Lice : rapporteur (Jules), droite de l'arbalète (Tom), panneau de visée,
## et une série jouée hors réseau (seul le premier tir de chaque cible est une réponse).

var _scene: Node
var _saved_token := ""


func before_each() -> void:
	_saved_token = ApiClient.token
	ApiClient.token = ""
	Session._queue.clear()
	SaveManager._profile_id = 0
	SaveManager.data = SaveManager.default_data()


func after_each() -> void:
	if is_instance_valid(_scene):
		_scene.queue_free()
	await wait_process_frames(2)
	ApiClient.token = _saved_token
	Session._queue.clear()
	Session._save_json(Session.QUEUE_FILE, Session._queue)  # ne pas laisser de fausses réponses
	Session.items = []
	Session.profile = {}
	SaveManager.data = SaveManager.default_data()


func _angle_item(i: int, angle: int, left := false) -> Dictionary:
	return {
		"id": "test:angle:%d" % i, "role": "enigme", "difficulty": 4 if left else 2, "notions": ["6e.maths.angles.mesure"],
		"type": "numeric", "prompt": "Mesure l'angle.", "hint": "Pars de 0.", "explanation": "La cible est à %d°." % angle,
		"answer": {"kind": "number", "value": str(angle)},
		"visual": {"kind": "rapporteur", "angle": angle, "reference": "gauche" if left else "droite", "minor": 10,
			"labels": 10 if left else 30, "double_scale": left, "distance": 5.5},
	}


func _line_item(i: int) -> Dictionary:
	return {
		"id": "test:droite:%d" % i, "role": "enigme", "difficulty": 4, "notions": ["2nde.maths.geometrie_reperee.droites"],
		"type": "numeric", "prompt": "Coefficient directeur ?", "hint": "Δy ÷ Δx.", "explanation": "a = 3/4.",
		"answer": {"kind": "fraction", "value": "3/4", "accept_equivalent": true},
		"visual": {"kind": "repere_tir", "start": [0, 2], "target": [8, 8], "width": 10, "height": 8},
	}


func test_protractor_directions() -> void:
	var range := ProtractorRange.new()
	add_child_autofree(range)
	range.setup(_angle_item(0, 60)["visual"], WorldTheme.lumineux())
	assert_almost_eq(range.direction(0).x, 1.0, 0.001, "ligne de départ à droite : 0° vers l'est")
	assert_almost_eq(range.direction(90).z, -1.0, 0.001, "90° : droit devant (nord)")
	assert_almost_eq(range.facing(0), 90.0, 0.001)
	range.setup(_angle_item(1, 60, true)["visual"], WorldTheme.lumineux())
	assert_almost_eq(range.direction(0).x, -1.0, 0.001, "ligne de départ à gauche : 0° vers l'ouest")
	assert_almost_eq(range.direction(60).x, -0.5, 0.001)


func test_crossbow_line() -> void:
	var range := LineRange.new()
	add_child_autofree(range)
	range.setup(_line_item(0)["visual"], WorldTheme.brouillard())
	assert_true(range.hits(3, 4))
	assert_true(range.hits(6, 8), "fraction équivalente")
	assert_false(range.hits(1, 1))
	assert_eq(LineRange.height_at(1, 1, 2, 8), Vector2i(10, 1), "a = 1 : y = 10 à x = 8")
	assert_eq(LineRange.height_at(1, 2, 2, 3), Vector2i(7, 2), "y = 1/2 × 3 + 2 = 7/2")


func test_aim_panel_values() -> void:
	var panel := TirPanel.new().setup(_line_item(0), WorldTheme.brouillard(), "Cible")
	add_child_autofree(panel)
	panel.set_aim(0, -3, 4)
	assert_eq(panel.value(), "-3/4")
	panel.set_aim(0, 2, 1)
	assert_eq(panel.value(), "2")
	var angle := TirPanel.new().setup(_angle_item(0, 40), WorldTheme.lumineux(), "Cible")
	add_child_autofree(angle)
	angle._change_angle(1)
	angle._change_angle(1)
	assert_eq(angle.value(), "20", "pas de 10° (graduations de la difficulté)")


func _wait_panel() -> TirPanel:
	var found: Array = []
	await wait_until(func() -> bool:
		found.clear()  # une fonction anonyme ne peut pas réaffecter `found` : on la remplit
		found.append_array(_scene.find_children("*", "", true, false).filter(func(n: Node) -> bool: return n is TirPanel and not n.is_queued_for_deletion()))
		return not found.is_empty(), 6.0)
	return found[0] if not found.is_empty() else null


## Attend la fin d'une cible (son panneau disparaît) sans retenir l'objet, qui sera libéré.
func _wait_gone(panel: TirPanel) -> void:
	var id := panel.get_instance_id()
	await wait_until(func() -> bool:
		var node := instance_from_id(id)
		return node == null or (node as Node).is_queued_for_deletion(), 6.0)


func test_a_series_records_only_first_shots() -> void:
	Session.profile = {"name": "Test", "world": "lumineux", "level": "6e"}
	Session.items = []
	for i in TirScene.ROUNDS:
		Session.items.append(_angle_item(i, 30 + 10 * i, i % 2 == 1))
	_scene = (load(TirScene.SCENE) as PackedScene).instantiate()
	add_child(_scene)
	await wait_process_frames(3)
	var intro: Button = _scene.find_children("*", "Button", true, false).filter(func(b: Button) -> bool: return b.text == "À mes cibles !")[0]
	intro.pressed.emit()
	# Première cible : un raté (le piège de l'autre graduation n'est pas en jeu ici), puis juste.
	var panel := await _wait_panel()
	var angle := int(panel.item["visual"]["angle"])
	panel.fired.emit(str(angle + 10))
	await wait_until(func() -> bool: return not panel._locked, 4.0)
	assert_string_contains(panel._feedback.text, "plus petit")
	panel.fired.emit(str(angle))
	await _wait_gone(panel)
	assert_eq(Session._queue.size(), 1, "seul le premier tir compte")
	assert_false(Session._queue[0]["correct"])
	assert_eq(Session._queue[0]["game_mode"], "tir")
	# Deuxième cible (ligne de départ à gauche) : le piège 180 − angle est reconnu.
	panel = await _wait_panel()
	angle = int(panel.item["visual"]["angle"])
	panel.fired.emit(str(180 - angle))
	await wait_until(func() -> bool: return not panel._locked, 4.0)
	assert_string_contains(panel._feedback.text, "graduation")
	panel.fired.emit(str(angle))
	await _wait_gone(panel)
	assert_eq(Session._queue.size(), 2)
	assert_gt(SaveManager.xp(), 0, "cibles touchées : de l'expérience")
