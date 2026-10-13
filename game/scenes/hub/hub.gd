extends Control
## Camp de base : niveau et XP du héros, les donjons de la classe rangés par région (un
## onglet par matière ; dans une région, ouverts l'un après l'autre), le village et ses quêtes, le défi du jour, l'arène d'entraînement,
## les Archives et l'apparence du héros (★ quand un choix vient de se débloquer). Récupère la sauvegarde du serveur à l'arrivée (autre appareil, TRD §2.7).

var _wt: WorldTheme
var _dungeons: Array[DungeonDef] = []
var _level: Label
var _xp_bar: ProgressBar
var _xp_text: Label
var _dungeon_rows: Array[Dictionary] = []  # {panel, state, button}
var _region_tabs: Dictionary = {}  # matière → bouton d'onglet
var _region_spacer: Control  # région de moins de trois donjons : chaque carte garde un tiers de la hauteur
## Région affichée (matière), gardée tant que le jeu tourne.
static var _region := ""
var _village: VillageDef
var _village_state: Label
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
	# Aménagements modifiés par le parent depuis la dernière fois : le camp se reconstruit
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

	# Les donjons de la région choisie, l'un sous l'autre ; un onglet par matière.
	var dungeons := VBoxContainer.new()
	dungeons.add_theme_constant_override("separation", 12)
	dungeons.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dungeons.size_flags_stretch_ratio = 1.55
	main.add_child(dungeons)
	var subjects := DungeonDef.subjects(_dungeons)
	if not _region in subjects:
		_region = subjects[0] if not subjects.is_empty() else ""
	if subjects.size() > 1:
		var tabs := HBoxContainer.new()
		tabs.add_theme_constant_override("separation", 10)
		for subject in subjects:
			var tab := UiKit.button(DungeonDef.SUBJECT_LABELS.get(subject, subject), 52.0)
			tab.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			tab.pressed.connect(_show_region.bind(subject))
			tabs.add_child(tab)
			_region_tabs[subject] = tab
		dungeons.add_child(tabs)
	for i in _dungeons.size():
		var d := _dungeons[i]
		var row := _row(dungeons, d.title, d.chapter_title)
		row["button"].pressed.connect(_enter_dungeon.bind(i))
		_dungeon_rows.append(row)
	_region_spacer = Control.new()
	_region_spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	dungeons.add_child(_region_spacer)
	_show_region(_region)
	if _dungeons.is_empty():
		# Classe dont les régions sont encore en préparation : le reste du camp fonctionne.
		var soon := PanelContainer.new()
		soon.size_flags_vertical = Control.SIZE_EXPAND_FILL
		dungeons.add_child(soon)
		var text := VBoxContainer.new()
		text.alignment = BoxContainer.ALIGNMENT_CENTER
		soon.add_child(text)
		text.add_child(UiKit.label("De nouvelles régions se préparent", 27, _wt.accent))
		text.add_child(UiKit.label(
			"Les donjons de ta classe (%s) arrivent bientôt. En attendant, l'arène, le défi du jour et les Archives t'attendent." \
				% Session.profile.get("level_label", Session.level()), 19, _wt.text))

	# Village, défi du jour, puis arène et Archives en plus petit.
	var side := VBoxContainer.new()
	side.add_theme_constant_override("separation", 12)
	side.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	main.add_child(side)
	if _village != null:
		var village := _row(side, _village.title, "Les habitants ont besoin de toi.")
		_village_state = village["state"]
		village["button"].text = "Y aller"
		village["button"].pressed.connect(_enter_village)
	var daily := _row(side, "Défi du jour", "Dix automatismes, à ton rythme.")
	_daily_state = daily["state"]
	_daily_button = daily["button"]
	_daily_button.pressed.connect(_enter_daily)
	# Arène et Archives : deux boutons dans un même panneau.
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
	for i in _dungeons.size():
		_refresh_dungeon(i)
	_show_region(_region)
	_refresh_daily()
	var unlocked := Wardrobe.unlocked_count(level, SaveManager.dungeons_done(), _wt.companion)
	_look_button.text = "Apparence ★" if unlocked > int(SaveManager.look()["seen"]) else "Apparence"
	if _village != null:
		var waiting := _village.pending_quests(DailyChallenge.today())
		var plural := waiting > 1
		_village_state.text = "Tout le monde est aidé aujourd'hui ✓" if waiting == 0 else \
			"%d habitant%s attend%s ton aide" % [waiting, "s" if plural else "", "ent" if plural else ""]


func _refresh_dungeon(i: int) -> void:
	var d := _dungeons[i]
	var row: Dictionary = _dungeon_rows[i]
	var state_label: Label = row["state"]
	var b: Button = row["button"]
	var panel: PanelContainer = row["panel"]
	if not SaveManager.dungeon_unlocked(_dungeons, i):
		state_label.text = "Termine « %s » pour l'ouvrir." % DungeonDef.previous(_dungeons, i).title
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


## Onglet de région : ses donjons seulement. Une région jamais visitée est signalée.
func _show_region(subject: String) -> void:
	_region = subject
	var shown := 0
	for i in _dungeons.size():
		(_dungeon_rows[i]["panel"] as Control).visible = _dungeons[i].subject == subject
		shown += 1 if _dungeons[i].subject == subject else 0
	if _region_spacer != null:
		_region_spacer.visible = shown > 0 and shown < 3
		_region_spacer.size_flags_stretch_ratio = maxf(1.0, 3.0 - shown)
	var first: String = DungeonDef.subjects(_dungeons).front() if not _dungeons.is_empty() else ""
	for key in _region_tabs:
		var tab: Button = _region_tabs[key]
		var label: String = DungeonDef.SUBJECT_LABELS.get(key, key)
		var fresh := _dungeons.all(func(d: DungeonDef) -> bool:
			var state := SaveManager.dungeon(d.code)
			return d.subject != key or (int(state["completed"]) == 0 and int(state["checkpoint"]) == 0))
		tab.text = label + (" · nouveau !" if fresh and key != subject and key != first else "")
		if key == subject:
			for style in ["normal", "hover", "pressed"]:
				tab.remove_theme_stylebox_override(style)
			for color in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
				tab.remove_theme_color_override(color)
		else:
			UiKit.style_secondary(tab, _wt)


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


func _enter_dungeon(i: int) -> void:
	if not SaveManager.dungeon_unlocked(_dungeons, i):
		return
	var d := _dungeons[i]
	Session.dungeon_code = d.code
	await _launch("donjon", d.session_params(), "res://scenes/dungeon/dungeon.tscn", "donjon_" + d.code)


func _enter_village() -> void:
	if _village == null:
		return
	await _launch("village", _village.session_params(), "res://scenes/village/village.tscn")


func _enter_daily() -> void:
	await _launch("defi", {}, "res://scenes/daily/daily.tscn")


func _enter_arena() -> void:
	await _launch("arene", {}, "res://scenes/combat/combat.tscn")


func _launch(mode: String, params: Dictionary, scene: String, cache := "") -> void:
	if _busy:
		return
	if Session.time_over():
		_show_rest()
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


## Durée de jeu fixée par le parent atteinte : on explique au lieu de lancer l'activité
## (elle s'arrêterait aussitôt). L'apparence et les Archives restent ouvertes.
func _show_rest() -> void:
	_message.text = "Pause : retour dans %d min" % Session.minutes_before_play()
	var layer := CanvasLayer.new()
	layer.layer = 20
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.55)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(shade)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(center)
	var panel := UiKit.message_panel(_wt, "Temps de jeu terminé", Session.rest_text(), "D'accord")
	center.add_child(panel[0])
	add_child(layer)
	(panel[1] as Button).pressed.connect(layer.queue_free)


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
	# Seulement si le camp est toujours affiché (l'enfant a pu partir entre-temps), et une
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


## Développement, PC uniquement : `-- --goto=donjon|village|defi|arene|archives|apparence`
## (`--dungeon=<code>` pour un autre donjon que le premier).
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
			_enter_village()
		"defi":
			_enter_daily()
		"arene":
			_enter_arena()
		"archives":
			get_tree().change_scene_to_file("res://scenes/archives/archives.tscn")
		"apparence":
			_open_wardrobe()
