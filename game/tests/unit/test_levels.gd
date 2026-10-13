extends GutTest
## Classes et mondes (étape A) : le monde donne l'ambiance, la classe donne les donjons et
## le village ; le profil relu au camp suit les changements faits par le parent.


func before_each() -> void:
	SaveManager._profile_id = 0
	SaveManager.data = SaveManager.default_data()


func after_each() -> void:
	Session.profile = {}
	SaveManager.data = SaveManager.default_data()


func test_world_ids_and_legacy_names() -> void:
	Session.profile = {"world": "tom", "level": "2nde"}
	assert_eq(Session.world(), "brouillard", "ancien identifiant (prénom) d'avant la migration 0009")
	Session.profile = {"world": "jules"}
	assert_eq(Session.world(), "lumineux")
	Session.profile = {}
	assert_eq(Session.world(), "lumineux")
	assert_eq(Session.level(), "6e")
	assert_true(WorldTheme.for_world("lumineux").companion)
	assert_false(WorldTheme.for_world("brouillard").companion)


func test_content_follows_the_class_not_the_world() -> void:
	assert_eq(DungeonDef.all_for_level("6e")[0].code, "tour_fractions")
	assert_eq(DungeonDef.all_for_level("2nde")[0].code, "labyrinthe_vecteurs")
	assert_eq(DungeonDef.all_for_level("5e").size(), 0, "classe sans donjon pour l'instant")
	assert_null(DungeonDef.by_code("5e", "tour_fractions"))
	assert_eq(VillageDef.for_level("6e").title, VillageDef.clairval().title)
	assert_eq(VillageDef.for_level("2nde").title, VillageDef.brumegarde().title)
	assert_null(VillageDef.for_level("1ere"))


func test_profile_refresh_signals_a_change_of_class() -> void:
	Session.profile = {"id": 1, "name": "Jules", "level": "6e", "world": "lumineux"}
	watch_signals(Session)
	Session.update_profile({"id": 1, "name": "Jules", "level": "6e", "world": "lumineux"})
	assert_signal_not_emitted(Session, "profile_changed")
	Session.update_profile({"id": 1, "name": "Jules", "level": "2nde", "level_label": "Seconde", "world": "brouillard"})
	assert_signal_emitted(Session, "profile_changed")
	assert_eq(Session.level(), "2nde")
	assert_eq(Session.world(), "brouillard")


func test_unlocks_survive_a_change_of_class() -> void:
	Session.profile = {"world": "lumineux", "level": "6e"}
	SaveManager.complete_dungeon("tour_fractions")
	SaveManager.complete_dungeon("atelier_balances")
	Session.profile = {"world": "lumineux", "level": "2nde"}
	assert_eq(SaveManager.dungeons_done(), 2, "les donjons de 6e comptent toujours")


func test_camp_of_a_class_without_regions_yet() -> void:
	Session.profile = {"name": "Léa", "world": "lumineux", "level": "5e", "level_label": "5ème"}
	var hub: Control = (load("res://scenes/hub/hub.tscn") as PackedScene).instantiate()
	add_child_autofree(hub)
	await wait_process_frames(3)
	var texts: Array[String] = []
	for node in hub.find_children("*", "Label", true, false):
		texts.append((node as Label).text)
	var buttons: Array[String] = []
	for node in hub.find_children("*", "Button", true, false):
		buttons.append((node as Button).text)
	assert_has(texts, "De nouvelles régions se préparent")
	assert_does_not_have(buttons, "Y aller", "pas de village pour cette classe")
	assert_has(buttons, "Arène")
