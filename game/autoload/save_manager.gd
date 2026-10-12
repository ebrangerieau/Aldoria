extends Node
## Sauvegarde de partie (TRD §2.7) : XP, progression dans les donjons, bestiaire,
## défis quotidiens (jours faits, record, coffres de la semaine ouverts), quêtes du
## village (dernier jour où chaque habitant a été aidé), apparence (« look », facultative).
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
## Époque du profil sur le serveur : elle change quand le parent réinitialise la
## progression ; une partie d'une autre époque est abandonnée, jamais renvoyée.
var _epoch := 0
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
	return {"schema_version": SCHEMA_VERSION, "xp": 0, "dungeons": {}, "bestiary": {}, "daily": _default_daily(), "village": {}}


static func _default_daily() -> Dictionary:
	return {"days": [], "best": {"correct": 0, "ms": 0}, "best_streak": 0, "chests": []}


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


## Un donjon est ouvert quand le précédent du même monde a été terminé une fois.
func dungeon_unlocked(dungeons: Array[DungeonDef], index: int) -> bool:
	return index == 0 or int(dungeon(dungeons[index - 1].code)["completed"]) > 0


func daily() -> Dictionary:
	_ensure_loaded()
	var d: Dictionary = data.get("daily", {})
	var full := _default_daily()
	full.merge(d, true)
	data["daily"] = full
	return full


func daily_days() -> Array:
	return daily()["days"]


## Donjons du monde terminés au moins une fois (déblocages de la garde-robe).
func dungeons_done() -> int:
	var count := 0
	for d in DungeonDef.all_for_world(Session.world()):
		if int(dungeon(d.code)["completed"]) > 0:
			count += 1
	return count


## Apparence du héros et compagnon (Wardrobe), toujours valide et autorisée : une
## sauvegarde ancienne ou d'un autre appareil n'a pas forcément de clé « look ».
func look() -> Dictionary:
	_ensure_loaded()
	return Wardrobe.sanitize(data.get("look"), Session.world(), level(), dungeons_done())


func set_look(look: Dictionary) -> void:
	_ensure_loaded()
	data["look"] = Wardrobe.sanitize(look, Session.world(), level(), dungeons_done())
	_touch()


## Habitant déjà aidé ce jour-là (une quête par habitant et par jour).
func quest_done(npc_code: String, day: String) -> bool:
	_ensure_loaded()
	return str((data.get("village", {}) as Dictionary).get(npc_code, "")) == day


func record_quest(npc_code: String, day: String) -> void:
	_ensure_loaded()
	if not data.get("village") is Dictionary:
		data["village"] = {}
	data["village"][npc_code] = day
	_touch()


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


## Défi quotidien terminé. `day` : jour compté (aujourd'hui, hier en rattrapage, ou ""
## pour un simple entraînement) ; record : plus de bonnes réponses, puis plus rapide.
func record_daily(day: String, correct: int, time_ms: int, today: String) -> void:
	var d := daily()
	var days: Array = d["days"]
	if day != "" and not days.has(day):
		days.append(day)
		days.sort()
		while days.size() > DailyChallenge.KEPT_DAYS:
			days.pop_front()
	var best: Dictionary = d["best"]
	if correct > int(best["correct"]) or (correct == int(best["correct"]) and time_ms < int(best["ms"])):
		d["best"] = {"correct": correct, "ms": time_ms}
	d["best_streak"] = maxi(int(d["best_streak"]), DailyChallenge.streak(days, today))
	_touch()


func weekly_chest_ready(today: String) -> bool:
	var d := daily()
	var week_done := DailyChallenge.week_count(d["days"], today) >= DailyChallenge.WEEKLY_GOAL
	return week_done and not (d["chests"] as Array).has(DailyChallenge.week_start(today))


func open_weekly_chest(today: String) -> void:
	if not weekly_chest_ready(today):
		return
	var chests: Array = daily()["chests"]
	chests.append(DailyChallenge.week_start(today))
	while chests.size() > 8:
		chests.pop_front()
	add_xp(DailyChallenge.WEEKLY_CHEST_XP)


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
	if int(server.get("epoch", 0)) != _epoch:
		_restart(server)
		return
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
		"base_revision": _revision, "schema_version": SCHEMA_VERSION, "data": data, "epoch": _epoch,
	})
	_pushing = false
	if res.ok:
		_revision = int(res.data["revision"])
		_dirty = false
		_write_local()
	elif res.status == 409:
		var current: Dictionary = res.error.get("details", {}).get("current", {})
		if int(current.get("epoch", 0)) != _epoch:
			_restart(current)  # progression réinitialisée par le parent
		else:
			_adopt(current)  # un autre appareil est allé plus loin : sa partie l'emporte


## Changement de joueur : dernier envoi, puis on oublie la partie en mémoire.
func unload() -> void:
	if _dirty:
		await push()
	_profile_id = 0
	_revision = 0
	_epoch = 0
	_dirty = false
	data = default_data()


## Le parent a réinitialisé la progression : on repart de la partie du serveur (vide
## ou recommencée sur un autre appareil), sans renvoyer l'ancienne.
func _restart(server: Dictionary) -> void:
	_epoch = int(server.get("epoch", 0))
	_revision = int(server.get("revision", 0))
	data = migrate(server["data"], int(server.get("schema_version", 0))) if server.get("data") is Dictionary else default_data()
	_dirty = false
	_write_local()
	changed.emit()


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
	_epoch = 0
	_dirty = false
	data = default_data()
	if id == 0 or not FileAccess.file_exists(FILE % id):
		return
	var stored: Variant = JSON.parse_string(FileAccess.get_file_as_string(FILE % id))
	if stored is Dictionary and stored.get("data") is Dictionary:
		data = migrate(stored["data"], int(stored["data"].get("schema_version", 0)))
		_revision = int(stored.get("revision", 0))
		_epoch = int(stored.get("epoch", 0))
		_dirty = bool(stored.get("dirty", false))


func _write_local() -> void:
	if _profile_id == 0:
		return  # pas de joueur identifié (tests) : partie en mémoire seulement
	var file := FileAccess.open(FILE % _profile_id, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify({"revision": _revision, "epoch": _epoch, "dirty": _dirty, "data": data}))
