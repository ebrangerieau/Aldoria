extends GutTest
## XP, niveaux et sauvegarde (TRD §2.7) : migration, conflits entre appareils.


func before_each() -> void:
	SaveManager._profile_id = 0
	SaveManager.data = SaveManager.default_data()


func after_each() -> void:
	SaveManager.data = SaveManager.default_data()


func test_level_thresholds() -> void:
	assert_eq(Progression.level_for_xp(0), 1)
	assert_eq(Progression.level_for_xp(199), 1)
	assert_eq(Progression.level_for_xp(200), 2)
	assert_eq(Progression.level_for_xp(600), 3)
	assert_eq(Progression.level_for_xp(1199), 3)
	assert_almost_eq(Progression.level_progress(400), 0.5, 0.001)
	assert_eq(Progression.hero_max_hp(1), 100)
	assert_eq(Progression.hero_max_hp(4), 130)


func test_add_xp_signals_level_up() -> void:
	watch_signals(SaveManager)
	SaveManager.add_xp(150)
	assert_signal_not_emitted(SaveManager, "level_up")
	SaveManager.add_xp(60)
	assert_signal_emitted_with_parameters(SaveManager, "level_up", [2])
	assert_eq(SaveManager.xp(), 210)


func test_dungeon_checkpoint_and_completion() -> void:
	SaveManager.set_checkpoint("tour_fractions", 3)
	assert_eq(int(SaveManager.dungeon("tour_fractions")["checkpoint"]), 3)
	assert_eq(int(SaveManager.dungeon("tour_fractions")["best_room"]), 3)
	SaveManager.complete_dungeon("tour_fractions")
	var state := SaveManager.dungeon("tour_fractions")
	assert_eq(int(state["completed"]), 1)
	assert_eq(int(state["checkpoint"]), 0, "rejouable depuis l'entrée")
	assert_eq(int(state["best_room"]), 3, "meilleure salle conservée")


func test_migrate_fills_missing_fields() -> void:
	var old := {"xp": 340.0}  # sans version : antérieure au format 1
	var migrated := SaveManager.migrate(old, 0)
	assert_eq(int(migrated["schema_version"]), SaveManager.SCHEMA_VERSION)
	assert_eq(int(migrated["xp"]), 340)
	assert_true(migrated["dungeons"] is Dictionary)
	assert_true(migrated["bestiary"] is Dictionary)


func test_conflict_adopts_the_server_save() -> void:
	SaveManager.add_xp(100)
	SaveManager._adopt({"revision": 7, "schema_version": 1, "data": {"xp": 900, "bestiary": {"Squelette": 3}}})
	assert_eq(SaveManager.xp(), 900)
	assert_eq(SaveManager._revision, 7)
	assert_false(SaveManager._dirty)
	assert_eq(int(SaveManager.bestiary()["Squelette"]), 3)
