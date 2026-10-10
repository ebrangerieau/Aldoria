extends Node
## Effets sonores (assets/sfx, synthétisés par tools/make_sfx.py).
## Sur le web, le son ne démarre qu'après une première interaction (écran titre).

const SOUNDS := ["click", "correct", "crit", "wrong", "hit", "hurt", "spell", "heal", "victory", "retreat"]
const VOICES := 6

var volume_db := -4.0
var _streams: Dictionary = {}
var _players: Array[AudioStreamPlayer] = []
var _next := 0


func _ready() -> void:
	for sound in SOUNDS:
		_streams[sound] = load("res://assets/sfx/%s.wav" % sound)
	for i in VOICES:
		var player := AudioStreamPlayer.new()
		add_child(player)
		_players.append(player)


func play(sound: String, pitch := 1.0) -> void:
	if not _streams.has(sound):
		push_warning("Son inconnu : %s" % sound)
		return
	var player := _players[_next]
	_next = (_next + 1) % VOICES
	player.stream = _streams[sound]
	player.pitch_scale = pitch
	player.volume_db = volume_db
	player.play()
