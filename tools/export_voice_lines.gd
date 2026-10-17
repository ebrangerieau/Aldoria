extends SceneTree
## Répliques à faire dire par des voix enregistrées (tools/voix_elevenlabs.py) : le prologue (narrateur,
## puis Maître Ysaline) et tout ce que Maître Ysaline dit sur la carte (accueil, Citadelle, village, seuil
## de chaque donjon, page rapportée, régions dans le brouillard, lieux secrets), pour toutes les classes
## qui ont un programme (content/seed/<classe>/). Le texte est exactement celui que le jeu lit : le jeu
## retrouve un son par l'empreinte SHA-256 de son texte (autoload Voice).
## Écrit content/voix/lignes.json ; à relancer après la modification d'un de ces textes.
##
## Usage : godot --headless --path game --script ../tools/export_voice_lines.gd

const OUT := "res://../content/voix/lignes.json"
const SEED := "../content/seed"

var _lines: Array = []
var _seen: Dictionary = {}


func _init() -> void:
	await process_frame  # autoloads prêts ; scripts chargés ensuite (ils utilisent les autoloads)
	var prologue: GDScript = load("res://scenes/prologue/prologue.gd")
	var map_def: GDScript = load("res://worlds/shared/world_map_def.gd")
	var dungeon_def: GDScript = load("res://worlds/shared/dungeon_def.gd")
	var village_def: GDScript = load("res://worlds/shared/village_def.gd")
	var map_consts := map_def.get_script_constant_map()
	for entry: Dictionary in prologue.get_script_constant_map()["PAGES"]:
		var voice := "narrateur" if str(entry["speaker"]) == "" else "ysaline"
		for world in ["lumineux", "brouillard"]:
			_add("prologue", "prologue-%s-%s" % [entry["shot"], world], voice, str(entry[world]))
	_add("carte", "carte-accueil", "ysaline", str(map_consts["WELCOME"]))
	_add("carte", "carte-citadelle", "ysaline", str(map_consts["CITADEL_TEXT"]))
	var regions: Dictionary = map_consts["REGIONS"]
	for region: String in regions:
		_add("carte", "brouillard-" + region, "ysaline", str(regions[region]["fog"]))
	var secrets: Dictionary = map_consts["SECRETS"]
	for secret: String in secrets:
		_add("carte", "secret-" + secret, "ysaline", str(secrets[secret]["text"]))
	for level in _levels():
		var village: Resource = village_def.for_level(level)
		if village != null:
			_add("carte", "village-" + level, "ysaline", str(village.get("intro")))
		var dungeons: Array = dungeon_def.all_for_level(level)
		for i in dungeons.size():
			var code := str(dungeons[i].get("code"))
			_add("carte", "seuil-" + code, "ysaline", str(dungeons[i].get("threshold")))
			_add("carte", "page-" + code, "ysaline", str(map_def.page_greeting(dungeons, i)))
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT.get_base_dir()))
	var file := FileAccess.open(OUT, FileAccess.WRITE)
	file.store_string(JSON.stringify(_lines, "  ") + "\n")
	file.close()
	var chars := 0
	for line: Dictionary in _lines:
		chars += str(line["texte"]).length()
	print("%d répliques, %d caractères -> %s" % [_lines.size(), chars, ProjectSettings.globalize_path(OUT)])
	quit()


## Classes dont le programme est chargé (même règle que l'API : un dossier dans content/seed).
func _levels() -> Array[String]:
	var found: Array[String] = []
	for dir in DirAccess.get_directories_at(ProjectSettings.globalize_path("res://").path_join(SEED)):
		found.append(dir)
	found.sort()
	return found


func _add(group: String, id: String, voice: String, text: String) -> void:
	if text.strip_edges() == "" or _seen.has(text):
		return  # même texte, même son
	_seen[text] = true
	_lines.append({"id": id, "groupe": group, "voix": voice, "texte": text})
