class_name Companion
extends Node3D
## Compagnon animal du monde de Jules (PRD §3) : un renard (Quaternius, CC0) qui suit
## le héros en marchant sur ses pas — les points de passage du héros, jamais à
## travers un mur — et fête les victoires. Purement décoratif.

const MODEL := "res://assets/quaternius/Fox.glb"
const SCALE := 0.45
const STEP := 0.3  # écart entre deux traces du héros
const FOLLOW_GAP := 1.6  # distance gardée derrière le héros
const WALK_SPEED := 4.0
const RUN_SPEED := 7.5
const TELEPORT_DISTANCE := 9.0  # héros téléporté (reprise, porte) : le renard le rejoint

var pet_name := ""
var _target: Node3D
## Hauteur du sol (donjon qui monte : DungeonLevel.height_at) ; vide : il garde sa hauteur.
var floor_height: Callable
var _trail: Array[Vector3] = []
var _anim: AnimationPlayer
var _idle_time := 0.0
var _busy := 0.0  # animation ponctuelle en cours (fête, mange)


static func create(look: Dictionary) -> Companion:
	var pet := Companion.new()
	pet.name = "Compagnon"
	pet.pet_name = str(look.get("pet_name", ""))
	var body: Node3D = (load(MODEL) as PackedScene).instantiate()
	body.scale = Vector3.ONE * SCALE
	pet.add_child(body)
	paint(body, Wardrobe.fur(str(look.get("pet_fur", ""))))
	pet._anim = body.find_child("AnimationPlayer", true, false) as AnimationPlayer
	if pet._anim:
		for loop in ["Idle", "Idle_2", "Walk", "Gallop"]:
			if pet._anim.has_animation(loop):
				pet._anim.get_animation(loop).loop_mode = Animation.LOOP_LINEAR
	return pet


## Pelage : couleurs des matériaux « Main » (dos) et « Main_Light » (ventre, museau).
static func paint(body: Node3D, fur: Dictionary) -> void:
	for node in body.find_children("*", "MeshInstance3D", true, false):
		var mesh_instance := node as MeshInstance3D
		for surface in mesh_instance.mesh.get_surface_count():
			var source := mesh_instance.get_active_material(surface) as BaseMaterial3D
			if source == null:
				continue
			var key := "main" if source.resource_name == "Main" else "light" if source.resource_name == "Main_Light" else ""
			if key == "":
				continue
			var mat := source.duplicate() as BaseMaterial3D
			mat.albedo_color = fur[key]
			mesh_instance.set_surface_override_material(surface, mat)


## Suit `target` (le héros) ; à appeler après avoir placé les deux.
func follow(target: Node3D) -> void:
	_target = target
	_trail.clear()
	position = _behind(target)


func _ready() -> void:
	_play("Idle")


func _physics_process(delta: float) -> void:
	if _target == null:
		return
	var hero := _target.position
	if position.distance_to(hero) > TELEPORT_DISTANCE:
		follow(_target)
		return
	if _trail.is_empty() or _trail[-1].distance_to(hero) > STEP:
		_trail.append(hero)
	# Point visé : la plus ancienne trace pas encore atteinte, tant qu'elle reste à
	# FOLLOW_GAP du héros ; déjà tout près du héros, il l'attend sur place.
	while not _trail.is_empty() and position.distance_to(_trail[0]) < 0.2:
		_trail.remove_at(0)
	if position.distance_to(hero) < FOLLOW_GAP:
		_trail.clear()
	var goal := position
	if not _trail.is_empty() and _trail[0].distance_to(hero) > FOLLOW_GAP:
		goal = _trail[0]
	var to_goal := goal - position
	to_goal.y = 0.0
	_busy = maxf(0.0, _busy - delta)
	if to_goal.length() > 0.15:
		var speed := RUN_SPEED if position.distance_to(hero) > FOLLOW_GAP * 2.2 else WALK_SPEED
		position += to_goal.normalized() * minf(to_goal.length(), speed * delta)
		if floor_height.is_valid():
			position.y = floor_height.call(position)
		rotation.y = lerp_angle(rotation.y, atan2(to_goal.x, to_goal.z), minf(1.0, 10.0 * delta))
		_idle_time = 0.0
		_busy = 0.0
		_play("Gallop" if speed > WALK_SPEED else "Walk")
	else:
		_idle_time += delta
		if _busy <= 0.0:
			# Au repos, il regarde le héros et s'occupe de temps en temps.
			var towards := hero - position
			if towards.length() > 0.3:
				rotation.y = lerp_angle(rotation.y, atan2(towards.x, towards.z), minf(1.0, 4.0 * delta))
			if _idle_time > 7.0:
				_idle_time = 0.0
				_once(["Eating", "Idle_2_HeadLow", "Idle_2"].pick_random())
			else:
				_play("Idle")


## Victoire, coffre : un petit bond.
func celebrate() -> void:
	_once("Jump_ToIdle")


func _once(anim_name: String) -> void:
	if _anim and _anim.has_animation(anim_name):
		_anim.play(anim_name, 0.15)
		_busy = _anim.get_animation(anim_name).length


func _play(anim_name: String) -> void:
	if _anim and _anim.has_animation(anim_name) and _anim.current_animation != anim_name:
		_anim.play(anim_name, 0.2)


func _behind(target: Node3D) -> Vector3:
	# Le héros d'exploration tourne son Fighter, pas lui-même.
	var facing: Node3D = target.get("fighter") if target is HeroController else target
	return target.position + Vector3(0.8, 0, -1.1).rotated(Vector3.UP, facing.rotation.y)
