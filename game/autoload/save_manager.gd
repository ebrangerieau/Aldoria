extends Node
## Sauvegarde de partie (TRD §2.7) : XP, progression dans les donjons, bestiaire.
##
## Écrite d'abord dans `user://` (IndexedDB sur le web), puis envoyée au serveur
## (`PUT /play/save` avec la révision sur laquelle elle s'appuie). Deux appareils
## en désaccord : la partie la plus avancée (XP) gagne ; le serveur garde les
## 20 dernières révisions. Sans réseau, la partie continue et repart plus tard.
##
## Le contenu suit `SCHEMA_VERSION` ; une sauvegarde plus ancienne passe par
## `migrate` au chargement.

signal changed
signal level_up(level: int)

const SCHEMA_VERSION := 1
const FILE := "user://save_%d.json"
const RETRY_S := 15.0

var data: Dictionary = default_data()
var _profile_id := 0
var _revision := 0  # révision du serveur sur laquelle `data` s'appuie
var _dirty := false  # modifications pas encore acceptées par le serveur
var _pushing := false


func _ready() -> void:
	var timer := Timer.new()
	timer.wait_time = RETRY_S
	timer.timeout.connect(func() -> void:
		if _dirty:
			push())
	add_child(timer)
	timer.start()


static func default_data() -> Dictionary:
	return {"schema_version": SCHEMA_VERSION, "xp": 0, "dungeons": {}, "bestiary": {}}


## Met une sauvegarde au format courant (version 1 : point de départ, rien à convertir).
## Une future version ajoutera ici ses étapes : `if from < 2: ...`.
static func migrate(save: Dictionary, from_version: int) -> Dictionary:
	var result := default_data()
	result.merge(save, true)
	if from_version < 1:
		result["xp"] = int(save.get("xp", 0))
	result["schema_version"] = SCHEMA_VERSION
	return result


# --- Lecture ----------------------------------------------------------------------

func xp() -> int:
	_ensure_loaded()
	return int(data["xp"])


func level() -> int:
	return Progression.level_for_xp(xp())


func dungeon(code: String) -> Dictionary:
	_ensure_loaded()
	var all: Dictionary = data["dungeons"]
	if not all.has(code):
		all[code] = {"checkpoint": 0, "completed": 0, "best_room": 0}
	return all[code]


func bestiary() -> Dictionary:
	_ensure_loaded()
	return data["bestiary"]


# --- Modifications ---------------------------------------------------------------------

func add_xp(amount: int) -> void:
	if amount <= 0:
		return
	var before := level()
	data["xp"] = xp() + amount
	_touch()
	if level() > before:
		level_up.emit(level())


## Salle de reprise d'un donjon (portes déjà ouvertes jusqu'à elle).
func set_checkpoint(code: String, room: int) -> void:
	var d := dungeon(code)
	d["checkpoint"] = room
	d["best_room"] = maxi(int(d["best_room"]), room)
	_touch()


func complete_dungeon(code: String) -> void:
	var d := dungeon(code)
	d["completed"] = int(d["completed"]) + 1
	d["checkpoint"] = 0  # rejouable depuis l'entrée
	_touch()


func record_defeat(enemy_key: String) -> void:
	var beasts := bestiary()
	beasts[enemy_key] = int(beasts.get(enemy_key, 0)) + 1
	_touch()


# --- Synchronisation ----------------------------------------------------------------------

## Au retour au camp : récupère la sauvegarde du serveur et réconcilie.
func sync() -> void:
	_ensure_loaded()
	if ApiClient.token == "" or _profile_id == 0:
		return
	var res := await ApiClient.get_json("/play/save")
	if not res.ok:
		return
	var server: Dictionary = res.data
	var server_revision := int(server.get("revision", 0))
	if server_revision > _revision and server.get("data") is Dictionary:
		var theirs: Dictionary = server["data"]
		if not _dirty or int(theirs.get("xp", 0)) >= xp():
			_adopt(server)
			return
	if _dirty or (server_revision == 0 and xp() > 0):
		await push()


func push() -> void:
	_ensure_loaded()
	if _pushing or ApiClient.token == "" or _profile_id == 0:
		return
	_pushing = true
	var res := await ApiClient.put_json("/play/save", {
		"base_revision": _revision, "schema_version": SCHEMA_VERSION, "data": data,
	})
	_pushing = false
	if res.ok:
		_revision = int(res.data["revision"])
		_dirty = false
		_write_local()
	elif res.status == 409:
		# Un autre appareil est allé plus loin : sa partie l'emporte.
		_adopt(res.error.get("details", {}).get("current", {}))


## Changement de joueur : dernier envoi, puis on oublie la partie en mémoire.
func unload() -> void:
	if _dirty:
		await push()
	_profile_id = 0
	_revision = 0
	_dirty = false
	data = default_data()


func _adopt(server: Dictionary) -> void:
	if not server.get("data") is Dictionary:
		return
	data = migrate(server["data"], int(server.get("schema_version", 0)))
	_revision = int(server.get("revision", 0))
	_dirty = false
	_write_local()
	changed.emit()


func _touch() -> void:
	_dirty = true
	_write_local()
	changed.emit()
	push()


# --- Stockage local ----------------------------------------------------------------------

func _current_profile_id() -> int:
	return int(Session.profile.get("id", 0))


## Charge la partie du joueur connecté quand il change (connexion, appareil partagé).
func _ensure_loaded() -> void:
	var id := _current_profile_id()
	if id == _profile_id:
		return
	_profile_id = id
	_revision = 0
	_dirty = false
	data = default_data()
	if id == 0 or not FileAccess.file_exists(FILE % id):
		return
	var stored: Variant = JSON.parse_string(FileAccess.get_file_as_string(FILE % id))
	if stored is Dictionary and stored.get("data") is Dictionary:
		data = migrate(stored["data"], int(stored["data"].get("schema_version", 0)))
		_revision = int(stored.get("revision", 0))
		_dirty = bool(stored.get("dirty", false))


func _write_local() -> void:
	if _profile_id == 0:
		return  # pas de joueur identifié (tests) : partie en mémoire seulement
	var file := FileAccess.open(FILE % _profile_id, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify({"revision": _revision, "dirty": _dirty, "data": data}))
