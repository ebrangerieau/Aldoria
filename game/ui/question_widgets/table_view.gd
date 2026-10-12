class_name TableView
extends VBoxContainer
## Document d'une enquête du village (Tom) : relevé statistique (valeurs / effectifs)
## ou tableau croisé avec ses totaux. Première ligne en en-tête ; si `totals`, la
## dernière ligne et la dernière colonne (les totaux) sont aussi mises en valeur.

const CELL_H := 44.0

var _wt: WorldTheme


func setup(visual: Dictionary, wt: WorldTheme) -> void:
	_wt = wt
	add_theme_constant_override("separation", 8)
	size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var title := UiKit.label(str(visual.get("title", "")), 20, wt.accent)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(title)
	var rows: Array = visual.get("rows", [])
	if rows.is_empty():
		return
	var totals := bool(visual.get("totals", false))
	var columns := (rows[0] as Array).size()
	var grid := GridContainer.new()
	grid.columns = columns
	grid.add_theme_constant_override("h_separation", 3)
	grid.add_theme_constant_override("v_separation", 3)
	for r in rows.size():
		for c in columns:
			var header := r == 0 or (c == 0 and str(rows[r][0]) != "")
			var total := totals and (r == rows.size() - 1 or c == columns - 1) and not header
			grid.add_child(_cell(str(rows[r][c]), header, total, c == 0))
	var center := CenterContainer.new()
	center.add_child(grid)
	add_child(center)


func _cell(text: String, header: bool, total: bool, first_column: bool) -> PanelContainer:
	var panel := PanelContainer.new()
	var box := StyleBoxFlat.new()
	box.bg_color = _wt.accent.lerp(_wt.panel, 0.55) if header else (_wt.accent.lerp(_wt.panel, 0.82) if total else _wt.panel.lerp(_wt.bg, 0.25))
	box.set_content_margin_all(8)
	box.content_margin_left = 12
	box.content_margin_right = 12
	panel.add_theme_stylebox_override("panel", box)
	panel.custom_minimum_size = Vector2(150.0 if first_column else 64.0, CELL_H)
	var label := UiKit.label(text, 20, _wt.text)
	label.autowrap_mode = TextServer.AUTOWRAP_OFF
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT if first_column else HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	panel.add_child(label)
	return panel
