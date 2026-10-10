extends Node3D
## Scène d'étalonnage (IMPLEMENTATION_PLAN, phase 0) : un diorama représentatif du jeu
## final pour mesurer fps, appels de dessin et mémoire sur la tablette réelle.
## Contenu : salle DungeonRoom, 2 personnages animés qui échangent des coups,
## caméra inclinée à focale longue qui oscille lentement.
##
## Accès sur le web : ?scene=calibration. Capture sur PC :
##   godot --path game -- --scene=calibration --screenshot=C:/chemin/capture.png

const CHARACTERS := "res://assets/kaykit/characters/%s.glb"

const CAMERA_FOV := 20.0
const CAMERA_DISTANCE := 62.0
const CAMERA_PITCH_DEG := -42.0
const CAMERA_SWAY_DEG := 12.0
const CAMERA_SWAY_PERIOD_S := 16.0

var _room: DungeonRoom
var _camera_pivot: Node3D
var _time := 0.0
var _hero_anim: AnimationPlayer
var _enemy_anim: AnimationPlayer


func _ready() -> void:
	_room = DungeonRoom.new()
	add_child(_room)
	_room.build()
	_build_characters()
	_build_camera()

	Quality.changed.connect(_apply_quality)
	PerfOverlay.show_overlay()


func _process(delta: float) -> void:
	_time += delta
	var sway := sin(_time * TAU / CAMERA_SWAY_PERIOD_S) * deg_to_rad(CAMERA_SWAY_DEG)
	_camera_pivot.rotation.y = sway


func _build_characters() -> void:
	if Quality.option("chars") == "0":  # diagnostic : ?chars=0
		return
	var hero := _character("Knight", Vector3(-2.6, 0, 1.5), 90.0)
	_hero_anim = _setup_animation(hero, "Idle")
	var enemy := _character("Skeleton_Warrior", Vector3(2.6, 0, 1.5), -90.0)
	_enemy_anim = _setup_animation(enemy, "Idle_Combat")

	# Échange de coups toutes les 4 s : représentatif d'un combat (animations + particules).
	var timer := Timer.new()
	timer.wait_time = 4.0
	timer.autostart = true
	timer.timeout.connect(_exchange_blows)
	add_child(timer)


func _character(model: String, pos: Vector3, yaw_deg: float) -> Node3D:
	var node: Node3D = (load(CHARACTERS % model) as PackedScene).instantiate()
	node.position = pos
	node.rotation_degrees.y = yaw_deg
	add_child(node)
	_room.adapt_character(node)
	return node


func _build_camera() -> void:
	_camera_pivot = Node3D.new()
	_camera_pivot.position = Vector3(0, 1.0, 0)
	add_child(_camera_pivot)
	var camera := Camera3D.new()
	camera.fov = CAMERA_FOV
	camera.far = 200.0
	var pitch := deg_to_rad(CAMERA_PITCH_DEG)
	camera.position = Vector3(0, -sin(pitch) * CAMERA_DISTANCE, cos(pitch) * CAMERA_DISTANCE)
	camera.rotation.x = pitch
	_camera_pivot.add_child(camera)
	camera.make_current()


func _setup_animation(character: Node, idle: String) -> AnimationPlayer:
	var player := character.find_child("AnimationPlayer", true, false) as AnimationPlayer
	if player == null:
		push_warning("Pas d'AnimationPlayer dans %s" % character.name)
		return null
	if player.has_animation(idle):
		player.get_animation(idle).loop_mode = Animation.LOOP_LINEAR
	player.play(idle)
	player.animation_finished.connect(func(_n: StringName) -> void: player.play(idle))
	return player


func _exchange_blows() -> void:
	if _hero_anim and _hero_anim.has_animation("1H_Melee_Attack_Chop"):
		_hero_anim.play("1H_Melee_Attack_Chop")
	if _enemy_anim and _enemy_anim.has_animation("Hit_A"):
		get_tree().create_timer(0.35).timeout.connect(func() -> void: _enemy_anim.play("Hit_A"))


func _apply_quality(_profile: StringName) -> void:
	if Quality.needs_rebuild(_room.built_settings):
		# Lumières et éclairage par sommet sont fixés à la construction.
		get_tree().reload_current_scene.call_deferred()
		return
	_room.apply_quality()

