extends GutTest
## Objets du sac : gain plafonné, utilisation, plume et parchemin dans une question.

var _saved: Dictionary
var _saved_profile := 0


func before_each() -> void:
	# Sans joueur identifié : la partie reste en mémoire (ni fichier, ni envoi au serveur).
	_saved_profile = SaveManager._profile_id
	SaveManager._profile_id = 0
	_saved = SaveManager.data.duplicate(true)
	SaveManager.data = SaveManager.default_data()


func after_each() -> void:
	SaveManager.data = _saved
	SaveManager._profile_id = _saved_profile


func test_rewards_are_capped_and_used() -> void:
	for i in 30:
		SaveManager.give_items(2)
	for id in Inventory.ORDER:
		assert_eq(SaveManager.item_count(id), Inventory.MAX, "plafond de %d" % Inventory.MAX)
	assert_eq(SaveManager.give_items(1), [] as Array[String], "sac plein : rien de plus")
	assert_true(SaveManager.use_item("bouclier"))
	assert_eq(SaveManager.item_count("bouclier"), Inventory.MAX - 1)


func test_cannot_use_what_you_do_not_have() -> void:
	assert_false(SaveManager.use_item("potion"))
	assert_eq(Inventory.summary(SaveManager.items()), "Sac : vide pour l'instant")


func test_draw_prefers_missing_items() -> void:
	var owned := {"plume": 5, "parchemin": 5, "bouclier": 5, "potion": 0}
	assert_eq(Inventory.draw(owned, 2), ["potion", "potion"] as Array[String])
	assert_eq(Inventory.describe(["potion", "potion", "plume"]), "Plume du sage, Potion d'urgence ×2")


func test_feather_removes_two_wrong_choices_and_keeps_full_power() -> void:
	SaveManager.data["items"] = {"plume": 1}
	var item := {"type": "mcq", "prompt": "2 + 2 ?", "choices": ["3", "4", "5", "6"], "difficulty": 1,
		"answer": {"kind": "choice", "index": 1}, "hint": "Compte sur tes doigts."}
	var panel := QuestionPanel.new()
	add_child_autofree(panel)
	panel.setup(item, "Test", WorldTheme.lumineux())
	var used := Button.new()
	add_child_autofree(used)
	panel._use_item("plume", used)
	var mcq := panel._widget as McqWidget
	var hidden := mcq.get_children().filter(func(b: Button) -> bool: return b.disabled)
	assert_eq(hidden.size(), 2)
	assert_false((mcq.get_child(1) as Button).disabled, "la bonne réponse reste")
	assert_eq(SaveManager.item_count("plume"), 0)
	assert_false(panel.penalized_hint(), "pas de baisse de puissance")
	watch_signals(panel)
	panel._on_submitted(1)
	var params: Array = get_signal_parameters(panel, "answered")
	assert_eq(params[0], 1)
	assert_eq(params[2], true)  # le temps (params[1]) peut avoir avancé d'une milliseconde


func test_daily_challenge_offers_no_items() -> void:
	SaveManager.data["items"] = {"plume": 3, "parchemin": 3}
	var item := {"type": "mcq", "prompt": "?", "choices": ["a", "b", "c"], "difficulty": 1,
		"answer": {"kind": "choice", "index": 0}, "hint": "Indice"}
	var panel := QuestionPanel.new()
	add_child_autofree(panel)
	panel.setup(item, "Défi", WorldTheme.lumineux(), false)
	var labels := panel.find_children("*", "Button", true, false).map(func(b: Button) -> String: return b.text)
	assert_false(labels.any(func(t: String) -> bool: return t.begins_with("Plume") or t.begins_with("Parchemin")))
