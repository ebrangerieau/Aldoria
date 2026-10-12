extends GutTest
## Déplacement du héros : clavier (ou manette) et trajet par points de passage,
## avec glissement contre les murs. Saisie des coordonnées d'un vecteur.

var _level: DungeonLevel
var _hero: HeroController


func before_each() -> void:
	_level = DungeonLevel.new()
	add_child(_level)
	_level.build(3)
	_hero = HeroController.create(Wardrobe.default_look("jules"), "Test", 100)
	_hero.position = Vector3(6, 0, 10)
	add_child(_hero)


func after_each() -> void:
	Input.action_release("move_right")
	_hero.queue_free()
	_level.queue_free()
	await wait_process_frames(2)


func test_keyboard_moves_the_hero() -> void:
	Input.action_press("move_right")
	await wait_physics_frames(30)
	Input.action_release("move_right")
	assert_gt(_hero.position.x, 7.0, "le héros avance vers l'est")
	assert_almost_eq(_hero.position.z, 10.0, 0.1)


func test_closed_door_blocks_the_way() -> void:
	_level.open_door(0, false)
	_hero.position = Vector3(30, 0, 10)  # salle 1, devant la porte fermée vers la salle 2
	Input.action_press("move_right")
	await wait_physics_frames(60)
	Input.action_release("move_right")
	assert_lt(_hero.position.x, DungeonLevel.ROOM_W * 2, "porte fermée : on ne passe pas")


func test_waypoints_lead_through_an_open_door() -> void:
	_level.open_door(0, false)
	_hero.go_to(_level.path(_hero.position, Vector3(24, 0, 4)))
	await wait_until(func() -> bool: return _hero.position.distance_to(Vector3(24, 0, 4)) < 0.6, 8.0)
	assert_almost_eq(_hero.position.x, 24.0, 0.6, "arrivé dans la salle suivante")


func test_vector_widget_emits_both_coordinates() -> void:
	var widget := VectorWidget.new()
	widget.setup(WorldTheme.tom())
	add_child_autofree(widget)
	watch_signals(widget)
	for key in ["3", ";", "−", "2"]:
		widget._press(key)
	widget._press("OK")
	assert_signal_emitted_with_parameters(widget, "submitted", [["3", "−2"]])
	assert_true(AnswerChecker.check({"kind": "vector", "value": ["3", "-2"]}, ["3", "−2"]))


func test_touch_stick_tap_and_drag() -> void:
	var stick := TouchStick.new()
	stick.setup(Color.WHITE)
	add_child_autofree(stick)
	watch_signals(stick)
	stick._gui_input(_mouse_button(Vector2(400, 300), true))
	stick._gui_input(_mouse_button(Vector2(402, 301), false))
	assert_signal_emitted_with_parameters(stick, "tapped", [Vector2(402, 301)])

	stick._gui_input(_mouse_button(Vector2(400, 300), true))
	var motion := InputEventMouseMotion.new()
	motion.position = Vector2(490, 300)
	stick._gui_input(motion)
	assert_almost_eq(stick.vector.x, 1.0, 0.01, "glisser vers la droite")
	assert_almost_eq(stick.vector.y, 0.0, 0.01)
	stick._gui_input(_mouse_button(Vector2(490, 300), false))
	assert_eq(stick.vector, Vector2.ZERO, "relâché : le héros s'arrête")
	assert_signal_emit_count(stick, "tapped", 1, "un glissé n'est pas un toucher")


func _mouse_button(at: Vector2, pressed: bool) -> InputEventMouseButton:
	var event := InputEventMouseButton.new()
	event.button_index = MOUSE_BUTTON_LEFT
	event.pressed = pressed
	event.position = at
	return event
