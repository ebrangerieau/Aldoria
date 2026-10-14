class_name NumberLineWidget
extends VBoxContainer
## Droite graduée. Mode « place » : toucher (ou glisser) pour poser le point, qui
## s'aimante sur la graduation la plus proche, puis « Valider » ; émet la fraction
## « k/subdivisions » (non simplifiée : le validateur accepte les fractions égales).
## Mode « read » : simple illustration, le point A est déjà placé (réponse au pavé).

signal submitted(value: Variant)

const HEIGHT := 130.0
const MARGIN := 36.0

var _min := 0
var _max := 1
var _sub := 2
var _interactive := true
var _ticks := 0  # graduation choisie, depuis _min ; -1 = rien de posé
var _point_label := ""
var _correct_ticks := -1
var _wt: WorldTheme
var _canvas: Control
var _ok: Button
var _locked := false


func setup(visual: Dictionary, wt: WorldTheme, interactive := true) -> void:
	_wt = wt
	_min = int(visual.get("min", 0))
	_max = int(visual.get("max", 1))
	_sub = maxi(1, int(visual.get("subdivisions", 2)))
	_interactive = interactive
	_ticks = -1
	if visual.get("mode") == "read" and visual.has("point"):
		_ticks = _ticks_of(str(visual["point"]))
		_point_label = str(visual.get("label", "A"))
	add_theme_constant_override("separation", 10)
	_canvas = Control.new()
	_canvas.custom_minimum_size = Vector2(0, HEIGHT)
	_canvas.mouse_filter = Control.MOUSE_FILTER_STOP if interactive else Control.MOUSE_FILTER_IGNORE
	_canvas.draw.connect(_draw_line)
	_canvas.gui_input.connect(_on_canvas_input)
	add_child(_canvas)
	if interactive:
		_ok = UiKit.button("Valider", 64.0)
		_ok.disabled = true
		_ok.pressed.connect(_submit)
		add_child(_ok)


## Après la réponse : la bonne graduation s'affiche (en vert) si elle diffère du choix.
func reveal(_correct: bool, answer_text := "") -> void:
	_correct_ticks = _ticks_of(answer_text)
	_canvas.queue_redraw()


func _ticks_of(text: String) -> int:
	var r := AnswerChecker.parse_rational(text)
	if r.is_empty():
		return -1
	return roundi((float(r.num) / r.den - _min) * _sub)


func _count() -> int:
	return (_max - _min) * _sub


func _x_of(ticks: int) -> float:
	var width := _canvas.size.x - 2 * MARGIN
	return MARGIN + width * ticks / float(_count())


func _on_canvas_input(event: InputEvent) -> void:
	if _locked:
		return
	var pos := Vector2.INF
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		pos = event.position
	elif event is InputEventMouseMotion and (event.button_mask & MOUSE_BUTTON_MASK_LEFT):
		pos = event.position
	if pos == Vector2.INF:
		return
	var width := _canvas.size.x - 2 * MARGIN
	var ticks := clampi(roundi((pos.x - MARGIN) / width * _count()), 0, _count())
	if ticks != _ticks:
		_ticks = ticks
		Sfx.play("click", 1.4)
		_ok.disabled = false
		_canvas.queue_redraw()
	_canvas.accept_event()


func _submit() -> void:
	if _locked or _ticks < 0:
		return
	_locked = true
	submitted.emit("%d/%d" % [_min * _sub + _ticks, _sub])


func _draw_line() -> void:
	var y := HEIGHT * 0.45
	var line := _wt.text
	var font := ThemeDB.fallback_font
	_canvas.draw_line(Vector2(MARGIN - 20, y), Vector2(_canvas.size.x - MARGIN + 24, y), line, 3.0)
	# Flèche au bout de la demi-droite.
	var tip := Vector2(_canvas.size.x - MARGIN + 30, y)
	_canvas.draw_colored_polygon(PackedVector2Array([tip, tip + Vector2(-12, -7), tip + Vector2(-12, 7)]), line)
	for t in _count() + 1:
		var x := _x_of(t)
		var major := t % _sub == 0
		var h := 18.0 if major else 9.0
		_canvas.draw_line(Vector2(x, y - h), Vector2(x, y + h), line, 3.0 if major else 2.0)
		if major:
			@warning_ignore("integer_division")
			var label := str(_min + t / _sub)
			_canvas.draw_string(font, Vector2(x - 20, y + 48), label, HORIZONTAL_ALIGNMENT_CENTER, 40, 26, line)
	if _correct_ticks >= 0 and _correct_ticks != _ticks:
		_draw_point(_correct_ticks, y, _wt.good_ink, "")
	if _ticks >= 0:
		var color := _wt.accent
		if _correct_ticks >= 0:
			color = _wt.good_ink if _correct_ticks == _ticks else _wt.bad_ink
		_draw_point(_ticks, y, color, _point_label)


func _draw_point(ticks: int, y: float, color: Color, label: String) -> void:
	var x := _x_of(ticks)
	_canvas.draw_circle(Vector2(x, y), 11.0, color)
	_canvas.draw_circle(Vector2(x, y), 11.0, Color.WHITE, false, 2.0)
	if label != "":
		_canvas.draw_string(ThemeDB.fallback_font, Vector2(x - 20, y - 26), label, HORIZONTAL_ALIGNMENT_CENTER, 40, 26, color)
