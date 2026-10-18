extends GutTest
## Erreurs du jeu envoyées au serveur (autoload ErrorReport) : une ligne par erreur avec son compte,
## l'écran où elle a eu lieu, et rien sur l'enfant.

var _saved_pending: Dictionary
var _saved_seen: Dictionary


func before_each() -> void:
	_saved_pending = ErrorReport._pending.duplicate()
	_saved_seen = ErrorReport._seen.duplicate()
	ErrorReport._pending = {}
	ErrorReport._seen = {}


func after_each() -> void:
	ErrorReport._pending = _saved_pending
	ErrorReport._seen = _saved_seen


func test_off_outside_the_web_so_tests_send_nothing() -> void:
	assert_false(ErrorReport.enabled)


func test_the_same_error_is_counted_once() -> void:
	ErrorReport.add("Invalid call. Nonexistent function 'size' in base 'Nil'.", "res://scenes/world_map/world_map.gd:212 _dialog")
	ErrorReport.add("Invalid call. Nonexistent function 'size' in base 'Nil'.", "res://scenes/world_map/world_map.gd:212 _dialog")
	ErrorReport.add("Autre erreur", "res://autoload/voice.gd:40 _download")
	var pending: Array = ErrorReport.pending()
	assert_eq(pending.size(), 2)
	var first: Dictionary = pending[0]
	assert_eq(first["count"], 2)
	assert_eq(first.keys(), ["message", "location", "count", "scene"], "aucune donnée d'enfant")


func test_an_error_loop_does_not_grow_without_end() -> void:
	for i in ErrorReport.MAX_DISTINCT + 30:
		ErrorReport.add("erreur %d" % i, "boucle")
	assert_eq(ErrorReport.pending().size(), ErrorReport.MAX_DISTINCT)


func test_the_catcher_gets_script_errors_with_their_place() -> void:
	var catcher := ErrorReport.Catcher.new()
	OS.add_logger(catcher)
	push_error("Erreur de test")
	OS.remove_logger(catcher)
	assert_push_error("Erreur de test")
	assert_eq(catcher.caught.size(), 1)
	var entry: Array = catcher.caught[0]
	assert_eq(entry[0], "Erreur de test")
	assert_string_contains(str(entry[1]), "test_error_report.gd")


func test_the_platform_names_the_kind_of_device() -> void:
	assert_string_contains(ErrorReport.platform(), Quality.device_kind())
