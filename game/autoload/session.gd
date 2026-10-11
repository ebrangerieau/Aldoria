extends Node
## Session de jeu : profil connecté, paquet de questions, file des tentatives.
##
## Mode dégradé (TRD §2.7) : chaque réponse est d'abord écrite dans `user://`
## (IndexedDB sur le web) avec un UUID, puis envoyée à l'API. En cas de coupure,
## l'envoi est retenté ; le serveur ignore les doublons.

signal queue_changed(pending: int)

const AUTH_FILE := "user://auth.json"
const PACK_FILE := "user://pack_%s.json"  # un paquet par mode (arène, donjon)
const PACK_MODES := ["arene", "donjon"]
const QUEUE_FILE := "user://attempts_queue.json"
const FLUSH_RETRY_S := 10.0
const BATCH_SIZE := 50

var profile: Dictionary = {}
var session_id := ""
var items: Array = []
var formulas: Dictionary = {}  # hash → texte SVG
var settings: Dictionary = {}
## Difficulté de départ par rôle, calculée par le serveur selon la maîtrise.
var start_levels: Dictionary = {}
var active_seconds := 0.0
## Temps de jeu actif depuis la connexion (toutes sessions) : limite fixée par le parent.
var played_seconds := 0.0

var _queue: Array = []
var _flushing := false
var _retry_timer: Timer
var _textures: Dictionary = {}


func _ready() -> void:
	_queue = _load_json(QUEUE_FILE, [])
	_retry_timer = Timer.new()
	_retry_timer.wait_time = FLUSH_RETRY_S
	_retry_timer.timeout.connect(flush)
	add_child(_retry_timer)
	_retry_timer.start()
	var auth: Dictionary = _load_json(AUTH_FILE, {})
	if auth.has("token"):
		ApiClient.token = auth["token"]
		profile = auth.get("profile", {})


func _process(delta: float) -> void:
	# Le navigateur met le jeu en pause quand l'onglet est caché : seul le temps actif compte.
	if session_id != "":
		active_seconds += delta
		played_seconds += delta


func is_logged_in() -> bool:
	return ApiClient.token != "" and not profile.is_empty()


func world() -> String:
	return profile.get("world", "jules")


func login(profile_id: int, pin: String) -> Dictionary:
	var res := await ApiClient.post_json("/play/login", {"profile_id": profile_id, "pin": pin}, false)
	if res.ok:
		ApiClient.token = res.data["token"]
		profile = res.data["profile"]
		played_seconds = 0.0
		_save_json(AUTH_FILE, {"token": ApiClient.token, "profile": profile})
	return res


## Changement de joueur. Les réponses en attente restent dans la file, rattachées
## à leur profil : elles partiront quand ce joueur se reconnectera.
func logout() -> void:
	await flush()
	await SaveManager.unload()
	ApiClient.token = ""
	profile = {}
	session_id = ""
	played_seconds = 0.0
	DirAccess.remove_absolute(AUTH_FILE)
	# Les paquets hors connexion appartiennent au joueur précédent (autre niveau).
	for mode in PACK_MODES:
		DirAccess.remove_absolute(PACK_FILE % mode)
	DirAccess.remove_absolute("user://pack.json")  # ancien nom (phase 1)


## Ouvre une session et charge le paquet de questions. `params` : chapitre et
## énigme d'un donjon (voir DungeonDef). Sans réseau, reprend le dernier paquet
## enregistré pour ce mode (s'il existe) pour que le jeu reste jouable.
func start(mode := "arene", params := {}) -> Dictionary:
	var res := await ApiClient.post_json("/play/session/start", params)
	if res.ok:
		_apply_pack(res.data)
		_save_json(PACK_FILE % mode, res.data)
		return res
	if res.status == 0:
		var cached: Dictionary = _load_json(PACK_FILE % mode, {})
		if not cached.is_empty():
			_apply_pack(cached)
			return {"ok": true, "status": 0, "data": cached, "error": {}, "offline": true}
	return res


func end() -> void:
	await flush()
	if session_id != "":
		await ApiClient.post_json("/play/session/end",
			{"session_id": session_id, "active_seconds": int(active_seconds)})
	session_id = ""


## Durée maximale de jeu atteinte (PRD US-11, réglée par le parent).
func time_over() -> bool:
	return played_seconds >= float(settings.get("session_max_minutes", 25)) * 60.0


## Enregistre une réponse (d'abord localement, puis envoi au serveur).
func record_attempt(item: Dictionary, correct: bool, time_ms: int, hint_used: bool, game_mode := "combat") -> void:
	var session_ref: Variant = null  # null hors session (paquet repris hors connexion sans id)
	if session_id != "":
		session_ref = session_id
	_queue.append({
		"profile_id": _profile_id(),  # local : retiré avant l'envoi
		"id": uuid_v4(),
		"session_id": session_ref,
		"item_id": item["id"],
		"generator": item.get("generator"),
		"difficulty": int(item["difficulty"]),
		"notion_ids": item["notions"],
		"correct": correct,
		"time_ms": time_ms,
		"time_target_ms": int(item.get("time_target_ms", 20000)),
		"hint_used": hint_used,
		"game_mode": game_mode,
		"answered_at": Time.get_datetime_string_from_system(true) + "Z",
	})
	_save_json(QUEUE_FILE, _queue)
	queue_changed.emit(pending_count())
	flush()


## Réponses en attente d'envoi pour le joueur connecté.
func pending_count() -> int:
	return _own_queue().size()


func flush() -> void:
	if _flushing or ApiClient.token == "" or _own_queue().is_empty():
		return
	_flushing = true
	while not _own_queue().is_empty():
		var batch := _own_queue().slice(0, BATCH_SIZE)
		var payload := batch.map(func(a: Dictionary) -> Dictionary:
			var copy := a.duplicate()
			copy.erase("profile_id")
			return copy)
		var res := await ApiClient.post_json("/play/attempts", {"attempts": payload})
		if not res.ok and not _rejected_for_good(res.status):
			break  # nouvel essai au prochain passage du minuteur
		if not res.ok:
			# Lot refusé par le serveur (invalide) : le renvoyer bloquerait la file à jamais.
			printerr("[Aldoria/api] %d réponse(s) refusée(s) par le serveur (%d), écartée(s)" % [batch.size(), res.status])
		var sent := {}
		for a in batch:
			sent[a["id"]] = true
		_queue = _queue.filter(func(a: Dictionary) -> bool: return not sent.has(a["id"]))
		_save_json(QUEUE_FILE, _queue)
		queue_changed.emit(pending_count())
	_flushing = false


## Refus définitif (requête invalide) ; les autres échecs se retentent : réseau,
## jeton expiré (401, nouvelle connexion), serveur indisponible (5xx).
static func _rejected_for_good(status: int) -> bool:
	return status in [400, 403, 404, 409, 413, 422]


func _profile_id() -> int:
	return int(profile.get("id", 0))


## File du joueur connecté (les réponses d'avant ce marquage lui sont rattachées).
func _own_queue() -> Array:
	var me := _profile_id()
	return _queue.filter(func(a: Dictionary) -> bool: return int(a.get("profile_id", me)) == me)


## Texture d'une formule (SVG blanc, à teinter avec `modulate`).
func formula_texture(formula_hash: String, scale := 1.0) -> Texture2D:
	var key := "%s@%.2f" % [formula_hash, scale]
	if _textures.has(key):
		return _textures[key]
	if not formulas.has(formula_hash):
		return null
	var image := Image.new()
	if image.load_svg_from_buffer((formulas[formula_hash] as String).to_utf8_buffer(), scale) != OK:
		return null
	var texture := ImageTexture.create_from_image(image)
	_textures[key] = texture
	return texture


static func uuid_v4() -> String:
	var b := Crypto.new().generate_random_bytes(16)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	var h := b.hex_encode()
	return "%s-%s-%s-%s-%s" % [h.substr(0, 8), h.substr(8, 4), h.substr(12, 4), h.substr(16, 4), h.substr(20, 12)]


func _apply_pack(data: Dictionary) -> void:
	session_id = data.get("session_id", "")
	items = data.get("items", [])
	formulas = data.get("formulas", {})
	settings = data.get("settings", {})
	start_levels = data.get("start_levels", {})
	active_seconds = 0.0
	_textures.clear()


func _load_json(path: String, default: Variant) -> Variant:
	if not FileAccess.file_exists(path):
		return default
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	return parsed if typeof(parsed) == typeof(default) else default


func _save_json(path: String, data: Variant) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(data))
