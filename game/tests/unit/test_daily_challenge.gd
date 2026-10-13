extends GutTest
## Défi quotidien : série de jours, rattrapage d'un jour manqué, coffre de la semaine,
## record personnel (DailyChallenge et SaveManager).


func before_each() -> void:
	SaveManager._profile_id = 0
	SaveManager.data = SaveManager.default_data()


func after_each() -> void:
	SaveManager.data = SaveManager.default_data()


func test_dates() -> void:
	assert_eq(DailyChallenge.shift_day("2026-10-01", -1), "2026-09-30")
	assert_eq(DailyChallenge.shift_day("2026-12-31", 1), "2027-01-01")
	assert_eq(DailyChallenge.week_start("2026-10-11"), "2026-10-05", "dimanche : semaine du lundi 5")
	assert_eq(DailyChallenge.week_start("2026-10-05"), "2026-10-05", "lundi")
	assert_eq(DailyChallenge.week_start("2026-10-08"), "2026-10-05")
	assert_eq(DailyChallenge.format_duration(42400), "42 s")
	assert_eq(DailyChallenge.format_duration(134000), "2 min 14 s")


func test_streak_counts_consecutive_days_up_to_today_or_yesterday() -> void:
	var days := ["2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"]
	assert_eq(DailyChallenge.streak(days, "2026-10-10"), 4)
	assert_eq(DailyChallenge.streak(days, "2026-10-11"), 4, "défi du jour pas encore fait : la série tient")
	assert_eq(DailyChallenge.streak(days, "2026-10-12"), 0, "un jour manqué : série cassée")
	assert_eq(DailyChallenge.streak([], "2026-10-12"), 0)


func test_one_missed_day_can_be_caught_up_once() -> void:
	var days := ["2026-10-08", "2026-10-09"]  # le 10 manqué
	assert_eq(DailyChallenge.counted_day(days, "2026-10-11"), "2026-10-11", "d'abord le défi du jour")
	days.append("2026-10-11")
	assert_true(DailyChallenge.can_catch_up(days, "2026-10-11"))
	assert_eq(DailyChallenge.counted_day(days, "2026-10-11"), "2026-10-10", "puis le rattrapage d'hier")
	days.append("2026-10-10")
	assert_eq(DailyChallenge.counted_day(days, "2026-10-11"), "", "ensuite : entraînement")
	assert_eq(DailyChallenge.streak(days, "2026-10-11"), 4, "série réparée")
	# Deux jours manqués : rien à rattraper.
	assert_false(DailyChallenge.can_catch_up(["2026-10-07", "2026-10-11"], "2026-10-11"))


func test_record_daily_keeps_best_and_streak() -> void:
	SaveManager.record_daily("2026-10-10", 8, 150000, "2026-10-10")
	SaveManager.record_daily("2026-10-11", 8, 120000, "2026-10-11")
	SaveManager.record_daily("2026-10-11", 7, 60000, "2026-10-11")  # même jour : pas de doublon
	var d := SaveManager.daily()
	assert_eq(d["days"], ["2026-10-10", "2026-10-11"])
	assert_eq(d["best"], {"correct": 8, "ms": 120000}, "plus de bonnes réponses d'abord, puis plus rapide")
	assert_eq(int(d["best_streak"]), 2)
	SaveManager.record_daily("", 10, 200000, "2026-10-11")  # entraînement : le record compte quand même
	assert_eq(int(SaveManager.daily()["best"]["correct"]), 10)
	assert_eq((SaveManager.daily()["days"] as Array).size(), 2)


func test_weekly_chest_after_five_challenges() -> void:
	for day in ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"]:
		SaveManager.record_daily(day, 6, 100000, day)
	assert_false(SaveManager.weekly_chest_ready("2026-10-08"))
	SaveManager.record_daily("2026-10-10", 6, 100000, "2026-10-10")
	assert_true(SaveManager.weekly_chest_ready("2026-10-10"))
	var xp := SaveManager.xp()
	SaveManager.open_weekly_chest("2026-10-10")
	assert_eq(SaveManager.xp(), xp + DailyChallenge.WEEKLY_CHEST_XP)
	assert_false(SaveManager.weekly_chest_ready("2026-10-11"), "un seul coffre par semaine")
	SaveManager.open_weekly_chest("2026-10-11")
	assert_eq(SaveManager.xp(), xp + DailyChallenge.WEEKLY_CHEST_XP)
	assert_false(SaveManager.weekly_chest_ready("2026-10-12"), "nouvelle semaine : tout recommence")


func test_old_save_without_daily_section_is_completed() -> void:
	var old := {"schema_version": 1, "xp": 300, "dungeons": {}, "bestiary": {}}
	SaveManager.data = SaveManager.migrate(old, 1)
	assert_eq(SaveManager.daily_days(), [])
	assert_eq(int(SaveManager.daily()["best"]["correct"]), 0)


func test_dungeons_open_one_after_the_other() -> void:
	for level in ["6e", "2nde"]:
		var dungeons := DungeonDef.all_for_level(level).filter(func(d: DungeonDef) -> bool: return d.subject == "maths")
		assert_eq(dungeons.size(), 3)
		assert_true(SaveManager.dungeon_unlocked(dungeons, 0))
		assert_false(SaveManager.dungeon_unlocked(dungeons, 1))
		SaveManager.set_checkpoint(dungeons[0].code, 3)
		assert_false(SaveManager.dungeon_unlocked(dungeons, 1), "à moitié fait : pas encore")
		SaveManager.complete_dungeon(dungeons[0].code)
		assert_true(SaveManager.dungeon_unlocked(dungeons, 1))
		assert_false(SaveManager.dungeon_unlocked(dungeons, 2))


func test_each_region_opens_its_first_dungeon() -> void:
	var dungeons := DungeonDef.all_for_level("6e")
	assert_eq(DungeonDef.subjects(dungeons), ["maths", "anglais"] as Array[String])
	var english := -1
	for i in dungeons.size():
		if dungeons[i].code == "bibliotheque_langues":
			english = i
	assert_true(english > 0)
	assert_eq(DungeonDef.previous(dungeons, english), null, "premier donjon de sa région")
	assert_true(SaveManager.dungeon_unlocked(dungeons, english), "ouvert sans finir les maths")
