extends Control
## Apparence (PRD §6, personnalisation) : l'enfant choisit la silhouette de son héros,
## son arme, ce qu'il tient dans l'autre main, son couvre-chef, sa cape et sa couleur ;
## dans le monde de Jules, le nom et le pelage de son renard. Aperçu 3D à gauche (on le
## fait tourner du doigt), choix à droite ; les choix verrouillés disent comment les
## obtenir. Enregistré au retour au camp (SaveManager.set_look), purement cosmétique.

var _wt: WorldTheme
var _look: Dictionary
var _saved: Dictionary
var _level := 1
var _done := 0
var _choices: VBoxContainer
var _stage: Node3D  # héros et compagnon de l'aperçu
var _turntable: Node3D
var _dragging := false


func _ready() -> void:
	_wt = WorldTheme.for_world(Session.world())
	_level = SaveManager.level()
	_done = SaveManager.dungeons_done()
	_look = SaveManager.look()
	_saved = _look.duplicate()
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = UiKit.make_theme(_wt)
	_build()
	_refresh()


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

	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 16)
	var title := UiKit.label("Apparence", 40, _wt.panel_border)
	title.autowrap_mode = TextServer.AUTOWRAP_OFF
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(title)
	var back := UiKit.button("Retour à la Citadelle", 56.0)
	back.custom_minimum_size.x = 240
	back.pressed.connect(_leave)
	top.add_child(back)
	column.add_child(top)

	var main := HBoxContainer.new()
	main.add_theme_constant_override("separation", 20)
	main.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(main)
	main.add_child(_build_preview())

	var panel := PanelContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.size_flags_stretch_ratio = 1.3
	main.add_child(panel)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	panel.add_child(scroll)
	_choices = VBoxContainer.new()
	_choices.add_theme_constant_override("separation", 10)
	_choices.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_choices)


## Aperçu 3D dans son propre monde : héros (et renard) sur un socle, sous une lumière
## directionnelle (aucune lumière ponctuelle : budget tablette).
func _build_preview() -> Control:
	var container := SubViewportContainer.new()
	container.stretch = true
	container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	container.size_flags_vertical = Control.SIZE_EXPAND_FILL
	container.gui_input.connect(_on_preview_input)
	var viewport := SubViewport.new()
	viewport.own_world_3d = true
	viewport.transparent_bg = true
	viewport.msaa_3d = Viewport.MSAA_2X if Quality.current == &"haut" else Viewport.MSAA_DISABLED
	container.add_child(viewport)

	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_CLEAR_COLOR
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = _wt.ambient
	env.environment.ambient_light_energy = _wt.ambient_energy + 0.3
	viewport.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.light_color = _wt.sun_color
	sun.light_energy = _wt.sun_energy
	sun.rotation_degrees = Vector3(-40, 35, 0)
	viewport.add_child(sun)
	var camera := Camera3D.new()
	camera.fov = 30.0
	var eye := Vector3(0, 2.6, 11.0)
	camera.transform = Transform3D(Basis.looking_at(Vector3(0, 1.05, 0) - eye), eye)
	viewport.add_child(camera)

	_turntable = Node3D.new()
	viewport.add_child(_turntable)
	var plinth := MeshInstance3D.new()
	var disc := CylinderMesh.new()
	disc.top_radius = 1.9
	disc.bottom_radius = 2.0
	disc.height = 0.16
	plinth.mesh = disc
	var stone := StandardMaterial3D.new()
	stone.albedo_color = _wt.panel_border.darkened(0.35)
	plinth.material_override = stone
	plinth.position.y = -0.08
	_turntable.add_child(plinth)
	_turntable.rotation_degrees.y = -20.0
	return container


func _on_preview_input(event: InputEvent) -> void:
	# Glisser du doigt (ou de la souris) fait tourner le socle.
	if event is InputEventScreenTouch or event is InputEventMouseButton:
		_dragging = event.pressed
	elif _dragging and (event is InputEventScreenDrag or event is InputEventMouseMotion):
		_turntable.rotation.y += event.relative.x * 0.012


func _refresh(cheer := false) -> void:
	_show_model(cheer)
	for child in _choices.get_children():
		child.queue_free()
	var parts: Dictionary = Wardrobe.PARTS[_look["model"]]

	_section("Silhouette")
	var row := _row()
	for item: Dictionary in Wardrobe.SILHOUETTES:
		_choice(row, item["name"], _look["model"] == item["model"], item, func() -> void:
			if _look["model"] != item["model"]:
				_look.merge(Wardrobe.defaults_for(item["model"]), true)
				_refresh(true))

	_section("Arme")
	row = _row()
	for pair: Array in parts["main"]:
		_choice(row, pair[1], _look["main"] == pair[0], {}, _pick.bind("main", pair[0]))

	_section("Dans l'autre main")
	if Wardrobe.is_two_handed(_look["main"]):
		_choices.add_child(UiKit.label("Une arme à deux mains : l'autre main est déjà prise.", 19, _wt.text_dim))
	else:
		row = _row()
		for pair: Array in parts["off"]:
			_choice(row, pair[1], _look["off"] == pair[0], {}, _pick.bind("off", pair[0]))

	_section("Tenue")
	row = _row()
	if parts["head"] != "":
		var hat := "Casque" if _look["model"] == "Knight" else "Chapeau"
		_choice(row, hat, _look["head"], {}, _pick.bind("head", true))
		_choice(row, "Tête nue", not _look["head"], {}, _pick.bind("head", false))
	_choice(row, "Cape", _look["cape"], {}, _pick.bind("cape", true))
	_choice(row, "Sans cape", not _look["cape"], {}, _pick.bind("cape", false))

	if _look["cape"]:
		_section("Couleur de la cape")
		row = _row()
		for item: Dictionary in Wardrobe.CAPE_COLORS:
			var b := _choice(row, item["name"], _look["cape_color"] == item["id"], item, _pick.bind("cape_color", item["id"]))
			if item["id"] != "origine" and not b.disabled:
				_swatch(b, item["color"])

	if _wt.companion:
		_section("Ton renard : son nom")
		row = _row()
		for pet_name: String in Wardrobe.PET_NAMES:
			_choice(row, pet_name, _look["pet_name"] == pet_name, {}, _pick.bind("pet_name", pet_name))
		_section("Son pelage")
		row = _row()
		for item: Dictionary in Wardrobe.PET_FURS:
			var b := _choice(row, item["name"], _look["pet_fur"] == item["id"], item, _pick.bind("pet_fur", item["id"]))
			if not b.disabled:
				_swatch(b, item["main"])


func _pick(key: String, value: Variant) -> void:
	if _look[key] == value:
		return
	_look[key] = value
	_look = Wardrobe.sanitize(_look, Session.world(), _level, _done)
	_refresh(key == "main")


func _section(text: String) -> void:
	var label := UiKit.label(text, 24, _wt.accent)
	_choices.add_child(label)


func _row() -> HFlowContainer:
	var row := HFlowContainer.new()
	row.add_theme_constant_override("h_separation", 10)
	row.add_theme_constant_override("v_separation", 10)
	_choices.add_child(row)
	return row


## Un choix : plein s'il est choisi, en contour sinon, grisé s'il est verrouillé (le
## texte dit alors comment l'obtenir).
func _choice(row: Container, text: String, selected: bool, requirement: Dictionary, on_press: Callable) -> Button:
	var locked := not requirement.is_empty() and not Wardrobe.requirement_met(requirement, _level, _done)
	var b := UiKit.button("%s · %s" % [text, Wardrobe.requirement_text(requirement)] if locked else text, 52.0)
	b.disabled = locked
	if not selected:
		UiKit.style_secondary(b, _wt)
	b.pressed.connect(on_press)
	row.add_child(b)
	return b


## Pastille de couleur à gauche du nom (cape, pelage).
func _swatch(b: Button, color: Color) -> void:
	var image := Image.create(22, 22, false, Image.FORMAT_RGBA8)
	image.fill(color)
	for i in 22:
		for edge in [0, 21]:
			image.set_pixel(i, edge, Color(0, 0, 0, 0.5))
			image.set_pixel(edge, i, Color(0, 0, 0, 0.5))
	b.icon = ImageTexture.create_from_image(image)


func _show_model(cheer: bool) -> void:
	if _stage != null:
		_stage.queue_free()
	_stage = Node3D.new()
	_turntable.add_child(_stage)
	var hero := Fighter.create_hero(_look, "", 1)
	hero.position = Vector3(0.35 if _wt.companion else 0.0, 0, 0)
	_stage.add_child(hero)
	if Quality.settings().vertex_shading:
		MobileLighting.apply_vertex_shading(hero)
	if cheer:
		hero.play.call_deferred(["Cheer"])
	if _wt.companion:
		var pet := Companion.create(_look)
		pet.position = Vector3(-1.0, 0, 0.7)
		pet.rotation_degrees.y = 30.0
		_stage.add_child(pet)
		if Quality.settings().vertex_shading:
			MobileLighting.apply_vertex_shading(pet)


func _leave() -> void:
	# Les nouveautés débloquées sont désormais vues (fin du signal « nouveau » au camp).
	_look["seen"] = Wardrobe.unlocked_count(_level, _done, _wt.companion)
	if _look != _saved:
		SaveManager.set_look(_look)
	get_tree().change_scene_to_file("res://scenes/hub/hub.tscn")
