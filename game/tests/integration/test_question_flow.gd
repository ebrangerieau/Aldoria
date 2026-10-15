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
	return AnswerInputs.correct_for(item["answer"])


func test_next_item_respects_role_and_starts_easy() -> void:
	_load_pack("6e")
	for role in ["automatisme", "chapitre"]:
		var item := QuestionService.next_item(role)
		assert_eq(item["role"], role)
		assert_eq(int(item["difficulty"]), 1, "on commence au niveau 1")


func test_quick_strike_without_automatisms_takes_an_easy_chapter_item() -> void:
	# Donjon d'anglais : pas d'automatismes dans le paquet.
	_load_pack("6e")
	Session.items = Session.items.filter(func(it: Dictionary) -> bool: return it["role"] != "automatisme")
	var item := QuestionService.next_item("automatisme")
	assert_false(item.is_empty(), "la frappe rapide a toujours une question")
	assert_eq(item["role"], "chapitre")
	assert_eq(int(item["difficulty"]), 1)


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
	# Une question dont la notion a au moins une autre forme dans le paquet.
	var failed := QuestionService.next_item("chapitre")
	while Session.items.filter(func(it: Dictionary) -> bool:
			return it["role"] == "chapitre" and failed["notions"][0] in it["notions"]).size() < 2:
		failed = QuestionService.next_item("chapitre")
	QuestionService.submit(failed, "0/1", 4000, false)
	var seen_again := false
	for i in 4:
		var item := QuestionService.next_item("chapitre")
		assert_ne(item["id"], failed["id"], "jamais exactement la même question")
		if failed["notions"][0] in item["notions"]:
			seen_again = true
		QuestionService.submit(item, _correct_input(item), 4000, false)
	assert_true(seen_again)


func test_failed_notion_comes_back_even_when_its_items_are_used_up() -> void:
	# Deux questions seulement sur la notion A, toutes deux déjà posées : la ratée ne
	# revient pas telle quelle, l'autre revient (paquet de 16 notions : cas fréquent).
	var items: Array = []
	for i in 2:
		items.append(_fake_item("a%d" % i, "notion.a", 1))
	for i in 6:
		items.append(_fake_item("b%d" % i, "notion.b", 3))
	Session._apply_pack({"items": items, "start_levels": {"chapitre": 1}})
	QuestionService.reset()
	var first := QuestionService.next_item("chapitre")
	QuestionService.submit(first, "1", 4000, false)
	var failed := QuestionService.next_item("chapitre")
	assert_eq(failed["notions"], ["notion.a"], "les deux questions faciles d'abord")
	QuestionService.submit(failed, "0", 4000, false)
	var came_back := {}
	for i in 3:
		var item := QuestionService.next_item("chapitre")
		came_back[item["id"]] = true
		QuestionService.submit(item, "1", 4000, false)
	assert_true(came_back.has(first["id"]), "la notion ratée revient par l'autre question")
	assert_false(came_back.has(failed["id"]), "jamais la question qui vient d'être ratée")


func _fake_item(id: String, notion: String, difficulty: int) -> Dictionary:
	return {"id": id, "type": "numeric", "role": "chapitre", "difficulty": difficulty, "notions": [notion],
		"answer": {"kind": "number", "value": "1"}, "time_target_ms": 20000, "prompt": "?"}


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
	assert_gt(with_formula.size(), 5)  # paquet partagé avec les autres matières
	var item: Dictionary = with_formula[0]
	var texture := Session.formula_texture(item["latex_hash"])
	assert_not_null(texture)
	assert_gt(texture.get_width(), 50)


func test_question_panel_for_each_type() -> void:
	var wt := WorldTheme.brouillard()
	for level in ["6e", "2nde"]:
		_load_pack(level)
		# Les 12 premiers, plus un item de chaque type présent dans le paquet.
		var sample: Array = Session.items.slice(0, 12)
		var types := {}
		for it in Session.items:
			if not types.has(it["type"]):
				types[it["type"]] = true
				sample.append(it)
		for item in sample:
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
	keypad.setup("expression", WorldTheme.brouillard())
	add_child_autofree(keypad)
	watch_signals(keypad)
	for key in ["x²", "+", "6", "x", "+", "9", "OK"]:
		keypad._press(key)
	assert_signal_emitted_with_parameters(keypad, "submitted", ["x²+6x+9"])
	assert_true(AnswerChecker.check({"kind": "expression", "value": "x^2+6x+9", "form": "expanded"}, "x²+6x+9"))


func _find_widget(panel: Node) -> Node:
	for node in panel.find_children("*", "", true, false):
		if node is McqWidget or node is KeypadWidget or node is OrderWidget or node is VectorWidget \
				or node is TrueFalseWidget or node is SignTableWidget or node is TextAnswerWidget \
				or (node is NumberLineWidget and node._interactive):
			return node
	return null


func test_number_line_snaps_to_graduation() -> void:
	var line := NumberLineWidget.new()
	line.setup({"min": 0, "max": 2, "subdivisions": 4, "mode": "place"}, WorldTheme.lumineux())
	line.size = Vector2(800, 200)
	add_child_autofree(line)
	await wait_process_frames(2)
	watch_signals(line)
	# 3/4 : trois graduations sur huit, un peu à côté (l'aimant corrige).
	var x: float = line._x_of(3) + 7.0
	var click := InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.pressed = true
	click.position = Vector2(x, 40)
	line._on_canvas_input(click)
	line._submit()
	assert_signal_emitted_with_parameters(line, "submitted", ["3/4"])
	assert_true(AnswerChecker.check({"kind": "fraction", "value": "6/8"}, "3/4"))


func test_order_widget_collects_taps_in_order() -> void:
	var order := OrderWidget.new()
	order.setup(["2,5", "2,15", "2,9"], WorldTheme.lumineux())
	add_child_autofree(order)
	watch_signals(order)
	order._pick(1)
	order._submit()  # incomplet : rien n'est envoyé
	assert_signal_not_emitted(order, "submitted")
	order._pick(1)  # déjà choisi : ignoré
	order._pick(0)
	order._pick(2)
	order._submit()
	assert_signal_emitted_with_parameters(order, "submitted", [[1, 0, 2]])
	assert_true(AnswerChecker.check({"kind": "order", "value": [1, 0, 2]}, [1.0, 0.0, 2.0]))


func test_long_order_items_stack_and_leave_the_pool() -> void:
	var events := ["The Statute of Westminster is passed", "India and Pakistan become independent",
		"South Africa rejoins the Commonwealth", "Charles III becomes king and Head of the Commonwealth",
		"Australians vote to count Aboriginal people in the census"]
	var panel := QuestionPanel.new()
	panel.setup({"id": "t", "type": "order", "difficulty": 3, "prompt": "Remets ces événements dans l'ordre.", "choices": events,
		"answer": {"kind": "order", "value": [0, 1, 2, 3, 4]}}, "Frise", WorldTheme.brouillard())
	add_child_autofree(panel)
	await wait_process_frames(2)
	var order: OrderWidget = panel.find_children("*", "OrderWidget", true, false)[0]
	var height := panel.get_combined_minimum_size().y
	for i in [4, 0, 2]:
		order._pick(i)
	await wait_process_frames(2)
	assert_true(order._row is VBoxContainer, "éléments longs : liste de haut en bas")
	assert_eq(order._row.get_child_count(), 3)
	assert_false(order._buttons[4].visible, "l'élément choisi quitte la réserve")
	assert_true(order._buttons[1].visible)
	assert_lt(panel.get_combined_minimum_size().x, 1281.0, "rien ne déborde sur le côté")
	assert_lt(panel.get_combined_minimum_size().y, height + 40.0, "la hauteur ne grandit presque pas")


func test_true_false_needs_verdict_then_reason() -> void:
	var widget := TrueFalseWidget.new()
	widget.setup(["raison A", "raison B", "raison C"], WorldTheme.brouillard())
	add_child_autofree(widget)
	watch_signals(widget)
	widget._choose_reason(1)  # pas encore de verdict : ignoré
	assert_signal_not_emitted(widget, "submitted")
	widget._choose_verdict(false)
	widget._choose_reason(1)
	assert_signal_emitted_with_parameters(widget, "submitted", [{"value": false, "reason": 1}])
	assert_true(AnswerChecker.check({"kind": "true_false", "value": false, "reason": 1}, {"value": false, "reason": 1.0}))


func test_sign_table_cycles_and_submits_row_by_row() -> void:
	var table := SignTableWidget.new()
	table.setup({"roots": ["−4"], "rows": ["2x + 8"]}, WorldTheme.brouillard())
	add_child_autofree(table)
	watch_signals(table)
	table._cycle(0)  # « + »
	table._cycle(0)  # « − »
	table._submit()  # case de droite vide : rien
	assert_signal_not_emitted(table, "submitted")
	table._cycle(1)
	table._submit()
	assert_signal_emitted_with_parameters(table, "submitted", [["-", "+"]])
	assert_true(AnswerChecker.check({"kind": "signs", "value": ["-", "+"]}, ["-", "+"]))


func test_child_can_report_a_question_with_the_answer_given() -> void:
	_load_pack("6e")
	var item := QuestionService.next_item("chapitre")
	QuestionService.submit(item, "12/7", 4000, false)
	assert_eq(QuestionService.last_input_for(item), "12/7")
	assert_eq(QuestionService.last_input_for({"id": "autre"}), "")
	var panel := ExplanationPanel.new()
	panel.setup(item, WorldTheme.lumineux())
	add_child_autofree(panel)
	watch_signals(panel)
	assert_false(panel._report_box.visible, "motifs cachés tant qu'on n'a pas demandé")
	panel._report_button.pressed.emit()
	assert_true(panel._report_box.visible)
	(panel._report_box.get_child(0) as Button).pressed.emit()
	assert_signal_emitted_with_parameters(panel, "reported", ["reponse"])
	assert_false(panel._report_box.visible)
	await wait_for_signal(get_tree().process_frame, 0.2)
