class_name DungeonRoom
extends Node3D
## Salle de donjon KayKit (grille de 4 m) : environnement, lumière, sol, murs,
## décor, torches et poussière. Respecte les règles de performance tablette
## (docs/perf-log.md) : géométrie statique fusionnée, matériau partagé, et selon
## `Quality.settings()` fausses lumières et éclairage par sommet.
##
## Utilisée par la scène d'étalonnage et par le combat.

const TILE := 4.0
const ROOM := 5  # tuiles par côté
const DUNGEON := "res://assets/kaykit/dungeon/%s.glb"

## Couleurs d'ambiance (surchargées par le monde : WorldTheme).
var background := Color(0.06, 0.05, 0.09)
var ambient := Color(0.45, 0.42, 0.55)
var ambient_energy := 0.6
var sun_color := Color(1.0, 0.86, 0.68)
var sun_energy := 1.1
var torch_color := Color(1.0, 0.62, 0.28)
## Rangées de dalles supplémentaires côté caméra (sol visible jusqu'au bas de l'écran).
var front_rows := 0
## Sol uni, sans dalles à éboulis (dessins au sol lisibles : stand de tir).
var plain_floor := false
## Gouffre du nord au sud (pont des fractions) : pas de dalle ni de décor là où |x| < chasm,
## ni de meuble dans l'allée du pont (|z| < 5).
var chasm := 0.0

var sun: DirectionalLight3D
var built_settings: Dictionary
var _material: StandardMaterial3D
var _static_root: Node3D
var _particles: Array[CPUParticles3D] = []
var _particle_base: Array[int] = []


func use_theme(wt: WorldTheme) -> DungeonRoom:
	background = wt.background
	ambient = wt.ambient
	ambient_energy = wt.ambient_energy
	sun_color = wt.sun_color
	sun_energy = wt.sun_energy
	torch_color = wt.torch_color
	return self


## Construit la salle (à appeler une fois la salle dans l'arbre).
func build() -> void:
	built_settings = Quality.settings()
	_material = StandardMaterial3D.new()
	_material.albedo_texture = load("res://assets/kaykit/dungeon/dungeon_texture.png")
	_material.roughness = 0.8
	if built_settings.vertex_shading:
		_material.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
	_static_root = Node3D.new()
	_static_root.name = "Static"
	add_child(_static_root)

	_build_environment()
	_build_structure()
	_build_props()
	if Quality.option("merge", "1") != "0":
		StaticBatcher.merge(_static_root, _material)
	apply_quality()


## Réglages non structurels (ombres, particules) : sans reconstruction.
func apply_quality() -> void:
	var s := Quality.settings()
	sun.shadow_enabled = s.shadows
	Quality.dress_sun(sun)
	for i in _particles.size():
		_particles[i].emitting = s.particle_ratio > 0.0
		_particles[i].visible = s.particle_ratio > 0.0
		_particles[i].amount = maxi(1, int(_particle_base[i] * s.particle_ratio))


## Prépare un personnage pour cette salle (éclairage par sommet si besoin).
func adapt_character(character: Node3D) -> void:
	if built_settings.vertex_shading:
		MobileLighting.apply_vertex_shading(character)


## Avec les vraies lumières (profil haut), les torches et l'éclairage par pixel
## ajoutent beaucoup de lumière : on atténue soleil et ambiance pour ne pas surexposer.
const REAL_LIGHTS_DIMMING := 0.75


func _build_environment() -> void:
	var dimming := REAL_LIGHTS_DIMMING if built_settings.lights == "real" else 1.0
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = background
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = ambient
	env.ambient_light_energy = ambient_energy * dimming
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var world_env := WorldEnvironment.new()
	world_env.environment = env
	add_child(world_env)

	sun = DirectionalLight3D.new()
	sun.light_color = sun_color
	sun.light_energy = sun_energy * dimming
	sun.rotation_degrees = Vector3(-55, -35, 0)
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = 90.0
	add_child(sun)


func _build_structure() -> void:
	var half := (ROOM - 1) * TILE / 2.0  # centre de la première tuile
	for ix in ROOM:
		for iz in ROOM + front_rows:
			var tile := "floor_tile_large_rocks" if (ix + iz) % 3 == 0 and not plain_floor else "floor_tile_large"
			if absf(ix * TILE - half) >= chasm:
				_place(tile, Vector3(ix * TILE - half, 0, iz * TILE - half))
	var back_z := -half - TILE / 2.0
	var side_x := half + TILE / 2.0
	for ix in ROOM:
		var piece := "wall_doorway" if ix == ROOM / 2 else ("wall_arched" if ix % 2 == 1 else "wall")
		_place(piece, Vector3(ix * TILE - half, 0, back_z))
	for iz in ROOM + front_rows:
		_place("wall", Vector3(-side_x, 0, iz * TILE - half), 90.0)
		_place("wall", Vector3(side_x, 0, iz * TILE - half), -90.0)
	_place("pillar_decorated", Vector3(-side_x, 0, back_z))
	_place("pillar_decorated", Vector3(side_x, 0, back_z))


func _build_props() -> void:
	var back_z := -(ROOM - 1) * TILE / 2.0 - TILE / 2.0
	for x in [-6.0, 6.0]:
		_place("torch_mounted", Vector3(x, 2.2, back_z + 0.1))
		_add_torch(Vector3(x, 3.0, back_z + 0.7))
	_place("banner_patternA_red", Vector3(-2.0, 0, back_z + 0.05))
	_place("banner_patternA_blue", Vector3(2.0, 0, back_z + 0.05))
	_place("barrel_large", Vector3(-8.0, 0, -6.5))
	_place("barrel_small_stack", Vector3(-6.2, 0, -7.0))
	_place("crates_stacked", Vector3(8.0, 0, -6.0), -20.0)
	_place("keg_decorated", Vector3(7.8, 0, 2.5), 90.0)
	_place("chest_gold", Vector3(0, 0, -6.5))
	_place("table_medium_decorated_A", Vector3(-7.0, 0, 3.0), 90.0)
	_place("candle_triple", Vector3(4.5, 0, -7.5))
	if not plain_floor:
		_place("rubble_half", Vector3(5.5, 0, 6.5), 30.0)
	_place("column", Vector3(-8.4, 0, 7.6))
	_add_dust()


func _place(piece: String, pos: Vector3, yaw_deg := 0.0) -> Node3D:
	var structure := piece.begins_with("wall") or piece.begins_with("banner") or piece.begins_with("floor") 		or piece.begins_with("pillar") or piece.begins_with("torch")
	if chasm > 0.0 and not structure and (absf(pos.x) < chasm or absf(pos.z) < 5.0):
		return null  # rien ne flotte au-dessus du gouffre ; le passage du pont reste libre
	var node: Node3D = (load(DUNGEON % piece) as PackedScene).instantiate()
	node.position = pos
	node.rotation_degrees.y = yaw_deg
	# Un seul matériau pour tout le donjon : fusion possible en un appel de dessin.
	for child in node.find_children("*", "MeshInstance3D", true, false):
		(child as MeshInstance3D).material_override = _material
	_static_root.add_child(node)
	return node


func _add_torch(pos: Vector3) -> void:
	match built_settings.lights:
		"fake":
			var fake_pos := pos + Vector3(0, -0.2, 0.2)
			var fake := MobileLighting.make_fake_light(torch_color, fake_pos.y)
			fake.position = fake_pos
			add_child(fake)
		"real":
			var light := OmniLight3D.new()
			light.position = pos
			light.light_color = torch_color
			light.light_energy = 1.3
			light.omni_range = 7.0
			add_child(light)

	var flame := CPUParticles3D.new()
	flame.position = pos + Vector3(0, -0.3, -0.2)
	flame.amount = 24
	flame.lifetime = 0.6
	flame.direction = Vector3.UP
	flame.spread = 15.0
	flame.initial_velocity_min = 0.6
	flame.initial_velocity_max = 1.2
	flame.gravity = Vector3(0, 0.5, 0)
	flame.mesh = particle_quad(torch_color, 0.25)
	_register_particles(flame)


func _add_dust() -> void:
	var dust := CPUParticles3D.new()
	dust.position = Vector3(0, 2.5, 0)
	dust.amount = 80
	dust.lifetime = 6.0
	dust.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	dust.emission_box_extents = Vector3(9, 2, 9)
	dust.direction = Vector3.UP
	dust.spread = 180.0
	dust.initial_velocity_min = 0.05
	dust.initial_velocity_max = 0.2
	dust.gravity = Vector3.ZERO
	dust.mesh = particle_quad(Color(0.5, 0.42, 0.3, 0.5), 0.08)
	_register_particles(dust)


func _register_particles(p: CPUParticles3D) -> void:
	_particles.append(p)
	_particle_base.append(p.amount)
	add_child(p)


## Quads partagés, par couleur et taille : chaque coup ou étincelle réutilise le même maillage
## et le même matériau au lieu d'en allouer de nouveaux (lecture seule : ne pas les modifier).
static var _quads: Dictionary = {}


## Quad additif face caméra pour les particules (flammes, étincelles, poussière).
static func particle_quad(color: Color, size: float) -> QuadMesh:
	var key := "%s/%s" % [color.to_html(), size]
	if _quads.has(key):
		return _quads[key]
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	mat.albedo_color = color
	mat.vertex_color_use_as_albedo = true
	var quad := QuadMesh.new()
	quad.size = Vector2(size, size)
	quad.material = mat
	_quads[key] = quad
	return quad
