extends GutTest
## Village joué hors réseau (paquet de test) : dialogue avec un habitant, quête de
## trois questions, récompense, une quête par jour ; choix des questions de quête.

const VILLAGE := "res://scenes/village/village.tscn"

var _scene: Node
var _saved_token := ""


func before_each() -> void:
	_saved_token = ApiClient.token
	ApiClient.token = ""
	Session._queue.clear()
	Session.played_seconds = 0.0
	SaveManager._profile_id = 0
	SaveManager.data = SaveManager.default_data()
	QuestionService.reset()


func after_each() -> void:
	if is_instance_valid(_scene):
		_scene.queue_free()
	await wait_process_frames(2)
	ApiClient.token = _saved_token
	Session._queue.clear()
	Session._save_json(Session.QUEUE_FILE, Session._queue)  # ne pas laisser de fausses réponses
	Session.items = []
	Session.profile = {}
	Session.context = {}
	SaveManager.data = SaveManager.default_data()


func _load(world: String) -> void:
	var level := "2nde" if world == "tom" else "6e"
	Session.profile = {"name": "Test", "world": world, "level": level}
	Session._apply_pack(JSON.parse_string(FileAccess.get_file_as_string("res://tests/fixtures/pack_%s.json" % level)))


func test_investigation_quest_asks_three_questions_on_one_document() -> void:
	_load("tom")
	var seen: Array = []
	for i in VillageDef.QUEST_SIZE:
		var item := QuestionService.next_quest_item("enquete", "2nde.statistiques.enquete")
		assert_eq(item["generator"], "2nde.statistiques.enquete")
		seen.append(item)
	assert_eq(seen.map(func(it: Dictionary) -> String: return str(it["visual"])).filter(
		func(v: String) -> bool: return v != str(seen[0]["visual"])).size(), 0, "même document")
	var levels: Array = seen.map(func(it: Dictionary) -> int: return int(it["difficulty"]))
	assert_eq(levels, [levels[0], levels[0] + 1, levels[0] + 2], "difficulté croissante")
	assert_eq(QuestionService.next_quest_item("enquete", "inconnu"), {})


func test_test_soon_quest_targets_the_chapter() -> void:
	_load("jules")
	var chapter := "6e.maths.fractions"
	for i in 5:
		var item := QuestionService.next_quest_item("veille", "", [chapter])
		assert_true(str(item["notions"][0]).begins_with(chapter + "."), item["id"])
		assert_eq(item["category"], "chapitre")
	# Sans notion à revoir dans le paquet de test : la révision se rabat sur le chapitre.
	assert_false(QuestionService.next_quest_item("revision").is_empty())


func test_quests_once_per_day() -> void:
	assert_false(SaveManager.quest_done("vesna", "2026-10-12"))
	SaveManager.record_quest("vesna", "2026-10-12")
	assert_true(SaveManager.quest_done("vesna", "2026-10-12"))
	assert_false(SaveManager.quest_done("vesna", "2026-10-13"), "nouvelle quête le lendemain")
	assert_eq(VillageDef.brumegarde().pending_quests("2026-10-12"), 3)
	var old := {"schema_version": 1, "xp": 0, "dungeons": {}, "bestiary": {}}
	SaveManager.data = SaveManager.migrate(old, 1)
	assert_false(SaveManager.quest_done("vesna", "2026-10-12"), "ancienne sauvegarde sans village")


func test_villages_reference_existing_models_and_generators() -> void:
	for world in ["jules", "tom"]:
		var village := VillageDef.for_world(world)
		assert_gt(village.npcs.size(), 2)
		var codes := {}
		for npc in village.npcs:
			assert_true(ResourceLoader.exists(Fighter.MODELS % npc["model"]), npc["model"])
			assert_true(npc["quest"] in ["revision", "veille", "enquete"])
			assert_lt(int(npc["room"]), village.room_count())
			codes[npc["code"]] = true
		assert_eq(codes.size(), village.npcs.size(), "codes uniques")
		var params := village.session_params()
		assert_eq(params["enigmas"].size(), village.npcs.filter(
			func(n: Dictionary) -> bool: return n["quest"] == "enquete").size())


func test_talk_accept_and_complete_a_quest() -> void:
	_load("tom")
	_scene = (load(VILLAGE) as PackedScene).instantiate()
	add_child(_scene)
	var enter := await _wait_button("Entrer dans le village")
	assert_not_null(enter, "présentation du village")
	enter.pressed.emit()
	await wait_until(func() -> bool: return not _scene._busy, 5.0)
	var vesna: Dictionary = _scene._npcs.filter(func(n: Dictionary) -> bool: return n["spec"]["code"] == "vesna")[0]
	assert_true((vesna["marker"] as Label3D).visible, "« ! » au-dessus de l'habitante")
	_scene._hero.position = vesna["node"].position + Vector3(0, 0, 1.5)
	var accept := await _wait_button("Je t'aide !")
	assert_not_null(accept, "demande de l'habitante")
	accept.pressed.emit()
	var xp := SaveManager.xp()
	var previous := 0
	for i in VillageDef.QUEST_SIZE:
		var panel: QuestionPanel = await _wait_for(QuestionPanel, previous)
		assert_not_null(panel, "question %d" % (i + 1))
		previous = panel.get_instance_id()
		assert_eq(panel.find_children("*", "TableView", true, false).size(), 1, "le document est affiché")
		panel.answered.emit(str(panel.item["answer"]["value"]), 5000, false)
	var thanks := await _wait_button("Avec plaisir !", 6.0)
	assert_not_null(thanks, "remerciements")
	assert_eq(SaveManager.xp(), xp + VillageDef.QUEST_XP + 3 * VillageDef.ANSWER_XP)
	assert_true(SaveManager.quest_done("vesna", DailyChallenge.today()))
	assert_false((vesna["marker"] as Label3D).visible)
	assert_eq(Session._queue.size(), 3)
	assert_true(Session._queue.all(func(a: Dictionary) -> bool: return a["game_mode"] == "village"))


# --- Aides ----------------------------------------------------------------------

func _wait_for(type: Variant, skip := 0, timeout := 6.0) -> Node:
	var found: Array = []
	await wait_until(func() -> bool:
		found.clear()
		found.append_array(_scene._hud.find_children("*", "", true, false).filter(
			func(n: Node) -> bool: return is_instance_of(n, type) and n.get_instance_id() != skip and not n.is_queued_for_deletion()))
		return not found.is_empty(), timeout)
	return found[0] if not found.is_empty() else null


func _wait_button(text: String, timeout := 4.0) -> Button:
	var found: Array = []
	await wait_until(func() -> bool:
		found.clear()
		found.append_array(_scene._hud.find_children("*", "Button", true, false).filter(
			func(b: Button) -> bool: return b.text == text and not b.is_queued_for_deletion()))
		return not found.is_empty(), timeout)
	return found[0] if not found.is_empty() else null
