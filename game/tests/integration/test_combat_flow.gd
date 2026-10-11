extends GutTest
## Combat complet piloté comme le ferait un joueur : choix d'action, réponse dans le
## panneau, explication après une erreur, victoire puis combat suivant, repli à 0 PV.
## Réseau coupé (pas de jeton) : les réponses restent dans la file locale.

const COMBAT := "res://scenes/combat/combat.tscn"

var _combat: Node
var _saved_token := ""


func before_each() -> void:
	_saved_token = ApiClient.token
	ApiClient.token = ""
	Session._queue.clear()
	Session.profile = {"name": "Test", "world": "jules", "level": "6e"}
	Session._apply_pack(JSON.parse_string(FileAccess.get_file_as_string("res://tests/fixtures/pack_6e.json")))
	_combat = (load(COMBAT) as PackedScene).instantiate()
	add_child(_combat)
	await wait_until(func() -> bool: return _actions_visible(), 5.0)


func after_each() -> void:
	Engine.time_scale = 1.0
	_combat.queue_free()
	await wait_process_frames(2)
	ApiClient.token = _saved_token
	Session._queue.clear()
	Session._save_json(Session.QUEUE_FILE, Session._queue)  # ne pas laisser de fausses réponses
	Session.items = []
	Session.profile = {}


func test_correct_answer_damages_enemy() -> void:
	var enemy: Fighter = _combat._enemy
	var hp_before := enemy.hp
	await _play_turn("automatisme", true)
	assert_lt(enemy.hp, hp_before, "l'ennemi a perdu des PV")
	assert_eq(Session.pending_count(), 1, "réponse enregistrée localement")
	assert_true(Session._queue[0]["correct"])


func test_wrong_answer_shows_explanation_and_costs_only_hp() -> void:
	var hero: Fighter = _combat._hero
	var enemy: Fighter = _combat._enemy
	await _play_turn("chapitre", false)
	assert_eq(enemy.hp, enemy.max_hp, "pas de dégâts sur une erreur")
	assert_lt(hero.hp, hero.max_hp, "l'ennemi a frappé")
	assert_false(Session._queue[0]["correct"])


func test_victory_leads_to_next_fight() -> void:
	var first_enemy: Fighter = _combat._enemy
	var first_max_hp := first_enemy.max_hp
	first_enemy.hp = 1
	await _play_turn("automatisme", true, false)
	var button := await _wait_message_button()
	assert_not_null(button, "panneau de victoire")
	button.pressed.emit()
	await wait_until(func() -> bool: return _actions_visible(), 5.0)
	assert_eq(_combat._wave, 2)
	assert_false(is_instance_valid(first_enemy), "premier ennemi retiré")
	assert_gt(_combat._enemy.max_hp, first_max_hp, "ennemi suivant plus résistant")
	assert_gt(_combat._xp, 0)


func test_retreat_at_zero_hp_restores_without_loss() -> void:
	var hero: Fighter = _combat._hero
	hero.hp = 1
	var xp_before: int = _combat._xp
	await _play_turn("chapitre", false, false)
	var button := await _wait_message_button()
	assert_not_null(button, "panneau de repli")
	button.pressed.emit()
	await wait_until(func() -> bool: return _actions_visible(), 5.0)
	assert_eq(hero.hp, hero.max_hp, "PV restaurés")
	assert_eq(_combat._xp, xp_before, "aucune progression perdue")


# --- Aides ----------------------------------------------------------------------

func _play_turn(action: String, correct: bool, wait_next_turn := true) -> void:
	_combat._hud.action_chosen.emit(action)
	var panel: QuestionPanel = await _wait_for(QuestionPanel)
	assert_not_null(panel, "panneau de question")
	var answer: Dictionary = panel.item["answer"]
	var value: Variant = "0/7"
	if answer["kind"] == "choice":
		value = int(answer["index"]) if correct else 99
	elif correct:
		value = str(answer["value"])
	panel.answered.emit(value, 1500, false)
	if not correct:
		var explanation: ExplanationPanel = await _wait_for(ExplanationPanel)
		assert_not_null(explanation, "explication après une erreur")
		explanation.closed.emit()
	if wait_next_turn:
		await wait_until(func() -> bool: return _actions_visible(), 8.0)


func _wait_for(type: Variant) -> Node:
	# Les lambdas capturent par valeur : on modifie le tableau, on ne le réaffecte pas.
	var found: Array = []
	await wait_until(func() -> bool:
		found.clear()
		found.append_array(_combat._hud.find_children("*", "", true, false).filter(
			func(n: Node) -> bool: return is_instance_of(n, type)))
		return not found.is_empty(), 8.0)
	return found[0] if not found.is_empty() else null


func _wait_message_button() -> Button:
	var found: Array = []
	await wait_until(func() -> bool:
		found.clear()
		found.append_array(_combat._hud._overlay.find_children("*", "Button", true, false))
		return not found.is_empty(), 8.0)
	return found[0] if not found.is_empty() else null


func _actions_visible() -> bool:
	return _combat._hud != null and _combat._hud._actions.visible
