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
	for profile_name in Quality.PROFILES:
		if profile_name != &"haut":
			assert_ne(Quality.PROFILES[profile_name].lights, "real", "profil %s" % profile_name)


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


func test_desktop_interface_grows_less_than_the_tablet_one() -> void:
	# Tablette : agrandissement proportionnel, toujours.
	assert_eq(Quality.ui_factor(Vector2(1920, 1080), false), 1.0)
	# PC 1080p : 1,5 × proportionnel → 1,2 × réel.
	assert_almost_eq(Quality.ui_factor(Vector2(1920, 1080), true) * 1.5, 1.2, 0.001)
	# PC petit écran (ou banc e2e en 1280 × 800) : jamais sous la taille de conception.
	assert_eq(Quality.ui_factor(Vector2(1280, 800), true), 1.0)
	assert_almost_eq(Quality.ui_factor(Vector2(1600, 900), true) * 1.25, 1.0, 0.001)
