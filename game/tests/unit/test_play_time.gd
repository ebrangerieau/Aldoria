extends GutTest
## Durée de jeu fixée par le parent : séance comptée par le serveur, remise à zéro après
## une pause (api/app/play_time.py).

var _saved: Dictionary


func before_each() -> void:
	_saved = {
		"played": Session.played_seconds, "max": Session.max_minutes, "break": Session.break_minutes,
		"last": Session._last_play_unix, "session": Session.session_id,
	}
	Session.session_id = ""
	Session.played_seconds = 0.0
	Session._last_play_unix = 0.0


func after_each() -> void:
	Session.played_seconds = _saved["played"]
	Session.max_minutes = _saved["max"]
	Session.break_minutes = _saved["break"]
	Session._last_play_unix = _saved["last"]
	Session.session_id = _saved["session"]


func _info(played: int, idle: int, max_minutes := 25) -> Dictionary:
	return {"played_seconds": played, "idle_seconds": idle, "session_max_minutes": max_minutes, "break_minutes": 30}


func test_server_counter_applies_after_a_reload() -> void:
	# Page rechargée : le compteur local repart de zéro, le serveur sait que Jules a joué 26 min.
	Session.sync_play_time(_info(26 * 60, 60))
	assert_true(Session.time_over())
	assert_eq(Session.minutes_before_play(), 29)
	assert_string_contains(Session.rest_text(), "26 minutes")
	assert_string_contains(Session.rest_text(), "dans 29 minutes")


func test_limit_set_by_the_parent() -> void:
	Session.sync_play_time(_info(26 * 60, 60, 40))
	assert_false(Session.time_over(), "40 minutes autorisées")


func test_a_long_enough_break_starts_a_new_seance() -> void:
	Session.sync_play_time(_info(26 * 60, 31 * 60))
	assert_false(Session.time_over())
	assert_eq(Session.played_seconds, 0.0)


func test_local_counter_kept_when_more_recent() -> void:
	# Fin de session pas encore reçue par le serveur : le compteur local, plus avancé, reste.
	Session.played_seconds = 20 * 60.0
	Session._last_play_unix = Time.get_unix_time_from_system()
	Session.sync_play_time(_info(12 * 60, 5 * 60))
	assert_eq(Session.played_seconds, 20 * 60.0)


func test_break_is_not_taken_during_an_activity() -> void:
	Session.played_seconds = 26 * 60.0
	Session._last_play_unix = Time.get_unix_time_from_system() - 3600.0
	Session.session_id = "en-cours"
	assert_true(Session.time_over(), "pas de remise à zéro en pleine partie")
	Session.session_id = ""
	assert_false(Session.time_over(), "au camp, après une heure : nouvelle séance")
