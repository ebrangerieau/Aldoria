extends GutTest
## Pont des fractions (Jules) : fractions exactes, panneau des planches, pont posé à la bonne
## longueur, et une série jouée hors réseau (seul le premier pont de chaque ravin est une réponse).

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


func _item(i: int, gap := "5/6") -> Dictionary:
	return {
		"id": "test:pont:%d" % i, "role": "enigme", "difficulty": 4, "notions": ["6e.maths.fractions.addition"],
		"type": "numeric", "prompt": "Le ravin mesure %s de perche." % gap, "hint": "Compte tout en sixièmes.",
		"explanation": "Par exemple : 1/2 + 1/3 = 5/6.",
		"answer": {"kind": "fraction", "value": gap, "accept_equivalent": true},
		"visual": {"kind": "pont", "gap": gap, "planks": [{"length": "1/2", "count": 2}, {"length": "1/3", "count": 2}]},
	}


func test_exact_fractions() -> void:
	assert_eq(ChasmBridge.total(["1/2", "1/3"]), Vector2i(5, 6))
	assert_eq(ChasmBridge.total(["1/2", "1/3", "1/6"]), Vector2i(1, 1), "réduite : 6/6 = 1")
	assert_eq(ChasmBridge.write(ChasmBridge.total(["3/4", "2/3"])), "17/12")
	assert_eq(ChasmBridge.compare(Vector2i(2, 3), Vector2i(4, 6)), 0)
	assert_lt(ChasmBridge.compare(Vector2i(3, 4), Vector2i(5, 6)), 0)
	assert_eq(ChasmBridge.parse("1"), Vector2i(1, 1))
	var stock := [{"length": "1/2", "count": 1}, {"length": "1/3", "count": 2}]
	assert_eq(ChasmBridge.total(ChasmBridge.solve(stock, Vector2i(7, 6))), Vector2i(7, 6))
	assert_eq(ChasmBridge.solve(stock, Vector2i(3, 2)), [], "il faudrait trois demis")
	assert_almost_eq(ChasmBridge.meters(Vector2i(1, 2)), ChasmBridge.PERCHE / 2.0, 0.001)


func test_panel_keeps_the_stock() -> void:
	var panel := PontPanel.new().setup(_item(0), WorldTheme.lumineux(), "Ravin")
	add_child_autofree(panel)
	var piles: Array = []
	panel.changed.connect(func(lengths: Array) -> void: piles.append(lengths))
	panel._take(0)
	panel._take(0)
	panel._take(0)  # plus de demi-planche en réserve
	assert_eq(panel.chosen(), ["1/2", "1/2"])
	assert_true(panel._buttons[0].disabled)
	panel._put_back()
	panel._take(1)
	assert_eq(panel.chosen(), ["1/2", "1/3"])
	assert_eq(piles[-1], ["1/2", "1/3"], "le tas suit le choix")
	assert_string_contains(panel._choice.text, "1/2 + 1/3")


func test_bridge_outcomes() -> void:
	var bridge := ChasmBridge.new()
	add_child_autofree(bridge)
	bridge.setup(_item(0)["visual"], WorldTheme.lumineux())
	bridge.set_pile(["1/2", "1/3"])
	assert_eq(bridge.pile_count(), 2)
	assert_eq(await bridge.build(), "juste")
	var joints := bridge.joints()
	assert_almost_eq(joints[0].x, -bridge.gap_meters() / 2.0 + ChasmBridge.meters(Vector2i(1, 2)) / 2.0, 0.01, "posée depuis la rive ouest")
	bridge.setup(_item(1)["visual"], WorldTheme.lumineux())
	bridge.set_pile(["1/2"])
	assert_eq(await bridge.build(), "court")
	await bridge.collapse()
	assert_eq(bridge.joints().size(), 0, "le pont raté est tombé")
	bridge.set_pile(["1/2", "1/2"])
	assert_eq(await bridge.build(), "long")


func _wait_panel() -> PontPanel:
	var found: Array = []
	await wait_until(func() -> bool:
		found.clear()
		found.append_array(_scene.find_children("*", "", true, false).filter(func(n: Node) -> bool: return n is PontPanel and not n.is_queued_for_deletion()))
		return not found.is_empty(), 6.0)
	return found[0] if not found.is_empty() else null


func _wait_gone(panel: PontPanel) -> void:
	var id := panel.get_instance_id()
	await wait_until(func() -> bool:
		var node := instance_from_id(id)
		return node == null or (node as Node).is_queued_for_deletion(), 12.0)


func test_a_series_records_only_first_bridges() -> void:
	Session.profile = {"name": "Test", "world": "lumineux", "level": "6e"}
	Session.items = []
	for i in PontScene.ROUNDS:
		Session.items.append(_item(i))
	_scene = (load(PontScene.SCENE) as PackedScene).instantiate()
	add_child(_scene)
	await wait_process_frames(3)
	var intro: Button = _scene.find_children("*", "Button", true, false).filter(func(b: Button) -> bool: return b.text == "Au premier ravin !")[0]
	intro.pressed.emit()
	# Premier ravin : trop court, puis juste.
	var panel := await _wait_panel()
	panel.choose(["1/2"])
	panel.built.emit(panel.chosen())
	await wait_until(func() -> bool: return not panel._locked, 6.0)
	assert_string_contains(panel._feedback.text, "Trop court")
	assert_eq(panel.chosen(), ["1/2"], "le choix reste, à corriger")
	panel.choose(["1/2", "1/3"])
	panel.built.emit(panel.chosen())
	await _wait_gone(panel)
	assert_eq(Session._queue.size(), 1, "seul le premier pont compte")
	assert_false(Session._queue[0]["correct"])
	assert_eq(Session._queue[0]["game_mode"], "pont")
	# Deuxième ravin : trop long, la réponse enregistrée est la somme posée.
	panel = await _wait_panel()
	panel.choose(["1/2", "1/2"])
	panel.built.emit(panel.chosen())
	await wait_until(func() -> bool: return not panel._locked, 6.0)
	assert_string_contains(panel._feedback.text, "1/2 + 1/2 = 1")
	assert_string_contains(panel._feedback.text, "Trop long")
	panel.choose(["1/3", "1/2"])
	panel.built.emit(panel.chosen())
	await _wait_gone(panel)
	assert_eq(Session._queue.size(), 2)
	assert_gt(SaveManager.xp(), 0, "ravins franchis : de l'expérience")
