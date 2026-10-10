extends GutTest


func _box_at(pos: Vector3) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.mesh = BoxMesh.new()
	instance.position = pos
	return instance


func test_merge_replaces_meshes_with_single_instance() -> void:
	var root := Node3D.new()
	add_child_autofree(root)
	root.add_child(_box_at(Vector3(-2, 0, 0)))
	root.add_child(_box_at(Vector3(2, 0, 0)))
	var material := StandardMaterial3D.new()

	var merged := StaticBatcher.merge(root, material)
	await wait_process_frames(1)

	assert_eq(root.get_child_count(), 1)
	assert_eq(merged.material_override, material)
	assert_eq(merged.mesh.get_surface_count(), 1)


func test_merge_keeps_world_positions() -> void:
	var root := Node3D.new()
	add_child_autofree(root)
	root.add_child(_box_at(Vector3(-2, 0, 0)))
	root.add_child(_box_at(Vector3(2, 0, 0)))

	var merged := StaticBatcher.merge(root, StandardMaterial3D.new())
	await wait_process_frames(1)
	var aabb := merged.mesh.get_aabb()

	# Deux cubes d'1 m centrés en x = -2 et x = 2 : boîte de -2,5 à 2,5.
	assert_almost_eq(aabb.position.x, -2.5, 0.001)
	assert_almost_eq(aabb.end.x, 2.5, 0.001)
