extends GutTest
## Prologue (docs/histoire.md §8) : textes des deux mondes (courts, règle « dys »), mise en
## scène de chaque tableau, fin qui range l'histoire comme vue.

var _scene: Prologue
var _saved_token := ""


func before_each() -> void:
	_saved_token = ApiClient.token
	ApiClient.token = ""  # pas de réseau : la sauvegarde reste en mémoire
	SaveManager._profile_id = 0
	SaveManager.data = SaveManager.default_data()
	Prologue.return_to = ""  # pas de changement de scène pendant les tests


func after_each() -> void:
	if is_instance_valid(_scene):
		_scene.queue_free()
	await wait_process_frames(2)
	ApiClient.token = _saved_token
	Session.profile = {}
	SaveManager.data = SaveManager.default_data()
	Prologue.return_to = Departure.MAP_SCENE


func _open(world: String) -> void:
	Session.profile = {"name": "Test", "world": world, "level": "6e"}
	_scene = (load(Prologue.SCENE) as PackedScene).instantiate()
	add_child(_scene)
	await wait_process_frames(2)


func test_texts_exist_for_both_worlds_and_stay_short() -> void:
	for entry: Dictionary in Prologue.PAGES:
		assert_true(Prologue.SHOTS.has(entry["shot"]), "caméra du tableau %s" % entry["shot"])
		for world in ["lumineux", "brouillard"]:
			var text := str(entry.get(world, ""))
			assert_ne(text, "", "%s : texte du monde %s" % [entry["title"], world])
			for sentence in text.replace("?", ".").replace("!", ".").split(".", false):
				var words := sentence.strip_edges().split(" ", false).size()
				assert_true(words <= 20, "phrase trop longue (%d mots) : %s" % [words, sentence])


func test_each_tableau_shows_its_characters() -> void:
	await _open("lumineux")
	assert_eq(_scene.page, 0)
	assert_true(_scene._ysaline.visible, "Maître Ysaline près de la Chronique")
	assert_false(_scene._malvrek.visible)
	await _scene.show_page(1, false)
	assert_true(_scene._malvrek.visible, "la nuit du vol : Malvrek")
	assert_true(_scene._paper.emitting, "les pages s'envolent")
	await _scene.show_page(2, false)
	assert_true(_scene._villager.visible, "un habitant qui a oublié")
	assert_true(_scene._env.fog_enabled, "le Brouillard de l'Oubli")
	await _scene.show_page(3, false)
	assert_true(_scene._hero.visible and _scene._ysaline.visible)
	assert_not_null(_scene._pet, "le renard dans le monde de Jules")
	assert_false(_scene._env.fog_enabled)


func test_tom_reads_his_own_text() -> void:
	await _open("brouillard")
	assert_null(_scene._pet, "pas de renard dans le Brouillard")
	assert_eq(_scene.text_of(1), str(Prologue.PAGES[1]["brouillard"]))


func test_last_page_or_skip_marks_the_story_seen() -> void:
	await _open("lumineux")
	assert_false(SaveManager.story_seen(Prologue.STORY_KEY))
	await _scene.show_page(Prologue.PAGES.size() - 1, false)
	await _scene.next()
	assert_true(SaveManager.story_seen(Prologue.STORY_KEY), "vu une fois : la carte ne le relance plus")
