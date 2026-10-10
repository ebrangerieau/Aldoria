extends Node3D
## Prototype « combat » (IMPLEMENTATION_PLAN, phase 1).
##
## Chaque action demande une réponse : le savoir est le pouvoir (PRD §1).
## - Frappe (automatisme) : rapide, dégâts moyens.
## - Sort (notion du chapitre) : plus puissant.
## - Soin : une question pour reprendre des PV.
## Justesse et vitesse modulent la puissance ; réponse juste en moins de la moitié
## du temps cible = coup critique (ralenti). Une erreur ouvre une explication et
## laisse l'ennemi frapper plus fort ; à 0 PV le héros se replie, sans rien perdre.

const HERO_HP := 100
const BASE_POWER := {"automatisme": 18, "chapitre": 32, "soin": 35}
const CRIT_RATIO := 0.5
const CRIT_MULT := 1.6
const FAST_MULT := 1.2
const HINT_MULT := 0.7
const GUARD_MULT := 0.5  # dégâts subis après une bonne réponse
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
var _enemy: Fighter
var _wave := 1
var _xp := 0
var _busy := false
var _session_over_shown := false


func _ready() -> void:
	_wt = WorldTheme.for_world(Session.world())
	_room = DungeonRoom.new().use_theme(_wt)
	_room.front_rows = 2
	add_child(_room)
	_room.build()

	_fx = CombatFx.new()
	add_child(_fx)
	_fx.camera = _build_camera()

	_hero = Fighter.create(_wt.hero_model, _wt.hero_name, HERO_HP)
	_hero.position = Vector3(-2.4, 0, 1.5)
	_hero.rotation_degrees.y = 65.0  # de trois quarts, face à l'ennemi
	add_child(_hero)
	_room.adapt_character(_hero)

	_hud = CombatHud.new()
	add_child(_hud)
	_hud.setup(_wt, _wt.hero_name)
	_hud.action_chosen.connect(_on_action)
	_hud.quit_requested.connect(_quit)
	_hero.hp_changed.connect(_hud.set_hero_hp)
	_hud.set_hero_hp(_hero.hp, _hero.max_hp)

	QuestionService.reset()
	_spawn_enemy()
	_player_turn()

	# Développement, PC uniquement : `-- --autoaction=automatisme|chapitre|soin`.
	var auto := Quality.option("autoaction")
	if auto != "" and not OS.has_feature("web"):
		await get_tree().create_timer(0.8).timeout
		_on_action(auto)


# --- Déroulement ---------------------------------------------------------------

func _player_turn() -> void:
	_busy = false
	if _session_time_over():
		_show_session_end()
		return
	_hud.show_actions(true, _hero.hp < _hero.max_hp)


func _on_action(action: String) -> void:
	if _busy:
		return
	_busy = true
	_hud.show_actions(false)
	var role := "chapitre" if action == "soin" else action
	var item := QuestionService.next_item(role)
	if item.is_empty():
		_hud.banner("Aucune question disponible", _wt.bad)
		_player_turn()
		return

	var panel := QuestionPanel.new()
	panel.setup(item, _wt.action_names[action], _wt)
	_hud.show_panel(panel)
	var res: Array = await panel.answered
	_hud.clear_panel()
	var result := QuestionService.submit(item, res[0], res[1], res[2])

	if result.correct:
		await _resolve_success(action, item, result, res[2])
	else:
		await _resolve_failure(item)

	if not _enemy.is_alive():
		await _victory()
		return
	await _enemy_turn(result.correct)
	if not _hero.is_alive():
		await _retreat()
		return
	_player_turn()


func _resolve_success(action: String, item: Dictionary, result: Dictionary, hint_used: bool) -> void:
	var crit: bool = result.speed_ratio < CRIT_RATIO and not hint_used
	var mult := CRIT_MULT if crit else (FAST_MULT if result.speed_ratio < 1.0 else 1.0)
	if hint_used:
		mult *= HINT_MULT
	var power := roundi(BASE_POWER[action] * mult * float(result.reward_factor))
	_xp += 10 * int(item["difficulty"])
	_hud.set_wave(_wave, _xp)
	_hud.banner(_wt.encouragements.pick_random(), _wt.good, 0.6)
	Sfx.play("crit" if crit else "correct")

	if action == "soin":
		_hero.play(["Use_Item", "Cheer", "Interact"])
		await get_tree().create_timer(0.4).timeout
		var healed := _hero.heal(power)
		Sfx.play("heal")
		_fx.rising_sparkles(_hero.global_position + Vector3(0, 0.8, 0), _wt.good)
		_fx.floating_text("+%d" % healed, _hero.chest(), _wt.good)
		await get_tree().create_timer(0.6).timeout
		return

	if action == "chapitre":
		_hero.play(["Spellcast_Shoot", "Spellcast_Raise", "1H_Melee_Attack_Stab"])
		await get_tree().create_timer(0.35).timeout
		Sfx.play("spell")
		await _fx.projectile(_hero.chest(), _enemy.chest(), _wt.accent)
	else:
		_hero.play(["1H_Melee_Attack_Chop", "2H_Melee_Attack_Chop", "Unarmed_Melee_Attack_Punch_A"], 1.2)
		await get_tree().create_timer(0.35).timeout

	_enemy.damage(power)
	_hud.set_enemy_hp(_enemy.hp, _enemy.max_hp)
	_enemy.play(["Hit_A", "Hit_B"])
	Sfx.play("hit", 0.85 if crit else 1.0)
	_fx.burst(_enemy.chest(), _wt.accent, 60 if crit else 30, 6.0 if crit else 4.0)
	_fx.floating_text(("%d !" if crit else "%d") % power, _enemy.chest(), Color("#ffd447") if crit else Color.WHITE, 128 if crit else 96)
	if crit:
		_fx.shake(0.35, 0.35)
		_hud.banner("Coup critique !", Color("#ffd447"), 0.5)
		await _fx.slow_motion(0.3, 0.45)
	else:
		_fx.shake(0.18, 0.25)
		await _fx.hitstop(0.07)
	await get_tree().create_timer(0.5).timeout


func _resolve_failure(item: Dictionary) -> void:
	Sfx.play("wrong")
	_hero.play(["Block_Hit", "Hit_B"], 0.8)
	var panel := ExplanationPanel.new()
	panel.setup(item, _wt)
	_hud.show_panel(panel)
	await panel.closed
	_hud.clear_panel()


func _enemy_turn(guarded: bool) -> void:
	await get_tree().create_timer(0.25).timeout
	_enemy.play(["1H_Melee_Attack_Chop", "2H_Melee_Attack_Chop", "Unarmed_Melee_Attack_Punch_A"])
	await get_tree().create_timer(0.45).timeout
	var base := randi_range(6, 10) if _wt.id == "jules" else randi_range(9, 14)
	var dmg := roundi((base + _wave) * (GUARD_MULT if guarded else 1.0))
	_hero.damage(dmg)
	Sfx.play("hurt")
	_hero.play(["Block_Hit"] if guarded else ["Hit_A", "Hit_B"])
	_fx.floating_text("-%d" % dmg, _hero.chest(), _wt.bad, 80)
	_fx.shake(0.12, 0.2)
	await get_tree().create_timer(0.6).timeout


func _victory() -> void:
	_enemy.play(["Death_A", "Death_B"])
	Sfx.play("victory")
	_xp += 25 * _wave
	_hud.set_wave(_wave, _xp)
	_hud.banner(_wt.victory_texts.pick_random(), _wt.accent, 1.4)
	await get_tree().create_timer(2.0).timeout
	var panel := _message_panel(
		"Ennemi vaincu !",
		"%d bonnes réponses sur %d. +%d XP." % [QuestionService.correct_count, QuestionService.answered, 25 * _wave],
		"Combat suivant")
	_hud.show_panel(panel[0])
	await (panel[1] as Button).pressed
	_hud.clear_panel()
	_wave += 1
	_enemy.queue_free()
	_spawn_enemy()
	_player_turn()


func _retreat() -> void:
	_hero.play(["Death_A", "Death_B"])
	Sfx.play("retreat")
	await get_tree().create_timer(1.6).timeout
	var panel := _message_panel("Repli", _wt.retreat_text, "Reprendre le combat")
	_hud.show_panel(panel[0])
	await (panel[1] as Button).pressed
	_hud.clear_panel()
	_hero.restore()
	_enemy.restore()
	_hud.set_enemy_hp(_enemy.hp, _enemy.max_hp)
	Sfx.play("heal")
	_fx.rising_sparkles(_hero.global_position + Vector3(0, 0.8, 0), _wt.good)
	_player_turn()


# --- Fin de session (durée fixée par le parent, PRD US-11) ---------------------

func _session_time_over() -> bool:
	var max_minutes := float(Session.settings.get("session_max_minutes", 25))
	return Session.active_seconds >= max_minutes * 60.0


func _show_session_end() -> void:
	if _session_over_shown:
		return
	_session_over_shown = true
	_hud.show_actions(false)
	var panel := _message_panel(
		"Belle session !",
		"%d bonnes réponses sur %d, %d XP. Une pause bien méritée : à la prochaine aventure !"
			% [QuestionService.correct_count, QuestionService.answered, _xp],
		"Terminer")
	_hud.show_panel(panel[0])
	await (panel[1] as Button).pressed
	_quit()


func _quit() -> void:
	_hud.show_actions(false)
	_hud.clear_panel()
	Engine.time_scale = 1.0
	await Session.end()
	get_tree().change_scene_to_file("res://scenes/title/title.tscn")


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
	_hud.set_enemy(name_text, _enemy.hp, _enemy.max_hp)
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


func _message_panel(title: String, body: String, button_text: String) -> Array:
	var panel := PanelContainer.new()
	panel.theme = UiKit.make_theme(_wt)
	panel.custom_minimum_size = Vector2(640, 0)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 16)
	panel.add_child(box)
	box.add_child(UiKit.label(title, 34, _wt.accent))
	box.add_child(UiKit.label(body, 24))
	var button := UiKit.button(button_text, 64.0)
	box.add_child(button)
	return [panel, button]
