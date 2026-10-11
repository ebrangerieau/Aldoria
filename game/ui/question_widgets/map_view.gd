class_name MapView
extends Control
## Énigme de la carte (Jules, échelles) : carte quadrillée (1 carreau = 1 cm), deux
## lieux posés sur les nœuds du quadrillage, une route éventuelle en deux tronçons et
## l'échelle (barre graduée ou échelle numérique). Après une bonne réponse, un
## voyageur parcourt la route.

const CELL := 34.0
const MARGIN := Vector2(14, 14)
const LEGEND_H := 44.0

var _cols := 12
var _rows := 8
var _points: Array = []  # [{label, at: Vector2}]
var _path: Array[Vector2] = []
var _scale: Dictionary = {}
var _wt: WorldTheme
var _travel := 0.0  # avancée du voyageur, de 0 à 1


func setup(visual: Dictionary, wt: WorldTheme) -> void:
	_wt = wt
	_cols = int(visual.get("cols", 12))
	_rows = int(visual.get("rows", 8))
	for p in visual.get("points", []):
		_points.append({"label": str(p["label"]), "at": Vector2(p["at"][0], p["at"][1])})
	for node in visual.get("path", []):
		_path.append(Vector2(node[0], node[1]))
	if _path.is_empty() and _points.size() == 2:
		_path = [_points[0]["at"], _points[1]["at"]]
	_scale = visual.get("scale", {})
	custom_minimum_size = Vector2(CELL * _cols, CELL * _rows + LEGEND_H) + MARGIN * 2
	size_flags_horizontal = Control.SIZE_SHRINK_CENTER


func reveal(correct: bool, _answer_text := "") -> void:
	if not correct:
		return
	create_tween().tween_method(func(v: float) -> void:
		_travel = v
		queue_redraw(), 0.0, 1.0, 1.2)


func _px(node: Vector2) -> Vector2:
	return MARGIN + node * CELL


func _draw() -> void:
	var paper := Color("#efe2bf")
	var ink := Color("#5b4630")
	var map_rect := Rect2(MARGIN, Vector2(CELL * _cols, CELL * _rows))
	draw_rect(Rect2(Vector2.ZERO, custom_minimum_size), paper.darkened(0.12))
	draw_rect(map_rect, paper)
	for x in _cols + 1:
		draw_line(_px(Vector2(x, 0)), _px(Vector2(x, _rows)), Color(ink, 0.35), 1.0)
	for y in _rows + 1:
		draw_line(_px(Vector2(0, y)), _px(Vector2(_cols, y)), Color(ink, 0.35), 1.0)
	draw_rect(map_rect, ink, false, 2.0)

	# Route en pointillés (ou ligne droite entre les deux lieux).
	var road := Color("#a0522d")
	for s in _path.size() - 1:
		draw_dashed_line(_px(_path[s]), _px(_path[s + 1]), road, 4.0, 10.0)
	if _travel > 0.0:
		_draw_traveller()

	var font := ThemeDB.fallback_font
	for p in _points:
		var at := _px(p["at"])
		draw_circle(at, 9.0, _wt.accent)
		draw_circle(at, 9.0, ink, false, 2.0)
		var label: String = p["label"]
		var width := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 18).x
		# Nom au-dessus du lieu, sauf si la route arrive par le haut : il ne cache jamais
		# les carreaux à compter.
		var baseline := at + Vector2(-width / 2.0, 30 if _road_from_above(p["at"]) else -14)
		draw_rect(Rect2(baseline + Vector2(-4, -17), Vector2(width + 8, 22)), Color(paper, 0.85))
		draw_string(font, baseline, label, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, ink)

	# Échelle, sous la carte.
	var base := Vector2(MARGIN.x, MARGIN.y + CELL * _rows + 30)
	if _scale.has("cells"):
		var length := CELL * float(_scale["cells"])
		draw_line(base, base + Vector2(length, 0), ink, 4.0)
		for tick in [0.0, length]:
			draw_line(base + Vector2(tick, -7), base + Vector2(tick, 7), ink, 2.0)
		draw_string(font, base + Vector2(length + 12, 7), str(_scale.get("text", "")), HORIZONTAL_ALIGNMENT_LEFT, -1, 20, ink)
	else:
		draw_string(font, base + Vector2(0, 7), str(_scale.get("text", "")), HORIZONTAL_ALIGNMENT_LEFT, -1, 20, ink)


func _road_from_above(node: Vector2) -> bool:
	for s in _path.size() - 1:
		for pair in [[_path[s], _path[s + 1]], [_path[s + 1], _path[s]]]:
			if pair[0] == node and pair[1].x == node.x and pair[1].y < node.y:
				return true
	return false


func _draw_traveller() -> void:
	var total := 0.0
	for s in _path.size() - 1:
		total += _path[s].distance_to(_path[s + 1])
	var remaining := _travel * total
	var at := _path[0]
	for s in _path.size() - 1:
		var leg := _path[s].distance_to(_path[s + 1])
		var t := minf(1.0, remaining / maxf(leg, 0.001))
		var end := _path[s].lerp(_path[s + 1], t)
		draw_line(_px(_path[s]), _px(end), _wt.good, 5.0)
		at = end
		remaining -= leg
		if remaining <= 0.0:
			break
	draw_circle(_px(at), 7.0, _wt.good)
