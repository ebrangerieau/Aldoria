class_name DungeonLevel
extends Node3D
## Donjon en enfilade : salles de 4 × 5 dalles KayKit (16 × 20 m) alignées d'ouest
## en est, reliées par une porte au milieu de chaque mur de séparation. Le côté sud
## reste ouvert : vue en coupe, la caméra est au sud et ne voit jamais à travers
## un mur.
##
## Mêmes règles de performance que DungeonRoom (docs/perf-log.md) : un seul matériau,
## géométrie fusionnée salle par salle (les salles hors champ sont écartées par la
## caméra), fausses lumières et éclairage par sommet selon `Quality.settings()`,
## particules actives seulement autour de la salle du héros.
##
## Repère d'une salle i : coin nord-ouest en (16·i, hauteur, 0), x vers l'est, z vers le sud.
##
## Donjon qui monte (`use_climb`, souhait des enfants) : chaque salle est `rise` mètres plus
## haut que la précédente ; un escalier muré, à l'est de chaque salle, mène à la porte de la
## suivante. Le héros et le compagnon suivent le sol (`height_at`) ; sous les salles, des murs
## ferment la vue en coupe. Sans montée (village), la disposition reste à plat.

const TILE := 4.0
const ROOM_W := 16.0
const ROOM_D := 20.0
const TILES_X := 4
const TILES_Z := 5
const DOOR_Z := 10.0  # milieu du mur de séparation (3e dalle)
const DOOR_HALF := 1.1
const WALL_T := 0.6
const DUNGEON := "res://assets/kaykit/dungeon/%s.glb"
const REAL_LIGHTS_DIMMING := 0.75
const DOOR_OPEN_ANGLE := -1.75  # radians : le battant s'ouvre vers l'est
const CLIMB_RISE := 4.0  # mètres entre deux salles d'un donjon qui monte (un étage : escalier KayKit à sa taille)
const STAIR_RUN := 4.0  # longueur de l'escalier (pièce KayKit « stairs », 4 × 5 m)
const STAIR_HALF := 2.5  # demi-largeur de l'escalier, de part et d'autre de DOOR_Z

var background := Color(0.06, 0.05, 0.09)
var ambient := Color(0.45, 0.42, 0.55)
var ambient_energy := 0.6
var sun_color := Color(1.0, 0.86, 0.68)
var sun_energy := 1.1
var torch_color := Color(1.0, 0.62, 0.28)
## Décor propre au donjon (DungeonDef.decor) ; valeurs absentes : décor par défaut.
var decor: Dictionary = {}

## Objets le long des murs (salles paires ; les salles impaires en miroir est-ouest) :
## [pièce, position dans la salle, orientation, rayon de l'obstacle].
const DEFAULT_PROPS := [
	["barrel_large", Vector3(1.4, 0, 1.6), 0.0, 0.8],
	["barrel_small_stack", Vector3(3.0, 0, 1.1), 0.0, 0.7],
	["crates_stacked", Vector3(14.4, 0, 1.8), -20.0, 0.9],
	["keg_decorated", Vector3(14.9, 0, 5.0), 90.0, 0.7],
]

var room_count := 0
var rise := 0.0
var built_settings: Dictionary
var sun: DirectionalLight3D
var _material: StandardMaterial3D
var _body: StaticBody3D
var _room_nodes: Array[Node3D] = []
var _particles: Array = []  # par salle : Array de [CPUParticles3D, quantité de base]
var _doors: Array = []  # porte entre la salle i et i+1 : {leaf, shape}, ou null une fois ouverte


func use_theme(wt: WorldTheme) -> DungeonLevel:
	background = wt.background
	ambient = wt.ambient
	ambient_energy = wt.ambient_energy
	sun_color = wt.sun_color
	sun_energy = wt.sun_energy
	torch_color = wt.torch_color
	return self


func use_decor(dungeon_decor: Dictionary) -> DungeonLevel:
	decor = dungeon_decor
	torch_color = decor.get("torch_color", torch_color)
	return self


## Construit `count` salles (à appeler une fois le nœud dans l'arbre).
## Donjon qui monte : chaque salle plus haut que la précédente, reliées par un escalier.
func use_climb(height := CLIMB_RISE) -> DungeonLevel:
	rise = height
	return self


func build(count: int) -> void:
	room_count = count
	built_settings = Quality.settings()
	_material = StandardMaterial3D.new()
	_material.albedo_texture = load("res://assets/kaykit/dungeon/dungeon_texture.png")
	_material.roughness = 0.8
	if built_settings.vertex_shading:
		_material.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
	_body = StaticBody3D.new()
	_body.name = "Walls"
	add_child(_body)
	_build_environment()
	_doors.resize(count - 1)
	for i in count:
		_build_room(i)
	_build_colliders()
	set_active_room(0)


# --- Repères ---------------------------------------------------------------------

func room_origin(i: int) -> Vector3:
	return Vector3(i * ROOM_W, i * rise, 0)


## Hauteur du sol sous un point : celle de sa salle, ou de l'escalier qui monte vers la suivante.
func height_at(p: Vector3) -> float:
	var i := room_at(p.x)
	var base := i * rise
	var local := p.x - i * ROOM_W
	if _has_stairs(i) and local > ROOM_W - STAIR_RUN and absf(p.z - DOOR_Z) < STAIR_HALF:
		return base + (local - (ROOM_W - STAIR_RUN)) / STAIR_RUN * rise
	return base


func _has_stairs(i: int) -> bool:
	return rise > 0.0 and i < room_count - 1


func room_at(x: float) -> int:
	return clampi(floori(x / ROOM_W), 0, room_count - 1)


## Point d'arrivée dans une salle, juste après la porte ouest.
func entry_point(i: int) -> Vector3:
	return room_origin(i) + Vector3(2.5, 0, DOOR_Z)


## Étage d'une salle pour l'affichage (« Étage 3 / 6 »).
func floor_label(i: int) -> String:
	return "Étage %d / %d" % [i + 1, room_count]


func is_door_open(i: int) -> bool:
	return i >= _doors.size() or _doors[i] == null


## Trajet en ligne droite, avec un passage par chaque porte franchie (toucher pour
## aller dans une autre salle). S'arrête devant la première porte fermée.
func path(from: Vector3, to: Vector3) -> Array[Vector3]:
	var points: Array[Vector3] = []
	var a := room_at(from.x)
	var b := room_at(to.x)
	var step := 1 if b > a else -1
	var i := a
	while i != b:
		var door := mini(i, i + step)
		var door_x := (door + 1) * ROOM_W
		# Escalier : on y entre et on en sort par son pied, à l'ouest de la porte.
		var foot := Vector3(door_x - STAIR_RUN - 0.6, 0, DOOR_Z)
		if _has_stairs(door) and step > 0:
			points.append(foot)
		points.append(Vector3(door_x - step * 1.2, 0, DOOR_Z))
		if not is_door_open(door):
			return points
		points.append(Vector3(door_x + step * 1.2, 0, DOOR_Z))
		if _has_stairs(door) and step < 0:
			points.append(foot)
		i += step
	points.append(Vector3(to.x, 0, clampf(to.z, 0.8, ROOM_D - 0.8)))
	return points


# --- Portes -------------------------------------------------------------------------

## Ouvre la porte entre la salle i et la suivante : le battant pivote vers la salle
## suivante et le passage se libère.
func open_door(i: int, animate := true) -> void:
	if i >= _doors.size() or _doors[i] == null:
		return
	var door: Dictionary = _doors[i]
	_doors[i] = null
	(door["shape"] as CollisionShape3D).set_deferred("disabled", true)
	var leaf: Node3D = door["leaf"]
	var opened := leaf.rotation.y + DOOR_OPEN_ANGLE
	if animate:
		create_tween().tween_property(leaf, "rotation:y", opened, 0.8).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	else:
		leaf.rotation.y = opened


## Porte dans le mur ouest de la salle i (i ≥ 1) : le battant du modèle KayKit reste
## mobile (hors fusion), un obstacle ferme le passage tant qu'elle est close.
func _make_door(i: int, room: Node3D, doorway: Node3D) -> void:
	var leaf := doorway.find_child("wall_doorway_door*", true, false) as Node3D
	leaf.reparent(room)  # garde sa position ; exclu de la fusion pour pouvoir pivoter
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(WALL_T, 8, DOOR_HALF * 2 + 0.4)
	shape.shape = box
	shape.position = Vector3(i * ROOM_W, i * rise + 2, DOOR_Z)
	_body.add_child(shape)
	_doors[i - 1] = {"leaf": leaf, "shape": shape}


# --- Particules selon la salle du héros ----------------------------------------------

func set_active_room(current: int) -> void:
	var ratio: float = Quality.settings().particle_ratio
	for i in room_count:
		var near := absi(i - current) <= 1
		for entry in _particles[i]:
			var p: CPUParticles3D = entry[0]
			p.emitting = near and ratio > 0.0
			p.visible = near and ratio > 0.0
			p.amount = maxi(1, int(entry[1] * ratio))


# --- Construction ----------------------------------------------------------------------

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
	sun.directional_shadow_max_distance = 60.0
	sun.shadow_enabled = built_settings.shadows
	Quality.dress_sun(sun)
	add_child(sun)


func _build_room(i: int) -> void:
	var room := Node3D.new()
	room.name = "Room%d" % i
	room.position = room_origin(i)
	add_child(room)
	_room_nodes.append(room)
	_particles.append([])
	var static_root := Node3D.new()
	static_root.name = "Static"
	room.add_child(static_root)

	var floor_piece: String = decor.get("floor", "floor_tile_large")
	var accent_piece: String = decor.get("floor_accent", "floor_tile_large_rocks")
	var walls: Array = decor.get("walls", ["wall", "wall_arched"])
	for ix in TILES_X:
		for iz in TILES_Z:
			# Dalle différente (éboulis, planches sombres) seulement le long du mur nord, hors du passage.
			var accent := iz == 0 and ix == 1 + (i % 2)
			_place(static_root, accent_piece if accent else floor_piece, Vector3(2 + ix * TILE, 0, 2 + iz * TILE))
	for ix in TILES_X:
		_place(static_root, walls[(ix + i) % 2], Vector3(2 + ix * TILE, 0, 0))
	# Mur ouest : extérieur pour la 1re salle, sinon mur de séparation avec sa porte.
	for iz in TILES_Z:
		var doorway := i > 0 and iz == 2
		var wall := _place(static_root, "wall_doorway" if doorway else "wall", Vector3(0, 0, 2 + iz * TILE), 90.0)
		if doorway:
			_make_door(i, room, wall)
	if i == room_count - 1:
		for iz in TILES_Z:
			_place(static_root, "wall", Vector3(ROOM_W, 0, 2 + iz * TILE), -90.0)
	elif rise > 0.0:
		_build_climb(i, static_root)
	_place(static_root, "pillar_decorated", Vector3(0, 0, 0))
	if i == room_count - 1 or rise > 0.0:
		_place(static_root, "pillar_decorated", Vector3(ROOM_W, 0, 0))

	# Décor contre les murs (jamais sur le passage des portes ni au centre).
	var mirror := i % 2 == 1
	var banners: Array = decor.get("banners", ["banner_patternA_red", "banner_patternA_blue"])
	_place(static_root, banners[1] if mirror else banners[0], Vector3(6.5, 0, 0.05))
	_place(static_root, banners[0] if mirror else banners[1], Vector3(9.5, 0, 0.05))
	for prop in decor.get("props", DEFAULT_PROPS):
		var at: Vector3 = prop[1]
		if mirror:
			at.x = ROOM_W - at.x
		_prop(static_root, prop[0], at, prop[2], prop[3])
	_place(static_root, "candle_triple", Vector3(8.0, 0, 0.9))
	for x in [4.0, 12.0]:
		_place(static_root, "torch_mounted", Vector3(x, 2.2, 0.1))
		_add_torch(room, i, Vector3(x, 3.0, 0.7))
	_add_dust(room, i)
	if rise > 0.0:
		_build_foundation(static_root)

	if Quality.option("merge", "1") != "0":
		StaticBatcher.merge(static_root, _material)


## Escalier d'une salle vers la suivante, contre son mur est : muret côté escalier (la
## porte de la salle suivante est au-dessus), mur plein ailleurs, murs sous la salle.
func _build_climb(i: int, root: Node3D) -> void:
	for iz in TILES_Z:
		var wall := _place(root, "wall", Vector3(ROOM_W, 0, 2 + iz * TILE), -90.0)
		if iz == 2:
			wall.scale.y = rise / 4.0  # sous la porte de la salle suivante
	# L'origine de la pièce est au haut des marches (son bord z = 0, pas son centre) : posée sur
	# la ligne du mur est, tournée de -90°, elle monte vers l'est sans vide derrière elle et suit
	# la rampe de `height_at`. 4 m de haut à l'échelle 1.
	var stairs := _place(root, "stairs", Vector3(ROOM_W, 0, DOOR_Z), -90.0)
	stairs.scale = Vector3(1, rise / 4.0, 1)


## Mur sous le bord sud d'une salle (vue en coupe : pas de sol flottant). Une rangée suffit :
## les caméras d'exploration et de combat ne voient guère plus bas que le sol.
func _build_foundation(root: Node3D) -> void:
	for ix in TILES_X:
		_place(root, "wall", Vector3(2 + ix * TILE, -4.0, ROOM_D), 180.0)


func _build_colliders() -> void:
	var length := room_count * ROOM_W
	# Murs assez hauts pour toutes les salles (donjon qui monte).
	var top := (room_count - 1) * rise + 4.0
	var mid := top / 2.0
	var tall := top + 4.0
	_box(Vector3(length / 2.0, mid, -WALL_T / 2.0), Vector3(length, tall, WALL_T))  # nord
	_box(Vector3(length / 2.0, mid, ROOM_D + 0.3), Vector3(length, tall, WALL_T))  # bord sud
	_box(Vector3(-WALL_T / 2.0, mid, ROOM_D / 2.0), Vector3(WALL_T, tall, ROOM_D))  # ouest
	_box(Vector3(length + WALL_T / 2.0, mid, ROOM_D / 2.0), Vector3(WALL_T, tall, ROOM_D))  # est
	for i in range(1, room_count):  # séparations, avec l'ouverture de la porte
		var x := i * ROOM_W
		var north := DOOR_Z - DOOR_HALF
		var south := ROOM_D - (DOOR_Z + DOOR_HALF)
		_box(Vector3(x, mid, north / 2.0), Vector3(WALL_T, tall, north))
		_box(Vector3(x, mid, DOOR_Z + DOOR_HALF + south / 2.0), Vector3(WALL_T, tall, south))
		if _has_stairs(i - 1):
			# Côtés de l'escalier : on y monte par son pied, pas par le flanc.
			var run_x := x - STAIR_RUN / 2.0 + 0.3
			for side in [-1.0, 1.0]:
				_box(Vector3(run_x, mid, DOOR_Z + side * (STAIR_HALF + 0.1)), Vector3(STAIR_RUN - 0.6, tall, 0.3))


func _box(center: Vector3, size: Vector3) -> void:
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	shape.shape = box
	shape.position = center
	_body.add_child(shape)


## Obstacle cylindrique (tonneaux, caisses…), dans le repère de la salle.
func add_obstacle(room: int, local: Vector3, radius: float) -> void:
	var shape := CollisionShape3D.new()
	var cylinder := CylinderShape3D.new()
	cylinder.radius = radius
	cylinder.height = 3.0
	shape.shape = cylinder
	shape.position = room_origin(room) + local + Vector3(0, 1.5, 0)
	_body.add_child(shape)


func _prop(root: Node3D, piece: String, pos: Vector3, yaw: float, radius: float) -> void:
	_place(root, piece, pos, yaw)
	add_obstacle(_room_nodes.size() - 1, pos, radius)


func _place(root: Node3D, piece: String, pos: Vector3, yaw_deg := 0.0) -> Node3D:
	var node: Node3D = (load(DUNGEON % piece) as PackedScene).instantiate()
	node.position = pos
	node.rotation_degrees.y = yaw_deg
	for child in node.find_children("*", "MeshInstance3D", true, false):
		(child as MeshInstance3D).material_override = _material
	root.add_child(node)
	return node


func _add_torch(room: Node3D, i: int, pos: Vector3) -> void:
	match built_settings.lights:
		"fake":
			var fake_pos := pos + Vector3(0, -0.2, 0.2)
			var fake := MobileLighting.make_fake_light(torch_color, fake_pos.y)
			fake.position = fake_pos
			room.add_child(fake)
		"real":
			var light := OmniLight3D.new()
			light.position = pos
			light.light_color = torch_color
			light.light_energy = 1.3
			light.omni_range = 7.0
			room.add_child(light)
	var flame := CPUParticles3D.new()
	flame.position = pos + Vector3(0, -0.3, -0.2)
	flame.amount = 24
	flame.lifetime = 0.6
	flame.direction = Vector3.UP
	flame.spread = 15.0
	flame.initial_velocity_min = 0.6
	flame.initial_velocity_max = 1.2
	flame.gravity = Vector3(0, 0.5, 0)
	flame.mesh = DungeonRoom.particle_quad(torch_color, 0.25)
	_register_particles(room, i, flame)


func _add_dust(room: Node3D, i: int) -> void:
	var dust := CPUParticles3D.new()
	dust.position = Vector3(ROOM_W / 2.0, 2.5, ROOM_D / 2.0)
	dust.amount = 50
	dust.lifetime = 6.0
	dust.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	dust.emission_box_extents = Vector3(7, 2, 9)
	dust.direction = Vector3.UP
	dust.spread = 180.0
	dust.initial_velocity_min = 0.05
	dust.initial_velocity_max = 0.2
	dust.gravity = Vector3.ZERO
	dust.mesh = DungeonRoom.particle_quad(Color(0.5, 0.42, 0.3, 0.5), 0.08)
	_register_particles(room, i, dust)


func _register_particles(room: Node3D, i: int, p: CPUParticles3D) -> void:
	_particles[i].append([p, p.amount])
	room.add_child(p)


## Prépare un personnage pour ce donjon (éclairage par sommet si besoin).
func adapt_character(character: Node3D) -> void:
	if built_settings.vertex_shading:
		MobileLighting.apply_vertex_shading(character)
