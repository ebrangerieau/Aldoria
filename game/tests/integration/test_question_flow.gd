extends GutTest
## Parcours question → réponse sur de vrais paquets exportés par l'API
## (tools/export_pack_fixture.py) : QuestionService, Session (file locale),
## QuestionPanel et ses widgets.

var _saved_token := ""
var _saved_queue: Array = []


func before_each() -> void:
	_saved_token = ApiClient.token
	ApiClient.token = ""  # pas d'envoi réseau pendant les tests
	_saved_queue = Session._queue.duplicate()
	Session._queue.clear()
	QuestionService.reset()


func after_each() -> void:
	ApiClient.token = _saved_token
	Session._queue = _saved_queue
	Session._save_json(Session.QUEUE_FILE, Session._queue)  # ne pas laisser de fausses réponses
	Session.items = []
	Session.formulas = {}


func _load_pack(level: String) -> void:
	var path := "res://tests/fixtures/pack_%s.json" % level
	Session._apply_pack(JSON.parse_string(FileAccess.get_file_as_string(path)))


func _correct_input(item: Dictionary) -> Variant:
	var answer: Dictionary = item["answer"]
	if answer["kind"] == "choice":
		return int(answer["index"])
	return str(answer["value"])


func test_next_item_respects_role_and_starts_easy() -> void:
	_load_pack("6e")
	for role in ["automatisme", "chapitre"]:
		var item := QuestionService.next_item(role)
		assert_eq(item["role"], role)
		assert_eq(int(item["difficulty"]), 1, "on commence au niveau 1")


func test_difficulty_rises_after_two_successes_and_drops_after_error() -> void:
	_load_pack("2nde")
	for i in 2:
		var easy := QuestionService.next_item("chapitre")
		assert_true(QuestionService.submit(easy, _correct_input(easy), 5000, false).correct)
	assert_eq(QuestionService.level_for("chapitre"), 2)
	var item := QuestionService.next_item("chapitre")
	assert_eq(int(item["difficulty"]), 2)
	assert_false(QuestionService.submit(item, "n'importe quoi", 5000, false).correct)
	assert_eq(QuestionService.level_for("chapitre"), 1)


func test_failed_notion_comes_back_in_another_form() -> void:
	_load_pack("6e")
	var failed := QuestionService.next_item("chapitre")
	QuestionService.submit(failed, "0/1", 4000, false)
	var seen_again := false
	for i in 4:
		var item := QuestionService.next_item("chapitre")
		assert_ne(item["id"], failed["id"], "jamais exactement la même question")
		if failed["notions"][0] in item["notions"]:
			seen_again = true
		QuestionService.submit(item, _correct_input(item), 4000, false)
	assert_true(seen_again)


func test_random_clicking_reduces_rewards_silently() -> void:
	_load_pack("6e")
	for i in 3:
		var rushed := QuestionService.next_item("automatisme")
		QuestionService.submit(rushed, 99, 200, false)  # très rapide et faux
	var item := QuestionService.next_item("automatisme")
	var result := QuestionService.submit(item, _correct_input(item), 2000, false)
	assert_true(result.correct)
	assert_eq(result.reward_factor, 0.5)


func test_every_answer_is_queued_locally_with_uuid() -> void:
	_load_pack("6e")
	var item := QuestionService.next_item("automatisme")
	QuestionService.submit(item, _correct_input(item), 3000, true)
	assert_eq(Session.pending_count(), 1)
	var attempt: Dictionary = Session._queue[0]
	assert_eq(attempt["item_id"], item["id"])
	assert_true(attempt["hint_used"])
	assert_eq(attempt["id"].length(), 36)
	assert_eq(attempt["id"][14], "4", "UUID version 4")


func test_formulas_render_from_pack() -> void:
	_load_pack("6e")
	# Toutes les questions n'ont pas de formule (balance, problèmes rédigés).
	var with_formula: Array = Session.items.filter(func(it: Dictionary) -> bool: return it.has("latex_hash"))
	assert_gt(with_formula.size(), 10)
	var item: Dictionary = with_formula[0]
	var texture := Session.formula_texture(item["latex_hash"])
	assert_not_null(texture)
	assert_gt(texture.get_width(), 50)


func test_question_panel_for_each_type() -> void:
	var wt := WorldTheme.tom()
	for level in ["6e", "2nde"]:
		_load_pack(level)
		for item in Session.items.slice(0, 12):
			var panel := QuestionPanel.new()
			panel.setup(item, "Test", wt)
			add_child_autofree(panel)
			watch_signals(panel)
			var widget := _find_widget(panel)
			assert_not_null(widget, "widget pour le type %s" % item["type"])
			widget.emit_signal("submitted", _correct_input(item))
			assert_signal_emitted(panel, "answered")
			var params: Array = get_signal_parameters(panel, "answered")
			assert_true(AnswerChecker.check(item["answer"], params[0]), item["id"])


func test_keypad_builds_expression_from_keys() -> void:
	var keypad := KeypadWidget.new()
	keypad.setup("expression", WorldTheme.tom())
	add_child_autofree(keypad)
	watch_signals(keypad)
	for key in ["x²", "+", "6", "x", "+", "9", "OK"]:
		keypad._press(key)
	assert_signal_emitted_with_parameters(keypad, "submitted", ["x²+6x+9"])
	assert_true(AnswerChecker.check({"kind": "expression", "value": "x^2+6x+9", "form": "expanded"}, "x²+6x+9"))


func _find_widget(panel: Node) -> Node:
	for node in panel.find_children("*", "", true, false):
		if node is McqWidget or node is KeypadWidget:
			return node
	return null
