class_name Prologue
extends Node3D
## Prologue de l'histoire (docs/histoire.md §8) : la nuit où Malvrek a arraché les pages de la
## Grande Chronique, et Maître Ysaline qui confie la quête au héros. Cinq tableaux dans une salle
## de la Citadelle (pièces KayKit, personnages et renard du jeu) : la caméra change de place, la
## lumière et les personnages changent, un texte court s'affiche (« Écouter », « Passer »).
## Vu une fois au premier passage sur la carte (`SaveManager.story_seen(STORY_KEY)`) ; se revoit
## depuis la Citadelle. Revient ensuite à la scène d'où l'on vient (`return_to`).

const SCENE := "res://scenes/prologue/prologue.tscn"
const STORY_KEY := "prologue"
const DUNGEON := "res://assets/kaykit/dungeon/%s.glb"
const BOOK := Vector3(8, 1.4, 4.2)  # dessus du pupitre de la Chronique
const FADE := 0.45

## Scène où revenir à la fin (la carte au premier passage, la Citadelle quand on le revoit).
static var return_to := "res://scenes/world_map/world_map.tscn"

## Tableaux : décor (`shot`), qui parle, titre et texte par monde (Jules : chaleureux et drôle ;
## Tom : sobre). Phrases courtes, une idée par phrase (règle « dys »).
const PAGES := [
	{"shot": "chronique", "speaker": "", "title": "La Grande Chronique",
		"lumineux": "Au cœur du royaume d'Aldoria se dresse la Citadelle des Archives. Elle garde un livre immense : la Grande Chronique. Chaque page garde un savoir : les nombres, les mots, les langues. Grâce à elle, tout le monde sait compter, lire et parler.",
		"brouillard": "Le royaume d'Aldoria tient grâce à un livre : la Grande Chronique. Il repose au cœur de la Citadelle des Archives. Chaque page garde un savoir : les nombres, les mots, les langues. Tant qu'il est entier, personne n'oublie."},
	{"shot": "vol", "speaker": "", "title": "La nuit du vol",
		"lumineux": "Mais une nuit, quelqu'un est entré sans bruit. C'était Malvrek, un ancien Archiviste. Il a arraché les pages de la Chronique, une par une. Puis il les a confiées à ses Effaceurs, qui les ont cachées dans tout le royaume.",
		"brouillard": "Une nuit, Malvrek est revenu. Autrefois, il était Archiviste lui aussi. Il a arraché les pages de la Chronique. Ses Effaceurs les ont emportées aux quatre coins du royaume."},
	{"shot": "oubli", "speaker": "", "title": "Le royaume oublie",
		"lumineux": "Depuis, partout où une page manque, les habitants oublient. Le boulanger ne sait plus compter ses pains. Les livres se vident. Un brouillard gris recouvre les régions : le Brouillard de l'Oubli.",
		"brouillard": "Depuis, là où une page manque, le savoir s'efface. Les calculs se brouillent. Les livres se vident. Le Brouillard de l'Oubli gagne les régions, une à une."},
	{"shot": "ysaline", "speaker": "Maître Ysaline", "title": "Maître Ysaline",
		"lumineux": "Te voilà enfin ! Je suis Maître Ysaline, la gardienne de la Chronique. Je suis la seule à n'avoir rien oublié. Tu es le plus jeune des Archivistes. Tu te trompes parfois ? Tant mieux : c'est comme ça qu'on apprend. Malvrek, lui, n'a jamais accepté de se tromper.",
		"brouillard": "Je suis Maître Ysaline, la gardienne de la Chronique. Je n'ai rien oublié, mais je ne peux pas tout reprendre seule. Tu es le plus jeune des Archivistes. Tu te tromperas : c'est comme ça qu'on apprend. Malvrek n'a jamais accepté l'erreur. C'est ce qui l'a perdu."},
	{"shot": "quete", "speaker": "Maître Ysaline", "title": "Ta quête",
		"lumineux": "Va retrouver les pages, une à une. Chaque Effaceur vaincu t'en rendra une. Avant chaque chemin, je te dirai ce qui t'attend. Je t'attends ici, à la Citadelle, au centre de la carte. En route, jeune Archiviste !",
		"brouillard": "Retrouve les pages, une à une. Chaque Effaceur vaincu t'en rendra une. Avant chaque chemin, je te dirai ce qui t'attend. La Citadelle sera ton point de départ, au centre de la carte. La Chronique compte sur toi."},
]

## Caméra de chaque tableau : position, point regardé.
const SHOTS := {
	# Le point regardé est sous les personnages : ils restent dans le haut de l'image, au-dessus
	# du panneau de texte.
	"chronique": [Vector3(8, 4.2, 12.5), Vector3(8, 0.2, 4.6)],
	"vol": [Vector3(8.6, 3.4, 11.5), Vector3(8.4, 0.2, 3.8)],
	"oubli": [Vector3(6.5, 3.6, 13.5), Vector3(6.2, 0.0, 5.8)],
	"ysaline": [Vector3(8.4, 3.3, 15.0), Vector3(8.2, 0.4, 6.6)],
	"quete": [Vector3(7.2, 2.6, 13.5), Vector3(7.6, 0.0, 6.8)],
}

var page := -1
var _wt: WorldTheme
var _material: StandardMaterial3D
var _env: Environment
var _sun: DirectionalLight3D
var _camera: Camera3D
var _pages_material: StandardMaterial3D  # pages du livre : brillent quand la Chronique est entière
var _book_glow: Node3D
var _paper: CPUParticles3D  # pages arrachées qui s'envolent
var _sparkles: CPUParticles3D
var _hero: Fighter
var _pet: Companion
var _ysaline: Fighter
var _malvrek: Fighter
var _villager: Fighter
var _question: Label3D
var _ui: CanvasLayer
var _fade: ColorRect
var _panel_box: VBoxContainer
var _next: Button
var _done := false
var _time := 0.0


## Lance le prologue ; `back` : scène où revenir à la fin.
static func play(tree: SceneTree, back: String) -> void:
	return_to = back
	tree.change_scene_to_file(SCENE)


func _ready() -> void:
	_wt = WorldTheme.for_world(Session.world())
	_build_set()
	_build_cast()
	_build_ui()
	var start := 0
	if not OS.has_feature("web") and Quality.option("tableau") != "":
		start = clampi(int(Quality.option("tableau")) - 1, 0, PAGES.size() - 1)  # captures d'écran
	show_page(start, false)


func _process(delta: float) -> void:
	_time += delta
	if _question.visible:
		_question.position.y = 2.7 + 0.1 * sin(_time * 3.0)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		finish()


# --- Déroulé ------------------------------------------------------------------------------------

func text_of(i: int) -> String:
	return str(PAGES[i][_wt.id if PAGES[i].has(_wt.id) else "lumineux"])


func show_page(i: int, animate := true) -> void:
	if animate and not Accessibility.on("calm"):
		await _fade_to(1.0)
	page = i
	var shot: String = PAGES[i]["shot"]
	_stage(shot)
	var cam: Array = SHOTS[shot]
	_camera.position = cam[0]
	_camera.look_at(cam[1])
	_fill_panel(i)
	if animate and not Accessibility.on("calm"):
		await _fade_to(0.0)


func next() -> void:
	if _done:
		return
	if page + 1 >= PAGES.size():
		finish()
	else:
		_next.disabled = true
		await show_page(page + 1)
		_next.disabled = false


## Fin ou « Passer » : l'histoire est vue (rangée dans la partie), retour à la scène d'origine.
func finish() -> void:
	if _done:
		return
	_done = true
	SaveManager.mark_story(STORY_KEY)
	Accessibility.stop_speaking()
	if is_inside_tree() and return_to != "":  # vide : les tests restent sur place
		get_tree().change_scene_to_file(return_to)


func _fade_to(alpha: float) -> void:
	var tween := create_tween()
	tween.tween_property(_fade, "color:a", alpha, FADE)
	await tween.finished


## Met en scène un tableau : lumière, personnages, livre.
func _stage(shot: String) -> void:
	var night := shot == "vol"
	var fog := shot == "oubli"
	_env.background_color = Color("#0b1020") if night else (Color("#5d6470") if fog else _wt.background)
	var day := Color(1.0, 0.9, 0.78) if _wt.id == "lumineux" else Color(0.78, 0.84, 1.0)  # Tom : plus froid
	_env.ambient_light_color = Color(0.35, 0.42, 0.75) if night else (Color(0.7, 0.72, 0.78) if fog else day)
	_env.ambient_light_energy = 0.45 if night else 0.7
	_env.fog_enabled = fog
	_sun.light_color = Color(0.55, 0.65, 1.0) if night else _wt.sun_color
	_sun.light_energy = 0.4 if night else (0.6 if fog else 1.0)
	var whole := shot == "chronique"
	_pages_material.emission_energy_multiplier = 1.6 if whole else (0.5 if shot == "quete" else 0.0)
	_pages_material.albedo_color = Color("#fff4d6") if whole or shot == "quete" else Color("#b9b3a6")
	_book_glow.visible = whole or shot == "quete"
	_paper.emitting = night
	_paper.visible = night
	_sparkles.emitting = whole and not Accessibility.on("calm")
	_sparkles.visible = _sparkles.emitting

	_ysaline.visible = shot in ["chronique", "ysaline", "quete"]
	_malvrek.visible = night
	_villager.visible = fog
	_question.visible = fog
	_hero.visible = shot in ["ysaline", "quete"]
	if _pet != null:
		_pet.visible = _hero.visible
	match shot:
		"chronique":
			_place(_ysaline, Vector3(10.2, 0, 4.6), Vector3(8, 0, 9))
			_ysaline.loop("Idle")
		"vol":
			_place(_malvrek, Vector3(9.6, 0, 3.0), BOOK)
			_malvrek.loop("Spellcasting")
		"oubli":
			_place(_villager, Vector3(6.0, 0, 6.5), Vector3(6.5, 0, 13))
			_villager.loop("Idle")
		"ysaline":
			_place(_ysaline, Vector3(9.4, 0, 6.2), Vector3(6.6, 0, 7.6))
			_place(_hero, Vector3(6.6, 0, 7.6), Vector3(9.4, 0, 6.2))
			_ysaline.play(["Interact"])
			_hero.loop("Idle")
		"quete":
			_place(_ysaline, Vector3(9.6, 0, 5.4), Vector3(7, 0, 8))
			_place(_hero, Vector3(7, 0, 8), Vector3(7, 0, 14))
			_hero.play(["Cheer"])
			_ysaline.play(["Spellcast_Raise"])
	if _pet != null and _hero.visible:
		_pet.position = _hero.position + Vector3(-1.3, 0, 0.6)
		_pet.rotation.y = _hero.rotation.y
		if shot == "quete":
			_pet.celebrate()


func _place(who: Node3D, at: Vector3, facing: Vector3) -> void:
	who.position = at
	var d := facing - at
	who.rotation.y = atan2(d.x, d.z)  # les personnages KayKit regardent vers +z


# --- Décor -------------------------------------------------------------------------------------

## Salle de la Citadelle : sol, murs d'étagères, fenêtre, pupitre de la Chronique (un seul
## maillage fusionné, comme les salles des donjons).
func _build_set() -> void:
	var settings := Quality.settings()
	_env = Environment.new()
	_env.background_mode = Environment.BG_COLOR
	_env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	_env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	_env.fog_light_color = Color(0.56, 0.6, 0.68)  # gris bleuté : le Brouillard de l'Oubli
	_env.fog_density = 0.05
	var world_env := WorldEnvironment.new()
	world_env.environment = _env
	add_child(world_env)
	_sun = DirectionalLight3D.new()
	_sun.rotation_degrees = Vector3(-50, -30, 0)
	_sun.shadow_enabled = settings.shadows
	add_child(_sun)
	_camera = Camera3D.new()
	_camera.fov = 45.0
	add_child(_camera)
	_camera.make_current()

	_material = StandardMaterial3D.new()
	_material.albedo_texture = load("res://assets/kaykit/dungeon/dungeon_texture.png")
	_material.roughness = 0.8
	if settings.vertex_shading:
		_material.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
	var room := Node3D.new()
	room.name = "Static"
	add_child(room)
	for ix in 4:
		for iz in 4:
			_piece(room, "floor_wood_large" if (ix + iz) % 2 == 0 else "floor_tile_large", Vector3(2 + ix * 4, 0, 2 + iz * 4))
	var back := ["wall_shelves", "wall_window_open", "wall_shelves", "wall_shelves"]
	for ix in 4:
		_piece(room, back[ix], Vector3(2 + ix * 4, 0, 0))
	for iz in 3:
		_piece(room, "wall_shelves" if iz == 1 else "wall", Vector3(0, 0, 2 + iz * 4), 90.0)
		_piece(room, "wall_shelves" if iz == 1 else "wall", Vector3(16, 0, 2 + iz * 4), -90.0)
	for x in [0.0, 16.0]:
		_piece(room, "pillar_decorated", Vector3(x, 0, 0))
	_piece(room, "banner_patternC_blue", Vector3(4, 0, 0.05))
	_piece(room, "banner_patternA_blue", Vector3(12, 0, 0.05))
	_piece(room, "column", Vector3(BOOK.x, 0, BOOK.z))  # pupitre
	_piece(room, "candle_triple", Vector3(6.6, 0, 3.2))
	_piece(room, "candle_triple", Vector3(9.6, 0, 3.0))
	_piece(room, "table_long_decorated_A", Vector3(13.4, 0, 9.5))
	_piece(room, "trunk_large_A", Vector3(2.2, 0, 3.0), 20.0)
	_piece(room, "shelves", Vector3(3.0, 0, 11.0), 90.0)
	if Quality.option("merge", "1") != "0":
		StaticBatcher.merge(room, _material)
	_build_book(settings)


## La Grande Chronique, ouverte sur son pupitre : deux pages qui brillent quand elle est entière.
func _build_book(settings: Dictionary) -> void:
	var book := Node3D.new()
	book.position = BOOK
	book.rotation_degrees.x = 18.0  # incliné vers la salle
	book.scale = Vector3.ONE * 1.7  # un livre immense
	add_child(book)
	var cover := StandardMaterial3D.new()
	cover.albedo_color = Color("#6b3a2a")
	_pages_material = StandardMaterial3D.new()
	_pages_material.emission_enabled = true
	_pages_material.emission = Color("#ffd88a")
	if settings.vertex_shading:
		cover.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
		_pages_material.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
	for side in [-1.0, 1.0]:
		var half := MeshInstance3D.new()
		var cover_box := BoxMesh.new()
		cover_box.size = Vector3(0.62, 0.05, 0.9)
		cover_box.material = cover
		half.mesh = cover_box
		half.position = Vector3(side * 0.31, 0.03, 0)
		half.rotation.z = -side * 0.12
		book.add_child(half)
		var leaves := MeshInstance3D.new()
		var leaves_box := BoxMesh.new()
		leaves_box.size = Vector3(0.56, 0.08, 0.82)
		leaves_box.material = _pages_material
		leaves.mesh = leaves_box
		leaves.position = Vector3(side * 0.3, 0.09, 0)
		leaves.rotation.z = -side * 0.12
		book.add_child(leaves)
	var gold := Color("#ffcf6a")
	match settings.lights:
		"real":
			var light := OmniLight3D.new()
			light.light_color = gold
			light.light_energy = 1.6
			light.omni_range = 6.0
			light.position = BOOK + Vector3(0, 0.8, 0.6)
			_book_glow = light
		_:
			_book_glow = MobileLighting.make_fake_light(gold, 1.8, Vector2(0, 0.8), 2.6, 7.0)
			_book_glow.position = BOOK + Vector3(0, 0.4, 0.3)
	add_child(_book_glow)

	_paper = CPUParticles3D.new()
	_paper.position = BOOK + Vector3(0, 0.3, 0)
	_paper.amount = 8 if Accessibility.on("calm") else 26
	_paper.lifetime = 3.2
	_paper.direction = Vector3(0.4, 1, 0.3)
	_paper.spread = 70.0
	_paper.initial_velocity_min = 1.2
	_paper.initial_velocity_max = 2.6
	_paper.gravity = Vector3(0.6, -0.4, 0)
	_paper.angular_velocity_min = -180.0
	_paper.angular_velocity_max = 180.0
	var paper_material := StandardMaterial3D.new()
	paper_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	paper_material.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	paper_material.albedo_color = Color("#f3ead2")
	paper_material.cull_mode = BaseMaterial3D.CULL_DISABLED
	var sheet := QuadMesh.new()
	sheet.size = Vector2(0.28, 0.36)
	sheet.material = paper_material
	_paper.mesh = sheet
	add_child(_paper)

	_sparkles = CPUParticles3D.new()
	_sparkles.position = BOOK + Vector3(0, 0.4, 0)
	_sparkles.amount = 20
	_sparkles.lifetime = 2.4
	_sparkles.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	_sparkles.emission_sphere_radius = 0.5
	_sparkles.direction = Vector3.UP
	_sparkles.spread = 25.0
	_sparkles.initial_velocity_min = 0.3
	_sparkles.initial_velocity_max = 0.7
	_sparkles.gravity = Vector3.ZERO
	_sparkles.mesh = DungeonRoom.particle_quad(Color(1.0, 0.85, 0.45, 0.8), 0.12)
	add_child(_sparkles)


func _piece(root: Node3D, piece: String, pos: Vector3, yaw := 0.0) -> void:
	var node: Node3D = (load(DUNGEON % piece) as PackedScene).instantiate()
	node.position = pos
	node.rotation_degrees.y = yaw
	for child in node.find_children("*", "MeshInstance3D", true, false):
		(child as MeshInstance3D).material_override = _material
	root.add_child(node)


# --- Personnages --------------------------------------------------------------------------------

## Le héros (son apparence), son renard dans le monde de Jules, Maître Ysaline (mage à la cape
## dorée, bâton), Malvrek (rôdeur encapuchonné, violet sombre, sans arme) et un habitant qui a
## tout oublié.
func _build_cast() -> void:
	_hero = Fighter.create_hero(SaveManager.look(), _wt.hero_name, 1)
	add_child(_hero)
	if _wt.companion:
		_pet = Companion.create(SaveManager.look())
		add_child(_pet)
	_ysaline = _character("Mage", "Maître Ysaline",
		{"main": "2H_Staff", "off": "", "head": true, "cape": true, "cape_color": "or"})
	_malvrek = _character("Rogue_Hooded", "Malvrek",
		{"main": "", "off": "", "head": false, "cape": true, "cape_color": "violet"})
	_tint(_malvrek, Color(0.55, 0.45, 0.72))
	_villager = _character("Barbarian", "Le boulanger",
		{"main": "Mug", "off": "", "head": false, "cape": false, "cape_color": "origine"})
	_question = Label3D.new()
	_question.text = "?"
	_question.font = Accessibility.font()
	_question.font_size = 160
	_question.pixel_size = 0.01
	_question.outline_size = 18
	_question.modulate = Color("#ffd447")
	_question.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_question.position = Vector3(6.9, 2.7, 6.5)  # à côté de la tête du boulanger
	add_child(_question)
	if Quality.settings().vertex_shading:
		for who: Node3D in [_hero, _ysaline, _malvrek, _villager]:
			MobileLighting.apply_vertex_shading(who)


func _character(model: String, display: String, look: Dictionary) -> Fighter:
	var f := Fighter.create(model, display, 1)
	Wardrobe.dress(f.get_child(0) as Node3D, model, look)
	add_child(f)
	return f


## Teinte un personnage (Malvrek : plus sombre que le héros encapuchonné de Tom).
func _tint(who: Node3D, color: Color) -> void:
	for node in who.find_children("*", "MeshInstance3D", true, false):
		var mesh_instance := node as MeshInstance3D
		for surface in mesh_instance.mesh.get_surface_count():
			var source := mesh_instance.get_active_material(surface) as BaseMaterial3D
			if source == null:
				continue
			var mat := source.duplicate() as BaseMaterial3D
			mat.albedo_color = mat.albedo_color * color
			mesh_instance.set_surface_override_material(surface, mat)


# --- Interface ----------------------------------------------------------------------------------

func _build_ui() -> void:
	_ui = CanvasLayer.new()
	_ui.layer = 10
	add_child(_ui)
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.theme = UiKit.make_theme(_wt)
	_ui.add_child(root)
	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 20)
	root.add_child(margin)
	var column := VBoxContainer.new()
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	margin.add_child(column)
	var top := HBoxContainer.new()
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(top)
	var heading := UiKit.label("Prologue", 22, Color.WHITE)
	heading.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.7))
	heading.add_theme_constant_override("outline_size", 8)
	heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(heading)
	var skip := UiKit.button("Passer", 52.0)
	UiKit.style_secondary(skip, _wt)
	skip.custom_minimum_size.x = 150
	skip.pressed.connect(finish)
	top.add_child(skip)
	var gap := Control.new()
	gap.size_flags_vertical = Control.SIZE_EXPAND_FILL
	gap.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(gap)
	var panel := PanelContainer.new()
	column.add_child(panel)
	_panel_box = VBoxContainer.new()
	_panel_box.add_theme_constant_override("separation", 10)
	panel.add_child(_panel_box)

	_fade = ColorRect.new()
	_fade.color = Color(0, 0, 0, 0)
	_fade.set_anchors_preset(Control.PRESET_FULL_RECT)
	_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(_fade)


func _fill_panel(i: int) -> void:
	for child in _panel_box.get_children():
		child.queue_free()
	var entry: Dictionary = PAGES[i]
	var title_row := HBoxContainer.new()
	var title := UiKit.label(entry["title"], 30, _wt.accent)
	title.autowrap_mode = TextServer.AUTOWRAP_OFF  # dans une rangée, un retour à la ligne la réduirait à une lettre
	title_row.add_child(title)
	var count := UiKit.label("%d / %d" % [i + 1, PAGES.size()], 18, _wt.text_dim)
	count.autowrap_mode = TextServer.AUTOWRAP_OFF
	count.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	count.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	title_row.add_child(count)
	_panel_box.add_child(title_row)
	var text := text_of(i)
	if entry["speaker"] != "":
		_panel_box.add_child(UiKit.label("%s :" % entry["speaker"], 19, _wt.text_dim))
		text = "« %s »" % text
	_panel_box.add_child(UiKit.label(text, 23))
	var buttons := HBoxContainer.new()
	buttons.add_theme_constant_override("separation", 14)
	_panel_box.add_child(buttons)
	if Accessibility.can_speak():
		buttons.add_child(UiKit.listen_button(_wt, "%s. %s" % [entry["title"], text_of(i)], Accessibility.auto_read()))
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	buttons.add_child(spacer)
	_next = UiKit.button("Commencer la quête" if i == PAGES.size() - 1 else "Suivant", 60.0)
	_next.custom_minimum_size.x = 260
	_next.pressed.connect(next)
	buttons.add_child(_next)
	_next.focus_mode = Control.FOCUS_ALL
	_next.grab_focus.call_deferred()  # Entrée (clavier du PC) passe au tableau suivant
