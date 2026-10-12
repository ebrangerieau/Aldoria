class_name MathTools
extends VBoxContainer
## Outils de calcul à la demande (aménagement « dyscalculie », comme les aides
## autorisées en classe par un PAP) : table de multiplication, et tableau de
## numération qui place chiffre par chiffre le nombre en cours de saisie au pavé.
## La table est dessinée d'un seul tenant (un appel de dessin, pas 121 cases).

const COLUMNS := ["milliers", "centaines", "dizaines", "unités", "dixièmes", "centièmes", "millièmes"]
const UNITS_INDEX := 3

var _wt: WorldTheme
var _table: Control
var _numeration: VBoxContainer
var _digits: Array[Label] = []
var _tabs: Dictionary = {}


func setup(wt: WorldTheme, keypad: KeypadWidget = null) -> void:
	_wt = wt
	add_theme_constant_override("separation", 8)
	var tabs := HBoxContainer.new()
	tabs.add_theme_constant_override("separation", 8)
	for id in ["table", "numeration"]:
		var b := UiKit.button("Table ×" if id == "table" else "Numération", 44.0)
		b.add_theme_font_size_override("font_size", UiKit.font_size(20))
		b.pressed.connect(_show.bind(id))
		tabs.add_child(b)
		_tabs[id] = b
	add_child(tabs)
	_table = _build_table()
	add_child(_table)
	_numeration = _build_numeration()
	add_child(_numeration)
	if keypad:
		keypad.text_changed.connect(show_number)
	_show("table")


func _show(id: String) -> void:
	_table.visible = id == "table"
	_numeration.visible = id == "numeration"
	for key in _tabs:
		var b: Button = _tabs[key]
		if key == id:
			b.remove_theme_stylebox_override("normal")
			b.remove_theme_color_override("font_color")
		else:
			UiKit.style_secondary(b, _wt)


func _build_table() -> Control:
	var table := MultiplicationTable.new()
	table.wt = _wt
	return table


func _build_numeration() -> VBoxContainer:
	var box := VBoxContainer.new()
	var grid := GridContainer.new()
	grid.columns = COLUMNS.size()
	grid.add_theme_constant_override("h_separation", 2)
	grid.add_theme_constant_override("v_separation", 2)
	for name in COLUMNS:
		var header := _cell(name, true, 30.0)
		(header.get_child(0) as Label).add_theme_font_size_override("font_size", UiKit.font_size(14))
		grid.add_child(header)
	for i in COLUMNS.size():
		var cell := _cell("", false, 48.0)
		var label: Label = cell.get_child(0)
		label.add_theme_font_size_override("font_size", UiKit.font_size(30))
		_digits.append(label)
		grid.add_child(cell)
	box.add_child(grid)
	box.add_child(UiKit.label("La virgule se place juste après les unités. Tape un nombre au pavé : il se range ici.", 16, _wt.text_dim))
	return box


## Range le nombre saisi : partie entière alignée sur les unités, décimales après.
func show_number(text: String) -> void:
	for label in _digits:
		label.text = ""
	var clean := text.replace("−", "").strip_edges()
	if clean == "" or not clean.replace(",", "").is_valid_int():
		return
	var parts := clean.split(",")
	var whole: String = parts[0]
	var decimals: String = parts[1] if parts.size() > 1 else ""
	for k in whole.length():
		var index := UNITS_INDEX - (whole.length() - 1 - k)
		if index >= 0:
			_digits[index].text = whole[k]
	for k in mini(decimals.length(), COLUMNS.size() - UNITS_INDEX - 1):
		_digits[UNITS_INDEX + 1 + k].text = decimals[k]


func _cell(text: String, header: bool, height: float) -> PanelContainer:
	var panel := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = _wt.accent.lerp(_wt.panel, 0.6) if header else _wt.panel.lerp(_wt.bg, 0.2)
	style.set_content_margin_all(2)
	panel.add_theme_stylebox_override("panel", style)
	panel.custom_minimum_size = Vector2(maxf(height, 40.0), height)
	var label := UiKit.label(text, 16, _wt.text)
	label.autowrap_mode = TextServer.AUTOWRAP_OFF
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	panel.add_child(label)
	return panel



## Table de Pythagore 10 × 10, en-têtes en couleur, tracée en une fois.
class MultiplicationTable extends Control:
	const CELL := Vector2(42, 25)
	var wt: WorldTheme

	func _ready() -> void:
		custom_minimum_size = CELL * 11

	func _draw() -> void:
		# Toutes les cases, puis tous les nombres : le rendu les regroupe en peu d'appels.
		for row in 11:
			for col in 11:
				var header := row == 0 or col == 0
				draw_rect(_rect(row, col), wt.accent.lerp(wt.panel, 0.6) if header else wt.panel.lerp(wt.bg, 0.2))
		var font := get_theme_default_font()
		var size_px := UiKit.font_size(15)
		for row in 11:
			for col in 11:
				var header := row == 0 or col == 0
				var text := "×" if row == 0 and col == 0 else str(maxi(row, col) if header else row * col)
				var rect := _rect(row, col)
				var baseline := rect.position + Vector2(0, rect.size.y / 2.0 + size_px * 0.35)
				draw_string(font, baseline, text, HORIZONTAL_ALIGNMENT_CENTER, rect.size.x, size_px, wt.text)

	func _rect(row: int, col: int) -> Rect2:
		return Rect2(Vector2(col, row) * CELL, CELL - Vector2(2, 2))
