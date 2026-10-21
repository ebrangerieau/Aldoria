class_name SphinxScene
extends Node3D
## Île du Sphinx : jeux de logique, sans question de leçon ni chrono. Une traversée (un passage,
## SphinxIsland) propose trois énigmes de blocs du temple : pousser les blocs de pierre sur les
## dalles gravées, sans jamais pouvoir les tirer (SphinxBoard, SphinxTemple). Annuler, recommencer
## et l'aide du Sphinx (il rejoue le début de la solution, un tiers de plus à chaque appel) sont
## toujours là. Trois énigmes résolues sans aide font monter d'un palier. Rien n'est envoyé au
## suivi des notions ; la session (mode « sphinx ») compte seulement le temps de jeu.

const STEP_SECONDS := 0.17
const SHOW_SECONDS := 0.12  # pas rejoués par l'aide du Sphinx
const VIEW_PITCH := -58.0
const VIEW_FOV := 40.0
const SWIPE := 42.0  # pixels : au-delà, un doigt qui glisse fait un pas dans sa direction
const STORY_KEY := "sphinx_intro"
const KEYS := {KEY_LEFT: "l", KEY_A: "l", KEY_Q: "l", KEY_RIGHT: "r", KEY_D: "r", KEY_UP: "u", KEY_W: "u", KEY_Z: "u",
	KEY_DOWN: "d", KEY_S: "d"}

signal _puzzle_over

var _wt: WorldTheme
var _board: SphinxBoard
var _temple: SphinxTemple
var _level: Dictionary
var _tier := 1
var _hero: Fighter
var _pet: Companion
var _camera: Camera3D
var _fx: CombatFx
var _hud: CombatHud
var _controls: Control
var _tip: Label
var _buttons: Dictionary = {}
var _busy := false  # un pas est en cours d'animation
var _showing := false  # le Sphinx rejoue la solution : le joueur regarde
var _playing := false  # énigme en cours : le joueur peut bouger
var _queued := ""
var _walk: Array[Vector2i] = []  # chemin vers une dalle touchée
var _hints := 0  # aides du Sphinx sur l'énigme en cours
var _solved := 0
var _rest := 0.0
var _press_at := Vector2(-1, -1)
var _ending := false


func _ready() -> void:
	_wt = WorldTheme.for_world(Session.world())
	_build_environment()
	_camera = Camera3D.new()
	_camera.fov = VIEW_FOV
	_camera.far = 200.0
	add_child(_camera)
	_camera.make_current()
	_fx = CombatFx.new()
	add_child(_fx)
	_fx.camera = _camera
	_hero = Fighter.create_hero(SaveManager.look(), _wt.hero_name, Progression.hero_max_hp(SaveManager.level()))
	add_child(_hero)
	if Quality.settings().vertex_shading:
		MobileLighting.apply_vertex_shading(_hero)
	if _wt.companion:
		_pet = Companion.create(SaveManager.look())  # assis près du Sphinx : il ne pousse pas de bloc
		add_child(_pet)
		if Quality.settings().vertex_shading:
			MobileLighting.apply_vertex_shading(_pet)
	_hud = CombatHud.new()
	add_child(_hud)
	_hud.setup(_wt, _wt.hero_name)
	_hud.quit_requested.connect(_quit)
	_hud.show_actions(false)
	_hud.set_enemy_visible(false)
	_hud.set_hero_hp_visible(false)
	_build_controls()
	_run()


func _build_environment() -> void:
	var colors := SphinxTemple.palette(_wt.id)
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = colors["sky"]
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = colors["ambient"]
	env.ambient_light_energy = 0.42
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var world_env := WorldEnvironment.new()
	world_env.environment = env
	add_child(world_env)
	var sun := DirectionalLight3D.new()
	sun.light_color = colors["sun"]
	sun.light_energy = float(colors["sun_energy"])
	sun.rotation_degrees = Vector3(-52, -30, 0)
	sun.shadow_enabled = Quality.settings().shadows
	Quality.dress_sun(sun)
	add_child(sun)


# --- Déroulement -----------------------------------------------------------------------------

## Développement, PC uniquement : `-- --sphinx=<palier>:<indice>[:<pas>]` passe l'accueil, ouvre
## cette énigme et rejoue ses premiers pas de solution (captures) ; sans passage, la barque part quand même.
func _dev_option() -> String:
	return Quality.option("sphinx") if not OS.has_feature("web") else ""


func _run() -> void:
	if not SaveManager.spend_passage() and _dev_option() == "":
		await _message("La barque", "Tu n'as pas de passage pour l'île. %s" % SphinxIsland.HOW_TO_EARN, "Retour à la carte")
		_quit()
		return
	if _dev_option() == "":
		if not SaveManager.story_seen(STORY_KEY):
			SaveManager.mark_story(STORY_KEY)
			await _message("Le Sphinx", _welcome(), "Au premier bloc !")
		else:
			await _message("Le Sphinx", "Te revoilà, Archiviste ! %d énigmes t'attendent dans mon temple." % SphinxIsland.VISIT_PUZZLES, "J'entre")
	for round in SphinxIsland.VISIT_PUZZLES:
		if Session.time_over():
			break
		await _play_puzzle(round)
		if _ending:
			return
		if Accessibility.pause_due() and round < SphinxIsland.VISIT_PUZZLES - 1:
			if await _pause():
				break
	await _finish()


func _welcome() -> String:
	var how := "Pour marcher : les flèches du clavier." if Quality.is_desktop() \
		else "Pour marcher : les flèches de l'écran, ou fais glisser ton doigt, ou touche une dalle."
	return "Bienvenue sur mon île, jeune Archiviste. Je suis le Sphinx, gardien de ce temple. Ici, pas de leçon à réciter : il faut réfléchir. Pousse les blocs de pierre jusqu'aux dalles gravées. Tu peux pousser un bloc, jamais le tirer. Si un bloc se coince, annule ton dernier pas ou recommence. Et si tu sèches, demande mon aide. %s" % how


func _play_puzzle(round: int) -> void:
	var pick := SaveManager.next_sphinx_puzzle()
	var dev := _dev_option().split(":")
	if round == 0 and dev.size() >= 2:
		pick = {"tier": int(dev[0]), "index": int(dev[1])}
	_tier = int(pick["tier"])
	_level = SphinxIsland.level(_tier, int(pick["index"]))
	_board = SphinxBoard.from_rows(_level["rows"])
	if _temple != null:
		_temple.queue_free()
	_temple = SphinxTemple.new()
	add_child(_temple)
	_temple.setup(_board, _wt)
	_place_hero()
	if _pet:
		_pet.position = _temple.sphinx_head() + Vector3(3.6, -4.6, 2.0)
		_pet.rotation.y = 0.0
	_point_camera()
	_hints = 0
	_refresh()
	_tip.text = "Pousse chaque bloc sur une dalle gravée."
	_controls.visible = true
	_playing = true
	if round == 0 and dev.size() >= 3:
		_show_steps(str(_level["solution"]).substr(0, int(dev[2])))
	await _puzzle_over
	_playing = false
	_controls.visible = false
	if _ending:
		return
	await _celebrate(round)


## Bandeau (énigme, palier, pas et poussées) et boutons Annuler / Recommencer.
func _refresh() -> void:
	_hud.set_status("Énigme du temple %d / %d" % [_solved + 1, SphinxIsland.VISIT_PUZZLES],
		"Palier %d · %d pas · %d poussée%s" % [_tier, _board.moves, _board.pushes, "s" if _board.pushes > 1 else ""])
	(_buttons["undo"] as Button).disabled = not _board.can_undo()
	(_buttons["restart"] as Button).disabled = not _board.can_undo()


func _celebrate(round: int) -> void:
	_temple.celebrate()
	Sfx.play("victory")
	for point in _temple.goal_points():
		_fx.burst(point, SphinxTemple.palette(_wt.id)["glow"], 16 if not Accessibility.on("calm") else 5, 2.2)
	_hero.play(["Cheer", "Interact"])
	if _pet:
		_pet.celebrate()
	_hud.banner("Énigme résolue !", _wt.good)
	var up := SaveManager.record_sphinx_solved(_hints > 0)
	_solved += 1
	await get_tree().create_timer(1.6).timeout
	var lines: Array[String] = ["Résolue en %d pas et %d poussées." % [_board.moves, _board.pushes]]
	if _hints == 0 and _board.pushes <= int(_level["pushes"]):
		lines.append("Le moins de poussées possible : même moi, je n'aurais pas fait mieux !")
	elif _hints > 0:
		lines.append("Avec mon aide, cette fois. La prochaine, tu la trouveras seul.")
	if up:
		lines.append("Tu es digne d'énigmes plus difficiles : palier %d !" % int(SaveManager.sphinx()["tier"]))
	var last := round == SphinxIsland.VISIT_PUZZLES - 1
	await _message("Le Sphinx", " ".join(lines), "Terminer" if last else "Énigme suivante")


func _finish() -> void:
	if _ending:
		return
	_ending = true
	var s := SaveManager.sphinx()
	var text := "Énigmes résolues pendant cette traversée : %d. Sceaux du Sphinx gagnés en tout : %d. La barque te ramène sur la grande île." % [_solved, int(s["solved"])]
	if Session.time_over():
		text += " " + Session.rest_text()
	_controls.visible = false
	await _message("Le Sphinx", text, "Retour à la carte")
	_leave()


# --- Héros et blocs --------------------------------------------------------------------------

func _place_hero() -> void:
	_hero.position = _temple.cell_position(_board.player)
	_hero.rotation.y = 0.0  # tourné vers la caméra
	_hero.idle()


func _face(dir: Vector2i) -> void:
	_hero.rotation.y = atan2(float(dir.x), float(dir.y))


func _process(delta: float) -> void:
	if _busy or not _playing:
		_rest = 0.0
		return
	_rest += delta
	if _rest > 0.12 and _hero.is_playing("Walking_A"):
		_hero.idle()


## Un pas (et la poussée d'un bloc) ; un pas demandé pendant l'animation attend son tour.
func _try_step(letter: String) -> void:
	if not _playing or _showing:
		return
	if _busy:
		_queued = letter
		return
	_walk.clear()
	await _step(letter)
	while _queued != "" and _playing and not _busy:
		var next := _queued
		_queued = ""
		await _step(next)


func _step(letter: String, seconds := STEP_SECONDS) -> bool:
	var dir: Vector2i = SphinxBoard.DIRS[letter]
	_face(dir)
	var res := _board.step(dir)
	if not res["moved"]:
		return false
	_busy = true
	_hero.loop("Walking_A", 1.3)
	var tween := create_tween().set_parallel()
	tween.tween_property(_hero, "position", _temple.cell_position(_board.player), seconds)
	var box := int(res["box"])
	if box >= 0:
		tween.tween_property(_temple.box_node(box), "position", _temple.cell_position(_board.boxes[box]), seconds)
		Sfx.play("hit", 0.7)
	await tween.finished
	_busy = false
	_rest = 0.0
	if box >= 0:
		_temple.refresh_marks()
		if _board.boxes[box] in _board.goals:
			Sfx.play("correct")
	_after_move(box)
	return true


func _after_move(box: int) -> void:
	_refresh()
	if _board.is_solved():
		_playing = false
		_walk.clear()
		_queued = ""
		_puzzle_over.emit()
		return
	if box >= 0 and _board.stuck_box() == box:
		_tip.text = "Ce bloc est coincé dans un coin : il ne bougera plus. Annule ou recommence."
	elif box >= 0:
		_tip.text = ""


## Marche jusqu'à une dalle touchée, pas à pas, sans pousser de bloc.
func _walk_to(cell: Vector2i) -> void:
	var path := _board.path_to(cell)
	if path.is_empty() or _busy or _showing:
		return
	_walk = path
	while not _walk.is_empty() and _playing:
		var dir: Vector2i = _walk.pop_front()
		if not await _step(_letter(dir), STEP_SECONDS * 0.8):
			break
	_walk.clear()


static func _letter(dir: Vector2i) -> String:
	for key: String in SphinxBoard.DIRS:
		if SphinxBoard.DIRS[key] == dir:
			return key
	return ""


func _undo() -> void:
	if _busy or _showing or not _playing:
		return
	var res := _board.undo()
	if not res["undone"]:
		return
	_busy = true
	var tween := create_tween().set_parallel()
	tween.tween_property(_hero, "position", _temple.cell_position(_board.player), STEP_SECONDS * 0.8)
	var box := int(res["box"])
	if box >= 0:
		tween.tween_property(_temple.box_node(box), "position", _temple.cell_position(_board.boxes[box]), STEP_SECONDS * 0.8)
	await tween.finished
	_busy = false
	_temple.refresh_marks()
	_tip.text = ""
	_refresh()


func _restart() -> void:
	if _busy or _showing or not _playing:
		return
	_board.restart()
	_temple.place_boxes()
	_place_hero()
	_tip.text = "On recommence. Prends le temps de regarder avant de pousser."
	_refresh()


## L'aide du Sphinx : il remet la salle comme au départ et rejoue le début de la solution, un tiers
## de plus à chaque appel (au troisième, toute la solution). L'énigme ne compte plus pour le palier.
func _help() -> void:
	if _busy or _showing or not _playing:
		return
	_hints += 1
	var solution := str(_level["solution"])
	var total := 0
	for c in solution:
		if c == c.to_upper():
			total += 1
	var target := ceili(total * mini(_hints, 3) / 3.0)
	var shown := ""
	var count := 0
	for c in solution:
		if count >= target:
			break
		shown += c
		if c == c.to_upper():
			count += 1
	_board.restart()
	_temple.place_boxes()
	_place_hero()
	_tip.text = "Regarde bien…"
	await _show_steps(shown)
	if _playing:
		_tip.text = "À toi de continuer !" if _hints < 3 else "Voilà le chemin. Essaie de t'en souvenir."


func _show_steps(steps: String) -> void:
	_showing = true
	_refresh()
	for c in steps:
		if not _playing:
			break
		await _step(c.to_lower(), SHOW_SECONDS)
	_showing = false


# --- Commandes ---------------------------------------------------------------------------------

func _build_controls() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 9  # sous les panneaux du HUD
	add_child(layer)
	_controls = Control.new()
	_controls.set_anchors_preset(Control.PRESET_FULL_RECT)
	_controls.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_controls.theme = UiKit.make_theme(_wt)
	_controls.visible = false
	layer.add_child(_controls)
	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for side in ["top", "right", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 16)
	margin.add_theme_constant_override("margin_left", int(Music.button_width()) + 28)  # coin du bouton de la musique
	_controls.add_child(margin)
	var row := HBoxContainer.new()
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_theme_constant_override("separation", 14)
	margin.add_child(row)

	var left := VBoxContainer.new()
	left.mouse_filter = Control.MOUSE_FILTER_IGNORE
	left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	left.alignment = BoxContainer.ALIGNMENT_END
	row.add_child(left)
	_tip = UiKit.on_scene(UiKit.label("", 21))
	_tip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	left.add_child(_tip)
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 12)
	left.add_child(actions)
	for spec in [["undo", "Annuler", "backward-time", _undo], ["restart", "Recommencer", "sands-of-time", _restart],
			["help", "Aide du Sphinx", "light-bulb", _help]]:
		var b := UiKit.icon_button(spec[1], spec[2], 60.0)
		if spec[0] != "help":
			UiKit.style_secondary(b, _wt)
		b.pressed.connect(spec[3])
		actions.add_child(b)
		_buttons[spec[0]] = b

	# Croix de direction (tablette, téléphone, souris).
	var pad := GridContainer.new()
	pad.columns = 3
	pad.add_theme_constant_override("h_separation", 6)
	pad.add_theme_constant_override("v_separation", 6)
	pad.size_flags_vertical = Control.SIZE_SHRINK_END
	row.add_child(pad)
	var size := 70.0 * (1.15 if Accessibility.on("big_targets") else 1.0)
	for slot in ["", "u", "", "l", "", "r", "", "d", ""]:
		if slot == "":
			var empty := Control.new()
			empty.custom_minimum_size = Vector2(size, size)
			empty.mouse_filter = Control.MOUSE_FILTER_IGNORE
			pad.add_child(empty)
			continue
		var name: String = {"u": "arrow-up", "d": "arrow-down", "l": "arrow-left", "r": "arrow-right"}[slot]
		var arrow := UiKit.icon_button("", name, size)
		arrow.custom_minimum_size = Vector2(size, size)
		arrow.tooltip_text = {"u": "Haut", "d": "Bas", "l": "Gauche", "r": "Droite"}[slot]
		UiKit.style_secondary(arrow, _wt)
		arrow.pressed.connect(_try_step.bind(slot))
		pad.add_child(arrow)


func _unhandled_input(event: InputEvent) -> void:
	if not _playing:
		return
	if event is InputEventKey and event.pressed:
		var key := (event as InputEventKey).keycode
		if KEYS.has(key):
			_try_step(KEYS[key])
		elif key == KEY_BACKSPACE:
			_undo()
		elif key == KEY_R and not event.is_echo():
			_restart()
		else:
			return
		get_viewport().set_input_as_handled()
		return
	if event.device == InputEvent.DEVICE_ID_EMULATION:
		return  # souris imitée à partir du toucher : déjà traité
	var pressed := false
	var at := Vector2.ZERO
	if event is InputEventScreenTouch and (event as InputEventScreenTouch).index == 0:
		pressed = (event as InputEventScreenTouch).pressed
		at = (event as InputEventScreenTouch).position
	elif event is InputEventMouseButton and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT:
		pressed = (event as InputEventMouseButton).pressed
		at = (event as InputEventMouseButton).position
	else:
		return
	if pressed:
		_press_at = at
		return
	if _press_at.x < 0:
		return
	var delta := at - _press_at
	_press_at = Vector2(-1, -1)
	if delta.length() >= SWIPE:
		var letter := ("r" if delta.x > 0 else "l") if absf(delta.x) > absf(delta.y) else ("d" if delta.y > 0 else "u")
		_try_step(letter)
		return
	var cell := _cell_at(at)
	var offset := cell - _board.player
	if absi(offset.x) + absi(offset.y) == 1:
		_try_step(_letter(offset))
	elif _board.is_free(cell):
		_walk_to(cell)


## Dalle sous un point de l'écran.
func _cell_at(at: Vector2) -> Vector2i:
	var origin := _camera.project_ray_origin(at)
	var direction := _camera.project_ray_normal(at)
	if absf(direction.y) < 0.001:
		return Vector2i(-1, -1)
	var hit := origin + direction * (-origin.y / direction.y)
	return Vector2i(roundi(hit.x / SphinxTemple.TILE + (_board.width - 1) / 2.0),
		roundi(hit.z / SphinxTemple.TILE + (_board.height - 1) / 2.0))


## Caméra qui cadre tout le temple, entre le bandeau du haut et les commandes du bas.
func _point_camera() -> void:
	var size := _temple.footprint()
	var view := get_viewport().get_visible_rect().size
	var aspect := view.x / maxf(view.y, 1.0)
	var half := tan(deg_to_rad(VIEW_FOV / 2.0))
	var pitch := deg_to_rad(VIEW_PITCH)
	# Le temple et, au nord, la tête du Sphinx ; place en haut pour le bandeau, en bas pour les commandes.
	var by_depth := (size.y * sin(-pitch) + 9.0) / (2.0 * half) * 1.3
	var by_width := (size.x + 3.0) / (2.0 * half * aspect) * 1.3
	var distance := maxf(by_depth, by_width)
	var target := Vector3(size.x * 0.04, 0, -2.2)
	if Quality.is_phone() or UiKit.text_scale > 1.2:  # commandes plus grandes : le temple monte et recule
		distance *= 1.2
		target += Vector3(size.x * 0.08, 0, 1.2)
	_camera.rotation = Vector3(pitch, 0, 0)
	_camera.position = target + Vector3(0, -sin(pitch) * distance, cos(pitch) * distance)


# --- Panneaux et sortie ---------------------------------------------------------------------

func _pause() -> bool:
	var panel := UiKit.pause_panel(_wt)
	_hud.show_panel(panel[0])
	var choice: Array = []
	(panel[1] as Button).pressed.connect(func() -> void: choice.append(false))
	(panel[2] as Button).pressed.connect(func() -> void: choice.append(true))
	while choice.is_empty():
		await get_tree().process_frame
	_hud.clear_panel()
	if not choice[0]:
		Accessibility.snooze_pause()
	return choice[0]


func _message(title: String, body: String, button_text: String) -> void:
	var panel := UiKit.message_panel(_wt, title, body, button_text)
	_hud.show_panel(panel[0])
	await (panel[1] as Button).pressed
	_hud.clear_panel()


func _quit() -> void:
	if _ending:
		return
	_ending = true
	_playing = false
	_puzzle_over.emit()
	_leave()


func _leave() -> void:
	_hud.clear_panel()
	await Session.end()
	get_tree().change_scene_to_file(Departure.MAP_SCENE)
