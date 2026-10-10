class_name CombatHud
extends CanvasLayer
## Interface du combat : barres de vie, vague, actions, bandeaux, panneaux
## (question, explication, fin) et indicateur hors connexion discret (TRD §2.7).

signal action_chosen(action: String)  # « automatisme », « chapitre », « soin »
signal quit_requested

var _wt: WorldTheme
var _hero_bar: ProgressBar
var _hero_hp: Label
var _enemy_bar: ProgressBar
var _enemy_hp: Label
var _enemy_name: Label
var _wave: Label
var _xp: Label
var _sync: Label
var _actions: HBoxContainer
var _buttons: Dictionary = {}
var _overlay: VBoxContainer
var _banner: Label


func setup(wt: WorldTheme, hero_name: String) -> void:
	_wt = wt
	layer = 10
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.theme = UiKit.make_theme(wt)
	add_child(root)

	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 16)
	root.add_child(margin)

	var column := VBoxContainer.new()
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	margin.add_child(column)

	# Bandeau du haut : héros | vague | ennemi
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 20)
	var hero_box := _fighter_box(hero_name, false)
	_hero_bar = hero_box[1]
	_hero_hp = hero_box[2]
	top.add_child(hero_box[0])
	var center := VBoxContainer.new()
	center.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_wave = _shadowed_label("", 26)
	_wave.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	center.add_child(_wave)
	_xp = _shadowed_label("", 20)
	_xp.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	center.add_child(_xp)
	_sync = _shadowed_label("", 16)
	_sync.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_sync.modulate = Color(1, 1, 1, 0.75)
	center.add_child(_sync)
	top.add_child(center)
	var enemy_box := _fighter_box("", true)
	_enemy_name = enemy_box[3]
	_enemy_bar = enemy_box[1]
	_enemy_hp = enemy_box[2]
	top.add_child(enemy_box[0])
	var quit := UiKit.button("Quitter", 52.0)
	UiKit.style_secondary(quit, wt)
	quit.pressed.connect(func() -> void: quit_requested.emit())
	top.add_child(quit)
	column.add_child(top)

	# Zone centrale : bandeau d'annonce, puis panneaux en bas de l'écran
	_banner = _shadowed_label("", 56)
	_banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner.modulate.a = 0.0
	_banner.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_banner.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	column.add_child(_banner)

	_overlay = VBoxContainer.new()
	_overlay.alignment = BoxContainer.ALIGNMENT_END
	column.add_child(_overlay)

	# Barre d'actions
	_actions = HBoxContainer.new()
	_actions.add_theme_constant_override("separation", 16)
	_actions.alignment = BoxContainer.ALIGNMENT_CENTER
	for action in ["automatisme", "chapitre", "soin"]:
		var subtitle: String = {"automatisme": "rapide", "chapitre": "puissant", "soin": "soigne"}[action]
		var b := UiKit.button("%s\n%s" % [wt.action_names[action], subtitle], 92.0)
		b.custom_minimum_size.x = 240
		b.pressed.connect(func() -> void: action_chosen.emit(action))
		_actions.add_child(b)
		_buttons[action] = b
	column.add_child(_actions)

	Session.queue_changed.connect(func(_n: int) -> void: _refresh_sync())
	ApiClient.online_changed.connect(func(_o: bool) -> void: _refresh_sync())
	_refresh_sync()


func set_hero_hp(hp: int, max_hp: int) -> void:
	_set_bar(_hero_bar, _hero_hp, hp, max_hp)


func set_enemy(name_text: String, hp: int, max_hp: int) -> void:
	_enemy_name.text = name_text
	_set_bar(_enemy_bar, _enemy_hp, hp, max_hp)


func set_enemy_hp(hp: int, max_hp: int) -> void:
	_set_bar(_enemy_bar, _enemy_hp, hp, max_hp)


func set_wave(wave: int, xp: int) -> void:
	_wave.text = "Combat %d" % wave
	_xp.text = "%d XP" % xp


func show_actions(visible_actions: bool, heal_enabled := true) -> void:
	_actions.visible = visible_actions
	(_buttons["soin"] as Button).disabled = not heal_enabled


func show_panel(panel: Control) -> void:
	clear_panel()
	var center := CenterContainer.new()
	center.add_child(panel)
	_overlay.add_child(center)
	panel.scale = Vector2(0.92, 0.92)
	panel.modulate.a = 0.0
	panel.pivot_offset = panel.size / 2.0
	var tween := create_tween().set_parallel()
	tween.tween_property(panel, "scale", Vector2.ONE, 0.15).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_property(panel, "modulate:a", 1.0, 0.12)


func clear_panel() -> void:
	for child in _overlay.get_children():
		child.queue_free()


func banner(text: String, color: Color, duration := 1.1) -> void:
	_banner.text = text
	_banner.add_theme_color_override("font_color", color)
	_banner.scale = Vector2(0.6, 0.6)
	_banner.pivot_offset = _banner.size / 2.0
	_banner.modulate.a = 1.0
	var tween := create_tween()
	tween.tween_property(_banner, "scale", Vector2.ONE, 0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_interval(duration)
	tween.tween_property(_banner, "modulate:a", 0.0, 0.3)


func _refresh_sync() -> void:
	var pending := Session.pending_count()
	if not ApiClient.online:
		_sync.text = "Hors connexion · %d réponse(s) en attente" % pending
	elif pending > 0:
		_sync.text = "Envoi de %d réponse(s)…" % pending
	else:
		_sync.text = ""


func _fighter_box(name_text: String, right: bool) -> Array:
	var box := VBoxContainer.new()
	box.custom_minimum_size = Vector2(300, 0)
	var name_label := _shadowed_label(name_text, 22)
	name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT if right else HORIZONTAL_ALIGNMENT_LEFT
	box.add_child(name_label)
	var bar := ProgressBar.new()
	bar.custom_minimum_size = Vector2(0, 22)
	bar.show_percentage = false
	bar.fill_mode = ProgressBar.FILL_END_TO_BEGIN if right else ProgressBar.FILL_BEGIN_TO_END
	var fill := StyleBoxFlat.new()
	fill.bg_color = _wt.bad if right else _wt.good
	fill.set_corner_radius_all(8)
	bar.add_theme_stylebox_override("fill", fill)
	box.add_child(bar)
	var hp := _shadowed_label("", 18)
	hp.horizontal_alignment = name_label.horizontal_alignment
	box.add_child(hp)
	return [box, bar, hp, name_label]


func _set_bar(bar: ProgressBar, label: Label, hp: int, max_hp: int) -> void:
	bar.max_value = max_hp
	create_tween().tween_property(bar, "value", float(hp), 0.35).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	label.text = "%d / %d PV" % [hp, max_hp]


## Texte posé sur la scène 3D : blanc avec ombre portée, lisible sur tout fond.
func _shadowed_label(text: String, size: int) -> Label:
	var l := UiKit.label(text, size, Color.WHITE)
	l.autowrap_mode = TextServer.AUTOWRAP_OFF
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	l.add_theme_constant_override("shadow_offset_x", 2)
	l.add_theme_constant_override("shadow_offset_y", 2)
	l.add_theme_constant_override("outline_size", 6)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.6))
	return l
