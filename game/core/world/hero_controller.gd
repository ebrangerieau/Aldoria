class_name HeroController
extends CharacterBody3D
## Héros en exploration : déplacement direct avec glissement le long des murs
## (IMPLEMENTATION_PLAN §1.3 : pas de module de navigation).
## Entrées : clavier (ZQSD / WASD selon la disposition, flèches), manette (stick
## gauche), joystick virtuel (`stick_vector`), toucher ou clic pour aller vers un
## point (`go_to`, en suivant les points de passage des portes).

const SPEED := 5.5
const ACCEL := 30.0
const ARRIVE_DISTANCE := 0.25
const TURN_SPEED := 12.0
const ACTIONS := {
	"move_left": [KEY_A, KEY_LEFT, JOY_AXIS_LEFT_X, -1.0],
	"move_right": [KEY_D, KEY_RIGHT, JOY_AXIS_LEFT_X, 1.0],
	"move_up": [KEY_W, KEY_UP, JOY_AXIS_LEFT_Y, -1.0],
	"move_down": [KEY_S, KEY_DOWN, JOY_AXIS_LEFT_Y, 1.0],
}

var fighter: Fighter
var controls_enabled := true
## Joystick virtuel : x vers la droite, y vers le bas de l'écran (= vers le sud).
var stick_vector := Vector2.ZERO
var _waypoints: Array[Vector3] = []
var _stuck_time := 0.0


static func create(look: Dictionary, name_text: String, max_hp: int) -> HeroController:
	_ensure_actions()
	var hero := HeroController.new()
	hero.motion_mode = CharacterBody3D.MOTION_MODE_FLOATING
	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.45
	capsule.height = 1.8
	shape.shape = capsule
	shape.position.y = 0.9
	hero.add_child(shape)
	hero.fighter = Fighter.create_hero(look, name_text, max_hp)
	hero.add_child(hero.fighter)
	return hero


## Actions de déplacement, déclarées une fois. Touches physiques : la position de
## WASD sur un clavier QWERTY correspond à ZQSD sur un clavier AZERTY.
static func _ensure_actions() -> void:
	for action in ACTIONS:
		if InputMap.has_action(action):
			continue
		InputMap.add_action(action, 0.25)
		var spec: Array = ACTIONS[action]
		for key in [spec[0], spec[1]]:
			var event := InputEventKey.new()
			event.physical_keycode = key
			InputMap.action_add_event(action, event)
		var axis := InputEventJoypadMotion.new()
		axis.axis = spec[2]
		axis.axis_value = spec[3]
		InputMap.action_add_event(action, axis)


## Aller vers des points successifs (toucher ou clic sur le sol).
func go_to(points: Array[Vector3]) -> void:
	_waypoints = points
	_stuck_time = 0.0


func stop() -> void:
	_waypoints.clear()
	velocity = Vector3.ZERO
	stick_vector = Vector2.ZERO
	fighter.idle()


func is_moving() -> bool:
	return velocity.length() > 0.3


func _physics_process(delta: float) -> void:
	var wish := Vector3.ZERO
	if controls_enabled:
		var input := Input.get_vector("move_left", "move_right", "move_up", "move_down")
		if stick_vector.length() > input.length():
			input = stick_vector
		if input.length() > 0.1:
			_waypoints.clear()  # une direction donnée annule le trajet en cours
			wish = Vector3(input.x, 0, input.y).limit_length(1.0)
		elif not _waypoints.is_empty():
			wish = _follow_waypoints(delta)
	else:
		_waypoints.clear()
	velocity = velocity.move_toward(wish * SPEED, ACCEL * delta)
	move_and_slide()
	position.y = 0.0
	_animate(delta)


func _follow_waypoints(delta: float) -> Vector3:
	var target := _waypoints[0]
	target.y = 0.0
	var to_target := target - position
	to_target.y = 0.0
	if to_target.length() < ARRIVE_DISTANCE:
		_waypoints.remove_at(0)
		_stuck_time = 0.0
		return Vector3.ZERO if _waypoints.is_empty() else _follow_waypoints(delta)
	# Bloqué contre un obstacle : on renonce plutôt que de pousser indéfiniment.
	if velocity.length() < 0.5 and get_slide_collision_count() > 0:
		_stuck_time += delta
		if _stuck_time > 0.6:
			_waypoints.clear()
			return Vector3.ZERO
	else:
		_stuck_time = 0.0
	# Ralentir en arrivant, pour ne pas dépasser le point.
	return to_target.normalized() * clampf(to_target.length() / 0.8, 0.3, 1.0)


func _animate(delta: float) -> void:
	var flat := Vector3(velocity.x, 0, velocity.z)
	if flat.length() > 0.3:
		var yaw := atan2(flat.x, flat.z)
		fighter.rotation.y = lerp_angle(fighter.rotation.y, yaw, minf(1.0, TURN_SPEED * delta))
		fighter.loop("Running_A" if flat.length() > SPEED * 0.55 else "Walking_A")
	elif fighter.is_playing("Running_A") or fighter.is_playing("Walking_A"):
		fighter.idle()
