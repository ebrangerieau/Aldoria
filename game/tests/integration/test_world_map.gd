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
	SaveManager.mark_story(Prologue.STORY_KEY)  # sinon la carte part vers le prologue
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
	assert_eq(_place("moulin_phrases")["status"], "open", "le Bois des Mots : le Moulin est ouvert")
	assert_eq(_place("puits_contes")["status"], "locked", "le Puits s'ouvre après le Moulin")
	assert_eq(_place("tour_experiences")["status"], "open", "le Laboratoire des Inventeurs : la Tour est ouverte")
	assert_eq(_place("maison_naturaliste")["status"], "locked", "la Maison s'ouvre après la Tour")
	assert_eq(_place("tour_oubli")["status"], "fog")
	assert_eq(_place("porte_origines")["status"], "open", "les Portes du Temps : la première porte est ouverte")
	assert_eq(_place("porte_horizons")["status"], "locked", "la deuxième s'ouvre après la première")
	SaveManager.complete_dungeon("tour_fractions")
	await _open()
	assert_eq(_place("tour_fractions")["status"], "done")
	assert_eq(_place("atelier_balances")["status"], "open")
	assert_eq((_scene._badge as HeroBadge).pages_text(), "Pages de la Chronique : 1 / 10")


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


func test_tom_physics_chemistry_lives_in_the_laboratory() -> void:
	assert_eq(WorldMapDef.region_of("physique_chimie"), "sciences")
	assert_eq(WorldMapDef.region_of("maths"), "maths")
	var lab: Array[DungeonDef] = []
	for d in DungeonDef.all_for_level("2nde"):
		if d.subject == "physique_chimie":
			lab.append(d)
	assert_eq(lab.size(), 2)
	assert_eq(lab[0].code, "alambic_elements")
	assert_string_contains(WorldMapDef.page_greeting(lab, 0), "Laboratoire foudroyé")
	assert_string_contains(WorldMapDef.page_greeting(lab, 1), "Laboratoire des Inventeurs")


func test_every_place_has_its_own_land_cell() -> void:
	var cells := [WorldMapDef.CITADEL, WorldMapDef.VILLAGE]
	for subject in WorldMapDef.REGIONS:
		cells.append_array(WorldMapDef.REGIONS[subject]["slots"])
	for id in WorldMapDef.SECRETS:
		cells.append(WorldMapDef.SECRETS[id]["cell"])
	for cell: Vector2i in cells:
		assert_eq(cells.count(cell), 1, "deux lieux sur %s" % cell)
		assert_ne(WorldMapDef.terrain(cell), "~", "lieu dans l'eau : %s" % cell)
	var snt: Array[DungeonDef] = []
	for d in DungeonDef.all_for_level("2nde"):
		if d.subject == "snt":
			snt.append(d)
	assert_eq(snt.map(func(d: DungeonDef) -> String: return d.code), ["pont_paquets", "atelier_automates"])


func test_tom_spanish_lives_with_his_english() -> void:
	assert_eq(WorldMapDef.region_of("espagnol"), "anglais")
	var languages: Array[DungeonDef] = []
	for d in DungeonDef.all_for_level("2nde"):
		if WorldMapDef.region_of(d.subject) == "anglais":
			languages.append(d)
	assert_eq(languages.map(func(d: DungeonDef) -> String: return d.code),
		["bibliotheque_engloutie", "port_couronnes", "moulin_mancha"])
	assert_lte(languages.size(), (WorldMapDef.REGIONS["anglais"]["slots"] as Array).size(), "une case par lieu")
	assert_true(SaveManager.dungeon_unlocked(languages, 2), "le premier lieu d'espagnol est ouvert")
	assert_string_contains(WorldMapDef.page_greeting(languages, 1), "toutes les pages de cette matière")
	assert_string_contains(WorldMapDef.page_greeting(languages, 2), "toutes les pages de cette matière")


func test_map_titles_drop_their_article() -> void:
	assert_eq(_short("La Tour des Fractions"), "Tour des Fractions")
	assert_eq(_short("L'Atelier des Balances"), "Atelier des Balances")
	assert_eq(_short("Clairval"), "Clairval")


func _short(title: String) -> String:
	return (load("res://scenes/world_map/world_map.gd") as GDScript).call("short_title", title)


func test_every_effaceur_speaks_and_every_page_tells_its_story() -> void:
	for level in ["6e", "2nde"]:
		for d in DungeonDef.all_for_level(level):
			assert_gt(d.boss_intro.length(), 30, d.code)
			assert_gt(d.boss_defeat.length(), 20, d.code)
			assert_gt(d.page_text.length(), 40, d.code)


func test_ysaline_greets_a_returned_page_once() -> void:
	SaveManager.complete_dungeon("tour_fractions")
	await _open()
	await wait_process_frames(5)
	assert_true(SaveManager.story_seen("page_tour_fractions"))
	var texts: Array = _scene.find_children("*", "Label", true, false).map(func(l: Label) -> String: return l.text)
	assert_true(texts.any(func(t: String) -> bool: return "page des Fractions" in t and "Atelier des Balances" in t), "le chemin suivant est annoncé")
	assert_false(SaveManager.story_seen("page_atelier_balances"))


func _touch(index: int, at: Vector2, pressed: bool) -> void:
	var e := InputEventScreenTouch.new()
	e.index = index
	e.position = at
	e.pressed = pressed
	_scene._unhandled_input(e)


func _drag(index: int, at: Vector2, relative: Vector2) -> void:
	var e := InputEventScreenDrag.new()
	e.index = index
	e.position = at
	e.relative = relative
	_scene._unhandled_input(e)


func test_pinch_zooms_and_a_finger_moves_the_map() -> void:
	await _open()
	var far: float = _scene._distance
	var focus: Vector3 = _scene._focus
	# Carte entière : rien à déplacer.
	_touch(0, Vector2(600, 400), true)
	_drag(0, Vector2(700, 400), Vector2(100, 0))
	_touch(0, Vector2(700, 400), false)
	assert_eq(_scene._focus, focus, "carte entière : elle ne glisse pas")
	assert_false(_scene._panel_open, "un doigt qui glisse n'ouvre pas de lieu")
	# Deux doigts qui s'écartent : la caméra se rapproche, sans jamais dépasser la limite.
	_touch(0, Vector2(600, 400), true)
	_touch(1, Vector2(700, 400), true)
	_drag(1, Vector2(800, 400), Vector2(100, 0))
	assert_lt(_scene._distance, far, "zoom avant")
	for i in 10:
		_drag(1, Vector2(900 + 100 * i, 400), Vector2(100, 0))
	assert_almost_eq(_scene._distance, _scene.CAMERA_NEAR, 0.01, "zoom borné")
	_touch(1, Vector2(1800, 400), false)
	_touch(0, Vector2(600, 400), false)
	assert_false(_scene._panel_open, "deux doigts : jamais un toucher de lieu")
	# Zoomé : un doigt déplace la carte.
	focus = _scene._focus
	_touch(0, Vector2(600, 400), true)
	_drag(0, Vector2(700, 400), Vector2(100, 0))
	_touch(0, Vector2(700, 400), false)
	assert_lt(_scene._focus.x, focus.x, "glisser vers la droite montre l'ouest de la carte")
	# Les boutons ramènent à la carte entière, et un lieu se touche encore après un zoom.
	for i in 10:
		_scene.zoom_by(1.0 / _scene.ZOOM_STEP)
	assert_almost_eq(_scene._distance, far, 0.01)
	assert_eq(_scene._focus, _scene._home, "dézoomée, la carte revient au centre")
	var at: Vector2 = _scene._camera.unproject_position(WorldMapDef.cell_position(_place("tour_fractions")["cell"]) + Vector3(0, 1.0, 0))
	assert_eq(_scene.pick(at)["id"], "tour_fractions")
