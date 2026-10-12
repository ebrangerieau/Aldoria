class_name TouchStick
extends Control
## Déplacement au doigt (et à la souris) sur toute la surface de jeu :
## - glisser : joystick virtuel qui apparaît sous le doigt (direction et vitesse) ;
## - toucher bref : aller vers ce point (`tapped`).
## Les boutons de l'interface, posés au-dessus, gardent leurs appuis.
## Sur tablette, le toucher arrive ici en souris émulée (emulate_mouse_from_touch).

signal tapped(screen_position: Vector2)

const DRAG_START_PX := 22.0
const RADIUS_PX := 90.0
const TAP_MAX_MS := 350

## Direction voulue, longueur 0 à 1 (x vers la droite, y vers le bas de l'écran).
var vector := Vector2.ZERO
var _pressed := false
var _dragging := false
var _start := Vector2.ZERO
var _current := Vector2.ZERO
var _pressed_ms := 0
var _color := Color.WHITE


func setup(color: Color) -> void:
	_color = color
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP


func set_enabled(enabled: bool) -> void:
	visible = enabled
	mouse_filter = Control.MOUSE_FILTER_STOP if enabled else Control.MOUSE_FILTER_IGNORE
	if not enabled:
		_release()


func _gui_input(event: InputEvent) -> void:
	var button := event as InputEventMouseButton
	if button and button.button_index == MOUSE_BUTTON_LEFT:
		if button.pressed:
			_pressed = true
			_dragging = false
			_start = button.position
			_current = button.position
			_pressed_ms = Time.get_ticks_msec()
		elif _pressed:
			var quick := Time.get_ticks_msec() - _pressed_ms <= TAP_MAX_MS or Accessibility.on("tap_only")
			if not _dragging and quick:
				tapped.emit(button.position)
			_release()
		accept_event()
		return
	var motion := event as InputEventMouseMotion
	if motion and _pressed:
		_current = motion.position
		if not _dragging and _current.distance_to(_start) > DRAG_START_PX:
			_dragging = true
		if _dragging and Accessibility.on("tap_only"):
			_dragging = false  # aménagement « gestes » : pas de joystick, le toucher suffit
		elif _dragging:
			vector = ((_current - _start) / RADIUS_PX).limit_length(1.0)
			queue_redraw()
		accept_event()


func _release() -> void:
	_pressed = false
	_dragging = false
	vector = Vector2.ZERO
	queue_redraw()


func _draw() -> void:
	if not _dragging:
		return
	draw_circle(_start, RADIUS_PX, Color(_color, 0.18))
	draw_arc(_start, RADIUS_PX, 0.0, TAU, 48, Color(_color, 0.55), 3.0, true)
	draw_circle(_start + vector * RADIUS_PX, 34.0, Color(_color, 0.75))
