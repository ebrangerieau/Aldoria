extends Node
## Erreurs du jeu envoyées au serveur (`POST /play/client-errors`, api/app/client_errors.py) pour les voir
## avant que les enfants les racontent : message, endroit du code, écran, version (`BuildInfo.VERSION`) et type
## d'appareil. Jamais de donnée d'enfant (ni prénom, ni question, ni réponse). L'exploitant les lit dans
## l'espace parent (Exploitation → Erreurs du jeu).
##
## Endroit dans le script même dans l'export publié : `debug/settings/gdscript/always_track_call_stacks`
## (project.godot). Actif sur le web seulement (sur PC : `-- --erreurs=1`), pour que les tests et les captures n'envoient rien.
## `?erreur_test=1` (web) déclenche une erreur d'essai au démarrage (tools/e2e/tts_check.js).
## Une même erreur n'est envoyée qu'une fois par lot, avec son compte ; envois espacés, sans réseau gardés
## pour plus tard.

const PATH := "/play/client-errors"
const SEND_EVERY := 15.0  # secondes entre deux envois
const MAX_BATCH := 20  # erreurs différentes par envoi (limite de l'API)
const MAX_DISTINCT := 50  # erreurs différentes gardées par lancement du jeu (une boucle d'erreurs ne déborde pas)


## Reçoit les erreurs du moteur et des scripts, depuis n'importe quel fil : il les met de côté, le
## nœud les range à l'image suivante.
class Catcher extends Logger:
	var mutex := Mutex.new()
	var caught: Array = []  # [message, endroit]

	func _log_error(function: String, file: String, line: int, code: String, rationale: String,
			_editor_notify: bool, error_type: int, script_backtraces: Array[ScriptBacktrace]) -> void:
		if error_type == ERROR_TYPE_WARNING:
			return
		var message := rationale if code == "" else (code if rationale == "" else "%s (%s)" % [rationale, code])
		var where := "%s:%d %s" % [file, line, function]
		for trace: ScriptBacktrace in script_backtraces:
			if trace.get_frame_count() > 0:  # endroit dans un script du jeu plutôt que dans le moteur
				where = "%s:%d %s" % [trace.get_frame_file(0), trace.get_frame_line(0), trace.get_frame_function(0)]
				break
		mutex.lock()
		if caught.size() < 200:
			caught.append([message, where])
		mutex.unlock()

	func _log_message(_message: String, _error: bool) -> void:
		pass


var enabled := false
var _catcher: Catcher
var _pending := {}  # clé -> {message, location, scene, count}
var _seen := {}  # clés déjà vues pendant ce lancement
var _send_in := SEND_EVERY
var _sending := false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	enabled = OS.has_feature("web") or Quality.option("erreurs") == "1"
	if enabled:
		_catcher = Catcher.new()
		OS.add_logger(_catcher)
		if Quality.option("erreur_test") == "1":
			_test_error.call_deferred()


## Erreurs en attente d'envoi (tests).
func pending() -> Array:
	_collect()
	return _pending.values()


## Tient compte d'une erreur (le `Catcher` passe par là) ; rangée avec l'écran en cours.
func add(message: String, location: String) -> void:
	var key := location + "|" + message
	if _pending.has(key):
		_pending[key]["count"] += 1
		return
	if not _seen.has(key) and _seen.size() >= MAX_DISTINCT:
		return
	_seen[key] = true
	var scene := get_tree().current_scene
	_pending[key] = {
		"message": message.left(500), "location": location.left(200), "count": 1,
		"scene": (scene.scene_file_path if scene != null else "").left(120),
	}


func _process(delta: float) -> void:
	if not enabled:
		return
	_collect()
	_send_in -= delta
	if _send_in <= 0.0 and not _pending.is_empty() and not _sending:
		_send_in = SEND_EVERY
		send()


func _collect() -> void:
	if _catcher == null:
		return
	_catcher.mutex.lock()
	var caught := _catcher.caught
	_catcher.caught = []
	_catcher.mutex.unlock()
	for entry: Array in caught:
		add(str(entry[0]), str(entry[1]))


## Envoie un lot ; sans appareil relié ou sans réseau, les erreurs restent pour l'envoi suivant.
func send() -> void:
	if ApiClient.device_token == "" or _pending.is_empty():
		return
	_sending = true
	var keys: Array = _pending.keys().slice(0, MAX_BATCH)
	var errors: Array = []
	for key: String in keys:
		errors.append(_pending[key])
	var result: Dictionary = await ApiClient.post_json(PATH, {
		"version": BuildInfo.VERSION, "platform": platform(), "errors": errors,
	}, false)
	if result["ok"] or int(result["status"]) == 422:  # refusé (trop long…) : inutile de réessayer
		for key: String in keys:
			_pending.erase(key)
	_sending = false


## « Web Android téléphone Chrome » : de quoi retrouver l'appareil, sans le désigner précisément.
static func platform() -> String:
	var parts: Array[String] = [OS.get_name()]
	if OS.has_feature("web"):
		var agent := str(JavaScriptBridge.get_interface("navigator").userAgent)
		for system: String in ["Android", "iPhone", "iPad", "Windows", "Mac OS", "Linux", "CrOS"]:
			if system in agent:
				parts.append(system)
				break
		for browser: String in ["Firefox", "Edg", "SamsungBrowser", "Chrome", "Safari"]:
			if browser in agent:
				parts.append({"Edg": "Edge", "SamsungBrowser": "Samsung Internet"}.get(browser, browser))
				break
	parts.append(Quality.device_kind())
	return " ".join(parts).left(80)


func _test_error() -> void:
	push_error("Erreur d'essai (erreur_test=1)")
