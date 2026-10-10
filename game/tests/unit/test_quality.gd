extends GutTest


func after_each() -> void:
	Quality.apply(&"haut")


func test_tablet_profile_matches_measured_setting() -> void:
	# Réglage « D » mesuré à 30 fps sur la tablette le 2026-10-10.
	var p: Dictionary = Quality.PROFILES[&"tablette"]
	assert_eq(p.lights, "fake")
	assert_true(p.vertex_shading)
	assert_false(p.shadows)
	assert_eq(p.scale_3d, 1.0)


func test_no_profile_uses_real_lights_except_pc() -> void:
	for name in Quality.PROFILES:
		if name != &"haut":
			assert_ne(Quality.PROFILES[name].lights, "real", "profil %s" % name)


func test_needs_rebuild_when_structural_setting_changes() -> void:
	Quality.apply(&"haut")
	var built := Quality.settings()
	assert_false(Quality.needs_rebuild(built))
	Quality.apply(&"tablette")
	assert_true(Quality.needs_rebuild(built))


func test_switching_between_tablet_and_low_keeps_structure() -> void:
	Quality.apply(&"tablette")
	var built := Quality.settings()
	Quality.apply(&"bas")
	assert_false(Quality.needs_rebuild(built), "seule la résolution change")
