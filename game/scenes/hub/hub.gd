extends Control
## Camp de base (avant le village du MVP) : niveau et XP du héros, puis trois
## destinations : le donjon du monde, l'arène d'entraînement, les Archives.
## Récupère la sauvegarde du serveur à l'arrivée (autre appareil, TRD §2.7).

var _wt: WorldTheme
var _def: DungeonDef
var _level: Label
var _xp_bar: ProgressBar
var _xp_text: Label
var _dungeon_state: Label
var _dungeon_button: Button
var _message: Label
var _busy := false


func _ready() -> void:
	_wt = WorldTheme.for_world(Session.world())
	_def = DungeonDef.for_world(Session.world())
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
		margin.add_theme_constant_override("margin_" + side, 28)
	add_child(margin)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 22)
	margin.add_child(column)

	# Bandeau : héros, niveau, XP | changer de joueur
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 20)
	var who := VBoxContainer.new()
	who.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var name_label := UiKit.label(_wt.hero_name, 34, _wt.panel_border)
	name_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	who.add_child(name_label)
	var level_row := HBoxContainer.new()
	level_row.add_theme_constant_override("separation", 16)
	_level = UiKit.label("", 26, Color.WHITE)
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
	var switch := UiKit.button("Changer de joueur", 56.0)
	UiKit.style_secondary(switch, _wt)
	switch.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	switch.pressed.connect(_switch_player)
	top.add_child(switch)
	column.add_child(top)

	_message = UiKit.label("", 22, _wt.panel_border)
	_message.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(_message)

	# Destinations
	var cards := HBoxContainer.new()
	cards.add_theme_constant_override("separation", 22)
	cards.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(cards)
	var dungeon := _card(cards, _def.title, "Chapitre : %s. %s" % [_def.chapter_title, _def.intro], 1.4)
	_dungeon_state = UiKit.label("", 22, _wt.accent)
	dungeon[0].add_child(_dungeon_state)
	_dungeon_button = _card_button(dungeon[0], "Entrer")
	_dungeon_button.pressed.connect(_enter_dungeon)

	var arena := _card(cards, "Arène d'entraînement", "Des ennemis à la chaîne, de plus en plus coriaces. Idéal pour s'échauffer.")
	_card_button(arena[0], "Combattre").pressed.connect(_enter_arena)

	var archives := _card(cards, "Les Archives", "Tes étoiles de maîtrise, notion par notion, et le bestiaire des créatures vaincues.")
	_card_button(archives[0], "Consulter").pressed.connect(func() -> void:
		get_tree().change_scene_to_file("res://scenes/archives/archives.tscn"))


## Carte : [contenu (VBox), panneau].
func _card(parent: Container, title: String, body: String, stretch := 1.0) -> Array:
	var panel := PanelContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.size_flags_stretch_ratio = stretch
	parent.add_child(panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 14)
	panel.add_child(box)
	box.add_child(UiKit.label(title, 30, _wt.accent))
	box.add_child(UiKit.label(body, 21, _wt.text))
	return [box, panel]


func _card_button(box: VBoxContainer, text: String) -> Button:
	var gap := Control.new()
	gap.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_child(gap)
	var b := UiKit.button(text, 76.0)
	box.add_child(b)
	return b


func _refresh() -> void:
	var xp := SaveManager.xp()
	var level := Progression.level_for_xp(xp)
	_level.text = "Niveau %d" % level
	_xp_bar.value = Progression.level_progress(xp)
	_xp_text.text = "%d / %d XP" % [xp, Progression.xp_for_level(level + 1)]
	var state := SaveManager.dungeon(_def.code)
	var checkpoint := int(state["checkpoint"])
	var completed := int(state["completed"])
	if checkpoint > 0:
		_dungeon_state.text = "Reprise : %s (salle %d sur %d)" % [_def.rooms[checkpoint]["title"], checkpoint + 1, _def.room_count()]
		_dungeon_button.text = "Continuer"
	elif completed > 0:
		_dungeon_state.text = "Terminé %d fois ★ Les ennemis sont revenus…" % completed
		_dungeon_button.text = "Y retourner"
	else:
		_dungeon_state.text = "%d salles, une énigme et un boss." % _def.room_count()
		_dungeon_button.text = "Entrer"


func _enter_dungeon() -> void:
	await _launch("donjon", _def.session_params(), "res://scenes/dungeon/dungeon.tscn")


func _enter_arena() -> void:
	await _launch("arene", {}, "res://scenes/combat/combat.tscn")


func _launch(mode: String, params: Dictionary, scene: String) -> void:
	if _busy:
		return
	_busy = true
	_message.text = "En route !"
	var res := await Session.start(mode, params)
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


## Développement, PC uniquement : `-- --goto=donjon|arene|archives`.
func _dev_goto() -> void:
	if OS.has_feature("web"):
		return
	match Quality.option("goto"):
		"donjon":
			_enter_dungeon()
		"arene":
			_enter_arena()
		"archives":
			get_tree().change_scene_to_file("res://scenes/archives/archives.tscn")
