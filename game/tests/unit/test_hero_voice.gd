extends GutTest
## Le héros parle entre les salles : indice juste sur la suite, pas de répétition.

var _saved: Array


func before_each() -> void:
	HeroVoice._load()
	_saved = HeroVoice._recent.duplicate()
	HeroVoice._recent.clear()


func after_each() -> void:
	HeroVoice._recent = _saved
	HeroVoice._save()


func test_hint_matches_the_next_room() -> void:
	var rooms := DungeonDef.tour_fractions().rooms
	var bank: Dictionary = HeroVoice.LINES["lumineux"]
	var before_enigma := HeroVoice.before_room("lumineux", rooms, 3)
	assert_true(bank["enigme"].any(func(l: String) -> bool: return l in before_enigma), before_enigma)
	var before_boss := HeroVoice.before_room("lumineux", rooms, 5)
	assert_true(bank["boss"].any(func(l: String) -> bool: return l in before_boss), before_boss)
	assert_false("salles" in before_boss, "pas de décompte devant le boss")
	var first := HeroVoice.before_room("lumineux", rooms, 1, true)
	assert_true(bank["start"].any(func(l: String) -> bool: return l.begins_with(first.get_slice(" ", 0))), first)
	assert_string_contains(first, "4")
	assert_eq(HeroVoice.before_room("lumineux", rooms, 6), "", "plus de salle")


func test_no_repetition_among_recent_lines() -> void:
	var options: Array = HeroVoice.LINES["lumineux"]["cleared"]
	var said := []
	for i in options.size():
		said.append(HeroVoice.pick(options))
	assert_eq(said.size(), options.size())
	var unique := {}
	for line in said:
		unique[line] = true
	assert_eq(unique.size(), options.size(), "toutes différentes avant de se répéter")


func test_fog_world_has_its_own_tone() -> void:
	var line := HeroVoice.before_room("brouillard", DungeonDef.labyrinthe_vecteurs().rooms, 1, true)
	var bank: Dictionary = HeroVoice.LINES["brouillard"]
	assert_true(bank["combat"].any(func(l: String) -> bool: return l in line), line)
