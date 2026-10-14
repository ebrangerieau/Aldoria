extends GutTest
## Carte du royaume (docs/histoire.md) : lieux et leur état selon la classe et la progression,
## brouillard sur les régions pas encore au programme, toucher un lieu, textes des seuils.

var _scene: Node
var _saved_token := ""


func before_each() -> void:
	_saved_token = ApiClient.token
	ApiClient.token = ""  # pas de réseau : la sauvegarde reste en mémoire
	SaveManager._profile_id = 0
	SaveManager.data = SaveManager.default_data()
	SaveManager.mark_story("welcome")  # pas d'accueil de Maître Ysaline par-dessus la carte
	Session.profile = {"name": "Test", "world": "lumineux", "level": "6e"}


func after_each() -> void:
	if is_instance_valid(_scene):
		_scene.queue_free()
	await wait_process_frames(2)
	ApiClient.token = _saved_token
	Session.profile = {}
	SaveManager.data = SaveManager.default_data()


func _open() -> void:
	if is_instance_valid(_scene):
		_scene.queue_free()
		await wait_process_frames(2)
	_scene = (load("res://scenes/world_map/world_map.tscn") as PackedScene).instantiate()
	add_child(_scene)
	await wait_process_frames(3)


func _place(id: String) -> Dictionary:
	for p in _scene._places:
		if p["id"] == id:
			return p
	return {}


func test_places_follow_the_class_and_progress() -> void:
	await _open()
	assert_eq(_place("citadelle")["status"], "open")
	assert_eq(_place("village")["status"], "open")
	assert_eq(_place("tour_fractions")["status"], "open")
	assert_eq(_place("atelier_balances")["status"], "locked", "fermé tant que la Tour n'est pas reprise")
	assert_eq(_place("bibliotheque_langues")["status"], "open", "chaque région a son premier donjon ouvert")
	assert_eq(_place("francais")["status"], "fog", "pas de français en 6e : Bois des Mots dans le brouillard")
	assert_eq(_place("tour_oubli")["status"], "fog")
	assert_eq(_place("portes_temps")["status"], "fog")
	SaveManager.complete_dungeon("tour_fractions")
	await _open()
	assert_eq(_place("tour_fractions")["status"], "done")
	assert_eq(_place("atelier_balances")["status"], "open")
	assert_eq((_scene._pages as Label).text, "Pages de la Chronique : 1 / 4")


func test_dungeons_sit_in_their_region() -> void:
	await _open()
	assert_eq(_place("tour_fractions")["cell"], WorldMapDef.REGIONS["maths"]["slots"][0])
	assert_eq(_place("observatoire_angles")["cell"], WorldMapDef.REGIONS["maths"]["slots"][2])
	assert_eq(_place("bibliotheque_langues")["cell"], WorldMapDef.REGIONS["anglais"]["slots"][0])
	for cell in [WorldMapDef.CITADEL, WorldMapDef.VILLAGE] + WorldMapDef.REGIONS["maths"]["slots"]:
		assert_ne(WorldMapDef.terrain(cell), "~", "lieu sur la terre ferme")


func test_touching_a_place_picks_it() -> void:
	await _open()
	var camera: Camera3D = _scene._camera
	var tower := _place("tour_fractions")
	var at := camera.unproject_position(WorldMapDef.cell_position(tower["cell"]) + Vector3(0, 1.0, 0))
	assert_eq(_scene.pick(at)["id"], "tour_fractions")
	assert_true(_scene.pick(Vector2(-500, -500)).is_empty(), "loin de tout lieu : rien")


func test_every_dungeon_has_its_threshold() -> void:
	for level in ["6e", "2nde"]:
		for d in DungeonDef.all_for_level(level):
			assert_gt(d.threshold.length(), 60, d.code)
			assert_true(d.page.begins_with("la page"), d.code)
			assert_true(ResourceLoader.exists(WorldMapDef.PIECES % d.map_piece), d.map_piece)
	assert_eq(WorldMapDef.size().x > 20.0, true)


func test_map_titles_drop_their_article() -> void:
	assert_eq(_short("La Tour des Fractions"), "Tour des Fractions")
	assert_eq(_short("L'Atelier des Balances"), "Atelier des Balances")
	assert_eq(_short("Clairval"), "Clairval")


func _short(title: String) -> String:
	return (load("res://scenes/world_map/world_map.gd") as GDScript).call("short_title", title)
