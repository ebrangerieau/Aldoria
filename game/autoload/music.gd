extends Node
## Musique du jeu (deploy/musique/theme.mp3, générée avec Suno ; voir docs/exploitation.md) : en
## boucle partout, sauf pendant une quête (donjon, village, défi du jour, arène, tir) où l'enfant doit
## rester concentré. Elle s'efface en fondu à l'entrée d'une quête et reprend où elle en était au
## retour. Elle se fait plus discrète quand une voix parle (prologue, « Écouter »).
##
## Hors du .pck pour ne pas alourdir le premier chargement : sur le web, téléchargée à côté du jeu
## (musique/, copiée par tools/postprocess_web.py) ; sur PC, lue dans deploy/musique.
## Volume : `Accessibility.music_volume()` (Options), moins fort en mode calme. `-- --musique=0` la coupe (PC) ;
## `--musique=muette` la charge sans le son (captures du bouton).
## Bouton « couper / remettre la musique » toujours au même endroit, en bas à gauche, sur tout écran où elle
## joue (préférence `music_off` de l'enfant) ; une scène qui a des boutons dans ce coin lui laisse
## `button_width()` de place (prologue).

const FILE := "theme.mp3"
## Scènes de quête : pas de musique.
const FOCUS_SCENES := [
	"res://scenes/dungeon/dungeon.tscn",
	"res://scenes/village/village.tscn",
	"res://scenes/daily/daily.tscn",
	"res://scenes/combat/combat.tscn",
	"res://scenes/tir/tir.tscn",
	"res://scenes/pont/pont.tscn",
	"res://scenes/sphinx/sphinx.tscn",
]
const BASE_DB := -6.0  # musique de fond : sous les voix et les effets
const DUCK_DB := -9.0  # en plus, pendant qu'une voix parle
const FADE_SECONDS := 1.5
const VOICE_CHECK := 0.25  # secondes entre deux regards sur la voix (pont JavaScript sur le web)
const BUTTON_SIZE := 56.0  # hauteur
const BUTTON_WIDTH := 80.0  # largeur fixe : la place que lui laisse le prologue est exacte
const BUTTON_MARGIN := 20.0  # comme les marges des écrans
const BUTTON_LAYER := 90  # au-dessus des écrans et de leurs fenêtres, sous « Tourne ton téléphone »

var _player: AudioStreamPlayer
var _gain := 0.0  # fondu (0 à 1)
var _duck := 0.0  # atténuation pendant une voix (dB, négative)
var _speaking := false
var _check_in := 0.0
var _layer: CanvasLayer
var _button: Button
var _button_for := ""  # scène et réglages pour lesquels le bouton est construit


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_player = AudioStreamPlayer.new()
	add_child(_player)
	if Quality.option("musique") != "0":
		_load()
	Accessibility.changed.connect(func() -> void: _button_for = "")  # taille des cibles, couleurs


## Niveau voulu dans une scène : 0 pendant une quête ou si l'enfant a coupé la musique, sinon 1.
func wanted_gain(scene_path: String) -> float:
	return 0.0 if scene_path in FOCUS_SCENES or is_muted() else 1.0


## Coupée par le bouton, ou volume à zéro dans les Options.
func is_muted() -> bool:
	return bool(Accessibility.prefs.get("music_off", false)) or Accessibility.music_volume() <= 0.0


## Bouton en bas à gauche : coupe la musique ou la remet (au volume des Options, ou par défaut s'il était à zéro).
func toggle() -> void:
	var muted := is_muted()
	if muted and Accessibility.music_volume() <= 0.0:
		Accessibility.prefs.erase("music")  # volume par défaut
	Accessibility.set_pref("music_off", not muted, false)
	refresh_button()


## Place à laisser au bouton dans une rangée qui part du coin en bas à gauche (marge de l'écran comprise).
func button_width() -> float:
	return BUTTON_WIDTH * UiKit.target_scale


## Hauteur du coin occupé, depuis le bas de l'écran : marge à laisser sous une liste qui va jusqu'en bas (Archives).
func corner_height() -> float:
	return BUTTON_SIZE * UiKit.target_scale + BUTTON_MARGIN + 12.0


## Bouton affiché : musique chargée, et pas dans une quête.
func shows_button() -> bool:
	return _button != null and _button.is_visible_in_tree()


func button() -> Button:
	return _button


func is_loaded() -> bool:
	return _player.stream != null


func _process(delta: float) -> void:
	if _player.stream == null:
		return
	_follow_scene()
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
		if Quality.option("musique") == "muette":
			_player.volume_db = -80.0


## Bouton construit pour chaque écran (thème du monde de l'enfant), caché pendant une quête.
func _follow_scene() -> void:
	var scene := get_tree().current_scene
	var path := scene.scene_file_path if scene != null else ""
	var key := "%s|%s|%s" % [scene.get_instance_id() if scene != null else 0, Session.world(), UiKit.target_scale]
	if key == _button_for:
		return
	_button_for = key
	if _layer == null:
		_layer = CanvasLayer.new()
		_layer.layer = BUTTON_LAYER
		add_child(_layer)
	for child in _layer.get_children():
		child.queue_free()
	_button = null
	if scene == null or path in FOCUS_SCENES:
		return
	var wt := WorldTheme.for_world(Session.world())
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.theme = UiKit.make_theme(wt)
	_layer.add_child(root)
	_button = UiKit.button("", BUTTON_SIZE)
	_button.custom_minimum_size.x = button_width()
	_button.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	UiKit.style_secondary(_button, wt)
	_button.pressed.connect(toggle)
	root.add_child(_button)
	# Collé au coin, il grandit vers le haut et la droite (sa taille dépend du thème).
	_button.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	_button.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_button.offset_left = BUTTON_MARGIN
	_button.offset_top = -BUTTON_MARGIN
	_button.offset_bottom = -BUTTON_MARGIN
	refresh_button()


## Icône et texte selon l'état (après un changement dans les Options).
func refresh_button() -> void:
	if _button == null:
		return
	var muted := is_muted()
	_button.icon = load(UiKit.ICONS % ("music-notes-off" if muted else "music-notes"))
	_button.tooltip_text = "Remettre la musique" if muted else "Couper la musique"


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
