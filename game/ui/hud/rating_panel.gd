class_name RatingPanel
extends PanelContainer
## Fin de donjon : « Comment as-tu trouvé ce donjon ? », de 1 à 5 étoiles (note de
## plaisir, indicateur du PRD §2, visible par le parent). Facultatif : « Passer » rend 0.

signal rated(value: int)

const WORDS := ["Bof", "Moyen", "Bien", "Très bien", "Génial !"]

var _wt: WorldTheme
var _stars: Array[Button] = []
var _word: Label
var _done := false


func setup(wt: WorldTheme, title: String) -> void:
	_wt = wt
	theme = UiKit.make_theme(wt)
	custom_minimum_size = Vector2(640, 0)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 16)
	add_child(box)
	box.add_child(UiKit.label(title, 34, wt.accent))
	box.add_child(UiKit.label("Comment as-tu trouvé ce donjon ?", 24))
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 12)
	for i in 5:
		var star := UiKit.button("★", 84.0)
		star.custom_minimum_size.x = 84.0
		star.add_theme_font_size_override("font_size", UiKit.font_size(44))
		UiKit.style_secondary(star, wt)
		star.pressed.connect(_choose.bind(i + 1))
		row.add_child(star)
		_stars.append(star)
	box.add_child(row)
	_word = UiKit.label(" ", 24, wt.accent)
	_word.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(_word)
	var skip := UiKit.button("Passer", 52.0)
	UiKit.style_secondary(skip, wt)
	skip.pressed.connect(func() -> void: _finish(0))
	box.add_child(skip)


func _choose(value: int) -> void:
	if _done:
		return
	for i in _stars.size():
		var lit := i < value
		_stars[i].add_theme_color_override("font_color", Color("#ffd447") if lit else _wt.text_dim)
		_stars[i].add_theme_color_override("font_pressed_color", Color("#ffd447") if lit else _wt.text_dim)
	_word.text = WORDS[value - 1]
	_finish(value)


func _finish(value: int) -> void:
	if _done:
		return
	_done = true
	if value > 0:
		await get_tree().create_timer(0.7).timeout  # le temps de voir les étoiles s'allumer
	rated.emit(value)
