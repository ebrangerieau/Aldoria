extends Node
## Session de jeu : profil connecté, paquet de questions, file des tentatives.
##
## Mode dégradé (TRD §2.7) : chaque réponse est d'abord écrite dans `user://`
## (IndexedDB sur le web) avec un UUID, puis envoyée à l'API. En cas de coupure,
## l'envoi est retenté ; le serveur ignore les doublons.

signal queue_changed(pending: int)

const AUTH_FILE := "user://auth.json"
const PACK_FILE := "user://pack_%s.json"  # un paquet par mode (arène, défi) ou par donjon
const QUEUE_FILE := "user://attempts_queue.json"
## Notions mises de côté (« Pas encore vu en classe ») pas encore reçues par le serveur.
const ASIDE_FILE := "user://aside_queue.json"
const FLUSH_RETRY_S := 10.0
const BATCH_SIZE := 50

signal profile_changed

var profile: Dictionary = {}
var session_id := ""
var items: Array = []
var formulas: Dictionary = {}  # hash → texte SVG
var settings: Dictionary = {}
## Difficulté de départ par rôle, calculée par le serveur selon la maîtrise.
var start_levels: Dictionary = {}
## Chapitres marqués par le parent : {test_soon: [{code, title}], current: [...]}.
var context: Dictionary = {}
## Donjon choisi au camp (code d'un DungeonDef du monde du joueur).
var dungeon_code := ""
## Mode de la session en cours (arene, donjon, defi, village, sphinx) et réponses enregistrées :
## une activité assez remplie rapporte un passage pour l'Île du Sphinx (SphinxIsland).
var mode := ""
var answered := 0
var active_seconds := 0.0
## Temps de jeu actif de la séance (toutes sessions qui se suivent) : limite fixée par le
## parent. Une pause de `break_minutes` sans jouer ouvre une nouvelle séance. Le serveur fait
## foi (api/app/play_time.py : même compteur sur tous les appareils, rechargement compris).
var played_seconds := 0.0
var max_minutes := 25
var break_minutes := 30
var _last_play_unix := 0.0

var _queue: Array = []
## Notions mises de côté depuis le dernier paquet du serveur (le paquet suivant ne les contient
## plus) : le jeu ne les pose plus, même dans un paquet gardé hors connexion.
var aside: Dictionary = {}
var _aside_queue: Array = []  # [{profile_id, notion}]
var _flushing := false
var _retry_timer: Timer
var _textures: Dictionary = {}


func _ready() -> void:
	_queue = _load_json(QUEUE_FILE, [])
	_aside_queue = _load_json(ASIDE_FILE, [])
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
		_last_play_unix = Time.get_unix_time_from_system()


func is_logged_in() -> bool:
	return ApiClient.token != "" and not profile.is_empty()


## Monde (ambiance) de l'enfant ; anciens identifiants (prénoms) d'avant la migration 0009.
func world() -> String:
	var value := str(profile.get("world", "lumineux"))
	return {"jules": "lumineux", "tom": "brouillard"}.get(value, value)


## Classe de l'enfant : elle fixe les donjons, le village et les questions.
func level() -> String:
	return str(profile.get("level", "6e"))


## Profil relu au retour au camp (`GET /play/me`) : le parent a pu changer la classe, le
## monde ou le prénom ; le camp se reconstruit alors (signal `profile_changed`).
func update_profile(fresh: Dictionary) -> void:
	if profile.is_empty() or fresh.is_empty():
		return
	var changed := false
	for key in ["name", "level", "level_label", "world"]:
		if fresh.has(key) and str(profile.get(key, "")) != str(fresh[key]):
			profile[key] = fresh[key]
			changed = true
	if changed:
		if ApiClient.token != "":
			_save_json(AUTH_FILE, {"token": ApiClient.token, "profile": profile})
		profile_changed.emit()


func login(profile_id: int, pin: String) -> Dictionary:
	var res := await ApiClient.post_json("/play/login", {"profile_id": profile_id, "pin": pin}, false)
	if res.ok:
		ApiClient.token = res.data["token"]
		profile = res.data["profile"]
		profile["accommodations"] = res.data.get("accommodations", {})
		played_seconds = 0.0
		sync_play_time(res.data.get("play_time", {}))
		_save_json(AUTH_FILE, {"token": ApiClient.token, "profile": profile})
		Accessibility.load_prefs(int(profile.get("id", 0)))
		Accessibility.apply_parent(profile["accommodations"])
	return res


## Changement de joueur. Les réponses en attente restent dans la file, rattachées
## à leur profil : elles partiront quand ce joueur se reconnectera.
func logout() -> void:
	await flush()
	await SaveManager.unload()
	ApiClient.token = ""
	profile = {}
	Accessibility.apply_parent(Accessibility.DEFAULTS)
	Accessibility.load_prefs(0)
	session_id = ""
	dungeon_code = ""
	aside.clear()
	played_seconds = 0.0
	_last_play_unix = 0.0
	DirAccess.remove_absolute(AUTH_FILE)
	# Les paquets hors connexion appartiennent au joueur précédent (autre niveau).
	for file in DirAccess.get_files_at("user://"):
		if file.begins_with("pack") and file.ends_with(".json"):
			DirAccess.remove_absolute("user://" + file)


## Ouvre une session et charge le paquet de questions. `wanted` : arene, donjon, defi,
## village ou sphinx (l'île : aucune question, la session compte le temps de jeu) ; `params` : chapitres et énigme d'un donjon (voir DungeonDef). Sans réseau,
## reprend le dernier paquet enregistré sous `cache` (le mode par défaut, le code
## du donjon sinon) pour que le jeu reste jouable.
func start(wanted := "arene", params := {}, cache := "") -> Dictionary:
	var body := params.duplicate()
	body["mode"] = wanted
	mode = wanted
	answered = 0
	var key := cache if cache != "" else wanted
	var res := await ApiClient.post_json("/play/session/start", body)
	if res.ok:
		_apply_pack(res.data)
		_save_json(PACK_FILE % key, res.data)
		# Le serveur a retiré les notions déjà reçues ; restent celles pas encore envoyées.
		aside.clear()
		for entry: Dictionary in _own_aside():
			aside[str(entry["notion"])] = true
		return res
	if res.status == 0:
		var cached: Dictionary = _load_json(PACK_FILE % key, {})
		if not cached.is_empty():
			_apply_pack(cached)
			return {"ok": true, "status": 0, "data": cached, "error": {}, "offline": true}
		if wanted == "sphinx":  # l'île n'a pas besoin de questions : on y joue aussi hors connexion
			_apply_pack({})
			return {"ok": true, "status": 0, "data": {}, "error": {}, "offline": true}
	return res


## Fin de session ; `rating` : note de plaisir de 1 à 5 (fin de donjon), 0 sinon.
func end(rating := 0) -> void:
	if mode != "sphinx" and answered >= SphinxIsland.PASS_ANSWERS:
		SaveManager.earn_passage()
	mode = ""
	answered = 0
	await flush()
	if session_id != "":
		var body := {"session_id": session_id, "active_seconds": int(active_seconds)}
		if rating > 0:
			body["rating"] = rating
		await ApiClient.post_json("/play/session/end", body)
	session_id = ""


## Durée maximale de jeu atteinte (PRD US-11, réglée par le parent).
func time_over() -> bool:
	_check_break()
	return played_seconds >= max_minutes * 60.0


## Minutes avant la fin de la pause (nouvelle séance), au moins 1.
func minutes_before_play() -> int:
	var idle := Time.get_unix_time_from_system() - _last_play_unix
	return maxi(1, ceili((break_minutes * 60.0 - idle) / 60.0))


## Phrase de fin de séance, montrée par chaque activité et par le camp.
func rest_text() -> String:
	return "Tu as joué %d minutes : c'est l'heure de la pause ! Tu pourras repartir à l'aventure dans %d minutes. Ta progression est sauvegardée." 		% [roundi(played_seconds / 60.0), minutes_before_play()]


## Temps de la séance connu du serveur (connexion, retour au camp, début de session) : on
## garde le plus avancé des deux compteurs (une fin de session a pu ne pas encore partir).
func sync_play_time(info: Dictionary) -> void:
	if info.is_empty():
		return
	max_minutes = int(info.get("session_max_minutes", max_minutes))
	break_minutes = int(info.get("break_minutes", break_minutes))
	var last := Time.get_unix_time_from_system() - float(info.get("idle_seconds", 0))
	var local_valid := played_seconds > 0.0 and _last_play_unix >= last
	played_seconds = maxf(played_seconds if local_valid else 0.0, float(info.get("played_seconds", 0)))
	_last_play_unix = maxf(_last_play_unix, last)


## Hors d'une activité, une pause assez longue remet la séance à zéro.
func _check_break() -> void:
	if session_id != "" or played_seconds <= 0.0:
		return
	if Time.get_unix_time_from_system() - _last_play_unix >= break_minutes * 60.0:
		played_seconds = 0.0
		Accessibility.reset_pause_timer()


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
	answered += 1
	_save_json(QUEUE_FILE, _queue)
	queue_changed.emit(pending_count())
	flush()


## « Pas encore vu en classe » : la notion n'est plus posée, et part au serveur (le parent la
## voit dans l'espace parent). Hors connexion, l'envoi attend le retour du réseau.
func set_aside_notion(code: String) -> void:
	if aside.has(code):
		return
	aside[code] = true
	_aside_queue.append({"profile_id": _profile_id(), "notion": code})
	_save_json(ASIDE_FILE, _aside_queue)
	_flush_aside()


## Vrai si l'item porte sur une notion mise de côté.
func is_set_aside(item: Dictionary) -> bool:
	for code in item.get("notions", []):
		if aside.has(str(code)):
			return true
	return false


func _own_aside() -> Array:
	var me := _profile_id()
	return _aside_queue.filter(func(a: Dictionary) -> bool: return int(a.get("profile_id", me)) == me)


func _flush_aside() -> void:
	if ApiClient.token == "":
		return
	for entry: Dictionary in _own_aside():
		var res := await ApiClient.post_json("/play/notions/set-aside", {"notion": entry["notion"]})
		if not res.ok and not _rejected_for_good(res.status):
			return  # nouvel essai au prochain passage du minuteur
		_aside_queue.erase(entry)
		_save_json(ASIDE_FILE, _aside_queue)


## Réponses en attente d'envoi pour le joueur connecté.
func pending_count() -> int:
	return _own_queue().size()


func flush() -> void:
	if not _own_aside().is_empty():
		_flush_aside()
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
	sync_play_time(settings.get("play_time", {}))
	start_levels = data.get("start_levels", {})
	context = data.get("context", {})
	if settings.has("accommodations"):
		Accessibility.apply_parent(settings["accommodations"])
		remember_accommodations(Accessibility.parent)
	active_seconds = 0.0
	_textures.clear()


## Derniers aménagements connus, gardés avec la connexion (lancement hors ligne).
func remember_accommodations(accommodations: Dictionary) -> void:
	if profile.is_empty():
		return
	profile["accommodations"] = accommodations
	if ApiClient.token != "":
		_save_json(AUTH_FILE, {"token": ApiClient.token, "profile": profile})


func _load_json(path: String, default: Variant) -> Variant:
	if not FileAccess.file_exists(path):
		return default
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	return parsed if typeof(parsed) == typeof(default) else default


func _save_json(path: String, data: Variant) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(data))
