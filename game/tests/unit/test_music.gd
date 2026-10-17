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


func test_every_quest_scene_exists() -> void:
	for scene: String in Music.FOCUS_SCENES:
		assert_true(ResourceLoader.exists(scene), scene)
