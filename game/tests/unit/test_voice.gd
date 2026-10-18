extends GutTest
## Voix du serveur : utilisée seulement quand l'enfant est connecté, en ligne, dans une langue
## qu'elle connaît, et pas juste après une panne du service (voix de l'appareil sinon).

var _token := ""
var _online := true


func before_each() -> void:
	_token = ApiClient.token
	_online = ApiClient.online
	Voice._off_until = 0


func after_each() -> void:
	ApiClient.token = _token
	ApiClient.online = _online
	Voice._off_until = 0
	Voice.stop()


func test_server_voice_only_when_it_can_answer() -> void:
	ApiClient.token = ""
	assert_false(Voice.usable("fr-FR"), "pas connecté : voix de l'appareil")
	ApiClient.token = "jeton"
	ApiClient.online = true
	assert_true(Voice.usable("fr-FR"))
	assert_true(Voice.usable("en-GB"), "écoute en anglais")
	assert_true(Voice.usable("es-ES"), "voix espagnole du serveur (espagnol de seconde)")
	assert_false(Voice.usable("de-DE"), "pas de voix allemande sur le serveur")
	ApiClient.online = false
	assert_false(Voice.usable("fr-FR"), "hors connexion")
	ApiClient.online = true
	Voice._off_until = Time.get_ticks_msec() + 30000
	assert_false(Voice.usable("fr-FR"), "service en panne : on réessaiera plus tard")


func test_stop_empties_the_queue() -> void:
	Voice._queue = [["Bonjour.", "fr-FR", 1.0], ["Hello.", "en-GB", 1.0]]
	var before := Voice._generation
	Voice.stop()
	assert_eq(Voice._queue.size(), 0)
	assert_gt(Voice._generation, before, "un son arrivé trop tard ne sera pas joué")


func test_english_parts_are_read_by_the_english_voice() -> void:
	var item := {"type": "mcq", "prompt": "Que veut dire “horse” ?", "choices": ["cheval", "chien"],
		"speech": {"prompt": "Que veut dire “horse” ?", "prompt_parts": [["Que veut dire", "fr-FR"], ["horse", "en-GB"]],
			"choices": ["cheval", "chien"], "explanation_parts": [["« cheval » se dit", "fr-FR"], ["horse", "en-GB"]]},
		"answer": {"kind": "choice", "index": 0}, "explanation": "« cheval » se dit “horse” en anglais."}
	var parts := Accessibility.question_parts(item)
	assert_eq(parts[0], ["Que veut dire", "fr-FR"])
	assert_eq(parts[1], ["horse", "en-GB"])
	var said: Variant = ExplanationPanel.spoken(item)
	assert_true(said is Array, "explication lue en morceaux")
	assert_has(said, ["horse", "en-GB"])
	assert_has(said, ["cheval", "fr-FR"], "réponse française lue en français")
