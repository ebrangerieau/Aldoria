extends Node
## Voix neuronale du serveur (Piper, api/app/routers/speech.py) : la même voix naturelle sur
## la tablette et le PC, en français et en anglais. `Accessibility.say` passe par ici quand
## l'enfant est connecté ; sinon (écran titre, hors connexion, langue sans voix du serveur,
## service absent), la voix de l'appareil prend le relais.
##
## Les morceaux sont lus l'un après l'autre (énoncé puis propositions). Un son déjà reçu est
## gardé pour la séance ; le serveur, lui, garde chaque son fabriqué.
##
## Voix enregistrées (narrateur du prologue, Maître Ysaline : tools/voix_elevenlabs.py) : servies
## avec le jeu dans voix/ ; `voix/manifest.json` associe l'empreinte SHA-256 d'un texte à son son.
## Un texte qui a un son enregistré est joué tel quel, les autres passent par Piper.

const LANGS := ["fr", "en"]
const RETRY_AFTER_MS := 60000  # service de voix en panne : la voix de l'appareil pendant 1 min
const MAX_CACHED := 200

var _player: AudioStreamPlayer
var _queue: Array = []  # [texte, langue, vitesse]
var _cache: Dictionary = {}  # « langue|vitesse|texte » → AudioStreamMP3
var _generation := 0  # change à chaque arrêt : un son arrivé trop tard n'est pas joué
var _running := false
var _off_until := 0
var _recorded: Dictionary = {}  # empreinte SHA-256 du texte → fichier de voix/
var _recorded_base := ""  # adresse du dossier voix/ (vide : pas de voix enregistrées)


func _ready() -> void:
	_player = AudioStreamPlayer.new()
	add_child(_player)
	_load_recorded()


## Vrai si la voix du serveur peut lire cette langue maintenant.
func usable(lang: String) -> bool:
	return ApiClient.token != "" and ApiClient.online and lang.substr(0, 2) in LANGS \
		and Time.get_ticks_msec() >= _off_until


func speak(text: String, lang: String, rate: float, interrupt: bool) -> void:
	if interrupt:
		stop()
	_queue.append([text, lang, rate])
	if not _running:
		_run(_generation)


## Prépare à l'avance le son d'un texte, sans le jouer (prologue : le tableau suivant).
func prefetch(text: String, lang := "fr-FR", rate := 0.95) -> void:
	if usable(lang):
		await _fetch(text, lang, rate)


## Vrai si ce texte a sa voix enregistrée.
func has_recording(text: String) -> bool:
	return _recorded.has(text.sha256_text())


func recorded_count() -> int:
	return _recorded.size()


func stop() -> void:
	_generation += 1
	_queue.clear()
	_running = false
	if _player.playing:
		_player.stop()


func is_speaking() -> bool:
	return _running


func _run(generation: int) -> void:
	_running = true
	while not _queue.is_empty() and generation == _generation:
		var part: Array = _queue.pop_front()
		var stream := await _fetch(str(part[0]), str(part[1]), float(part[2]))
		if generation != _generation:
			return
		if stream == null:
			# Pas de son du serveur : la voix de l'appareil lit ce morceau et la suite.
			var rest := [part] + _queue
			_queue.clear()
			for item: Array in rest:
				Accessibility.device_say(str(item[0]), str(item[1]), false, float(item[2]))
			break
		_player.stream = stream
		_player.volume_db = linear_to_db(maxf(0.001, Accessibility.volume()))
		_player.play()
		await _player.finished
	if generation == _generation:
		_running = false


func _fetch(text: String, lang: String, rate: float) -> AudioStreamMP3:
	if lang.begins_with("fr") and has_recording(text):
		var recorded := await _fetch_recorded(str(_recorded[text.sha256_text()]))
		if recorded != null:
			return recorded  # sinon (fichier absent), Piper
	var key := "%s|%.2f|%s" % [lang, rate, text]
	if _cache.has(key):
		return _cache[key]
	var res := await ApiClient.post_for_bytes("/play/speech", {"text": text, "lang": lang, "rate": rate})
	if not res.ok:
		if res.status != 404:  # 404 : seulement cette langue ; sinon le service est absent
			_off_until = Time.get_ticks_msec() + RETRY_AFTER_MS
		return null
	var stream := AudioStreamMP3.new()
	stream.data = res.bytes
	if _cache.size() >= MAX_CACHED:
		_cache.clear()
	_cache[key] = stream
	return stream


## Manifeste des voix enregistrées : à côté du jeu sur le web ; sur PC, `-- --voix=<adresse du
## site>` (export web local, tools/e2e) pour les essayer.
func _load_recorded() -> void:
	var site := str(JavaScriptBridge.get_interface("location").origin) if OS.has_feature("web") 		else Quality.option("voix")
	if site == "":
		return
	_recorded_base = site.trim_suffix("/") + "/voix/"
	var body := await _download(_recorded_base + "manifest.json")
	var manifest: Variant = JSON.parse_string(body.get_string_from_utf8()) if not body.is_empty() else null
	if not manifest is Dictionary:
		return
	for digest: String in manifest:
		var entry: Variant = manifest[digest]
		if entry is Dictionary and str(entry.get("fichier", "")) != "":
			_recorded[digest] = str(entry["fichier"])


func _fetch_recorded(file: String) -> AudioStreamMP3:
	var key := "voix/" + file
	if _cache.has(key):
		return _cache[key]
	var bytes := await _download(_recorded_base + file.uri_encode())
	if bytes.is_empty():
		return null
	var stream := AudioStreamMP3.new()
	stream.data = bytes
	if _cache.size() >= MAX_CACHED:
		_cache.clear()
	_cache[key] = stream
	return stream


## Fichier servi avec le jeu (vide si absent ou injoignable).
func _download(url: String) -> PackedByteArray:
	var http := HTTPRequest.new()
	http.timeout = 20.0
	http.accept_gzip = not OS.has_feature("web")  # le navigateur décompresse déjà (gzip de nginx)
	add_child(http)
	if http.request(url) != OK:
		http.queue_free()
		return PackedByteArray()
	var res: Array = await http.request_completed
	http.queue_free()
	if res[0] != HTTPRequest.RESULT_SUCCESS or int(res[1]) != 200:
		return PackedByteArray()
	return res[3]
