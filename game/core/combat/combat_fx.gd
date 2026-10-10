class_name CombatFx
extends Node3D
## « Game feel » du combat (PRD §9) : ce qui rend la bonne réponse jouissive.
## Chiffres de dégâts, secousse d'écran, arrêt sur image (hitstop), ralenti sur
## coup critique, projectile de sort, gerbes d'étincelles.

var camera: Camera3D
var _shake_strength := 0.0
var _shake_time := 0.0
var _rng := RandomNumberGenerator.new()


func _process(delta: float) -> void:
	if camera == null:
		return
	# La secousse se calcule en temps réel, même pendant un ralenti.
	var real_delta := delta / maxf(Engine.time_scale, 0.01)
	if _shake_time > 0.0:
		_shake_time -= real_delta
		var k := _shake_strength * clampf(_shake_time / 0.3, 0.0, 1.0)
		camera.h_offset = _rng.randf_range(-k, k)
		camera.v_offset = _rng.randf_range(-k, k)
	else:
		camera.h_offset = 0.0
		camera.v_offset = 0.0


func shake(strength := 0.25, duration := 0.3) -> void:
	_shake_strength = strength
	_shake_time = duration


## Arrêt sur image très bref : donne du poids à l'impact.
func hitstop(duration := 0.07) -> void:
	Engine.time_scale = 0.05
	await get_tree().create_timer(duration, true, false, true).timeout
	Engine.time_scale = 1.0


## Ralenti du coup critique (réponse juste et rapide).
func slow_motion(time_scale := 0.3, duration := 0.5) -> void:
	Engine.time_scale = time_scale
	await get_tree().create_timer(duration, true, false, true).timeout
	Engine.time_scale = 1.0


func floating_text(text: String, at: Vector3, color: Color, size := 96) -> void:
	var label := Label3D.new()
	label.text = text
	label.font_size = size
	label.outline_size = 18
	label.modulate = color
	label.outline_modulate = Color(0, 0, 0, 0.85)
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.no_depth_test = true
	label.fixed_size = false
	label.pixel_size = 0.012
	label.position = at + Vector3(_rng.randf_range(-0.3, 0.3), 0.4, 0)
	add_child(label)
	var tween := create_tween().set_parallel()
	tween.tween_property(label, "position:y", label.position.y + 1.6, 0.9).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	tween.tween_property(label, "modulate:a", 0.0, 0.9).set_delay(0.35)
	tween.tween_property(label, "scale", Vector3.ONE * 1.25, 0.12)
	tween.chain().tween_callback(label.queue_free)


func burst(at: Vector3, color: Color, amount := 40, speed := 4.0) -> void:
	var p := CPUParticles3D.new()
	p.position = at
	p.one_shot = true
	p.explosiveness = 1.0
	# Même avec ?particles=0, on garde une petite gerbe : c'est un retour de jeu, pas du décor.
	p.amount = maxi(4, int(amount * Quality.settings().particle_ratio))
	p.lifetime = 0.6
	p.direction = Vector3.UP
	p.spread = 180.0
	p.initial_velocity_min = speed * 0.5
	p.initial_velocity_max = speed
	p.gravity = Vector3(0, -6, 0)
	p.scale_amount_min = 0.6
	p.scale_amount_max = 1.2
	p.mesh = DungeonRoom.particle_quad(color, 0.18)
	add_child(p)
	p.emitting = true
	get_tree().create_timer(1.5).timeout.connect(p.queue_free)


func rising_sparkles(at: Vector3, color: Color) -> void:
	var p := CPUParticles3D.new()
	p.position = at
	p.one_shot = true
	p.explosiveness = 0.3
	p.amount = 30
	p.lifetime = 1.0
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	p.emission_sphere_radius = 0.6
	p.direction = Vector3.UP
	p.spread = 15.0
	p.initial_velocity_min = 1.0
	p.initial_velocity_max = 2.0
	p.gravity = Vector3.ZERO
	p.mesh = DungeonRoom.particle_quad(color, 0.15)
	add_child(p)
	p.emitting = true
	get_tree().create_timer(2.0).timeout.connect(p.queue_free)


## Orbe lumineux du lanceur à la cible ; renvoie quand il arrive.
func projectile(from: Vector3, to: Vector3, color: Color, duration := 0.35) -> void:
	var orb := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.22
	sphere.height = 0.44
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = color.lightened(0.4)
	sphere.material = mat
	orb.mesh = sphere
	var glow := MobileLighting.make_fake_light(color, 0.0, Vector2.ZERO, 1.6, 0.1)
	glow.get_child(1).visible = false  # pas de flaque au sol pour un projectile
	orb.add_child(glow)
	orb.position = from
	add_child(orb)
	var tween := create_tween()
	tween.tween_property(orb, "position", to, duration).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	await tween.finished
	orb.queue_free()
