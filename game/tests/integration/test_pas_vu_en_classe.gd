extends GutTest
## « Pas vu en classe » : l'enfant met une notion de côté depuis le panneau de question ;
## une autre question la remplace, rien n'est compté, et la notion n'est plus posée.

var _saved_token := ""
var _saved_queue: Array = []
var _saved_aside_queue: Array = []
var _panel: QuestionPanel


func before_each() -> void:
	_saved_token = ApiClient.token
	ApiClient.token = ""  # pas d'envoi réseau pendant les tests
	_saved_queue = Session._queue.duplicate()
	_saved_aside_queue = Session._aside_queue.duplicate()
	Session._queue.clear()
	Session._aside_queue.clear()
	Session.aside.clear()
	QuestionService.reset()
	Session._apply_pack(JSON.parse_string(FileAccess.get_file_as_string("res://tests/fixtures/pack_6e.json")))


func after_each() -> void:
	if is_instance_valid(_panel):
		_panel.queue_free()
	await wait_process_frames(2)
	ApiClient.token = _saved_token
	Session._queue = _saved_queue
	Session._aside_queue = _saved_aside_queue
	Session._save_json(Session.QUEUE_FILE, Session._queue)
	Session._save_json(Session.ASIDE_FILE, Session._aside_queue)  # ne pas laisser de faux envois
	Session.aside.clear()
	Session.items = []
	Session.formulas = {}


func test_the_question_is_replaced_and_the_notion_never_comes_back() -> void:
	var first := QuestionService.next_item("chapitre")
	var notion: String = first["notions"][0]
	_panel = QuestionPanel.new()
	_panel.setup(first, "Sort", WorldTheme.lumineux())
	add_child(_panel)
	await wait_process_frames(2)
	_panel._aside_button.pressed.emit()
	assert_eq(_panel.item["id"], first["id"], "un seul appui ne fait rien : il faut confirmer")
	assert_eq(_panel._aside_button.text, "Sûr ? Pas encore vu")
	_panel._aside_button.pressed.emit()
	await wait_process_frames(2)
	assert_ne(_panel.item["id"], first["id"], "une autre question remplace la première")
	assert_false(notion in _panel.item["notions"])
	assert_eq(_panel.item["role"], "chapitre", "même rôle (le sort reste un sort)")
	assert_true(Session.aside.has(notion))
	assert_eq(Session._aside_queue.size(), 1, "envoi au serveur en attente (hors connexion)")
	assert_eq(QuestionService.answered, 0, "rien n'est compté : ni erreur, ni réussite")
	for i in 40:
		var next := QuestionService.next_item("chapitre")
		assert_false(notion in next["notions"], "la notion mise de côté n'est plus posée")


func test_no_aside_button_on_an_enigma() -> void:
	var enigma := {"id": "e1", "role": "enigme", "notions": ["6e.maths.prealgebre.balance"], "type": "mcq",
		"prompt": "?", "choices": ["1", "2"], "answer": {"kind": "choice", "index": 0}, "difficulty": 1}
	assert_false(QuestionPanel.can_set_aside(enigma))
	var question := QuestionService.next_item("chapitre")
	assert_true(QuestionPanel.can_set_aside(question))
