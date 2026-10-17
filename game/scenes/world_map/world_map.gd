extends Node3D
## Carte du royaume (docs/histoire.md) : écran principal après la connexion. La Citadelle des
## Archives au centre, le village de Clairval, une région par matière avec ses donjons (pages de
## la Grande Chronique retrouvées, quêtes ouvertes, lieux encore fermés), et les régions pas encore
## au programme dans le brouillard. Toucher un lieu ouvre son seuil : Maître Ysaline présente le
## monde et la quête, l'enfant choisit d'y entrer ou non.
##
## Géométrie : une seule texture pour tout le pack, donc un matériau partagé et un seul maillage
## fusionné (StaticBatcher), comme les salles des donjons (budget tablette, docs/perf-log.md).

const DUNGEON_SCENE := "res://scenes/dungeon/dungeon.tscn"
const VILLAGE_SCENE := "res://scenes/village/village.tscn"
const PICK_RADIUS := 90.0  # pixels autour d'un lieu touché
const CAMERA_PITCH := -58.0
const CAMERA_FOV := 38.0
## Zoom : distance de la caméra, de la carte entière (FAR) au plus près (NEAR).
const CAMERA_FAR := 31.0
const CAMERA_NEAR := 12.0
const ZOOM_STEP := 1.25  # boutons + / − et molette
const DRAG_THRESHOLD := 14.0  # pixels : au-delà, un doigt qui bouge déplace la carte au lieu de toucher un lieu

var _wt: WorldTheme
var _dungeons: Array[DungeonDef] = []
var _village: VillageDef
var _material: StandardMaterial3D
var _grass_material: StandardMaterial3D  # herbe du pack teintée en vert (elle est vert-jaune)
var _static: Node3D
var _ground: Node3D
var _camera: Camera3D
var _places: Array[Dictionary] = []  # {kind, id, title, cell, status, index, label}
var _markers: Array[Label3D] = []  # repères qui flottent au-dessus des quêtes ouvertes
var _time := 0.0
var _hud: CanvasLayer
var _badge: HeroBadge
var _message: Label
var _busy := false
var _panel_open := false
var _home := Vector3.ZERO  # centre de la carte entière
var _focus := Vector3.ZERO  # point visé par la caméra
var _distance := CAMERA_FAR
var _touches := {}  # doigt → position à l'écran
var _pinch := 0.0  # écart entre deux doigts au dernier mouvement
var _press_at := Vector2(-1, -1)  # où le doigt (ou la souris) s'est posé
var _dragged := false
var _zoom_buttons: Array[Button] = []


func _ready() -> void:
	_wt = WorldTheme.for_world(Session.world())
	_dungeons = DungeonDef.all_for_level(Session.level())
	_village = VillageDef.for_level(Session.level())
	_material = StandardMaterial3D.new()
	_material.albedo_texture = load("res://assets/kaykit/hexagon/hexagons_medieval.png")
	_material.roughness = 0.9
	if Quality.settings().vertex_shading:
		_material.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
	_grass_material = _material.duplicate()
	_grass_material.albedo_color = Color(0.56, 0.8, 0.52) if _wt.id == "lumineux" else Color(0.48, 0.64, 0.54)
	_build_environment()
	_static = Node3D.new()
	_static.name = "Static"
	add_child(_static)
	_ground = Node3D.new()
	_ground.name = "Ground"
	add_child(_ground)
	_build_terrain()
	_collect_places()
	_build_places()
	if Quality.option("merge", "1") != "0":
		StaticBatcher.merge(_static, _material)
		StaticBatcher.merge(_ground, _grass_material)
	_build_paths()
	_build_camera()
	_build_hud()
	_refresh()
	SaveManager.changed.connect(_refresh)
	await SaveManager.sync()
	Accessibility.changed.connect(_rebuild, CONNECT_ONE_SHOT)
	Session.profile_changed.connect(_rebuild, CONNECT_ONE_SHOT)
	await Accessibility.refresh()
	if Session.time_over():
		_message.text = "Pause : retour dans %d min" % Session.minutes_before_play()
	if await _dev_goto():
		return
	if not SaveManager.story_seen(Prologue.STORY_KEY):
		Prologue.play(get_tree(), Departure.MAP_SCENE)  # la nuit du vol, puis retour ici
		return
	if not SaveManager.story_seen("welcome"):
		SaveManager.mark_story("welcome")
		await _dialog("La carte du royaume", WorldMapDef.WELCOME, "", "Je suis prêt !", "")
	await _celebrate_pages()


## Maître Ysaline salue chaque page rapportée (une fois) et montre le chemin qui s'ouvre.
func _celebrate_pages() -> void:
	for i in _dungeons.size():
		var d := _dungeons[i]
		var key := "page_" + d.code
		if int(SaveManager.dungeon(d.code)["completed"]) == 0 or SaveManager.story_seen(key):
			continue
		SaveManager.mark_story(key)
		var next := ""
		for j in range(i + 1, _dungeons.size()):
			if _dungeons[j].subject == d.subject:
				next = "Regarde : le chemin vers « %s » s'éclaire sur la carte." % _dungeons[j].title
				break
		if next == "":
			var region := str(WorldMapDef.REGIONS.get(d.subject, {}).get("title", "cette région"))
			next = "Toutes les pages de la région « %s » sont revenues. Malvrek doit trembler dans sa tour !" % region
		var text := "Tu as rapporté %s ! Elle a repris sa place dans la Grande Chronique. %s" % [d.page, next]
		await _dialog("Une page retrouvée", text, "", "Merci, Maître Ysaline", "")


func _process(delta: float) -> void:
	_time += delta
	for i in _markers.size():
		var m := _markers[i]
		m.position.y = m.get_meta("base_y") + 0.25 * sin(_time * 2.6 + i)


# --- Lieux --------------------------------------------------------------------------------

## Lieux de la carte et leur état, pour la classe et la progression de l'enfant.
func _collect_places() -> void:
	_places.clear()
	_places.append({"kind": "citadel", "id": "citadelle", "title": "La Citadelle des Archives",
		"cell": WorldMapDef.CITADEL, "status": "open"})
	if _village != null:
		_places.append({"kind": "village", "id": "village", "title": _village.title,
			"cell": WorldMapDef.VILLAGE, "status": "open"})
	var used := {}
	for i in _dungeons.size():
		var d := _dungeons[i]
		var region: Dictionary = WorldMapDef.REGIONS.get(d.subject, {})
		var slot := int(used.get(d.subject, 0))
		used[d.subject] = slot + 1
		if region.is_empty() or slot >= (region["slots"] as Array).size():
			continue
		var status := "locked"
		if SaveManager.dungeon_unlocked(_dungeons, i):
			status = "done" if int(SaveManager.dungeon(d.code)["completed"]) > 0 else "open"
		_places.append({"kind": "dungeon", "id": d.code, "title": d.title, "cell": region["slots"][slot],
			"status": status, "index": i, "region": d.subject})
	for subject in WorldMapDef.REGIONS:
		if not used.has(subject):
			var region: Dictionary = WorldMapDef.REGIONS[subject]
			_places.append({"kind": "fog", "id": subject, "title": region["title"], "cell": region["slots"][0],
				"status": "fog", "region": subject})
	for id in WorldMapDef.SECRETS:
		var secret: Dictionary = WorldMapDef.SECRETS[id]
		_places.append({"kind": "secret", "id": id, "title": secret["title"], "cell": secret["cell"], "status": "fog"})


func _build_places() -> void:
	_add_piece("building_castle_blue", WorldMapDef.CITADEL, Vector2.ZERO, 30.0, 1.2)
	_add_piece("building_archeryrange_green", WorldMapDef.CITADEL + Vector2i(1, 0), Vector2.ZERO, -20.0)
	_add_piece("flag_blue", WorldMapDef.CITADEL, Vector2(0.75, 0.6), 0.0, 2.2)
	if _village != null:
		_add_piece("building_market_yellow", WorldMapDef.VILLAGE, Vector2(0.15, -0.2), 10.0)
		_add_piece("building_well_yellow", WorldMapDef.VILLAGE, Vector2(-0.55, 0.55), 0.0)
		_add_piece("building_home_A_yellow", WorldMapDef.VILLAGE + Vector2i(-1, 0), Vector2(0.3, -0.2), 40.0)
		_add_piece("building_home_B_yellow", WorldMapDef.VILLAGE + Vector2i(-1, 0), Vector2(-0.4, 0.4), -30.0)
		_add_piece("building_windmill_yellow", WorldMapDef.VILLAGE + Vector2i(0, 1), Vector2.ZERO, 15.0)
	for p in _places:
		match p["kind"]:
			"dungeon":
				var d := _dungeons[int(p["index"])]
				_add_piece(d.map_piece, p["cell"], Vector2.ZERO, 20.0, 1.15)
				if p["status"] == "done":
					_add_piece("flag_blue", p["cell"], Vector2(0.6, 0.5), 0.0, 2.2)
				elif p["status"] == "locked":
					_add_piece("cloud_small", p["cell"], Vector2.ZERO, 0.0, 0.8, 2.2)
			"fog":
				for cell in WorldMapDef.REGIONS[p["region"]]["slots"]:
					_add_piece("cloud_big", cell, Vector2.ZERO, randf_range(0, 360), 0.9, 1.8)
			"secret":
				_add_piece(WorldMapDef.SECRETS[p["id"]]["piece"], p["cell"], Vector2.ZERO, 0.0, 1.1)
				_add_piece("cloud_big", p["cell"], Vector2(0.3, 0.2), 30.0, 0.9, 2.6)
		_add_label(p)


func _add_label(p: Dictionary) -> void:
	var at := WorldMapDef.cell_position(p["cell"])
	var title := Label3D.new()
	title.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	title.no_depth_test = true
	title.fixed_size = false
	title.font = Accessibility.font()
	title.font_size = UiKit.font_size(36)
	title.pixel_size = 0.011
	title.outline_size = 14
	title.outline_modulate = Color(0, 0, 0, 0.75)
	title.position = at + Vector3(0, 3.2 if p["kind"] == "citadel" else 2.6, 0.4)
	title.text = "%s\n%s" % [short_title(p["title"]), _status_text(p)]
	title.modulate = {"done": _wt.good.lightened(0.35), "open": Color.WHITE, "locked": Color(0.85, 0.85, 0.85), "fog": Color(0.8, 0.82, 0.9)}[p["status"]]
	title.render_priority = 2
	add_child(title)
	p["label"] = title
	if p["kind"] in ["dungeon", "village"] and p["status"] == "open":
		var marker := Label3D.new()
		marker.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		marker.no_depth_test = true
		marker.font = Accessibility.font()
		marker.font_size = 96
		marker.pixel_size = 0.012
		marker.outline_size = 16
		marker.outline_modulate = Color(0, 0, 0, 0.6)
		marker.modulate = Color("#ffd447")
		marker.text = "▼"
		marker.position = at + Vector3(0, 4.3, 0.4)
		marker.set_meta("base_y", marker.position.y)
		marker.render_priority = 3
		add_child(marker)
		_markers.append(marker)


## Nom sur la carte, sans article (« Tour des Fractions ») : plus court, il se chevauche moins.
static func short_title(title: String) -> String:
	for article in ["La ", "Le ", "Les ", "L'"]:
		if title.begins_with(article):
			var rest := title.substr(article.length())
			return rest[0].to_upper() + rest.substr(1)
	return title


func _status_text(p: Dictionary) -> String:
	match p["kind"]:
		"citadel":
			return "Entrer"
		"village":
			var waiting := _village.pending_quests(DailyChallenge.today())
			return "Tout le monde est aidé ✓" if waiting == 0 else "%d habitant%s à aider" % [waiting, "s" if waiting > 1 else ""]
		"dungeon":
			var d := _dungeons[int(p["index"])]
			match p["status"]:
				"done":
					return "Page retrouvée ✓"
				"locked":
					return "Fermé"
			var checkpoint := int(SaveManager.dungeon(d.code)["checkpoint"])
			return "Reprise : étage %d" % (checkpoint + 1) if checkpoint > 0 else "Nouvelle quête !"
	return "Dans le brouillard"


# --- Terrain et décor ------------------------------------------------------------------------

func _build_terrain() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 2026
	for r in WorldMapDef.GRID.size():
		for q in (WorldMapDef.GRID[r] as String).length():
			var cell := Vector2i(q, r)
			var kind := WorldMapDef.terrain(cell)
			var yaw := 60.0 * rng.randi_range(0, 5)
			if kind == "~":
				_add_piece("hex_water", cell, Vector2.ZERO, 0.0)
				continue
			_add_piece("hex_grass", cell, Vector2.ZERO, 0.0, 1.0, 0.0, _ground)
			if _is_place_cell(cell):
				continue
			match kind:
				"M":
					_add_piece(["mountain_A_grass_trees", "mountain_B_grass", "mountain_C_grass_trees"][rng.randi_range(0, 2)], cell, Vector2.ZERO, yaw, 1.0, 0.0, _ground)
				"H":
					_add_piece("hills_A_trees", cell, Vector2.ZERO, yaw, 1.0, 0.0, _ground)
				"h":
					_add_piece("hills_B", cell, Vector2.ZERO, yaw, 1.0, 0.0, _ground)
				"T":
					_add_piece(["trees_A_large", "trees_B_large", "trees_A_medium"][rng.randi_range(0, 2)], cell, Vector2.ZERO, yaw)
				_:
					if rng.randf() < 0.25:
						_add_piece(["trees_B_small", "rock_single_A"][rng.randi_range(0, 1)], cell, Vector2(rng.randf_range(-0.4, 0.4), rng.randf_range(-0.4, 0.4)), yaw)


func _is_place_cell(cell: Vector2i) -> bool:
	if cell in [WorldMapDef.CITADEL, WorldMapDef.CITADEL + Vector2i(1, 0), WorldMapDef.VILLAGE,
			WorldMapDef.VILLAGE + Vector2i(-1, 0), WorldMapDef.VILLAGE + Vector2i(0, 1)]:
		return true
	for subject in WorldMapDef.REGIONS:
		if cell in WorldMapDef.REGIONS[subject]["slots"]:
			return true
	for id in WorldMapDef.SECRETS:
		if WorldMapDef.SECRETS[id]["cell"] == cell:
			return true
	return false


func _add_piece(piece: String, cell: Vector2i, offset: Vector2, yaw: float, scale_factor := 1.0, height := 0.0, parent: Node3D = null) -> void:
	var node: Node3D = (load(WorldMapDef.PIECES % piece) as PackedScene).instantiate()
	node.position = WorldMapDef.cell_position(cell) + Vector3(offset.x, height, offset.y)
	node.rotation_degrees.y = yaw
	node.scale = Vector3.ONE * scale_factor
	var into := parent if parent != null else _static
	for child in node.find_children("*", "MeshInstance3D", true, false):
		(child as MeshInstance3D).material_override = _grass_material if into == _ground else _material
	into.add_child(node)


## Chemins lumineux depuis la Citadelle : vers le village, et vers chaque donjon ouvert ou
## repris, de proche en proche dans sa région. Des pastilles dorées (pages retrouvées) ou
## claires (quêtes ouvertes), dessinées en une seule fois.
func _build_paths() -> void:
	var dots: Array[Vector3] = []
	var gold: Array[Vector3] = []
	var previous := {}
	for p in _places:
		match p["kind"]:
			"village":
				_dots_between(WorldMapDef.CITADEL, p["cell"], dots)
			"dungeon":
				if p["status"] == "locked":
					continue
				var from: Vector2i = previous.get(p["region"], WorldMapDef.CITADEL)
				_dots_between(from, p["cell"], gold if p["status"] == "done" else dots)
				previous[p["region"]] = p["cell"]
	_add_dots(dots, Color(1, 1, 1, 0.9))
	_add_dots(gold, Color("#ffd447"))


func _dots_between(a: Vector2i, b: Vector2i, out: Array[Vector3]) -> void:
	var from := WorldMapDef.cell_position(a)
	var to := WorldMapDef.cell_position(b)
	var length := from.distance_to(to)
	var steps := int(length / 0.55)
	for s in range(2, steps - 1):  # ni sur le bâtiment de départ, ni sur celui d'arrivée
		out.append(from.lerp(to, float(s) / steps) + Vector3(0, 0.12, 0))


func _add_dots(points: Array[Vector3], color: Color) -> void:
	if points.is_empty():
		return
	var mesh := CylinderMesh.new()
	mesh.top_radius = 0.11
	mesh.bottom_radius = 0.11
	mesh.height = 0.06
	mesh.radial_segments = 8
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color = color
	mesh.material = material
	var multi := MultiMesh.new()
	multi.transform_format = MultiMesh.TRANSFORM_3D
	multi.mesh = mesh
	multi.instance_count = points.size()
	for i in points.size():
		multi.set_instance_transform(i, Transform3D(Basis(), points[i]))
	var node := MultiMeshInstance3D.new()
	node.multimesh = multi
	add_child(node)


func _build_environment() -> void:
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	var sea := Color("#3e8fb5") if _wt.id == "lumineux" else Color("#16283a")
	env.environment.background_color = sea
	# Lumière douce : la texture du pack est déjà claire, un soleil trop fort la brûle (herbe jaune).
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(0.78, 0.8, 0.88) if _wt.id == "lumineux" else Color(0.55, 0.62, 0.75)
	env.environment.ambient_light_energy = 0.55 if _wt.id == "lumineux" else 0.45
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55, -35, 0)
	sun.light_color = Color(1.0, 0.96, 0.9) if _wt.id == "lumineux" else Color(0.8, 0.86, 1.0)
	sun.light_energy = 0.85 if _wt.id == "lumineux" else 0.7
	sun.shadow_enabled = Quality.settings().shadows
	Quality.dress_sun(sun)
	add_child(sun)


func _build_camera() -> void:
	_camera = Camera3D.new()
	_camera.fov = CAMERA_FOV
	_camera.far = 200.0
	add_child(_camera)
	var size := WorldMapDef.size()
	_home = Vector3(size.x / 2.0 - WorldMapDef.TILE_W / 2.0, 0, size.y / 2.0 - 1.0)
	_focus = _home
	_camera.rotation = Vector3(deg_to_rad(CAMERA_PITCH), 0, 0)
	_place_camera()
	_camera.make_current()


## Caméra au-dessus du point visé ; zoomée, elle peut se déplacer, jamais hors de la carte.
func _place_camera() -> void:
	_distance = clampf(_distance, CAMERA_NEAR, CAMERA_FAR)
	var freedom := 1.0 - (_distance - CAMERA_NEAR) / (CAMERA_FAR - CAMERA_NEAR)  # 0 : carte entière
	var half := WorldMapDef.size() / 2.0 * freedom
	_focus.x = clampf(_focus.x, _home.x - half.x, _home.x + half.x)
	_focus.z = clampf(_focus.z, _home.z - half.y, _home.z + half.y)
	_focus.y = 0.0
	var pitch := deg_to_rad(CAMERA_PITCH)
	_camera.position = _focus + Vector3(0, -sin(pitch) * _distance, cos(pitch) * _distance)
	for b in _zoom_buttons:
		b.disabled = (b.text == "+" and _distance <= CAMERA_NEAR + 0.01) or (b.text == "−" and _distance >= CAMERA_FAR - 0.01)


## Zoom d'un facteur (> 1 : rapproche), en gardant sous le doigt le point `at` de l'écran.
func zoom_by(factor: float, at := Vector2(-1, -1)) -> void:
	var before := _ground_point(at) if at.x >= 0 else _focus
	_distance /= factor
	_place_camera()
	if at.x >= 0:
		_focus += before - _ground_point(at)
		_place_camera()


## Déplace la carte comme si on la faisait glisser du doigt de `delta` pixels.
func pan_by(delta: Vector2) -> void:
	var a := _ground_point(get_viewport().get_visible_rect().size / 2.0)
	var b := _ground_point(get_viewport().get_visible_rect().size / 2.0 + delta)
	_focus -= b - a
	_place_camera()


## Point du sol (y = 0) sous un point de l'écran.
func _ground_point(at: Vector2) -> Vector3:
	var origin := _camera.project_ray_origin(at)
	var direction := _camera.project_ray_normal(at)
	if absf(direction.y) < 0.001:
		return _focus
	return origin + direction * (-origin.y / direction.y)


# --- Interface -------------------------------------------------------------------------------

func _build_hud() -> void:
	_hud = CanvasLayer.new()
	_hud.layer = 10
	add_child(_hud)
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.theme = UiKit.make_theme(_wt)
	_hud.add_child(root)
	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 18)
	root.add_child(margin)
	var column := VBoxContainer.new()
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	margin.add_child(column)

	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 18)
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_badge = HeroBadge.create(_wt, _dungeons)
	_badge.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	top.add_child(_badge)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_child(spacer)
	_message = UiKit.on_scene(UiKit.label("", 20))
	_message.autowrap_mode = TextServer.AUTOWRAP_OFF
	_message.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	top.add_child(_message)
	var options := UiKit.icon_button("Options", "cog", 52.0)
	UiKit.style_secondary(options, _wt)
	options.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	options.pressed.connect(_show_options)
	top.add_child(options)
	var switch := UiKit.icon_button("Changer de joueur", "two-shadows", 52.0)
	UiKit.style_secondary(switch, _wt)
	switch.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	switch.pressed.connect(_switch_player)
	top.add_child(switch)
	column.add_child(top)

	var gap := Control.new()
	gap.size_flags_vertical = Control.SIZE_EXPAND_FILL
	gap.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(gap)
	var bottom := HBoxContainer.new()
	bottom.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bottom.add_theme_constant_override("separation", 10)
	var hint_text := "Touche un lieu de la carte pour découvrir sa quête"
	if not Quality.is_desktop():
		hint_text = "Touche un lieu pour découvrir sa quête · deux doigts pour zoomer"
	var hint := UiKit.on_scene(UiKit.title(hint_text, 22))
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hint.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hint.size_flags_vertical = Control.SIZE_SHRINK_END
	bottom.add_child(hint)
	# Zoom aux boutons (toujours là : pincer à deux doigts n'est pas facile pour tout le monde).
	for sign in ["−", "+"]:
		var b := UiKit.button(sign, 56.0)
		UiKit.style_secondary(b, _wt)
		b.custom_minimum_size.x = 64
		b.add_theme_font_size_override("font_size", UiKit.font_size(30))
		b.pressed.connect(zoom_by.bind(ZOOM_STEP if sign == "+" else 1.0 / ZOOM_STEP))
		bottom.add_child(b)
		_zoom_buttons.append(b)
	column.add_child(bottom)
	_place_camera()


func _refresh() -> void:
	_badge.refresh()


## Toucher un lieu ouvre son seuil (au lever du doigt, s'il n'a pas glissé). Deux doigts : zoom ;
## un doigt qui glisse : déplacement. Souris : molette et glisser.
func _unhandled_input(event: InputEvent) -> void:
	if _busy or _panel_open:
		return
	if event.device == InputEvent.DEVICE_ID_EMULATION:
		return  # souris imitée à partir du toucher : déjà traité par les événements tactiles
	if event is InputEventScreenTouch:
		_on_touch(event as InputEventScreenTouch)
	elif event is InputEventScreenDrag:
		_on_finger_drag(event as InputEventScreenDrag)
	elif event is InputEventMagnifyGesture:
		zoom_by((event as InputEventMagnifyGesture).factor, event.position)
	elif event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.pressed and mb.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN]:
			zoom_by(ZOOM_STEP if mb.button_index == MOUSE_BUTTON_WHEEL_UP else 1.0 / ZOOM_STEP, mb.position)
		elif mb.button_index == MOUSE_BUTTON_LEFT:
			_press(mb.position) if mb.pressed else _release(mb.position)
	elif event is InputEventMouseMotion and (event as InputEventMouseMotion).button_mask & MOUSE_BUTTON_MASK_LEFT:
		_move((event as InputEventMouseMotion).position, (event as InputEventMouseMotion).relative)


func _on_touch(touch: InputEventScreenTouch) -> void:
	if touch.pressed:
		_touches[touch.index] = touch.position
		if _touches.size() == 1:
			_press(touch.position)
		else:
			_dragged = true  # deux doigts : un zoom, jamais un toucher de lieu
			_pinch = _finger_gap()
		return
	_touches.erase(touch.index)
	if _touches.is_empty():
		_release(touch.position)


func _on_finger_drag(drag: InputEventScreenDrag) -> void:
	if not _touches.has(drag.index):
		return
	_touches[drag.index] = drag.position
	if _touches.size() >= 2:
		var gap := _finger_gap()
		if _pinch > 0.0 and gap > 0.0:
			var fingers: Array = _touches.values()
			zoom_by(gap / _pinch, ((fingers[0] as Vector2) + (fingers[1] as Vector2)) / 2.0)
		_pinch = gap
	else:
		_move(drag.position, drag.relative)


func _finger_gap() -> float:
	var fingers: Array = _touches.values()
	return (fingers[0] as Vector2).distance_to(fingers[1]) if fingers.size() >= 2 else 0.0


func _press(at: Vector2) -> void:
	_press_at = at
	_dragged = false


func _move(at: Vector2, relative: Vector2) -> void:
	if _press_at.x < 0:
		return
	if not _dragged and at.distance_to(_press_at) < DRAG_THRESHOLD:
		return
	_dragged = true
	pan_by(relative)


func _release(at: Vector2) -> void:
	var tapped := _press_at.x >= 0 and not _dragged
	_press_at = Vector2(-1, -1)
	if not tapped:
		return
	var place := pick(at)
	if not place.is_empty():
		get_viewport().set_input_as_handled()
		_open_threshold(place)


## Lieu le plus proche d'un point touché à l'écran (vide si aucun n'est assez près).
func pick(at: Vector2) -> Dictionary:
	var best := {}
	var best_d := PICK_RADIUS
	for p in _places:
		var spot := WorldMapDef.cell_position(p["cell"]) + Vector3(0, 1.0, 0)
		if _camera.is_position_behind(spot):
			continue
		var d := _camera.unproject_position(spot).distance_to(at)
		if d < best_d:
			best_d = d
			best = p
	return best


# --- Seuil d'une quête ---------------------------------------------------------------------

## Maître Ysaline présente le lieu ; « J'y vais » part vers le lieu, « Pas maintenant » reste
## sur la carte (docs/histoire.md §7).
func _open_threshold(p: Dictionary) -> void:
	match p["kind"]:
		"citadel":
			if await _dialog(p["title"], WorldMapDef.CITADEL_TEXT, "", "Entrer", "Pas maintenant"):
				get_tree().change_scene_to_file(Departure.CITADEL_SCENE)
		"village":
			var waiting := _village.pending_quests(DailyChallenge.today())
			var detail := "Aujourd'hui, tout le monde a déjà reçu ton aide. Tu peux quand même te promener." if waiting == 0 \
				else "%d habitant%s attend%s ton aide : trois questions chacun." % [waiting, "s" if waiting > 1 else "", "ent" if waiting > 1 else ""]
			if await _dialog(p["title"], _village.intro, detail, "J'y vais", "Pas maintenant"):
				_launch("village", _village.session_params(), VILLAGE_SCENE)
		"dungeon":
			var d := _dungeons[int(p["index"])]
			if p["status"] == "locked":
				var before := DungeonDef.previous(_dungeons, int(p["index"]))
				await _dialog(d.title, d.threshold, "Ce chemin est encore fermé : reprends d'abord %s dans « %s »." % [before.page, before.title], "D'accord", "")
				return
			if await _dialog(d.title, d.threshold, _dungeon_detail(d, p["status"]), "J'y vais", "Pas maintenant"):
				Session.dungeon_code = d.code
				_launch("donjon", d.session_params(), DUNGEON_SCENE, "donjon_" + d.code)
		"fog":
			await _dialog(p["title"], WorldMapDef.REGIONS[p["region"]]["fog"], "", "D'accord", "")
		"secret":
			await _dialog(p["title"], WorldMapDef.SECRETS[p["id"]]["text"], "", "D'accord", "")


func _dungeon_detail(d: DungeonDef, status: String) -> String:
	var boss := ""
	var last: Array = d.rooms[-1].get("enemies", [])
	if not last.is_empty():
		boss = str(last[0]["name"])
		for article in ["Le ", "La ", "L'"]:  # « et le Grand Diviseur », au fil de la phrase
			if boss.begins_with(article):
				boss = article.to_lower() + boss.substr(article.length())
	var lines := ["%d étages, une énigme, et %s au sommet." % [d.room_count(), boss],
		# Première lettre seulement : les noms propres gardent leur majuscule (les Grecs, les Romains).
		"Ce que tu vas travailler : %s." % (d.chapter_title.left(1).to_lower() + d.chapter_title.substr(1))]
	var checkpoint := int(SaveManager.dungeon(d.code)["checkpoint"])
	if checkpoint > 0:
		lines.append("Tu reprendras à l'étage %d." % (checkpoint + 1))
	elif status == "done":
		lines.append("Tu as déjà repris %s. Les Effaceurs sont revenus : tu peux t'entraîner encore." % d.page)
	return "\n".join(lines)


## Panneau de Maître Ysaline : vrai si l'enfant choisit le bouton principal.
func _dialog(title: String, text: String, detail: String, yes: String, no: String) -> bool:
	_panel_open = true
	var layer := CanvasLayer.new()
	layer.layer = 20
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.5)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(shade)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	center.theme = UiKit.make_theme(_wt)
	layer.add_child(center)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", -14)  # le bandeau chevauche le haut du panneau
	center.add_child(column)
	var heading := UiKit.ribbon(_wt, title, 28)
	heading.z_index = 1
	column.add_child(heading)
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(780, 0)
	column.add_child(panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 12)
	panel.add_child(box)
	var top_gap := Control.new()
	top_gap.custom_minimum_size.y = 6
	box.add_child(top_gap)
	box.add_child(UiKit.speaker(_wt, "Maître Ysaline"))
	box.add_child(UiKit.label("« %s »" % text, 23))
	if detail != "":
		box.add_child(UiKit.divider(_wt, 360))
		var icons := ["castle", "open-book", "scroll-quill"]
		var lines := detail.split("\n")
		for i in lines.size():
			box.add_child(UiKit.info_line(_wt, icons[mini(i, icons.size() - 1)], lines[i], 20))
	if Accessibility.can_speak():
		box.add_child(UiKit.listen_button(_wt, "%s. %s %s" % [title, text, detail], Accessibility.auto_read()))
	var buttons := HBoxContainer.new()
	buttons.add_theme_constant_override("separation", 14)
	box.add_child(buttons)
	var choice: Array[bool] = []
	if no != "":
		var later := UiKit.button(no, 60.0)
		UiKit.style_secondary(later, _wt)
		later.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		later.pressed.connect(func() -> void: choice.append(false))
		buttons.add_child(later)
	var go := UiKit.icon_button(yes, "broadsword" if yes == "J'y vais" else "check-mark", 60.0)
	go.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	go.pressed.connect(func() -> void: choice.append(true))
	buttons.add_child(go)
	add_child(layer)
	go.focus_mode = Control.FOCUS_ALL
	go.grab_focus()  # Entrée (clavier du PC) valide le bouton principal
	while choice.is_empty():
		await get_tree().process_frame
	layer.queue_free()
	_panel_open = false
	return choice[0]


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


func _show_options() -> void:
	if _busy or _panel_open:
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
	_panel_open = true
	panel.closed.connect(func() -> void:
		layer.queue_free()
		_panel_open = false)


func _switch_player() -> void:
	if _busy:
		return
	_busy = true
	await Session.logout()
	get_tree().change_scene_to_file("res://scenes/profile/profile_select.tscn")


func _rebuild() -> void:
	if is_inside_tree() and get_tree().current_scene == self and not _busy:
		_busy = true
		get_tree().reload_current_scene.call_deferred()


## Développement, PC uniquement : `--goto=…` passe par la Citadelle (qui lance l'activité) ;
## `--seuil=<id>` ouvre le seuil d'un lieu (captures d'écran) ; `--places=1` affiche la position
## des lieux à l'écran. Vrai si l'on quitte la carte.
func _dev_goto() -> bool:
	if OS.has_feature("web"):
		return false
	if Quality.option("goto") not in ["", "carte"]:
		get_tree().change_scene_to_file(Departure.CITADEL_SCENE)
		return true
	if Quality.option("places") != "":
		# Positions à l'écran des lieux (scripts de test du navigateur, tools/e2e).
		await get_tree().process_frame
		for p in _places:
			var at := _camera.unproject_position(WorldMapDef.cell_position(p["cell"]) + Vector3(0, 1.0, 0))
			print("lieu %s %d %d" % [p["id"], roundi(at.x), roundi(at.y)])
	var wanted := Quality.option("seuil")
	if wanted != "":
		SaveManager.mark_story(Prologue.STORY_KEY)
		SaveManager.mark_story("welcome")
		for p in _places:
			if p["id"] == wanted:
				_open_threshold(p)
		return true
	return false
