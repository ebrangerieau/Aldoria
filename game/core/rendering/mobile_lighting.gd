class_name MobileLighting
extends RefCounted
## Éclairage économique pour la tablette (docs/perf-log.md, 2026-10-10).
## Avec le renderer Compatibility, chaque OmniLight3D redessine tous les objets
## qu'elle touche : sur la tablette, 2 torches coûtaient 19 -> 28 fps.
## On les remplace par de fausses lumières, et on éclaire par sommet.


## Passe en éclairage par sommet tous les matériaux sous `root`
## (les matériaux sont dupliqués : la ressource importée n'est pas modifiée).
static func apply_vertex_shading(root: Node) -> void:
	for node in root.find_children("*", "MeshInstance3D", true, false):
		var instance := node as MeshInstance3D
		if instance.material_override is BaseMaterial3D:
			var override_mat := (instance.material_override as BaseMaterial3D).duplicate() as BaseMaterial3D
			override_mat.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
			instance.material_override = override_mat
			continue
		for surface in instance.mesh.get_surface_count():
			var source := instance.get_active_material(surface) as BaseMaterial3D
			if source == null:
				continue
			var mat := source.duplicate() as BaseMaterial3D
			mat.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
			instance.set_surface_override_material(surface, mat)


## Fausse lumière : halo additif face caméra autour de la source et flaque de
## lumière au sol devant elle. Aucune passe de rendu supplémentaire.
## À placer à la position de la source ; `height` = hauteur de la source au-dessus
## du sol, `pool_offset` = décalage horizontal de la flaque (vers l'intérieur de la salle).
static func make_fake_light(color: Color, height: float, pool_offset := Vector2(0, 2.5),
		halo_size := 2.2, pool_size := 9.0) -> Node3D:
	var root := Node3D.new()
	root.name = "FakeLight"

	var halo := MeshInstance3D.new()
	halo.mesh = _glow_quad(halo_size, Color(color, 0.55), true)
	halo.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(halo)

	var pool := MeshInstance3D.new()
	pool.mesh = _glow_quad(pool_size, Color(color, 0.35), false)
	pool.rotation_degrees.x = -90.0
	pool.position = Vector3(pool_offset.x, -height + 0.06, pool_offset.y)
	pool.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(pool)
	return root


static func _glow_quad(size: float, color: Color, billboard: bool) -> QuadMesh:
	var gradient := Gradient.new()
	gradient.set_color(0, Color(1, 1, 1, 1))
	gradient.set_color(1, Color(1, 1, 1, 0))
	var texture := GradientTexture2D.new()
	texture.gradient = gradient
	texture.fill = GradientTexture2D.FILL_RADIAL
	texture.fill_from = Vector2(0.5, 0.5)
	texture.fill_to = Vector2(0.5, 0.0)
	texture.width = 64
	texture.height = 64
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat.albedo_texture = texture
	mat.albedo_color = color
	if billboard:
		mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	var quad := QuadMesh.new()
	quad.size = Vector2(size, size)
	quad.material = mat
	return quad
