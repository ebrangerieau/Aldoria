extends GutTest
## Défi du jour joué hors réseau (paquet de test), et camp : donjons ouverts l'un
## après l'autre, état du défi.

var _scene: Node
var _saved_token := ""


func before_each() -> void:
	_saved_token = ApiClient.token
	ApiClient.token = ""
	Session._queue.clear()
	SaveManager._profile_id = 0
	SaveManager.data = SaveManager.default_data()
	Session.profile = {"name": "Test", "world": "lumineux", "level": "6e"}
	Session._apply_pack(JSON.parse_string(FileAccess.get_file_as_string("res://tests/fixtures/pack_6e.json")))


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


func test_ten_automatisms_then_streak_and_record() -> void:
	_scene = (load("res://scenes/daily/daily.tscn") as PackedScene).instantiate()
	add_child(_scene)
	var start := await _wait_button("C'est parti !")
	assert_not_null(start, "présentation du défi")
	start.pressed.emit()
	var previous := 0  # identifiant de la question précédente (libérée ensuite)
	for i in DailyChallenge.QUESTIONS:
		var panel: QuestionPanel = await _wait_for(QuestionPanel, 6.0, previous)
		previous = panel.get_instance_id() if panel else 0
		assert_not_null(panel, "question %d" % (i + 1))
		assert_eq(panel.item["role"], "automatisme")
		var correct := i % 3 != 2
		panel.answered.emit(_answer_for(panel.item, correct), 3000, false)
		if not correct:
			var explanation: ExplanationPanel = await _wait_for(ExplanationPanel)
			assert_not_null(explanation)
			explanation.closed.emit()
	var back := await _wait_button("Retour au camp", 6.0)
	assert_not_null(back, "bilan du défi")
	var today := DailyChallenge.today()
	assert_eq(SaveManager.daily_days(), [today])
	assert_eq(SaveManager.daily()["best"], {"correct": 7, "ms": 30000})
	assert_gt(SaveManager.xp(), DailyChallenge.COMPLETION_XP)
	assert_eq(Session._queue.size(), 10)
	assert_true(Session._queue.all(func(a: Dictionary) -> bool: return a["game_mode"] == "defi"))


func test_hub_opens_dungeons_one_after_the_other() -> void:
	_scene = (load("res://scenes/hub/hub.tscn") as PackedScene).instantiate()
	add_child(_scene)
	await wait_process_frames(3)
	var rows: Array = _scene._dungeon_rows
	assert_eq(rows.size(), 4, "trois donjons de maths, la Bibliothèque des Langues")
	assert_true((rows[0]["panel"] as Control).visible and not (rows[3]["panel"] as Control).visible, "onglet Maths")
	assert_false((rows[3]["button"] as Button).disabled, "région d'anglais ouverte d'emblée")
	assert_string_contains((_scene._region_tabs["anglais"] as Button).text, "nouveau")
	_scene._show_region("anglais")
	assert_true((rows[3]["panel"] as Control).visible and not (rows[0]["panel"] as Control).visible)
	_scene._show_region("maths")
	assert_false((rows[0]["button"] as Button).disabled)
	assert_true((rows[1]["button"] as Button).disabled, "Atelier fermé tant que la Tour n'est pas finie")
	assert_string_contains((rows[1]["state"] as Label).text, "La Tour des Fractions")
	SaveManager.complete_dungeon("tour_fractions")
	assert_false((rows[1]["button"] as Button).disabled)
	assert_true((rows[2]["button"] as Button).disabled)
	assert_eq((_scene._daily_button as Button).text, "Relever")
	SaveManager.record_daily(DailyChallenge.today(), 9, 90000, DailyChallenge.today())
	assert_eq((_scene._daily_button as Button).text, "S'entraîner")


# --- Aides ----------------------------------------------------------------------

func _answer_for(item: Dictionary, correct: bool) -> Variant:
	var answer: Dictionary = item["answer"]
	if answer["kind"] == "choice":
		return int(answer["index"]) if correct else (int(answer["index"]) + 1) % (item["choices"] as Array).size()
	if not correct:
		return "999999"
	if answer["kind"] in ["order", "vector", "signs"]:
		return answer["value"]
	if answer["kind"] == "true_false":
		return {"value": answer["value"], "reason": answer["reason"]}
	return str(answer["value"])


## Premier nœud du type donné, autre que `skip` (la question précédente reste affichée
## un instant après la réponse).
func _wait_for(type: Variant, timeout := 6.0, skip := 0) -> Node:
	var found: Array = []
	await wait_until(func() -> bool:
		found.clear()
		found.append_array(_scene.find_children("*", "", true, false).filter(
			func(n: Node) -> bool: return is_instance_of(n, type) and n.get_instance_id() != skip and not n.is_queued_for_deletion()))
		return not found.is_empty(), timeout)
	return found[0] if not found.is_empty() else null


func _wait_button(text: String, timeout := 3.0) -> Button:
	var found: Array = []
	await wait_until(func() -> bool:
		found.clear()
		found.append_array(_scene.find_children("*", "Button", true, false).filter(
			func(b: Button) -> bool: return b.text == text and not b.is_queued_for_deletion()))
		return not found.is_empty(), timeout)
	return found[0] if not found.is_empty() else null
