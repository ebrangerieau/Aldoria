class_name BalanceView
extends VBoxContainer
## Énigme de la balance (Jules, pré-algèbre) : boîtes de masse inconnue et billes
## sur deux plateaux en équilibre. Deux gestes pour raisonner comme en classe :
## enlever la même chose des deux côtés (la balance reste en équilibre), jusqu'à
## lire combien pèsent les boîtes. Ne valide rien : la réponse se donne au pavé.

const BOX_PX := 24.0
const MARBLE_R := 5.0
const MARBLE_STEP := 11.5
const MARBLES_PER_ROW := 16

var _initial: Dictionary
var _left := {"boxes": 0, "units": 0}
var _right := {"boxes": 0, "units": 0}
var _box_names: Array = ["boîte", "boîtes"]
var _unit_names: Array = ["bille", "billes"]
var _wt: WorldTheme
var _canvas: Control
var _caption: Label
var _remove_units: Button
var _remove_boxes: Button
var _revealed := ""


func setup(visual: Dictionary, wt: WorldTheme) -> void:
	_wt = wt
	_initial = visual
	_box_names = visual.get("box", _box_names)
	_unit_names = visual.get("unit", _unit_names)
	add_theme_constant_override("separation", 8)
	_canvas = Control.new()
	_canvas.custom_minimum_size = Vector2(560, 150)
	_canvas.draw.connect(_draw_balance)
	add_child(_canvas)
	_caption = UiKit.label("", 20, wt.text)
	_caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(_caption)
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 10)
	_remove_units = UiKit.button("", 52.0)
	_remove_units.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_remove_units.pressed.connect(_remove.bind("units"))
	actions.add_child(_remove_units)
	_remove_boxes = UiKit.button("", 52.0)
	_remove_boxes.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_remove_boxes.pressed.connect(_remove.bind("boxes"))
	actions.add_child(_remove_boxes)
	var reset := UiKit.button("↺", 52.0)
	reset.custom_minimum_size.x = 64
	UiKit.style_secondary(reset, wt)
	reset.pressed.connect(_reset)
	actions.add_child(reset)
	add_child(actions)
	_reset()


## Après la réponse : les boîtes affichent leur masse si c'était juste.
func reveal(correct: bool, answer_text := "") -> void:
	_revealed = answer_text if correct else ""
	_remove_units.disabled = true
	_remove_boxes.disabled = true
	_canvas.queue_redraw()


func _reset() -> void:
	_left = {"boxes": int(_initial["left"]["boxes"]), "units": int(_initial["left"]["units"])}
	_right = {"boxes": int(_initial["right"]["boxes"]), "units": int(_initial["right"]["units"])}
	_refresh()


## Enlève de chaque côté tout ce qui est commun (billes ou boîtes).
func _remove(kind: String) -> void:
	var n := mini(int(_left[kind]), int(_right[kind]))
	if n <= 0:
		return
	_left[kind] -= n
	_right[kind] -= n
	Sfx.play("correct", 1.3)
	_refresh()


func _refresh() -> void:
	var units := mini(int(_left["units"]), int(_right["units"]))
	var boxes := mini(int(_left["boxes"]), int(_right["boxes"]))
	_remove_units.text = "Enlever %s de chaque côté" % _count(units, _unit_names)
	_remove_units.disabled = units == 0
	_remove_units.visible = units > 0 or boxes == 0
	_remove_boxes.text = "Enlever %s de chaque côté" % _count(boxes, _box_names)
	_remove_boxes.disabled = boxes == 0
	_remove_boxes.visible = boxes > 0
	_caption.text = "%s  =  %s" % [_side_text(_left), _side_text(_right)]
	_canvas.queue_redraw()


func _side_text(side: Dictionary) -> String:
	var parts := PackedStringArray()
	if int(side["boxes"]) > 0:
		parts.append(_count(side["boxes"], _box_names))
	if int(side["units"]) > 0 or parts.is_empty():
		parts.append(_count(side["units"], _unit_names))
	return " et ".join(parts)


static func _count(n: int, names: Array) -> String:
	return "%d %s" % [n, names[0] if n <= 1 else names[1]]


func _draw_balance() -> void:
	var size := _canvas.size
	var cx := size.x / 2.0
	var beam_y := 30.0
	var line := _wt.text_dim
	# Pied et fléau (toujours horizontal : la balance est en équilibre).
	_canvas.draw_line(Vector2(cx, beam_y), Vector2(cx, size.y - 8), line, 5.0)
	_canvas.draw_colored_polygon(PackedVector2Array([
		Vector2(cx - 34, size.y - 4), Vector2(cx + 34, size.y - 4), Vector2(cx, size.y - 30)]), line)
	_canvas.draw_line(Vector2(24, beam_y), Vector2(size.x - 24, beam_y), line, 6.0)
	_canvas.draw_circle(Vector2(cx, beam_y), 8.0, _wt.accent)
	var plate_w := cx - 60.0
	_draw_plate(Rect2(30, beam_y, plate_w, size.y - beam_y - 14), _left)
	_draw_plate(Rect2(size.x - 30 - plate_w, beam_y, plate_w, size.y - beam_y - 14), _right)


func _draw_plate(area: Rect2, side: Dictionary) -> void:
	var line := _wt.text_dim
	var plate_y := area.end.y
	var mid := area.get_center().x
	_canvas.draw_line(Vector2(mid, area.position.y), Vector2(area.position.x + 10, plate_y), line, 2.0)
	_canvas.draw_line(Vector2(mid, area.position.y), Vector2(area.end.x - 10, plate_y), line, 2.0)
	_canvas.draw_line(Vector2(area.position.x, plate_y), Vector2(area.end.x, plate_y), line, 5.0)
	var font := ThemeDB.fallback_font
	var y := plate_y - 4.0
	# Boîtes, posées sur le plateau.
	var boxes := int(side["boxes"])
	if boxes > 0:
		var total_w := boxes * (BOX_PX + 4) - 4
		var x := mid - total_w / 2.0
		for b in boxes:
			var rect := Rect2(x + b * (BOX_PX + 4), y - BOX_PX, BOX_PX, BOX_PX)
			_canvas.draw_rect(rect, _wt.accent)
			_canvas.draw_rect(rect, _wt.accent.darkened(0.4), false, 2.0)
			var text := _revealed if _revealed != "" else "?"
			var fs := 18 if text.length() < 3 else 13
			_canvas.draw_string(font, Vector2(rect.position.x, rect.end.y - 7), text, HORIZONTAL_ALIGNMENT_CENTER, BOX_PX, fs, Color.WHITE)
		y -= BOX_PX + 6
	# Billes, en rangées.
	var units := int(side["units"])
	var per_row := mini(MARBLES_PER_ROW, maxi(1, units))
	var row_w := (per_row - 1) * MARBLE_STEP
	for u in units:
		@warning_ignore("integer_division")
		var row := u / MARBLES_PER_ROW
		var col := u % MARBLES_PER_ROW
		var center := Vector2(mid - row_w / 2.0 + col * MARBLE_STEP, y - MARBLE_R - row * MARBLE_STEP)
		_canvas.draw_circle(center, MARBLE_R, _wt.good)
