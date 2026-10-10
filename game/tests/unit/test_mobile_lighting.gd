extends GutTest


func test_vertex_shading_on_override_material() -> void:
	var root := Node3D.new()
	add_child_autofree(root)
	var instance := MeshInstance3D.new()
	instance.mesh = BoxMesh.new()
	var original := StandardMaterial3D.new()
	instance.material_override = original
	root.add_child(instance)

	MobileLighting.apply_vertex_shading(root)

	var mat := instance.material_override as BaseMaterial3D
	assert_eq(mat.shading_mode, BaseMaterial3D.SHADING_MODE_PER_VERTEX)
	assert_eq(original.shading_mode, BaseMaterial3D.SHADING_MODE_PER_PIXEL,
		"la ressource d'origine ne doit pas être modifiée")


func test_vertex_shading_on_surface_materials() -> void:
	var root := Node3D.new()
	add_child_autofree(root)
	var instance := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.material = StandardMaterial3D.new()
	instance.mesh = box
	root.add_child(instance)

	MobileLighting.apply_vertex_shading(root)

	var mat := instance.get_surface_override_material(0) as BaseMaterial3D
	assert_not_null(mat)
	assert_eq(mat.shading_mode, BaseMaterial3D.SHADING_MODE_PER_VERTEX)


func test_fake_light_pool_sits_on_floor() -> void:
	var light := MobileLighting.make_fake_light(Color.ORANGE, 2.8)
	add_child_autofree(light)
	light.position = Vector3(3, 2.8, -7)
	var pool := light.get_child(1) as MeshInstance3D
	assert_almost_eq(pool.global_position.y, 0.06, 0.001)


func test_fake_light_adds_no_light_node() -> void:
	var light := MobileLighting.make_fake_light(Color.ORANGE, 2.0)
	add_child_autofree(light)
	assert_eq(light.find_children("*", "Light3D", true, false).size(), 0)
