class_name GridView
extends Control
## Énigme des miroirs (Tom, vecteurs) : repère quadrillé avec la source du rayon,
## le(s) miroir(s) et le cristal à atteindre. Un point caché (celui qu'on cherche)
## n'apparaît qu'après la réponse, quand le rayon est tiré.

const SIZE_PX := 230.0

var _span := 6
var _points: Dictionary = {}  # nom → {at: Vector2, role, hidden}
var _path: Array = []
var _wt: WorldTheme
var _beam := 0.0  # avancée du rayon, de 0 à 1
var _beam_ok := true


func setup(visual: Dictionary, wt: WorldTheme) -> void:
	_wt = wt
	_span = int(visual.get("span", 6)) + 1
	for p in visual.get("points", []):
		_points[p["name"]] = {"at": Vector2(p["at"][0], p["at"][1]), "role": p["role"], "hidden": p.get("hidden", false)}
	_path = visual.get("path", [])
	custom_minimum_size = Vector2(SIZE_PX, SIZE_PX)


## Tire le rayon : jusqu'au cristal si la réponse est juste, il s'éteint sinon.
func reveal(correct: bool, _answer_text := "") -> void:
	_beam_ok = correct
	for p in _points.values():
		p["hidden"] = false
	var tween := create_tween()
	tween.tween_method(func(v: float) -> void:
		_beam = v
		queue_redraw(), 0.0, 1.0 if correct else 0.45, 0.6)


func _to_px(p: Vector2) -> Vector2:
	var side := minf(size.x, size.y)
	var origin := Vector2(size.x / 2.0, size.y / 2.0)
	return origin + Vector2(p.x, -p.y) * (side / 2.0) / _span


func _draw() -> void:
	var side := minf(size.x, size.y)
	var area := Rect2((size - Vector2(side, side)) / 2.0, Vector2(side, side))
	draw_rect(area, _wt.panel.lerp(_wt.bg, 0.25))
	for k in range(-_span + 1, _span):
		var color := Color(_wt.text_dim, 0.25)
		draw_line(_to_px(Vector2(k, -_span)), _to_px(Vector2(k, _span)), color, 1.0)
		draw_line(_to_px(Vector2(-_span, k)), _to_px(Vector2(_span, k)), color, 1.0)
	draw_line(_to_px(Vector2(-_span, 0)), _to_px(Vector2(_span, 0)), _wt.text_dim, 2.0)
	draw_line(_to_px(Vector2(0, -_span)), _to_px(Vector2(0, _span)), _wt.text_dim, 2.0)
	var font := ThemeDB.fallback_font
	draw_string(font, _to_px(Vector2(1, 0)) + Vector2(-4, 16), "1", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, _wt.text_dim)
	draw_string(font, _to_px(Vector2(0, 1)) + Vector2(-14, 5), "1", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, _wt.text_dim)

	if _beam > 0.0 and _path.size() >= 2:
		_draw_beam()
	for name in _points:
		var p: Dictionary = _points[name]
		if p["hidden"]:
			continue
		var at := _to_px(p["at"])
		match p["role"]:
			"source":
				draw_circle(at, 9.0, Color("#ffd447"))
			"mirror":
				draw_line(at + Vector2(-9, 9), at + Vector2(9, -9), _wt.accent, 5.0)
			_:
				draw_colored_polygon(PackedVector2Array([at + Vector2(0, -11), at + Vector2(8, 0), at + Vector2(0, 11), at + Vector2(-8, 0)]), _wt.good if _beam >= 1.0 and _beam_ok else _wt.accent)
		draw_string(font, at + Vector2(10, -8), name, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, _wt.text)


func _draw_beam() -> void:
	var color := Color("#ffd447") if _beam_ok else _wt.bad
	var segments := _path.size() - 1
	var progress := _beam * segments
	for s in segments:
		if progress <= s:
			break
		var a := _to_px(_points[_path[s]]["at"])
		var b := _to_px(_points[_path[s + 1]]["at"])
		var t := minf(1.0, progress - s)
		draw_line(a, a.lerp(b, t), Color(color, 0.35), 9.0)
		draw_line(a, a.lerp(b, t), color, 3.0)
