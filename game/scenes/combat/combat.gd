extends Node3D
## Arène d'entraînement (prototype de la phase 1) : des vagues d'ennemis de plus
## en plus résistants, sans exploration. Le combat lui-même est dans
## core/combat/encounter.gd, partagé avec les donjons.
## À 0 PV le héros se replie, sans rien perdre, et reprend le même combat.

const ENEMY_HP_BASE := 60
const ENEMY_HP_PER_WAVE := 25

# Cadrage : combattants dans la moitié haute de l'écran, au-dessus du panneau de question.
const CAMERA_FOV := 22.0
const CAMERA_DISTANCE := 22.0
const CAMERA_PITCH_DEG := -20.0
const CAMERA_TARGET := Vector3(0, -0.9, 4.2)

var _wt: WorldTheme
var _room: DungeonRoom
var _fx: CombatFx
var _hud: CombatHud
var _hero: Fighter
var _pet: Companion  # renard du monde de Jules (null pour Tom)
var _enemy: Fighter
var _encounter: Encounter
var _wave := 1
var _xp := 0


func _ready() -> void:
	_wt = WorldTheme.for_world(Session.world())
	_room = DungeonRoom.new().use_theme(_wt)
	_room.front_rows = 2
	add_child(_room)
	_room.build()

	_fx = CombatFx.new()
	add_child(_fx)
	_fx.camera = _build_camera()

	_hero = Fighter.create_hero(SaveManager.look(), _wt.hero_name, Progression.hero_max_hp(SaveManager.level()))
	_hero.position = Vector3(-2.4, 0, 1.5)
	_hero.rotation_degrees.y = 65.0  # de trois quarts, face à l'ennemi
	add_child(_hero)
	_room.adapt_character(_hero)
	if _wt.companion:
		# Le renard reste assis près du héros et fête les victoires.
		_pet = Companion.create(SaveManager.look())
		_pet.position = _hero.position + Vector3(-0.9, 0, 1.4)
		_pet.rotation_degrees.y = 65.0
		add_child(_pet)
		_room.adapt_character(_pet)

	_hud = CombatHud.new()
	add_child(_hud)
	_hud.setup(_wt, _wt.hero_name)
	_hud.quit_requested.connect(_quit)
	_hero.hp_changed.connect(_hud.set_hero_hp)
	_hud.set_hero_hp(_hero.hp, _hero.max_hp)

	QuestionService.reset()
	_encounter = Encounter.new().setup(_hero, _hud, _fx, _wt)
	add_child(_encounter)
	_encounter.xp_gained.connect(_on_xp)
	_run()

	# Développement, PC uniquement : `-- --autoaction=automatisme|chapitre|soin`.
	var auto := Quality.option("autoaction")
	if auto != "" and not OS.has_feature("web"):
		await get_tree().create_timer(0.8).timeout
		_hud.action_chosen.emit(auto)


func _run() -> void:
	_spawn_enemy()
	while true:
		var outcome := await _encounter.fight(_enemy, _wave, 25 * _wave)
		match outcome:
			"victory":
				if _pet:
					_pet.celebrate()
				await _show_message("Ennemi vaincu !",
					"%d bonnes réponses sur %d. +%d XP." % [QuestionService.correct_count, QuestionService.answered, 25 * _wave],
					"Combat suivant")
				_wave += 1
				_enemy.queue_free()
				if Accessibility.pause_due() and not await _continue_after_pause():
					_quit()
					return
				_spawn_enemy()
			"retreat":
				await _show_message("Repli", _wt.retreat_text, "Reprendre le combat")
				_hero.restore()
				_enemy.restore()
				Sfx.play("heal")
				_fx.rising_sparkles(_hero.global_position + Vector3(0, 0.8, 0), _wt.good)
			_:  # durée de jeu atteinte
				await _show_message("Belle session !",
					"%d bonnes réponses sur %d, %d XP. %s"
						% [QuestionService.correct_count, QuestionService.answered, _xp, Session.rest_text()],
					"Terminer")
				_quit()
				return


func _on_xp(amount: int) -> void:
	_xp += amount
	SaveManager.add_xp(amount)
	_hud.set_wave(_wave, _xp)


## Rappel de pause (bien-être) entre deux combats : vrai si l'enfant continue.
func _continue_after_pause() -> bool:
	var panel := UiKit.pause_panel(_wt)
	_hud.show_panel(panel[0])
	var choice: Array = []
	(panel[1] as Button).pressed.connect(func() -> void: choice.append(true))
	(panel[2] as Button).pressed.connect(func() -> void: choice.append(false))
	while choice.is_empty():
		await get_tree().process_frame
	_hud.clear_panel()
	if choice[0]:
		Accessibility.snooze_pause()
	return choice[0]


func _show_message(title: String, body: String, button_text: String) -> void:
	var panel := UiKit.message_panel(_wt, title, body, button_text)
	_hud.show_panel(panel[0])
	await (panel[1] as Button).pressed
	_hud.clear_panel()


func _quit() -> void:
	_hud.show_actions(false)
	_hud.clear_panel()
	Engine.time_scale = 1.0
	await Session.end()
	get_tree().change_scene_to_file("res://scenes/hub/hub.tscn")


# --- Construction ---------------------------------------------------------------

func _spawn_enemy() -> void:
	var name_text: String = _wt.enemy_names[(_wave - 1) % _wt.enemy_names.size()]
	var model: String = _wt.enemy_models[(_wave - 1) % _wt.enemy_models.size()]
	var hp := ENEMY_HP_BASE + ENEMY_HP_PER_WAVE * (_wave - 1)
	_enemy = Fighter.create(model, name_text, hp, "Idle_Combat")
	_enemy.position = Vector3(2.4, 0, 1.5)
	_enemy.rotation_degrees.y = -65.0
	add_child(_enemy)
	_room.adapt_character(_enemy)
	_enemy.play(["Spawn_Ground", "Skeletons_Awaken_Standing", "Idle_Combat"])
	_hud.set_wave(_wave, _xp)


func _build_camera() -> Camera3D:
	var camera := Camera3D.new()
	camera.fov = CAMERA_FOV
	camera.far = 200.0
	var pitch := deg_to_rad(CAMERA_PITCH_DEG)
	camera.position = CAMERA_TARGET + Vector3(0, -sin(pitch) * CAMERA_DISTANCE, cos(pitch) * CAMERA_DISTANCE)
	camera.rotation.x = pitch
	add_child(camera)
	camera.make_current()
	return camera
