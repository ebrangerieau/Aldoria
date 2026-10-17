extends Control
## La Citadelle des Archives (docs/histoire.md §5), au centre de la carte du royaume : niveau et
## XP du héros, pages de la Grande Chronique retrouvées, le chemin vers la carte (donjons et
## village partent de la carte, par leur seuil), le défi du jour, l'arène d'entraînement, les
## Archives et l'apparence du héros (★ quand un choix vient de se débloquer). Récupère la
## sauvegarde du serveur à l'arrivée (autre appareil, TRD §2.7).

var _wt: WorldTheme
var _dungeons: Array[DungeonDef] = []
var _village: VillageDef
var _badge: HeroBadge
var _pages_state: Label
var _daily_state: Label
var _daily_button: Button
var _look_button: Button
var _message: Label
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
	# La salle de la Citadelle en 3D : le héros et Maître Ysaline près de la Grande Chronique.
	UiKit.backdrop(self, _wt, true, true, 2.8)
	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 20)
	add_child(margin)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 10)
	margin.add_child(column)

	# Bandeau : le héros (niveau, XP, sac) | message | options, changer de joueur
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 14)
	column.add_child(top)
	_badge = HeroBadge.create(_wt)
	_badge.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	top.add_child(_badge)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(spacer)
	_message = UiKit.on_scene(UiKit.label("", 22))
	_message.autowrap_mode = TextServer.AUTOWRAP_OFF
	_message.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	top.add_child(_message)
	var options := UiKit.icon_button("Options", "cog", 56.0)
	UiKit.style_secondary(options, _wt)
	options.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	options.pressed.connect(_show_options)
	top.add_child(options)
	var switch := UiKit.icon_button("Changer de joueur", "two-shadows", 56.0)
	UiKit.style_secondary(switch, _wt)
	switch.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	switch.pressed.connect(_switch_player)
	top.add_child(switch)

	# À gauche, la salle reste visible (le héros, Maître Ysaline, la Chronique) sous le bandeau ;
	# à droite, les cartes : la carte du royaume, la Pierre du Jour, les salles de la Citadelle.
	var body := HBoxContainer.new()
	body.add_theme_constant_override("separation", 16)
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(body)
	var stage := VBoxContainer.new()
	stage.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	stage.mouse_filter = Control.MOUSE_FILTER_IGNORE
	body.add_child(stage)
	stage.add_child(UiKit.ribbon(_wt, "La Citadelle des Archives", 28))
	var motto := UiKit.on_scene(UiKit.label(
		"Ici veille la Grande Chronique. Malvrek et ses Effaceurs en ont volé les pages.", 19))
	motto.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	stage.add_child(motto)
	var scroll := ScrollContainer.new()  # texte agrandi, cibles agrandies : défilement au doigt
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.custom_minimum_size.x = 500
	body.add_child(scroll)
	var cards := VBoxContainer.new()
	cards.add_theme_constant_override("separation", 6)
	cards.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(cards)
	var journey := _card(cards, "treasure-map", "La carte du royaume")
	_pages_state = UiKit.label("", 19, _wt.text)
	journey.add_child(_pages_state)
	var to_map := UiKit.icon_button("Ouvrir la carte du royaume", "treasure-map", 60.0)
	to_map.pressed.connect(_open_map)
	journey.add_child(to_map)

	var daily := _card(cards, "sun", "Défi du jour")
	_daily_state = UiKit.label("", 19, _wt.text)
	daily.add_child(_daily_state)
	_daily_button = UiKit.icon_button("Relever", "sun", 60.0)
	_daily_button.pressed.connect(_enter_daily)
	daily.add_child(_daily_button)

	var halls := _card(cards, "castle", "Dans la Citadelle")
	# Une rangée de tuiles ; texte agrandi : trois par ligne, pour ne pas élargir la colonne.
	var grid := GridContainer.new()
	grid.columns = 3 if UiKit.text_scale > 1.1 else 5
	grid.add_theme_constant_override("h_separation", 6)
	grid.add_theme_constant_override("v_separation", 6)
	halls.add_child(grid)
	var arena := _small_button(grid, "Arène", "crossed-swords")
	arena.pressed.connect(_enter_arena)
	if TirScene.generator_for(Session.level()) != "":
		var shooting := _small_button(grid, "Tir", "round-star")
		shooting.pressed.connect(_enter_shooting)
	var archives := _small_button(grid, "Archives", "open-book")
	archives.pressed.connect(func() -> void:
		get_tree().change_scene_to_file("res://scenes/archives/archives.tscn"))
	_look_button = _small_button(grid, "Apparence", "visored-helm")
	_look_button.pressed.connect(_open_wardrobe)
	var story := _small_button(grid, "Prologue", "scroll-unfurled")
	story.pressed.connect(_open_prologue)


## Carte de la Citadelle : icône et titre gravé ; renvoie la colonne où ajouter l'état et le bouton.
func _card(parent: Container, icon_name: String, title: String) -> VBoxContainer:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", UiKit.texture_box("panel_" + _wt.id, UiKit.MARGINS["panel"], 18))
	parent.add_child(panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	panel.add_child(box)
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 10)
	box.add_child(head)
	head.add_child(UiKit.icon(icon_name, 38, _wt.accent))
	var t := UiKit.title(title, 22, _wt.accent)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	t.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	head.add_child(t)
	return box


## Tuile : icône au-dessus de son nom.
func _small_button(parent: Container, text: String, icon_name: String) -> Button:
	var b := UiKit.icon_button(text, icon_name, 84.0)
	UiKit.style_secondary(b, _wt)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.vertical_icon_alignment = VERTICAL_ALIGNMENT_TOP
	b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	b.add_theme_font_size_override("font_size", UiKit.font_size(17))
	b.add_theme_constant_override("icon_max_width", roundi(32 * UiKit.text_scale))
	parent.add_child(b)
	return b


func _refresh() -> void:
	_badge.refresh()
	var level := Progression.level_for_xp(SaveManager.xp())
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


## Stand de tir de la Lice : tirs calculés (angle pour Jules, droite pour Tom).
func _enter_shooting() -> void:
	await _launch("arene", TirScene.params(Session.level()), TirScene.SCENE, "tir")


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
	center.add_child(UiKit.fitted(panel))
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


## Développement, PC uniquement : `-- --goto=donjon|village|defi|arene|tir|archives|apparence|prologue`
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
		"tir":
			_enter_shooting()
		"archives":
			get_tree().change_scene_to_file("res://scenes/archives/archives.tscn")
		"apparence":
			_open_wardrobe()
		"prologue":
			_open_prologue()
