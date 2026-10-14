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
	assert_false(Voice.usable("es-ES"), "pas de voix espagnole sur le serveur")
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
