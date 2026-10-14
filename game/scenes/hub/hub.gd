extends Control
## La Citadelle des Archives (docs/histoire.md §5), au centre de la carte du royaume : niveau et
## XP du héros, pages de la Grande Chronique retrouvées, le chemin vers la carte (donjons et
## village partent de la carte, par leur seuil), le défi du jour, l'arène d'entraînement, les
## Archives et l'apparence du héros (★ quand un choix vient de se débloquer). Récupère la
## sauvegarde du serveur à l'arrivée (autre appareil, TRD §2.7).

var _wt: WorldTheme
var _dungeons: Array[DungeonDef] = []
var _village: VillageDef
var _level: Label
var _xp_bar: ProgressBar
var _xp_text: Label
var _pages_state: Label
var _daily_state: Label
var _daily_button: Button
var _look_button: Button
var _message: Label
var _bag: Label
var _busy := false


func _ready() -> void:
	_wt = WorldTheme.for_world(Session.world())
	# Le monde donne l'ambiance ; la classe donne les donjons et le village.
	_dungeons = DungeonDef.all_for_level(Session.level())
	_village = VillageDef.for_level(Session.level())
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = UiKit.make_theme(_wt)
	_build()
	_refresh()
	SaveManager.changed.connect(_refresh)
	await SaveManager.sync()
	# Aménagements modifiés par le parent depuis la dernière fois : la Citadelle se reconstruit
	# (police, tailles, couleurs) ; de même quand l'enfant change ses options.
	Accessibility.changed.connect(_rebuild, CONNECT_ONE_SHOT)
	# Classe, monde ou prénom changés par le parent : même reconstruction.
	Session.profile_changed.connect(_rebuild, CONNECT_ONE_SHOT)
	await Accessibility.refresh()
	if Session.time_over():
		_message.text = "Pause : retour dans %d min" % Session.minutes_before_play()
	_dev_goto()


func _build() -> void:
	var bg := ColorRect.new()
	bg.color = _wt.bg
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 24)
	add_child(margin)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 14)
	margin.add_child(column)

	# Bandeau : héros, niveau, XP | changer de joueur
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 20)
	var who := VBoxContainer.new()
	who.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var name_label := UiKit.label(_wt.hero_name, 32, _wt.panel_border)
	name_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	who.add_child(name_label)
	var level_row := HBoxContainer.new()
	level_row.add_theme_constant_override("separation", 16)
	_level = UiKit.label("", 24, Color.WHITE)
	_level.autowrap_mode = TextServer.AUTOWRAP_OFF
	level_row.add_child(_level)
	_xp_bar = ProgressBar.new()
	_xp_bar.custom_minimum_size = Vector2(320, 20)
	_xp_bar.show_percentage = false
	_xp_bar.max_value = 1.0
	_xp_bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	level_row.add_child(_xp_bar)
	_xp_text = UiKit.label("", 20, Color(1, 1, 1, 0.75))
	_xp_text.autowrap_mode = TextServer.AUTOWRAP_OFF
	level_row.add_child(_xp_text)
	who.add_child(level_row)
	_bag = UiKit.label("", 18, Color(1, 1, 1, 0.8))
	_bag.autowrap_mode = TextServer.AUTOWRAP_OFF
	who.add_child(_bag)
	top.add_child(who)
	_message = UiKit.label("", 22, _wt.panel_border)
	_message.autowrap_mode = TextServer.AUTOWRAP_OFF
	_message.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	top.add_child(_message)
	var options := UiKit.button("Options", 56.0)
	UiKit.style_secondary(options, _wt)
	options.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	options.pressed.connect(_show_options)
	top.add_child(options)
	var switch := UiKit.button("Changer de joueur", 56.0)
	UiKit.style_secondary(switch, _wt)
	switch.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	switch.pressed.connect(_switch_player)
	top.add_child(switch)
	column.add_child(top)

	# Défilement au doigt si le contenu dépasse (texte agrandi, boutons plus grands).
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	column.add_child(scroll)
	var main := HBoxContainer.new()
	main.add_theme_constant_override("separation", 20)
	main.size_flags_vertical = Control.SIZE_EXPAND_FILL
	main.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(main)

	# La Citadelle et le chemin vers la carte du royaume.
	var left := VBoxContainer.new()
	left.add_theme_constant_override("separation", 12)
	left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	left.size_flags_stretch_ratio = 1.4
	main.add_child(left)
	var hall := PanelContainer.new()
	hall.size_flags_vertical = Control.SIZE_EXPAND_FILL
	left.add_child(hall)
	var hall_text := VBoxContainer.new()
	hall_text.add_theme_constant_override("separation", 12)
	hall_text.alignment = BoxContainer.ALIGNMENT_CENTER
	hall.add_child(hall_text)
	hall_text.add_child(UiKit.label("La Citadelle des Archives", 34, _wt.accent))
	hall_text.add_child(UiKit.label(
		"Ici veille la Grande Chronique. Malvrek et ses Effaceurs en ont volé les pages : chacune se cache dans une région du royaume.", 21, _wt.text))
	_pages_state = UiKit.label("", 22, _wt.accent)
	hall_text.add_child(_pages_state)
	var to_map := UiKit.button("Ouvrir la carte du royaume", 72.0)
	to_map.pressed.connect(_open_map)
	hall_text.add_child(to_map)
	var story := UiKit.button("Revoir le prologue", 52.0)
	UiKit.style_secondary(story, _wt)
	story.pressed.connect(_open_prologue)
	hall_text.add_child(story)

	# Défi du jour, puis arène, Archives et apparence en plus petit.
	var side := VBoxContainer.new()
	side.add_theme_constant_override("separation", 12)
	side.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	main.add_child(side)
	var daily := _row(side, "Défi du jour", "Dix automatismes, à ton rythme.")
	_daily_state = daily["state"]
	_daily_button = daily["button"]
	_daily_button.pressed.connect(_enter_daily)
	var small_panel := PanelContainer.new()
	side.add_child(small_panel)
	var small := HBoxContainer.new()
	small.add_theme_constant_override("separation", 12)
	small_panel.add_child(small)
	var arena := UiKit.button("Arène", 60.0)
	arena.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	arena.pressed.connect(_enter_arena)
	small.add_child(arena)
	var archives := UiKit.button("Archives", 60.0)
	archives.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	archives.pressed.connect(func() -> void:
		get_tree().change_scene_to_file("res://scenes/archives/archives.tscn"))
	small.add_child(archives)
	_look_button = UiKit.button("Apparence", 60.0)
	_look_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_look_button.pressed.connect(_open_wardrobe)
	small.add_child(_look_button)


## Carte en ligne : titre, sous-titre et état à gauche, bouton à droite.
## Renvoie {panel, state, button}.
func _row(parent: Container, title: String, subtitle: String) -> Dictionary:
	var panel := PanelContainer.new()
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	parent.add_child(panel)
	var line := HBoxContainer.new()
	line.add_theme_constant_override("separation", 16)
	panel.add_child(line)
	var text := VBoxContainer.new()
	text.add_theme_constant_override("separation", 4)
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text.alignment = BoxContainer.ALIGNMENT_CENTER
	line.add_child(text)
	text.add_child(UiKit.label(title, 27, _wt.accent))
	text.add_child(UiKit.label(subtitle, 19, _wt.text))
	var state := UiKit.label("", 19, _wt.accent)
	text.add_child(state)
	var b := UiKit.button("Entrer", 64.0)
	b.custom_minimum_size.x = 190
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	line.add_child(b)
	return {"panel": panel, "state": state, "button": b}


func _refresh() -> void:
	var xp := SaveManager.xp()
	var level := Progression.level_for_xp(xp)
	_level.text = "Niveau %d" % level
	_xp_bar.value = Progression.level_progress(xp)
	_xp_text.text = "%d / %d XP" % [xp, Progression.xp_for_level(level + 1)]
	_bag.text = Inventory.summary(SaveManager.items())
	var found := _dungeons.filter(func(d: DungeonDef) -> bool: return int(SaveManager.dungeon(d.code)["completed"]) > 0).size()
	_pages_state.text = "Pages retrouvées : %d / %d" % [found, _dungeons.size()] if not _dungeons.is_empty() \
		else "Les régions de ta classe (%s) se préparent." % Session.profile.get("level_label", Session.level())
	_refresh_daily()
	var unlocked := Wardrobe.unlocked_count(level, SaveManager.dungeons_done(), _wt.companion)
	_look_button.text = "Apparence ★" if unlocked > int(SaveManager.look()["seen"]) else "Apparence"


func _refresh_daily() -> void:
	var today := DailyChallenge.today()
	var days := SaveManager.daily_days()
	var streak := DailyChallenge.streak(days, today)
	var series := "Série : %d jour%s" % [streak, "s" if streak > 1 else ""] if streak > 0 else "Pas encore de série"
	var week := "coffre %d / %d" % [mini(DailyChallenge.week_count(days, today), DailyChallenge.WEEKLY_GOAL), DailyChallenge.WEEKLY_GOAL]
	if not days.has(today):
		_daily_state.text = "%s · %s · à relever" % [series, week]
		_daily_button.text = "Relever"
	elif DailyChallenge.can_catch_up(days, today):
		_daily_state.text = "Fait aujourd'hui ✓ · hier manqué : rattrape-le !"
		_daily_button.text = "Rattraper"
	else:
		_daily_state.text = "%s · %s · fait aujourd'hui ✓" % [series, week]
		_daily_button.text = "S'entraîner"


func _open_map() -> void:
	if not _busy:
		get_tree().change_scene_to_file(Departure.MAP_SCENE)


func _open_prologue() -> void:
	if not _busy:
		Prologue.play(get_tree(), Departure.CITADEL_SCENE)


func _enter_daily() -> void:
	await _launch("defi", {}, "res://scenes/daily/daily.tscn")


func _enter_arena() -> void:
	await _launch("arene", {}, "res://scenes/combat/combat.tscn")


func _launch(mode: String, params: Dictionary, scene: String, cache := "") -> void:
	if _busy:
		return
	_busy = true
	_message.text = "En route !"
	var result := await Departure.go(get_tree(), mode, params, scene, cache)
	if result == "":
		return
	_busy = false
	if result == "pause":
		_message.text = "Pause : retour dans %d min" % Session.minutes_before_play()
		Departure.show_rest(self, _wt)
	else:
		_message.text = result


func _open_wardrobe() -> void:
	if not _busy:
		get_tree().change_scene_to_file("res://scenes/wardrobe/wardrobe.tscn")


func _show_options() -> void:
	if _busy:
		return
	var layer := CanvasLayer.new()
	layer.layer = 20
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.55)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(shade)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(center)
	var panel := OptionsPanel.new()
	panel.setup(_wt)
	center.add_child(panel)
	add_child(layer)
	panel.closed.connect(layer.queue_free)


func _rebuild() -> void:
	# Seulement si la Citadelle est toujours affichée (l'enfant a pu partir entre-temps), et une
	# seule fois même si aménagements et profil changent ensemble.
	if is_inside_tree() and get_tree().current_scene == self and not _busy:
		_busy = true
		get_tree().reload_current_scene.call_deferred()


func _switch_player() -> void:
	if _busy:
		return
	_busy = true
	await Session.logout()
	get_tree().change_scene_to_file("res://scenes/profile/profile_select.tscn")


## Développement, PC uniquement : `-- --goto=donjon|village|defi|arene|archives|apparence|prologue`
## (`--dungeon=<code>` pour un autre donjon que le premier). Le donjon et le village partent
## d'ici sans passer par leur seuil sur la carte (captures d'écran).
func _dev_goto() -> void:
	if OS.has_feature("web"):
		return
	match Quality.option("goto"):
		"donjon":
			if _dungeons.is_empty():
				return
			var index := 0
			for i in _dungeons.size():
				if _dungeons[i].code == Quality.option("dungeon"):
					index = i
			var d := _dungeons[index]
			Session.dungeon_code = d.code
			_launch("donjon", d.session_params(), "res://scenes/dungeon/dungeon.tscn", "donjon_" + d.code)
		"village":
			if _village != null:
				_launch("village", _village.session_params(), "res://scenes/village/village.tscn")
		"defi":
			_enter_daily()
		"arene":
			_enter_arena()
		"archives":
			get_tree().change_scene_to_file("res://scenes/archives/archives.tscn")
		"apparence":
			_open_wardrobe()
		"prologue":
			_open_prologue()
