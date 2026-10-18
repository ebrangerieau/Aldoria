extends GutTest
## Musique du jeu (autoload Music) : partout, sauf pendant une quête où l'enfant doit rester concentré.

var _saved_prefs: Dictionary


func before_each() -> void:
	_saved_prefs = Accessibility.prefs.duplicate()


func after_each() -> void:
	Accessibility.prefs = _saved_prefs


func test_the_music_is_found() -> void:
	assert_true(Music.is_loaded(), "deploy/musique/theme.mp3 lue sur PC")


func test_silent_during_a_quest() -> void:
	for scene: String in Music.FOCUS_SCENES:
		assert_eq(Music.wanted_gain(scene), 0.0, scene)
	assert_true(Music.FOCUS_SCENES.has("res://scenes/dungeon/dungeon.tscn"))
	for scene in [Departure.MAP_SCENE, Departure.CITADEL_SCENE, Prologue.SCENE]:
		assert_eq(Music.wanted_gain(scene), 1.0, scene)


func test_the_child_can_turn_it_off() -> void:
	Accessibility.prefs["music"] = 0.0
	assert_eq(Music.wanted_gain(Departure.MAP_SCENE), 0.0)


func test_the_button_turns_it_off_and_back_on() -> void:
	Accessibility.prefs["music"] = 0.5
	Music.toggle()
	assert_true(Music.is_muted())
	assert_eq(Music.wanted_gain(Departure.MAP_SCENE), 0.0)
	Music.toggle()
	assert_false(Music.is_muted())
	assert_eq(Accessibility.music_volume(), 0.5, "le volume choisi dans les Options est gardé")


func test_the_button_brings_back_a_music_set_to_zero() -> void:
	Accessibility.prefs["music"] = 0.0
	Music.toggle()
	assert_false(Music.is_muted())
	assert_gt(Accessibility.music_volume(), 0.0)


func test_the_button_is_in_the_bottom_left_corner() -> void:
	Accessibility.prefs.erase("music_off")
	var screen_node := Node.new()  # un écran ordinaire (les tests tournent sans scène en cours)
	get_tree().root.add_child(screen_node)
	var before := get_tree().current_scene
	get_tree().current_scene = screen_node
	await wait_frames(2)
	assert_true(Music.shows_button(), "affiché hors d'une quête")
	if not Music.shows_button():
		return
	var button := Music.button()
	var screen := button.get_viewport_rect().size
	var rect := button.get_global_rect()
	assert_lt(rect.position.x, 40.0)
	assert_gt(rect.end.y, screen.y - 40.0)
	assert_eq(button.tooltip_text, "Couper la musique")
	button.pressed.emit()
	assert_eq(button.tooltip_text, "Remettre la musique")
	assert_true(Music.is_muted())
	get_tree().current_scene = before
	screen_node.queue_free()


func test_every_quest_scene_exists() -> void:
	for scene: String in Music.FOCUS_SCENES:
		assert_true(ResourceLoader.exists(scene), scene)
