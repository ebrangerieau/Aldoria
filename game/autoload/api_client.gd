extends Node
## Client HTTP de l'API (TRD §2.3). Chaque appel renvoie un dictionnaire :
## {ok: bool, status: int, data: Variant, error: {code, message, details?}}.
## Une erreur réseau (status 0) bascule `online` à faux, sans bloquer le jeu.

signal online_changed(online: bool)

const API_PREFIX := "/api/v1"
## Résultats HTTPRequest qui traduisent une vraie absence de réseau.
const NETWORK_RESULTS := [
	HTTPRequest.RESULT_CANT_CONNECT, HTTPRequest.RESULT_CANT_RESOLVE,
	HTTPRequest.RESULT_CONNECTION_ERROR, HTTPRequest.RESULT_TLS_HANDSHAKE_ERROR,
	HTTPRequest.RESULT_NO_RESPONSE, HTTPRequest.RESULT_TIMEOUT,
]
# 127.0.0.1 et non localhost : Godot essaie d'abord IPv6 (::1), où Docker n'écoute pas.
const DEFAULT_DEV_API := "http://127.0.0.1:8098"

var base_url := ""
var token := ""
var online := true


func _ready() -> void:
	base_url = _detect_base_url()


func get_json(path: String, auth := true) -> Dictionary:
	return await _request(HTTPClient.METHOD_GET, path, null, auth)


func post_json(path: String, body: Variant = {}, auth := true) -> Dictionary:
	return await _request(HTTPClient.METHOD_POST, path, body, auth)


func put_json(path: String, body: Variant = {}, auth := true) -> Dictionary:
	return await _request(HTTPClient.METHOD_PUT, path, body, auth)


func _request(method: HTTPClient.Method, path: String, body: Variant, auth: bool) -> Dictionary:
	var http := HTTPRequest.new()
	http.timeout = 20.0
	# Sur le web, le navigateur décompresse déjà la réponse (fetch) mais laisse l'en-tête
	# Content-Encoding : Godot tenterait une 2e décompression et échouerait
	# (RESULT_BODY_DECOMPRESS_FAILED, vu sur le paquet de session le 2026-10-11).
	http.accept_gzip = not OS.has_feature("web")
	add_child(http)
	var headers := PackedStringArray(["Content-Type: application/json", "Accept: application/json"])
	if auth and token != "":
		headers.append("Authorization: Bearer %s" % token)
	var payload := "" if body == null else JSON.stringify(body)
	var err := http.request(base_url + path, headers, method, payload)
	if err != OK:
		http.queue_free()
		_set_online(false)
		return _network_error()
	var res: Array = await http.request_completed
	http.queue_free()
	var result: int = res[0]
	var status: int = res[1]
	if result != HTTPRequest.RESULT_SUCCESS:
		printerr("[Aldoria/api] %s %s : échec HTTPRequest (résultat %d, statut %d)" % [
			{HTTPClient.METHOD_GET: "GET", HTTPClient.METHOD_PUT: "PUT"}.get(method, "POST"), path, result, status])
		if result in NETWORK_RESULTS:
			_set_online(false)
			return _network_error()
		# Réponse reçue mais illisible : ce n'est pas une coupure réseau.
		return {
			"ok": false, "status": status, "data": null,
			"error": {"code": "client_%d" % result, "message": "Réponse du serveur illisible (code %d)." % result},
		}
	_set_online(true)
	var text := (res[3] as PackedByteArray).get_string_from_utf8()
	var data: Variant = JSON.parse_string(text) if text != "" else null
	if status >= 200 and status < 300:
		return {"ok": true, "status": status, "data": data, "error": {}}
	var error: Dictionary = {"code": "http_%d" % status, "message": "Erreur du serveur."}
	if data is Dictionary and data.has("error"):
		error = data["error"]
	return {"ok": false, "status": status, "data": data, "error": error}


func _network_error() -> Dictionary:
	return {
		"ok": false, "status": 0, "data": null,
		"error": {"code": "network", "message": "Pas de connexion au serveur."},
	}


func _set_online(value: bool) -> void:
	if value != online:
		online = value
		online_changed.emit(online)


func _detect_base_url() -> String:
	if OS.has_feature("web"):
		# Même origine que la page : pas de CORS (connect-src 'self').
		return str(JavaScriptBridge.get_interface("location").origin) + API_PREFIX
	return Quality.option("api", DEFAULT_DEV_API) + API_PREFIX
