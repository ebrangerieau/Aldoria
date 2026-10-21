extends GutTest
## Île du Sphinx : passages gagnés par les activités (au moins six réponses), réserve limitée,
## paliers des énigmes, et une traversée jouée hors réseau avec l'aide du Sphinx.

var _scene: Node
var _saved_token := ""


func before_each() -> void:
	_saved_token = ApiClient.token
	ApiClient.token = ""
	Session._queue.clear()
	Session.profile = {"name": "Test", "world": "lumineux", "level": "6e"}
	SaveManager._profile_id = 0
	SaveManager.data = SaveManager.default_data()


func after_each() -> void:
	if is_instance_valid(_scene):
		_scene.queue_free()
	await wait_process_frames(2)
	ApiClient.token = _saved_token
	Session._queue.clear()
	Session._save_json(Session.QUEUE_FILE, Session._queue)
	Session.mode = ""
	Session.answered = 0
	Session.profile = {}
	SaveManager.data = SaveManager.default_data()


func _end_activity(mode: String, answers: int) -> void:
	Session.mode = mode
	Session.answered = answers
	await Session.end()


func test_an_activity_earns_a_passage() -> void:
	await _end_activity("donjon", SphinxIsland.PASS_ANSWERS - 1)
	assert_eq(SaveManager.sphinx_passes(), 0, "une activité à peine commencée ne compte pas")
	await _end_activity("defi", SphinxIsland.PASS_ANSWERS)
	assert_eq(SaveManager.sphinx_passes(), 1)
	await _end_activity("sphinx", 40)
	assert_eq(SaveManager.sphinx_passes(), 1, "l'île elle-même ne rapporte pas de passage")
	for i in 4:
		await _end_activity("village", 9)
	assert_eq(SaveManager.sphinx_passes(), SphinxIsland.MAX_PASSES, "réserve limitée")
	assert_eq(SaveManager.take_passage_news(), SphinxIsland.MAX_PASSES)
	assert_eq(SaveManager.take_passage_news(), 0, "annoncés une seule fois")
	assert_eq(Session.answered, 0)


func test_answers_are_counted_by_session() -> void:
	Session.mode = "arene"
	Session.answered = 0
	var item := {"id": "test:1", "difficulty": 1, "notions": ["x"]}
	for i in 3:
		Session.record_attempt(item, true, 1000, false)
	assert_eq(Session.answered, 3)


func test_tiers() -> void:
	assert_eq(SphinxIsland.start_tier("6e"), 1)
	assert_eq(SphinxIsland.start_tier("2nde"), 2)
	assert_eq(int(SaveManager.sphinx()["tier"]), 1)
	assert_false(SaveManager.record_sphinx_solved(true), "avec l'aide du Sphinx : pas de palier")
	for i in SphinxIsland.TIER_UP - 1:
		assert_false(SaveManager.record_sphinx_solved(false))
	assert_true(SaveManager.record_sphinx_solved(false))
	assert_eq(int(SaveManager.sphinx()["tier"]), 2)
	assert_eq(int(SaveManager.sphinx()["solved"]), SphinxIsland.TIER_UP + 1)
	var first := SaveManager.next_sphinx_puzzle()
	var second := SaveManager.next_sphinx_puzzle()
	assert_eq(first, {"tier": 2, "index": 0})
	assert_eq(second, {"tier": 2, "index": 1}, "jamais deux fois la même énigme de suite")


func _button(text: String) -> Button:
	var found: Array = []
	await wait_until(func() -> bool:
		found.clear()  # la lambda garde une copie des variables locales : on remplit le tableau
		found.append_array(_scene.find_children("*", "Button", true, false).filter(func(b: Button) -> bool:
			return b.text == text and b.is_visible_in_tree() and not b.is_queued_for_deletion()))
		return not found.is_empty(), 10.0)
	return found[0] if not found.is_empty() else null


func test_a_crossing_with_the_sphinx_help() -> void:
	SaveManager.earn_passage()
	_scene = (load(SphinxIsland.SCENE) as PackedScene).instantiate()
	add_child(_scene)
	var start := await _button("Au premier bloc !")
	assert_not_null(start, "le Sphinx accueille l'enfant la première fois")
	assert_eq(SaveManager.sphinx_passes(), 0, "la traversée coûte un passage")
	start.pressed.emit()
	await wait_until(func() -> bool: return _scene._playing, 5.0)
	var board: SphinxBoard = _scene._board
	assert_eq(int(SaveManager.sphinx()["next"]["1"]), 1, "première énigme du palier 1")
	# Un pas au clavier, puis annulé.
	var moved := false
	for letter in ["l", "r", "u", "d"]:
		if board.is_free(board.player + SphinxBoard.DIRS[letter]):
			await _scene._try_step(letter)
			moved = true
			break
	assert_true(moved)
	assert_eq(board.moves, 1)
	await _scene._undo()
	assert_eq(board.moves, 0)
	# Trois appels à l'aide : le troisième montre toute la solution.
	for i in 3:
		if _scene._playing:
			await _scene._help()
	assert_true(board.is_solved())
	var next := await _button("Énigme suivante")
	assert_not_null(next)
	assert_eq(int(SaveManager.sphinx()["solved"]), 1)
	assert_eq(int(SaveManager.sphinx()["streak"]), 0, "résolue avec de l'aide : ne compte pas pour le palier")
	next.pressed.emit()
	await wait_until(func() -> bool: return _scene._playing, 5.0)
	assert_ne(_scene._board, board, "une nouvelle salle")
	assert_string_contains(_scene._hud._wave.text, "2 / 3")
	assert_eq(Session.answered, 0, "aucune question de leçon sur l'île")
