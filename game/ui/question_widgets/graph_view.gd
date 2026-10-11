class_name GraphView
extends Control
## Courbe d'une fonction (affine par morceaux sur des points entiers) dans un repère
## quadrillé, pour la lecture graphique : image, antécédents, nombre de solutions.

const SIZE_PX := Vector2(360, 300)

var _xmin := -5
var _xmax := 5
var _ymin := -5
var _ymax := 5
var _points: PackedVector2Array = []
var _wt: WorldTheme


func setup(visual: Dictionary, wt: WorldTheme) -> void:
	_wt = wt
	_xmin = int(visual.get("xmin", -5))
	_xmax = int(visual.get("xmax", 5))
	_ymin = int(visual.get("ymin", -5))
	_ymax = int(visual.get("ymax", 5))
	for p in visual.get("points", []):
		_points.append(Vector2(float(p[0]), float(p[1])))
	custom_minimum_size = SIZE_PX
	size_flags_horizontal = Control.SIZE_SHRINK_CENTER


func _to_px(p: Vector2) -> Vector2:
	var pad := 18.0
	var w := size.x - 2 * pad
	var h := size.y - 2 * pad
	return Vector2(
		pad + (p.x - _xmin) / float(_xmax - _xmin) * w,
		pad + (_ymax - p.y) / float(_ymax - _ymin) * h)


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), _wt.panel.lerp(_wt.bg, 0.2))
	var grid := Color(_wt.text_dim, 0.25)
	for x in range(_xmin, _xmax + 1):
		draw_line(_to_px(Vector2(x, _ymin)), _to_px(Vector2(x, _ymax)), grid, 1.0)
	for y in range(_ymin, _ymax + 1):
		draw_line(_to_px(Vector2(_xmin, y)), _to_px(Vector2(_xmax, y)), grid, 1.0)
	draw_line(_to_px(Vector2(_xmin, 0)), _to_px(Vector2(_xmax, 0)), _wt.text_dim, 2.0)
	draw_line(_to_px(Vector2(0, _ymin)), _to_px(Vector2(0, _ymax)), _wt.text_dim, 2.0)
	var font := ThemeDB.fallback_font
	draw_string(font, _to_px(Vector2(1, 0)) + Vector2(-4, 16), "1", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, _wt.text_dim)
	draw_string(font, _to_px(Vector2(0, 1)) + Vector2(-14, 5), "1", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, _wt.text_dim)
	draw_string(font, _to_px(Vector2(0, 0)) + Vector2(-14, 16), "0", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, _wt.text_dim)
	if _points.size() >= 2:
		var px := PackedVector2Array()
		for p in _points:
			px.append(_to_px(p))
		draw_polyline(px, _wt.accent, 4.0, true)
		draw_string(font, px[px.size() - 1] + Vector2(-26, -10), "Cf", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, _wt.accent)
