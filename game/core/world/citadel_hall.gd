class_name CitadelHall
extends Node3D
## Salle de la Citadelle des Archives (docs/histoire.md §5) : sol, murs d'étagères, fenêtre et la
## Grande Chronique ouverte sur son pupitre. Décor du prologue et fond des écrans de menu
## (`UiKit.backdrop`). Un seul maillage fusionné (StaticBatcher), lumière selon `Quality`.

const DUNGEON := "res://assets/kaykit/dungeon/%s.glb"
const BOOK := Vector3(8, 1.4, 4.2)  # dessus du pupitre de la Chronique

var env: Environment
var sun: DirectionalLight3D
var pages_material: StandardMaterial3D  # pages du livre : brillent quand la Chronique est entière
var book_glow: Node3D
var paper: CPUParticles3D  # pages arrachées qui s'envolent (prologue)
var sparkles: CPUParticles3D
var _material: StandardMaterial3D


## Lumière de jour d'un monde (Jules : chaude ; Tom : plus froide), livre entier et brillant.
func daylight(wt: WorldTheme) -> void:
	env.background_color = wt.background
	env.ambient_light_color = Color(1.0, 0.9, 0.78) if wt.id == "lumineux" else Color(0.78, 0.84, 1.0)
	env.ambient_light_energy = 0.7
	env.fog_enabled = false
	sun.light_color = wt.sun_color
	sun.light_energy = 1.0
	pages_material.emission_energy_multiplier = 1.6
	pages_material.albedo_color = Color("#fff4d6")
	book_glow.visible = true
	paper.emitting = false
	paper.visible = false
	sparkles.emitting = not Accessibility.on("calm")
	sparkles.visible = sparkles.emitting


## Personnage KayKit habillé (Maître Ysaline, Malvrek, un habitant), ajouté à `parent`.
static func character(parent: Node, model: String, display: String, look: Dictionary) -> Fighter:
	var f := Fighter.create(model, display, 1)
	Wardrobe.dress(f.get_child(0) as Node3D, model, look)
	parent.add_child(f)
	return f


## Maître Ysaline : mage à la cape dorée, bâton.
static func ysaline(parent: Node) -> Fighter:
	return character(parent, "Mage", "Maître Ysaline",
		{"main": "2H_Staff", "off": "", "head": true, "cape": true, "cape_color": "or"})


## Place un personnage et le tourne vers un point (les personnages KayKit regardent vers +z).
static func place(who: Node3D, at: Vector3, facing: Vector3) -> void:
	who.position = at
	var d := facing - at
	who.rotation.y = atan2(d.x, d.z)


## Salle de la Citadelle : sol, murs d'étagères, fenêtre, pupitre de la Chronique (un seul
## maillage fusionné, comme les salles des donjons).
func build() -> void:
	var settings := Quality.settings()
	env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.fog_light_color = Color(0.56, 0.6, 0.68)  # gris bleuté : le Brouillard de l'Oubli
	env.fog_density = 0.05
	var world_env := WorldEnvironment.new()
	world_env.environment = env
	add_child(world_env)
	sun = DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-50, -30, 0)
	sun.shadow_enabled = settings.shadows
	add_child(sun)
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
	# Un étage de murs au-dessus : la salle remplit le fond des menus (pas de vide au-dessus des murs).
	for ix in 4:
		_piece(room, "wall_arched" if ix % 2 == 0 else "wall", Vector3(2 + ix * 4, 4, 0))
	for iz in 3:
		_piece(room, "wall", Vector3(0, 4, 2 + iz * 4), 90.0)
		_piece(room, "wall", Vector3(16, 4, 2 + iz * 4), -90.0)
	for x in [0.0, 16.0]:
		_piece(room, "pillar_decorated", Vector3(x, 0, 0))
		_piece(room, "pillar_decorated", Vector3(x, 4, 0))
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
	pages_material = StandardMaterial3D.new()
	pages_material.emission_enabled = true
	pages_material.emission = Color("#ffd88a")
	if settings.vertex_shading:
		cover.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
		pages_material.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
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
		leaves_box.material = pages_material
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
			book_glow = light
		_:
			book_glow = MobileLighting.make_fake_light(gold, 1.8, Vector2(0, 0.8), 2.6, 7.0)
			book_glow.position = BOOK + Vector3(0, 0.4, 0.3)
	add_child(book_glow)

	paper = CPUParticles3D.new()
	paper.position = BOOK + Vector3(0, 0.3, 0)
	paper.amount = 8 if Accessibility.on("calm") else 26
	paper.lifetime = 3.2
	paper.direction = Vector3(0.4, 1, 0.3)
	paper.spread = 70.0
	paper.initial_velocity_min = 1.2
	paper.initial_velocity_max = 2.6
	paper.gravity = Vector3(0.6, -0.4, 0)
	paper.angular_velocity_min = -180.0
	paper.angular_velocity_max = 180.0
	var sheet_material := StandardMaterial3D.new()
	sheet_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sheet_material.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	sheet_material.albedo_color = Color("#f3ead2")
	sheet_material.cull_mode = BaseMaterial3D.CULL_DISABLED
	var sheet := QuadMesh.new()
	sheet.size = Vector2(0.28, 0.36)
	sheet.material = sheet_material
	paper.mesh = sheet
	add_child(paper)

	sparkles = CPUParticles3D.new()
	sparkles.position = BOOK + Vector3(0, 0.4, 0)
	sparkles.amount = 20
	sparkles.lifetime = 2.4
	sparkles.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	sparkles.emission_sphere_radius = 0.5
	sparkles.direction = Vector3.UP
	sparkles.spread = 25.0
	sparkles.initial_velocity_min = 0.3
	sparkles.initial_velocity_max = 0.7
	sparkles.gravity = Vector3.ZERO
	sparkles.mesh = DungeonRoom.particle_quad(Color(1.0, 0.85, 0.45, 0.8), 0.12)
	add_child(sparkles)


func _piece(root: Node3D, piece: String, pos: Vector3, yaw := 0.0) -> void:
	var node: Node3D = (load(DUNGEON % piece) as PackedScene).instantiate()
	node.position = pos
	node.rotation_degrees.y = yaw
	for child in node.find_children("*", "MeshInstance3D", true, false):
		(child as MeshInstance3D).material_override = _material
	root.add_child(node)


