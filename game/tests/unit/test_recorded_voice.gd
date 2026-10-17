extends GutTest
## Voix enregistrées (tools/voix_elevenlabs.py) : le jeu retrouve le son d'un texte par la même
## empreinte que le script Python, et le joue à la place de la voix du serveur.

var _saved_recorded: Dictionary
var _saved_cache: Dictionary


func before_each() -> void:
	_saved_recorded = Voice._recorded.duplicate()
	_saved_cache = Voice._cache.duplicate()


func after_each() -> void:
	Voice._recorded = _saved_recorded
	Voice._cache = _saved_cache


func test_same_fingerprint_as_the_generation_script() -> void:
	# hashlib.sha256("Maître Ysaline".encode("utf-8")).hexdigest()
	assert_eq("Maître Ysaline".sha256_text(), "f0b717af47b7fc71a7fa7bb4c2225941dc0eccc3ed5e1575bbdedb20c3bcbbf6")


func test_a_recorded_text_plays_its_own_sound() -> void:
	var text := "Te voilà enfin !"
	var sound := AudioStreamMP3.new()
	Voice._recorded[text.sha256_text()] = "prologue-ysaline-test.mp3"
	Voice._cache["voix/prologue-ysaline-test.mp3"] = sound
	assert_true(Voice.has_recording(text))
	assert_eq(await Voice._fetch(text, "fr-FR", 0.95), sound)
	assert_false(Voice.has_recording("Un autre texte."), "les autres textes passent par Piper")


func test_the_lines_to_record_follow_the_texts_of_the_game() -> void:
	var path := ProjectSettings.globalize_path("res://").path_join("../content/voix/lignes.json")
	var lines: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	assert_true(lines is Array, "content/voix/lignes.json (tools/export_voice_lines.gd)")
	if not lines is Array:
		return
	var known := {}
	for line: Dictionary in lines:
		known[str(line["texte"])] = true
	var texts: Array[String] = [WorldMapDef.WELCOME, WorldMapDef.CITADEL_TEXT]
	for entry: Dictionary in Prologue.PAGES:
		texts.append(str(entry["lumineux"]))
		texts.append(str(entry["brouillard"]))
	for level in DirAccess.get_directories_at(ProjectSettings.globalize_path("res://").path_join("../content/seed")):
		var dungeons := DungeonDef.all_for_level(level)
		for i in dungeons.size():
			texts.append(dungeons[i].threshold)
			texts.append(WorldMapDef.page_greeting(dungeons, i))
	for text in texts:
		assert_true(known.has(text), "texte modifié : relancer tools/export_voice_lines.gd (%s…)" % text.left(40))
