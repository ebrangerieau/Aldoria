extends Node3D
## Scène d'étalonnage (IMPLEMENTATION_PLAN, phase 0) : un diorama représentatif du jeu
## final pour mesurer fps, appels de dessin et mémoire sur la tablette réelle.
## Contenu : salle de donjon KayKit (grille de 4 m), 2 personnages animés,
## une lumière directionnelle avec ombres, 2 torches (lumière + particules),
## caméra inclinée à focale longue qui oscille lentement.
##
## Capture d'écran pour vérification hors navigateur :
##   godot --path game -- --screenshot=C:/chemin/capture.png

const TILE := 4.0
const ROOM := 5 # tuiles par côté
const DUNGEON := "res://assets/kaykit/dungeon/%s.glb"
const CHARACTERS := "res://assets/kaykit/characters/%s.glb"

const CAMERA_FOV := 20.0
const CAMERA_DISTANCE := 62.0
const CAMERA_PITCH_DEG := -42.0
const CAMERA_SWAY_DEG := 12.0
const CAMERA_SWAY_PERIOD_S := 16.0

var _shared_material: StandardMaterial3D
var _static_root: Node3D
var _sun: DirectionalLight3D
var _particles: Array[CPUParticles3D] = []
var _particle_base_amounts: Array[int] = []
var _camera_pivot: Node3D
var _time := 0.0
var _hero_anim: AnimationPlayer
var _enemy_anim: AnimationPlayer
var _built: Dictionary # réglages structurels utilisés pour construire la scène


func _ready() -> void:
	_built = Quality.settings()
	_shared_material = StandardMaterial3D.new()
	_shared_material.albedo_texture = load("res://assets/kaykit/dungeon/dungeon_texture.png")
	_shared_material.roughness = 0.8
	if _built.vertex_shading:
		_shared_material.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX

	_static_root = Node3D.new()
	_static_root.name = "Static"
	add_child(_static_root)

	_build_environment()
	_build_room()
	_build_props()
	if Quality.option("merge", "1") != "0":
		StaticBatcher.merge(_static_root, _shared_material)
	_build_characters()
	_build_camera()

	Quality.changed.connect(_apply_quality)
	_apply_quality(Quality.current)
	PerfOverlay.show_overlay()
	_maybe_take_screenshot()


func _process(delta: float) -> void:
	_time += delta
	var sway := sin(_time * TAU / CAMERA_SWAY_PERIOD_S) * deg_to_rad(CAMERA_SWAY_DEG)
	_camera_pivot.rotation.y = sway


# --- Construction -----------------------------------------------------------

func _build_environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.06, 0.05, 0.09)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.45, 0.42, 0.55)
	env.ambient_light_energy = 0.6
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var world_env := WorldEnvironment.new()
	world_env.environment = env
	add_child(world_env)

	_sun = DirectionalLight3D.new()
	_sun.light_color = Color(1.0, 0.86, 0.68)
	_sun.light_energy = 1.1
	_sun.rotation_degrees = Vector3(-55, -35, 0)
	_sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	_sun.directional_shadow_max_distance = 90.0
	add_child(_sun)


func _build_room() -> void:
	var half := (ROOM - 1) * TILE / 2.0 # centre de la première tuile
	for ix in ROOM:
		for iz in ROOM:
			var tile := "floor_tile_large_rocks" if (ix + iz) % 3 == 0 else "floor_tile_large"
			_place(tile, Vector3(ix * TILE - half, 0, iz * TILE - half))

	var back_z := -half - TILE / 2.0
	var side_x := half + TILE / 2.0
	for ix in ROOM:
		var x := ix * TILE - half
		var piece := "wall_doorway" if ix == ROOM / 2 else ("wall_arched" if ix % 2 == 1 else "wall")
		_place(piece, Vector3(x, 0, back_z))
	for iz in ROOM:
		var z := iz * TILE - half
		_place("wall", Vector3(-side_x, 0, z), 90.0)
		_place("wall", Vector3(side_x, 0, z), -90.0)
	_place("pillar_decorated", Vector3(-side_x, 0, back_z))
	_place("pillar_decorated", Vector3(side_x, 0, back_z))


func _build_props() -> void:
	var back_z := -(ROOM - 1) * TILE / 2.0 - TILE / 2.0
	for x in [-6.0, 6.0]:
		_place("torch_mounted", Vector3(x, 2.2, back_z + 0.1))
		_add_torch_light(Vector3(x, 3.0, back_z + 0.7))
	_place("banner_patternA_red", Vector3(-2.0, 0, back_z + 0.05))
	_place("banner_patternA_blue", Vector3(2.0, 0, back_z + 0.05))
	_place("barrel_large", Vector3(-8.0, 0, -6.5))
	_place("barrel_small_stack", Vector3(-6.2, 0, -7.0))
	_place("crates_stacked", Vector3(8.0, 0, -6.0), -20.0)
	_place("keg_decorated", Vector3(7.8, 0, 2.5), 90.0)
	_place("chest_gold", Vector3(0, 0, -6.5))
	_place("table_medium_decorated_A", Vector3(-7.0, 0, 3.0), 90.0)
	_place("candle_triple", Vector3(4.5, 0, -7.5))
	_place("rubble_half", Vector3(5.5, 0, 6.5), 30.0)
	_place("column", Vector3(-4.0, 0, 7.0))
	_add_dust()


func _build_characters() -> void:
	if Quality.option("chars") == "0": # diagnostic : ?chars=0
		return
	var hero := _instance(CHARACTERS % "Knight")
	hero.position = Vector3(-2.6, 0, 1.5)
	hero.rotation_degrees.y = 90.0
	add_child(hero)
	if _built.vertex_shading:
		MobileLighting.apply_vertex_shading(hero)
	_hero_anim = _setup_animation(hero, "Idle")

	var enemy := _instance(CHARACTERS % "Skeleton_Warrior")
	enemy.position = Vector3(2.6, 0, 1.5)
	enemy.rotation_degrees.y = -90.0
	add_child(enemy)
	if _built.vertex_shading:
		MobileLighting.apply_vertex_shading(enemy)
	_enemy_anim = _setup_animation(enemy, "Idle_Combat")

	# Échange de coups toutes les 4 s : représentatif d'un combat (animations + particules).
	var timer := Timer.new()
	timer.wait_time = 4.0
	timer.autostart = true
	timer.timeout.connect(_exchange_blows)
	add_child(timer)


func _build_camera() -> void:
	_camera_pivot = Node3D.new()
	_camera_pivot.position = Vector3(0, 1.0, 0)
	add_child(_camera_pivot)
	var camera := Camera3D.new()
	camera.fov = CAMERA_FOV
	camera.far = 200.0
	var pitch := deg_to_rad(CAMERA_PITCH_DEG)
	camera.position = Vector3(0, -sin(pitch) * CAMERA_DISTANCE, cos(pitch) * CAMERA_DISTANCE)
	camera.rotation.x = pitch
	_camera_pivot.add_child(camera)
	camera.make_current()


# --- Aides ------------------------------------------------------------------

func _instance(path: String) -> Node3D:
	var scene: PackedScene = load(path)
	return scene.instantiate() as Node3D


func _place(piece: String, pos: Vector3, yaw_deg := 0.0) -> Node3D:
	var node := _instance(DUNGEON % piece)
	node.position = pos
	node.rotation_degrees.y = yaw_deg
	_apply_shared_material(node)
	_static_root.add_child(node)
	return node


func _apply_shared_material(root: Node) -> void:
	# Un seul matériau pour tout le donjon : limite les changements d'état GPU
	# (même logique que l'atlas recommandé pour le web mobile).
	for child in root.find_children("*", "MeshInstance3D", true, false):
		(child as MeshInstance3D).material_override = _shared_material


func _setup_animation(character: Node, idle: String) -> AnimationPlayer:
	var player := character.find_child("AnimationPlayer", true, false) as AnimationPlayer
	if player == null:
		push_warning("Pas d'AnimationPlayer dans %s" % character.name)
		return null
	for anim_name in [idle]:
		if player.has_animation(anim_name):
			player.get_animation(anim_name).loop_mode = Animation.LOOP_LINEAR
	player.play(idle)
	player.animation_finished.connect(func(_n: StringName) -> void: player.play(idle))
	return player


func _exchange_blows() -> void:
	if _hero_anim and _hero_anim.has_animation("1H_Melee_Attack_Chop"):
		_hero_anim.play("1H_Melee_Attack_Chop")
	if _enemy_anim and _enemy_anim.has_animation("Hit_A"):
		get_tree().create_timer(0.35).timeout.connect(func() -> void: _enemy_anim.play("Hit_A"))


func _add_torch_light(pos: Vector3) -> void:
	if _built.lights == "fake":
		var fake_pos := pos + Vector3(0, -0.2, 0.2)
		var fake := MobileLighting.make_fake_light(Color(1.0, 0.62, 0.28), fake_pos.y)
		fake.position = fake_pos
		add_child(fake)
	elif _built.lights == "real":
		var light := OmniLight3D.new()
		light.position = pos
		light.light_color = Color(1.0, 0.6, 0.25)
		light.light_energy = 2.0
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
	flame.color = Color(1.0, 0.55, 0.15)
	flame.mesh = _particle_mesh(Color(1.0, 0.6, 0.2), 0.25)
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
	dust.mesh = _particle_mesh(Color(0.5, 0.42, 0.3, 0.5), 0.08)
	_register_particles(dust)


func _particle_mesh(color: Color, size := 1.0) -> QuadMesh:
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
	return quad


func _register_particles(p: CPUParticles3D) -> void:
	_particles.append(p)
	_particle_base_amounts.append(p.amount)
	add_child(p)


func _apply_quality(_profile: StringName) -> void:
	if Quality.needs_rebuild(_built):
		# Lumières et éclairage par sommet sont fixés à la construction.
		get_tree().reload_current_scene.call_deferred()
		return
	var s := Quality.settings()
	_sun.shadow_enabled = s.shadows
	for i in _particles.size():
		_particles[i].emitting = s.particle_ratio > 0.0
		_particles[i].visible = s.particle_ratio > 0.0
		_particles[i].amount = maxi(1, int(_particle_base_amounts[i] * s.particle_ratio))


func _maybe_take_screenshot() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--screenshot="):
			var path := arg.trim_prefix("--screenshot=")
			for i in 30:
				await get_tree().process_frame
			get_viewport().get_texture().get_image().save_png(path)
			print("Capture enregistrée : ", path)
			get_tree().quit()
