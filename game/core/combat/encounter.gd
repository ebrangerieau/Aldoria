class_name Encounter
extends Node
## Un combat au tour par tour, joué dans la scène qui l'accueille (arène ou salle
## de donjon). Chaque action demande une réponse : le savoir est le pouvoir (PRD §1).
## - Frappe (automatisme) : rapide, dégâts moyens.
## - Sort (notion du chapitre) : plus puissant.
## - Soin : une question pour reprendre des PV.
## - Sac : bouclier (le prochain coup ne touche pas) ou potion d'urgence (toute la vie),
##   sans question et sans perdre son tour (Inventory).
## Justesse et vitesse modulent la puissance ; réponse juste en moins de la moitié
## du temps cible = coup critique (ralenti). Une erreur ouvre une explication et
## laisse l'ennemi frapper plus fort.
##
## Boss de synthèse : chaque bonne réponse brise un des BOSS_HITS sceaux (moins avec
## des critiques, plus avec des indices : de 7 à 11 questions), et la difficulté monte
## de question en question (d'un cran sous le niveau du joueur à un cran au-dessus),
## quelle que soit l'action choisie. Retours des enfants : 10 sceaux et deux crans
## au-dessus, c'était trop dur.
##
## `fight()` rend « victory », « retreat » (héros à 0 PV : la scène le replie, sans
## rien lui faire perdre) ou « time_over » (durée de jeu fixée par le parent atteinte).

signal xp_gained(amount: int)

const BASE_POWER := {"automatisme": 18, "chapitre": 32, "soin": 35}
const CRIT_RATIO := 0.5
const CRIT_MULT := 1.6
const FAST_MULT := 1.2
const HINT_MULT := 0.7
const GUARD_MULT := 0.5  # dégâts subis après une bonne réponse
const BOSS_HITS := 8
const BOSS_CRIT_MULT := 1.25  # au mieux 7 questions

var hero: Fighter
var hud: CombatHud
var fx: CombatFx
var wt: WorldTheme

var enemy: Fighter
var boss := false
var tier := 1  # force de l'ennemi (dégâts infligés)
var questions := 0
var _correct_run := 0  # bonnes réponses d'affilée (coup critique « sans vitesse »)
var _boss_base := {}
var _shield := false  # bouclier levé : le prochain coup de l'ennemi ne touche pas


func setup(hero_fighter: Fighter, combat_hud: CombatHud, combat_fx: CombatFx, theme: WorldTheme) -> Encounter:
	hero = hero_fighter
	hud = combat_hud
	fx = combat_fx
	wt = theme
	return self


## Combat contre `foe` jusqu'à la victoire, au repli ou à la fin du temps de jeu.
## `reward_xp` : XP gagnée en le battant.
func fight(foe: Fighter, foe_tier: int, reward_xp: int, is_boss := false) -> String:
	enemy = foe
	tier = foe_tier
	boss = is_boss
	questions = 0
	_boss_base = {"automatisme": QuestionService.level_for("automatisme"), "chapitre": QuestionService.level_for("chapitre")}
	hud.set_enemy(foe.display_name, foe.hp, foe.max_hp)
	while true:
		if Session.time_over():
			hud.show_actions(false)
			return "time_over"
		hud.show_actions(true, hero.hp < hero.max_hp)
		var action: String = await hud.action_chosen
		hud.show_actions(false)
		if action == "sac":
			await _open_bag()
			continue
		var outcome := await _turn(action, reward_xp)
		if outcome != "":
			return outcome
	return ""


func _turn(action: String, reward_xp: int) -> String:
	var role := "chapitre" if action == "soin" else action
	var item := QuestionService.next_item(role, _boss_level(role) if boss else 0)
	if item.is_empty():
		hud.banner("Aucune question disponible", wt.bad)
		return ""

	var panel := QuestionPanel.new()
	panel.setup(item, wt.action_names[action], wt)
	hud.show_panel(panel)
	var res: Array = await panel.answered
	hud.clear_panel()
	var result := QuestionService.submit(item, res[0], res[1], res[2], "boss" if boss else "combat")
	questions += 1

	if result.correct:
		# Seul l'indice ordinaire réduit la puissance (pas la plume ni le parchemin).
		await _resolve_success(action, item, result, panel.penalized_hint())
	else:
		await _resolve_failure(item)

	if not enemy.is_alive():
		await _enemy_defeated(reward_xp)
		return "victory"
	await _enemy_turn(result.correct)
	if not hero.is_alive():
		hero.play(["Death_A", "Death_B"])
		Sfx.play("retreat")
		await get_tree().create_timer(1.6).timeout
		return "retreat"
	return ""


## Difficulté du boss : d'un cran sous le niveau du joueur à un cran au-dessus.
func _boss_level(role: String) -> int:
	var base: int = _boss_base.get(role, 1)
	var low := maxi(1, base - 1)
	var high := mini(5, base + 1)
	return low + roundi((high - low) * minf(1.0, questions / float(BOSS_HITS - 1)))


func _resolve_success(action: String, item: Dictionary, result: Dictionary, hint_used: bool) -> void:
	_correct_run += 1
	var crit: bool = result.speed_ratio < CRIT_RATIO and not hint_used
	var mult := CRIT_MULT if crit else (FAST_MULT if result.speed_ratio < 1.0 else 1.0)
	if Accessibility.on("no_speed"):
		# Aménagement « sans pénalité de lenteur » : la vitesse ne compte pas ; le coup
		# critique récompense la régularité (3e bonne réponse d'affilée, sans indice).
		crit = _correct_run >= 3 and not hint_used
		mult = CRIT_MULT if crit else 1.0
		if crit:
			_correct_run = 0
	var base: float = BASE_POWER[action]
	if boss and action != "soin":
		base = ceilf(enemy.max_hp / float(BOSS_HITS))
		mult = BOSS_CRIT_MULT if crit else 1.0
	if hint_used:
		mult *= HINT_MULT
	var power := roundi(base * mult * float(result.reward_factor))
	xp_gained.emit(Progression.answer_xp(int(item["difficulty"])))
	hud.banner(wt.encouragements.pick_random(), wt.good, 0.6)
	Sfx.play("crit" if crit else "correct")

	if action == "soin":
		hero.play(["Use_Item", "Cheer", "Interact"])
		await get_tree().create_timer(0.4).timeout
		var healed := hero.heal(power)
		Sfx.play("heal")
		fx.rising_sparkles(hero.global_position + Vector3(0, 0.8, 0), wt.good)
		fx.floating_text("+%d" % healed, hero.chest(), wt.good)
		await get_tree().create_timer(0.6).timeout
		return

	if action == "chapitre":
		hero.play(["Spellcast_Shoot", "Spellcast_Raise", "1H_Melee_Attack_Stab"])
		await get_tree().create_timer(0.35).timeout
		Sfx.play("spell")
		await fx.projectile(hero.chest(), enemy.chest(), wt.accent)
	else:
		hero.play(hero.attack_animations, 1.2)  # selon l'arme choisie (Wardrobe)
		await get_tree().create_timer(0.35).timeout

	enemy.damage(power)
	hud.set_enemy_hp(enemy.hp, enemy.max_hp)
	enemy.play(["Hit_A", "Hit_B"])
	Sfx.play("hit", 0.85 if crit else 1.0)
	fx.burst(enemy.chest(), wt.accent, 60 if crit else 30, 6.0 if crit else 4.0)
	fx.floating_text(("%d !" if crit else "%d") % power, enemy.chest(), Color("#ffd447") if crit else Color.WHITE, 128 if crit else 96)
	if crit:
		fx.shake(0.35, 0.35)
		hud.banner("Coup critique !", Color("#ffd447"), 0.5)
		await fx.slow_motion(0.3, 0.45)
	else:
		fx.shake(0.18, 0.25)
		await fx.hitstop(0.07)
	await get_tree().create_timer(0.5).timeout


func _resolve_failure(item: Dictionary) -> void:
	_correct_run = 0
	Sfx.play("wrong")
	hero.play(["Block_Hit", "Hit_B"], 0.8)
	var panel := ExplanationPanel.new()
	panel.setup(item, wt)
	hud.show_panel(panel)
	await panel.closed
	hud.clear_panel()


## Sac : bouclier ou potion d'urgence. Rien n'est choisi : retour aux actions.
func _open_bag() -> void:
	var panel := PanelContainer.new()
	panel.theme = UiKit.make_theme(wt)
	panel.custom_minimum_size = Vector2(640, 0)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 14)
	panel.add_child(box)
	box.add_child(UiKit.label("Ton sac", 32, wt.accent))
	var chosen: Array[String] = []
	for id in ["potion", "bouclier"]:
		var count := SaveManager.item_count(id)
		var b := UiKit.button("%s ×%d : %s" % [Inventory.ITEMS[id]["name"], count, Inventory.ITEMS[id]["help"]], 64.0)
		b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		b.disabled = count <= 0 or (id == "potion" and hero.hp >= hero.max_hp) or (id == "bouclier" and _shield)
		b.pressed.connect(func() -> void: chosen.append(id))
		box.add_child(b)
	var close := UiKit.button("Fermer", 56.0)
	UiKit.style_secondary(close, wt)
	close.pressed.connect(func() -> void: chosen.append(""))
	box.add_child(close)
	hud.show_panel(panel)
	while chosen.is_empty():
		await get_tree().process_frame
	hud.clear_panel()
	if chosen[0] == "" or not SaveManager.use_item(chosen[0]):
		return
	if chosen[0] == "potion":
		hero.play(["Use_Item", "Cheer"])
		var healed := hero.heal(hero.max_hp)
		Sfx.play("heal")
		fx.rising_sparkles(hero.global_position + Vector3(0, 0.8, 0), wt.good)
		fx.floating_text("+%d" % healed, hero.chest(), wt.good)
	else:
		_shield = true
		hero.play(["Block", "Blocking", "Block_Hit"])
		Sfx.play("spell", 0.9)
		hud.banner("Bouclier levé !", wt.accent, 0.9)
	await get_tree().create_timer(0.7).timeout


func _enemy_turn(guarded: bool) -> void:
	await get_tree().create_timer(0.25).timeout
	enemy.play(enemy.attack_animations)
	await get_tree().create_timer(0.45).timeout
	if _shield:
		_shield = false
		hero.play(["Block_Hit", "Block"])
		Sfx.play("hit", 1.3)
		fx.floating_text("Bloqué !", hero.chest(), wt.accent, 80)
		await get_tree().create_timer(0.6).timeout
		return
	var base := randi_range(6, 10) if wt.id == "lumineux" else randi_range(9, 14)
	var dmg := roundi((base + tier) * (GUARD_MULT if guarded else 1.0))
	hero.damage(dmg)
	Sfx.play("hurt")
	hero.play(["Block_Hit"] if guarded else ["Hit_A", "Hit_B"])
	fx.floating_text("-%d" % dmg, hero.chest(), wt.bad, 80)
	fx.shake(0.12, 0.2)
	await get_tree().create_timer(0.6).timeout


func _enemy_defeated(reward_xp: int) -> void:
	enemy.play(["Death_A", "Death_B"])
	Sfx.play("victory")
	xp_gained.emit(reward_xp)
	hud.banner(wt.victory_texts.pick_random(), wt.accent, 1.4)
	await get_tree().create_timer(2.0).timeout
