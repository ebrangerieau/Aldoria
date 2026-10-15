class_name CombatHud
extends CanvasLayer
## Interface du combat et de l'exploration : barres de vie, titre (vague ou salle),
## niveau et XP, actions, bandeaux, panneaux (question, explication, fin) et
## indicateur hors connexion discret (TRD §2.7). En exploration, la barre de
## l'ennemi et les actions sont masquées.

signal action_chosen(action: String)  # « automatisme », « chapitre », « soin », « sac »
signal quit_requested

var _wt: WorldTheme
var _hero_name: Label
var _hero_panel: Control
var _enemy_box: Control
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
var _bubble: PanelContainer
var _bubble_text: Label
var _bubble_tween: Tween


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
	_hero_name = hero_box[3]
	_hero_panel = hero_box[0]
	top.add_child(hero_box[0])
	var center := VBoxContainer.new()
	center.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	center.custom_minimum_size.x = 120
	_wave = _shadowed_label("", 26)
	_wave.add_theme_font_override("font", Accessibility.title_font())
	_wave.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS  # nom de salle long : jamais hors de l'écran
	_wave.custom_minimum_size.x = 100
	_wave.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	center.add_child(_wave)
	_xp = _shadowed_label("", 20)
	_xp.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_xp.custom_minimum_size.x = 100
	_xp.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	center.add_child(_xp)
	_sync = _shadowed_label("", 16)
	_sync.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_sync.modulate = Color(1, 1, 1, 0.75)
	center.add_child(_sync)
	top.add_child(center)
	var enemy_box := _fighter_box("", true)
	_enemy_box = enemy_box[0]
	_enemy_name = enemy_box[3]
	_enemy_bar = enemy_box[1]
	_enemy_hp = enemy_box[2]
	top.add_child(enemy_box[0])
	var quit := UiKit.icon_button("Quitter", "exit-door", 52.0)
	UiKit.style_secondary(quit, wt)
	quit.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	quit.pressed.connect(func() -> void: quit_requested.emit())
	top.add_child(quit)
	column.add_child(top)

	# Zone centrale libre (les panneaux montent aussi haut que nécessaire), puis
	# panneaux en bas de l'écran. Le bandeau d'annonce flotte par-dessus, hors mise en page.
	var gap := Control.new()
	gap.mouse_filter = Control.MOUSE_FILTER_IGNORE
	gap.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(gap)
	_banner = _shadowed_label("", 56)
	_banner.add_theme_font_override("font", Accessibility.title_font())
	_banner.set_anchors_preset(Control.PRESET_CENTER)
	_banner.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_banner.grow_vertical = Control.GROW_DIRECTION_BOTH
	_banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_banner.position.y -= 120  # au-dessus des panneaux
	_banner.modulate.a = 0.0
	_banner.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(_banner)

	# Bulle du héros (HeroVoice) : en haut à gauche, sous sa barre de vie, loin du joystick.
	_bubble = PanelContainer.new()
	_bubble.add_theme_stylebox_override("panel", UiKit.card_box(wt, 18))
	_bubble.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_bubble.position = Vector2(16, 112)
	_bubble.custom_minimum_size = Vector2(460, 0)
	_bubble.size = Vector2(460, 0)
	_bubble.modulate.a = 0.0
	_bubble_text = UiKit.label("", 22, wt.text)
	_bubble_text.custom_minimum_size.x = 430
	_bubble_text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_bubble.add_child(_bubble_text)
	root.add_child(_bubble)

	_overlay = VBoxContainer.new()
	_overlay.alignment = BoxContainer.ALIGNMENT_END
	column.add_child(_overlay)

	# Barre d'actions
	_actions = HBoxContainer.new()
	_actions.add_theme_constant_override("separation", 16)
	_actions.alignment = BoxContainer.ALIGNMENT_CENTER
	for action in ["automatisme", "chapitre", "soin"]:
		var subtitle: String = {"automatisme": "rapide", "chapitre": "puissant", "soin": "soigne"}[action]
		var icon_name: String = {"automatisme": "broadsword", "chapitre": "magic-swirl", "soin": "heart-plus"}[action]
		var b := UiKit.icon_button("%s\n%s" % [wt.action_names[action], subtitle], icon_name, 92.0)
		b.add_theme_constant_override("icon_max_width", roundi(44 * UiKit.text_scale))
		b.custom_minimum_size.x = 240
		b.pressed.connect(func() -> void: action_chosen.emit(action))
		_actions.add_child(b)
		_buttons[action] = b
	# Sac (bouclier, potion d'urgence) : ne coûte pas le tour.
	var bag := UiKit.icon_button("Sac\nobjets", "swap-bag", 92.0)
	bag.add_theme_constant_override("icon_max_width", roundi(40 * UiKit.text_scale))
	UiKit.style_secondary(bag, wt)
	bag.custom_minimum_size.x = 150
	bag.pressed.connect(func() -> void: action_chosen.emit("sac"))
	_actions.add_child(bag)
	_buttons["sac"] = bag
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
	set_status("Combat %d" % wave, "%d XP" % xp)


## Titre (vague, nom de la salle) et ligne d'information (niveau, XP).
func set_status(title: String, subtitle: String) -> void:
	_wave.text = title
	_xp.text = subtitle


func set_hero_name(text: String) -> void:
	_hero_name.text = text


## Village : pas de combat, la barre de vie du héros est masquée.
func set_hero_hp_visible(visible_hp: bool) -> void:
	_hero_bar.get_parent().visible = visible_hp  # barre et cœur
	_hero_hp.visible = visible_hp


## Exploration (faux) ou combat (vrai) : barre de l'ennemi.
func set_enemy_visible(visible_enemy: bool) -> void:
	_enemy_box.modulate.a = 1.0 if visible_enemy else 0.0


func show_actions(visible_actions: bool, heal_enabled := true) -> void:
	_actions.visible = visible_actions
	(_buttons["soin"] as Button).disabled = not heal_enabled
	(_buttons["sac"] as Button).disabled = SaveManager.item_count("bouclier") + SaveManager.item_count("potion") == 0


func show_panel(panel: Control) -> void:
	clear_panel()
	_hush()  # la bulle du héros ne cache jamais l'énoncé
	# Panneau plus haut que l'écran (texte agrandi, frise longue) : il défile au lieu de déborder.
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.add_child(panel)
	var center := CenterContainer.new()
	center.add_child(scroll)
	_overlay.add_child(center)
	panel.minimum_size_changed.connect(_fit_panel.bind(scroll, panel))
	_fit_panel(scroll, panel)
	panel.scale = Vector2(0.92, 0.92)
	panel.modulate.a = 0.0
	panel.pivot_offset = panel.size / 2.0
	var tween := create_tween().set_parallel()
	tween.tween_property(panel, "scale", Vector2.ONE, 0.15).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_property(panel, "modulate:a", 1.0, 0.12)


func _fit_panel(scroll: ScrollContainer, panel: Control) -> void:
	var need := panel.get_combined_minimum_size()
	# Sous la barre du héros (en haut), avec une marge en bas de l'écran.
	var room := get_viewport().get_visible_rect().size.y - _hero_panel.get_global_rect().end.y - 28.0
	scroll.custom_minimum_size = Vector2(need.x, minf(need.y, room))


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


## Le héros parle : bulle qui s'efface d'elle-même (le temps de lire), lue à voix haute
## si la lecture automatique est activée. Ne bloque pas l'exploration.
func say(text: String) -> void:
	if text == "":
		return
	_bubble_text.text = "« %s »" % text
	# Sous le cartouche du héros : il grandit avec le texte agrandi, la bulle ne le cache jamais.
	_bubble.position.y = _hero_panel.get_global_rect().end.y + 10.0
	_bubble.reset_size()
	if _bubble_tween != null:
		_bubble_tween.kill()
	_bubble.modulate.a = 0.0
	_bubble_tween = create_tween()
	_bubble_tween.tween_property(_bubble, "modulate:a", 1.0, 0.25)
	_bubble_tween.tween_interval(clampf(2.5 + text.length() * 0.06, 3.5, 9.0))
	_bubble_tween.tween_property(_bubble, "modulate:a", 0.0, 0.4)
	if Accessibility.auto_read():
		Accessibility.say(text)


## Efface la bulle du héros tout de suite (une question s'ouvre).
func _hush() -> void:
	if _bubble_tween != null:
		_bubble_tween.kill()
	_bubble_tween = create_tween()
	_bubble_tween.tween_property(_bubble, "modulate:a", 0.0, 0.15)


func _refresh_sync() -> void:
	var pending := Session.pending_count()
	if not ApiClient.online:
		_sync.text = "Hors connexion · %d réponse(s) en attente" % pending
	elif pending > 0:
		_sync.text = "Envoi de %d réponse(s)…" % pending
	else:
		_sync.text = ""


## Cartouche d'un combattant : nom gravé, cœur (héros) ou tête de monstre, barre de vie.
func _fighter_box(name_text: String, right: bool) -> Array:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", UiKit.card_box(_wt, 14))
	panel.custom_minimum_size = Vector2(290, 0)
	panel.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 4)
	panel.add_child(box)
	var name_label := UiKit.title(name_text, 20, _wt.accent)
	name_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	name_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT if right else HORIZONTAL_ALIGNMENT_LEFT
	box.add_child(name_label)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	box.add_child(row)
	var badge := UiKit.icon("dragon-head" if right else "hearts", 24, _wt.bad_ink if right else _wt.good_ink)
	var bar := ProgressBar.new()
	bar.custom_minimum_size = Vector2(0, 20)
	bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	bar.show_percentage = false
	bar.fill_mode = ProgressBar.FILL_END_TO_BEGIN if right else ProgressBar.FILL_BEGIN_TO_END
	UiKit.style_bar(bar, _wt, _wt.bad if right else _wt.good)
	if right:
		row.add_child(bar)
		row.add_child(badge)
	else:
		row.add_child(badge)
		row.add_child(bar)
	var hp := UiKit.label("", 17, _wt.text_dim)
	hp.autowrap_mode = TextServer.AUTOWRAP_OFF
	hp.horizontal_alignment = name_label.horizontal_alignment
	box.add_child(hp)
	return [panel, bar, hp, name_label]


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
