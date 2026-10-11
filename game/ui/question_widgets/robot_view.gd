class_name RobotView
extends Control
## Grille du robot (pensée informatique, 6e) : case de départ en vert avec une flèche
## dans la direction du robot, cases candidates marquées A, B, C, D.

const CELL := 42.0

var _size := 6
var _start := Vector2i.ZERO
var _facing := "E"
var _marks: Dictionary = {}
var _wt: WorldTheme


func setup(visual: Dictionary, wt: WorldTheme) -> void:
	_wt = wt
	_size = int(visual.get("size", 6))
	var s: Array = visual.get("start", [0, 0])
	_start = Vector2i(int(s[0]), int(s[1]))
	_facing = str(visual.get("facing", "E"))
	_marks = visual.get("marks", {})
	custom_minimum_size = Vector2(CELL * _size + 4, CELL * _size + 4)
	size_flags_horizontal = Control.SIZE_SHRINK_CENTER


func _cell_rect(x: int, y: int) -> Rect2:
	return Rect2(Vector2(2 + x * CELL, 2 + y * CELL), Vector2(CELL, CELL))


func _draw() -> void:
	var line := Color(_wt.text_dim, 0.6)
	draw_rect(Rect2(Vector2.ZERO, custom_minimum_size), _wt.panel.lerp(_wt.bg, 0.15))
	for x in _size:
		for y in _size:
			draw_rect(_cell_rect(x, y), line, false, 1.5)
	var start_rect := _cell_rect(_start.x, _start.y).grow(-3)
	draw_rect(start_rect, _wt.good)
	# Flèche : direction du robot.
	var c := start_rect.get_center()
	var dir: Vector2 = {"N": Vector2.UP, "E": Vector2.RIGHT, "S": Vector2.DOWN, "O": Vector2.LEFT}.get(_facing, Vector2.RIGHT)
	var side := Vector2(-dir.y, dir.x)
	draw_colored_polygon(PackedVector2Array([c + dir * 14, c - dir * 10 + side * 11, c - dir * 10 - side * 11]), Color.WHITE)
	var font := ThemeDB.fallback_font
	for letter in _marks:
		var cell: Array = _marks[letter]
		var r := _cell_rect(int(cell[0]), int(cell[1])).grow(-3)
		draw_rect(r, _wt.accent.lerp(_wt.panel, 0.55))
		draw_string(font, Vector2(r.position.x, r.get_center().y + 9), str(letter), HORIZONTAL_ALIGNMENT_CENTER, r.size.x, 26, _wt.text)
