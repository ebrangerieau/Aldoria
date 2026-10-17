class_name TouchScroll
extends Node
## Défilement au doigt d'un ScrollContainer, même quand le doigt se pose sur un bouton (le
## défilement de Godot ne part que d'une zone vide, et une barre fine se vise mal sur téléphone).
## Un doigt qui glisse de plus de DRAG_THRESHOLD pixels fait défiler et n'active pas le bouton
## touché ; un simple toucher reste un toucher. Ajouté comme enfant du ScrollContainer.
##
## Godot imite la souris à partir du toucher (le clic d'un bouton vient de ce clic imité, envoyé
## juste avant l'événement tactile). Pendant un défilement, la souris imitée est ignorée et le
## lever du doigt devient un relâchement loin de tout bouton : l'appui est annulé, sans clic.

const DRAG_THRESHOLD := 12.0
const MARK := "touch_scroll"

var _scroll: ScrollContainer
var _finger := -1
var _start := Vector2.ZERO
var _start_scroll := 0
var _dragging := false


static func attach(scroll: ScrollContainer) -> void:
	var helper := TouchScroll.new()
	helper._scroll = scroll
	scroll.add_child(helper, false, Node.INTERNAL_MODE_BACK)


func _input(event: InputEvent) -> void:
	if _scroll == null or not _scroll.is_visible_in_tree() or event.has_meta(MARK):
		return
	if event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		if touch.pressed and _finger < 0 and _scroll.get_global_rect().has_point(touch.position):
			_finger = touch.index
			_start = touch.position
			_start_scroll = _scroll.scroll_vertical
			_dragging = false
		elif not touch.pressed and touch.index == _finger:
			_finger = -1
			if _dragging:
				_dragging = false
				get_viewport().set_input_as_handled()
				_cancel_press()
	elif event is InputEventScreenDrag:
		var drag := event as InputEventScreenDrag
		if drag.index != _finger:
			return
		if not _dragging and absf(drag.position.y - _start.y) > DRAG_THRESHOLD \
				and _scroll.get_v_scroll_bar().max_value > _scroll.size.y:
			_dragging = true
		if _dragging:
			_scroll.scroll_vertical = _start_scroll - int(drag.position.y - _start.y)
			get_viewport().set_input_as_handled()
	elif _dragging and event.device == InputEvent.DEVICE_ID_EMULATION:
		get_viewport().set_input_as_handled()  # souris imitée pendant le défilement


## Relâchement imité loin de tout bouton : le bouton appuyé au départ ne se déclenche pas.
func _cancel_press() -> void:
	var release := InputEventMouseButton.new()
	release.button_index = MOUSE_BUTTON_LEFT
	release.pressed = false
	release.position = Vector2(-10000, -10000)
	release.global_position = release.position
	release.device = InputEvent.DEVICE_ID_EMULATION
	release.set_meta(MARK, true)
	Input.parse_input_event(release)


func is_dragging() -> bool:
	return _dragging
