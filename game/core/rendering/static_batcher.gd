class_name StaticBatcher
extends RefCounted
## Fusionne toute la géométrie statique d'un sous-arbre en un seul maillage
## partageant le même matériau : une salle entière coûte alors un appel de dessin
## (plus un par passe d'ombre) au lieu d'un par tuile ou par mur.
## Indispensable pour tenir le budget tablette du TRD §2.2 (< 100 appels de dessin).


## Remplace les MeshInstance3D sous `root` par un unique MeshInstance3D enfant de `root`.
## Les nœuds non-maillage (lumières, particules…) ne doivent pas être sous `root`.
static func merge(root: Node3D, material: Material) -> MeshInstance3D:
	var tool := SurfaceTool.new()
	tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	var root_inverse := root.global_transform.affine_inverse()
	var merged_count := 0
	for node in root.find_children("*", "MeshInstance3D", true, false):
		var instance := node as MeshInstance3D
		if instance.mesh == null:
			continue
		var xform := root_inverse * instance.global_transform
		for surface in instance.mesh.get_surface_count():
			tool.append_from(instance.mesh, surface, xform)
		merged_count += 1

	for child in root.get_children():
		root.remove_child(child)
		child.queue_free()

	var merged := MeshInstance3D.new()
	merged.name = "MergedStatic"
	merged.mesh = tool.commit()
	merged.material_override = material
	root.add_child(merged)
	print_verbose("StaticBatcher : %d maillages fusionnés" % merged_count)
	return merged
