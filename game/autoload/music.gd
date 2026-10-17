extends Node
## Musique du jeu (deploy/musique/theme.mp3, générée avec Suno ; voir docs/exploitation.md) : en
## boucle partout, sauf pendant une quête (donjon, village, défi du jour, arène, tir) où l'enfant doit
## rester concentré. Elle s'efface en fondu à l'entrée d'une quête et reprend où elle en était au
## retour. Elle se fait plus discrète quand une voix parle (prologue, « Écouter »).
##
## Hors du .pck pour ne pas alourdir le premier chargement : sur le web, téléchargée à côté du jeu
## (musique/, copiée par tools/postprocess_web.py) ; sur PC, lue dans deploy/musique.
## Volume : `Accessibility.music_volume()` (Options), moins fort en mode calme. `-- --musique=0` la coupe (PC).

const FILE := "theme.mp3"
## Scènes de quête : pas de musique.
const FOCUS_SCENES := [
	"res://scenes/dungeon/dungeon.tscn",
	"res://scenes/village/village.tscn",
	"res://scenes/daily/daily.tscn",
	"res://scenes/combat/combat.tscn",
	"res://scenes/tir/tir.tscn",
]
const BASE_DB := -9.0  # musique de fond : sous les voix et les effets
const DUCK_DB := -9.0  # en plus, pendant qu'une voix parle
const FADE_SECONDS := 1.5
const VOICE_CHECK := 0.25  # secondes entre deux regards sur la voix (pont JavaScript sur le web)

var _player: AudioStreamPlayer
var _gain := 0.0  # fondu (0 à 1)
var _duck := 0.0  # atténuation pendant une voix (dB, négative)
var _speaking := false
var _check_in := 0.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_player = AudioStreamPlayer.new()
	add_child(_player)
	if Quality.option("musique") != "0":
		_load()


## Niveau voulu dans une scène : 0 pendant une quête ou si l'enfant a coupé la musique, sinon 1.
func wanted_gain(scene_path: String) -> float:
	return 0.0 if scene_path in FOCUS_SCENES or Accessibility.music_volume() <= 0.0 else 1.0


func is_loaded() -> bool:
	return _player.stream != null


func _process(delta: float) -> void:
	if _player.stream == null:
		return
	_check_in -= delta
	if _check_in <= 0.0:
		_check_in = VOICE_CHECK
		_speaking = Accessibility.is_speaking()
	var scene := get_tree().current_scene
	var wanted := wanted_gain(scene.scene_file_path if scene != null else "")
	_gain = move_toward(_gain, wanted, delta / FADE_SECONDS)
	_duck = move_toward(_duck, DUCK_DB if _speaking else 0.0, delta * 18.0)
	var silent := _gain <= 0.001
	if _player.stream_paused != silent:
		_player.stream_paused = silent  # reprend où elle en était
	if not silent:
		var calm := Accessibility.CALM_VOLUME_DB if Accessibility.on("calm") else 0.0
		var level := maxf(0.0001, _gain * Accessibility.music_volume())
		_player.volume_db = linear_to_db(level) + BASE_DB + _duck + calm


func _load() -> void:
	var bytes := PackedByteArray()
	if OS.has_feature("web"):
		bytes = await _download(str(JavaScriptBridge.get_interface("location").origin) + "/musique/" + FILE)
	else:
		var path := ProjectSettings.globalize_path("res://").path_join("../deploy/musique/" + FILE)
		if FileAccess.file_exists(path):
			bytes = FileAccess.get_file_as_bytes(path)
	if bytes.is_empty():
		return
	var stream := AudioStreamMP3.new()
	stream.data = bytes
	stream.loop = true
	_player.stream = stream
	_player.volume_db = -80.0
	_player.play()
	_player.stream_paused = true  # le fondu la lance (`_process`)


func _download(url: String) -> PackedByteArray:
	var http := HTTPRequest.new()
	http.timeout = 60.0
	http.accept_gzip = not OS.has_feature("web")  # le navigateur décompresse déjà
	add_child(http)
	if http.request(url) != OK:
		http.queue_free()
		return PackedByteArray()
	var res: Array = await http.request_completed
	http.queue_free()
	if res[0] != HTTPRequest.RESULT_SUCCESS or int(res[1]) != 200:
		return PackedByteArray()
	return res[3]
