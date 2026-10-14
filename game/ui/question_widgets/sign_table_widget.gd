class_name SignTableWidget
extends VBoxContainer
## Tableau de signes : une colonne par intervalle (bornes : les valeurs qui annulent les
## facteurs), puis
## une ligne par facteur et, s'il y en a deux, le produit (ou le quotient). Toucher une
## case la fait passer de vide à « + », puis « − », puis « + »… « Valider » quand tout
## est rempli. Émet la liste des signes, ligne par ligne.

signal submitted(value: Variant)

const CELL_W := 150.0
const ROW_H := 58.0
const LABEL_W := 190.0

var _roots: Array = []
var _rows: Array = []
var _cells: Array[Button] = []
var _values: Array[String] = []
var _wt: WorldTheme
var _ok: Button
var _locked := false


func setup(visual: Dictionary, wt: WorldTheme) -> void:
	_wt = wt
	_roots = visual.get("roots", [])
	_rows = visual.get("rows", [])
	add_theme_constant_override("separation", 10)
	var grid := GridContainer.new()
	var columns := _roots.size() + 1
	grid.columns = columns + 1
	grid.add_theme_constant_override("h_separation", 6)
	grid.add_theme_constant_override("v_separation", 6)
	# En-tête : x | ]−∞ ; r1[ | ]r1 ; r2[ | ]r2 ; +∞[
	grid.add_child(_header("x", LABEL_W))
	for c in columns:
		var left: String = "−∞" if c == 0 else str(_roots[c - 1])
		var right: String = "+∞" if c == columns - 1 else str(_roots[c])
		grid.add_child(_header("]%s ; %s[" % [left, right], CELL_W))
	for r in _rows.size():
		var name_text: String = str(_rows[r])
		grid.add_child(_header(name_text, LABEL_W, r == _rows.size() - 1 and _rows.size() > 1))
		for c in columns:
			var b := UiKit.button("", ROW_H)
			b.custom_minimum_size.x = CELL_W
			b.add_theme_font_size_override("font_size", UiKit.font_size(34))
			UiKit.style_secondary(b, wt)
			b.pressed.connect(_cycle.bind(_cells.size()))
			grid.add_child(b)
			_cells.append(b)
			_values.append("")
	var center := CenterContainer.new()
	center.add_child(grid)
	add_child(center)
	_ok = UiKit.button("Valider", 60.0)
	_ok.disabled = true
	_ok.pressed.connect(_submit)
	add_child(_ok)


func _header(text: String, width: float, strong := false) -> Label:
	var l := UiKit.label(UiKit.pretty_math(text), 22, _wt.accent if strong else _wt.text)
	l.autowrap_mode = TextServer.AUTOWRAP_OFF
	l.custom_minimum_size = Vector2(width, ROW_H)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	return l


func _cycle(index: int) -> void:
	if _locked:
		return
	_values[index] = "+" if _values[index] != "+" else "-"
	_cells[index].text = "+" if _values[index] == "+" else "−"
	_ok.disabled = _values.has("")


func _submit() -> void:
	if _locked or _values.has(""):
		return
	_locked = true
	submitted.emit(_values.duplicate())


## Après la réponse (`answer_text` : signes attendus séparés par des espaces) :
## cases justes en vert, fausses en rouge, avec le bon signe.
func reveal(_correct: bool, answer_text := "") -> void:
	var expected := answer_text.replace("−", "-").replace("|", " ").split(" ", false)
	for i in mini(expected.size(), _cells.size()):
		var right := str(expected[i]) == _values[i]
		_cells[i].text = "+" if str(expected[i]) == "+" else "−"
		_cells[i].add_theme_color_override("font_color", _wt.good_ink if right else _wt.bad_ink)
