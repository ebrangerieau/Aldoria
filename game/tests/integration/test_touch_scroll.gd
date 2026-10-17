extends GutTest
## Défilement au doigt (TouchScroll) : une fenêtre trop haute pour un téléphone défile même quand le
## doigt se pose sur un bouton, et ce bouton ne se déclenche pas.


func _touch(index: int, at: Vector2, pressed: bool) -> void:
	var e := InputEventScreenTouch.new()
	e.index = index
	e.position = at
	e.pressed = pressed
	get_viewport().push_input(e, true)


func _drag(index: int, at: Vector2, relative: Vector2) -> void:
	var e := InputEventScreenDrag.new()
	e.index = index
	e.position = at
	e.relative = relative
	get_viewport().push_input(e, true)


func test_a_finger_scrolls_a_tall_panel_even_over_a_button() -> void:
	var box := VBoxContainer.new()
	var pressed: Array = []
	for i in 12:
		var b := UiKit.button("Bouton %d" % i, 64.0)
		b.pressed.connect(func() -> void: pressed.append(i))
		box.add_child(b)
	# Comme UiKit.fitted, à une hauteur fixe (la fenêtre de test est plus haute qu'un téléphone).
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.add_child(box)
	TouchScroll.attach(scroll)
	add_child_autofree(scroll)
	scroll.size = Vector2(400, 200)
	await wait_process_frames(3)
	var on_button := Vector2(100, 40)
	_touch(0, on_button, true)
	for step in 6:
		_drag(0, on_button - Vector2(0, 20 * (step + 1)), Vector2(0, -20))
	await wait_process_frames(2)
	assert_gt(scroll.scroll_vertical, 60, "le doigt fait défiler, même posé sur un bouton")
	_touch(0, on_button - Vector2(0, 120), false)
	await wait_process_frames(3)
	assert_eq(pressed, [], "après un défilement, le bouton touché au départ ne se déclenche pas")
