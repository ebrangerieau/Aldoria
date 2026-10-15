extends GutTest
## Salle-énigme 3D de la balance : une manche se résout sur la balance (BalanceRig +
## BalanceEnigma), seul le premier essai compte comme réponse.

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


## 3 boîtes et 4 billes contre 19 billes : une boîte pèse 5 billes.
func _item() -> Dictionary:
	return {
		"id": "test:balance", "role": "enigme", "difficulty": 3, "notions": ["6e.maths.prealgebre.balance"],
		"type": "numeric", "prompt": "…", "hint": "Enlève la même chose des deux côtés.", "explanation": "Une boîte pèse 5 billes.",
		"answer": {"kind": "number", "value": "5"},
		"visual": {"kind": "balance", "left": {"boxes": 3, "units": 4}, "right": {"boxes": 0, "units": 19},
			"box": ["boîte", "boîtes"], "unit": ["bille", "billes"]},
	}


func _setup() -> BalanceEnigma:
	var rig := BalanceRig.create(WorldTheme.lumineux(), false)
	add_child_autofree(rig)
	var enigma := BalanceEnigma.new().setup(_item(), rig, WorldTheme.lumineux(), "Balances")
	add_child_autofree(enigma)
	return enigma


func test_removing_the_same_on_both_sides_keeps_the_balance() -> void:
	var enigma := _setup()
	assert_false(enigma._remove_box.visible, "pas de boîte à droite : pas de bouton pour en enlever")
	for i in 4:
		enigma._remove("units")
	assert_eq(enigma._rig.sides, {"left": {"boxes": 3, "units": 0}, "right": {"boxes": 0, "units": 15}})
	assert_true(enigma._remove_unit.disabled, "plus de bille à gauche")
	assert_eq(enigma._rig._marbles[1].multimesh.instance_count, 15, "les billes affichées suivent")
	assert_eq(Session._queue.size(), 0, "enlever n'est pas répondre")


func test_only_the_first_try_is_recorded_and_the_beam_points_the_way() -> void:
	var enigma := _setup()
	watch_signals(enigma)
	enigma._guess = 7
	enigma._attempt()
	assert_eq(Session._queue.size(), 1, "premier essai : une réponse enregistrée")
	assert_false(Session._queue[0]["correct"])
	assert_string_contains(enigma._feedback.text, "à gauche", "3 × 7 + 4 > 19 : le côté des boîtes est trop lourd")
	assert_string_contains(enigma._feedback.text, "moins")
	enigma._guess = 4
	enigma._attempt()
	assert_string_contains(enigma._feedback.text, "plus")
	enigma._guess = 5
	enigma._attempt()
	assert_eq(Session._queue.size(), 1, "les essais suivants corrigent sans compter")
	await wait_for_signal(enigma.solved, 4.0)
	assert_signal_emitted_with_parameters(enigma, "solved", [false])


func test_right_first_time() -> void:
	var enigma := _setup()
	watch_signals(enigma)
	enigma._guess = 5
	enigma._attempt()
	assert_true(Session._queue[0]["correct"])
	await wait_for_signal(enigma.solved, 3.0)
	assert_signal_emitted_with_parameters(enigma, "solved", [true])
