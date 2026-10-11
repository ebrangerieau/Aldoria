extends Control
## Camp de base (avant le village du MVP) : niveau et XP du héros, les trois donjons
## du monde (ouverts l'un après l'autre), le défi du jour, l'arène d'entraînement et
## les Archives. Récupère la sauvegarde du serveur à l'arrivée (autre appareil, TRD §2.7).

var _wt: WorldTheme
var _dungeons: Array[DungeonDef] = []
var _level: Label
var _xp_bar: ProgressBar
var _xp_text: Label
var _dungeon_rows: Array[Dictionary] = []  # {panel, state, button}
var _daily_state: Label
var _daily_button: Button
var _message: Label
var _busy := false


func _ready() -> void:
	_wt = WorldTheme.for_world(Session.world())
	_dungeons = DungeonDef.all_for_world(Session.world())
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = UiKit.make_theme(_wt)
	_build()
	_refresh()
	SaveManager.changed.connect(_refresh)
	await SaveManager.sync()
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
	top.add_child(who)
	_message = UiKit.label("", 22, _wt.panel_border)
	_message.autowrap_mode = TextServer.AUTOWRAP_OFF
	_message.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	top.add_child(_message)
	var switch := UiKit.button("Changer de joueur", 56.0)
	UiKit.style_secondary(switch, _wt)
	switch.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	switch.pressed.connect(_switch_player)
	top.add_child(switch)
	column.add_child(top)

	var main := HBoxContainer.new()
	main.add_theme_constant_override("separation", 20)
	main.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(main)

	# Les trois donjons, l'un sous l'autre.
	var dungeons := VBoxContainer.new()
	dungeons.add_theme_constant_override("separation", 12)
	dungeons.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dungeons.size_flags_stretch_ratio = 1.55
	main.add_child(dungeons)
	for i in _dungeons.size():
		var d := _dungeons[i]
		var row := _row(dungeons, d.title, d.chapter_title)
		row["button"].pressed.connect(_enter_dungeon.bind(i))
		_dungeon_rows.append(row)

	# Défi du jour, arène, Archives.
	var side := VBoxContainer.new()
	side.add_theme_constant_override("separation", 12)
	side.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	main.add_child(side)
	var daily := _row(side, "Défi du jour", "Dix automatismes, à ton rythme.")
	_daily_state = daily["state"]
	_daily_button = daily["button"]
	_daily_button.pressed.connect(_enter_daily)
	var arena := _row(side, "Arène d'entraînement", "Des ennemis à la chaîne, de plus en plus coriaces.")
	arena["button"].text = "Combattre"
	arena["state"].visible = false
	arena["button"].pressed.connect(_enter_arena)
	var archives := _row(side, "Les Archives", "Tes étoiles de maîtrise et le bestiaire.")
	archives["button"].text = "Consulter"
	archives["state"].visible = false
	archives["button"].pressed.connect(func() -> void:
		get_tree().change_scene_to_file("res://scenes/archives/archives.tscn"))


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
	for i in _dungeons.size():
		_refresh_dungeon(i)
	_refresh_daily()


func _refresh_dungeon(i: int) -> void:
	var d := _dungeons[i]
	var row: Dictionary = _dungeon_rows[i]
	var state_label: Label = row["state"]
	var b: Button = row["button"]
	var panel: PanelContainer = row["panel"]
	if not SaveManager.dungeon_unlocked(_dungeons, i):
		state_label.text = "Termine « %s » pour l'ouvrir." % _dungeons[i - 1].title
		state_label.add_theme_color_override("font_color", _wt.text)
		b.text = "Fermé"
		b.disabled = true
		panel.modulate = Color(1, 1, 1, 0.7)
		return
	state_label.add_theme_color_override("font_color", _wt.accent)
	b.disabled = false
	panel.modulate = Color.WHITE
	var state := SaveManager.dungeon(d.code)
	var checkpoint := int(state["checkpoint"])
	var completed := int(state["completed"])
	if checkpoint > 0:
		state_label.text = "Reprise : %s (salle %d sur %d)" % [d.rooms[checkpoint]["title"], checkpoint + 1, d.room_count()]
		b.text = "Continuer"
	elif completed > 0:
		state_label.text = "Terminé %d fois ★ Les ennemis sont revenus…" % completed
		b.text = "Y retourner"
	else:
		state_label.text = "%d salles, une énigme et un boss." % d.room_count()
		b.text = "Entrer"


func _refresh_daily() -> void:
	var today := DailyChallenge.today()
	var days := SaveManager.daily_days()
	var streak := DailyChallenge.streak(days, today)
	var series := "Série : %d jour%s" % [streak, "s" if streak > 1 else ""] if streak > 0 else "Pas encore de série"
	var week := "coffre %d / %d" % [mini(DailyChallenge.week_count(days, today), DailyChallenge.WEEKLY_GOAL), DailyChallenge.WEEKLY_GOAL]
	if not days.has(today):
		_daily_state.text = "%s · %s · à relever aujourd'hui" % [series, week]
		_daily_button.text = "Relever"
	elif DailyChallenge.can_catch_up(days, today):
		_daily_state.text = "Fait aujourd'hui ✓ · hier manqué : rattrape-le !"
		_daily_button.text = "Rattraper"
	else:
		_daily_state.text = "%s · %s · fait aujourd'hui ✓" % [series, week]
		_daily_button.text = "S'entraîner"


func _enter_dungeon(i: int) -> void:
	if not SaveManager.dungeon_unlocked(_dungeons, i):
		return
	var d := _dungeons[i]
	Session.dungeon_code = d.code
	await _launch("donjon", d.session_params(), "res://scenes/dungeon/dungeon.tscn", "donjon_" + d.code)


func _enter_daily() -> void:
	await _launch("defi", {}, "res://scenes/daily/daily.tscn")


func _enter_arena() -> void:
	await _launch("arene", {}, "res://scenes/combat/combat.tscn")


func _launch(mode: String, params: Dictionary, scene: String, cache := "") -> void:
	if _busy:
		return
	_busy = true
	_message.text = "En route !"
	var res := await Session.start(mode, params, cache)
	if res.ok:
		get_tree().change_scene_to_file(scene)
		return
	if res.status == 401:
		await Session.logout()  # jeton expiré : on redemande le code
		get_tree().change_scene_to_file("res://scenes/profile/profile_select.tscn")
		return
	_message.text = "%s Réessaie dans un instant." % res.error.get("message", "")
	_busy = false


func _switch_player() -> void:
	if _busy:
		return
	_busy = true
	await Session.logout()
	get_tree().change_scene_to_file("res://scenes/profile/profile_select.tscn")


## Développement, PC uniquement : `-- --goto=donjon|defi|arene|archives`
## (`--dungeon=<code>` pour un autre donjon que le premier).
func _dev_goto() -> void:
	if OS.has_feature("web"):
		return
	match Quality.option("goto"):
		"donjon":
			var index := 0
			for i in _dungeons.size():
				if _dungeons[i].code == Quality.option("dungeon"):
					index = i
			var d := _dungeons[index]
			Session.dungeon_code = d.code
			_launch("donjon", d.session_params(), "res://scenes/dungeon/dungeon.tscn", "donjon_" + d.code)
		"defi":
			_enter_daily()
		"arene":
			_enter_arena()
		"archives":
			get_tree().change_scene_to_file("res://scenes/archives/archives.tscn")
