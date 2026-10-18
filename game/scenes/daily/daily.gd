extends Control
## Défi du jour : 10 automatismes d'affilée (paquet `defi` du serveur), sans compte à
## rebours. Bilan : bonnes réponses, temps de réponse cumulé (lecture des explications
## exclue), record personnel, série de jours et coffre de la semaine (DailyChallenge).
## « Quitter » ramène au camp à tout moment : un défi interrompu ne compte pas.

const GAME_MODE := "defi"

var _wt: WorldTheme
var _pips: Array[Panel] = []
var _counter: Label
var _stage: CenterContainer
var _day := ""  # jour compté par ce défi ("" : entraînement)
var _today := ""
var _correct := 0
var _time_ms := 0
var _xp := 0
var _leaving := false


func _ready() -> void:
	_wt = WorldTheme.for_world(Session.world())
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = UiKit.make_theme(_wt)
	QuestionService.reset()
	_today = DailyChallenge.today()
	_day = DailyChallenge.counted_day(SaveManager.daily_days(), _today)
	_build()
	await _intro()
	await _run()
	await _results()
	_leave()


func _leave() -> void:
	if _leaving:
		return
	_leaving = true
	await Session.end()
	get_tree().change_scene_to_file("res://scenes/hub/hub.tscn")


func _build() -> void:
	var bg := ColorRect.new()
	bg.color = _wt.bg
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	UiKit.backdrop(self, _wt)  # la salle de la Citadelle (la Pierre du Jour y veille)
	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 24)
	add_child(margin)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 16)
	margin.add_child(column)

	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 14)
	top.add_child(UiKit.screen_title(_wt, "Défi du jour" if _day != DailyChallenge.shift_day(_today, -1) else "Défi de rattrapage"))
	for i in DailyChallenge.QUESTIONS:
		var pip := Panel.new()
		pip.custom_minimum_size = Vector2(30, 30)
		pip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		_paint(pip, Color(0, 0, 0, 0.45))
		top.add_child(pip)
		_pips.append(pip)
	_counter = UiKit.on_scene(UiKit.label("", 26))
	_counter.autowrap_mode = TextServer.AUTOWRAP_OFF
	_counter.custom_minimum_size.x = 90
	_counter.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	top.add_child(_counter)
	var quit := UiKit.icon_button("Quitter", "exit-door", 56.0)
	UiKit.style_secondary(quit, _wt)
	quit.custom_minimum_size.x = 150
	quit.pressed.connect(_leave)
	top.add_child(quit)
	column.add_child(top)

	_stage = CenterContainer.new()
	_stage.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(_stage)


## « , en 2 min 14 s » ; rien avec l'aménagement « sans pénalité de lenteur ».
func _time_text(ms: int) -> String:
	return "" if Accessibility.on("no_speed") else ", en %s" % DailyChallenge.format_duration(ms)


func _continue_after_pause() -> bool:
	var panel := UiKit.pause_panel(_wt)
	_show(panel[0])
	var choice: Array = []
	(panel[1] as Button).pressed.connect(func() -> void: choice.append(true))
	(panel[2] as Button).pressed.connect(func() -> void: choice.append(false))
	while choice.is_empty():
		await get_tree().process_frame
	if choice[0]:
		Accessibility.snooze_pause()
	return choice[0]


## Pastille du résultat : couleur et symbole (lisible aussi sans distinguer les couleurs).
func _mark(pip: Panel, correct: bool) -> void:
	_paint(pip, _wt.good if correct else _wt.bad)
	var sign := UiKit.label("✓" if correct else "✗", 18, Color.WHITE)
	sign.autowrap_mode = TextServer.AUTOWRAP_OFF
	sign.set_anchors_preset(Control.PRESET_FULL_RECT)
	sign.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sign.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	pip.add_child(sign)


func _paint(pip: Panel, color: Color) -> void:
	var box := StyleBoxFlat.new()
	box.bg_color = color
	box.set_corner_radius_all(15)
	box.set_border_width_all(2)
	box.border_color = _wt.panel_border  # sertie comme une pierre
	box.anti_aliasing = true
	pip.add_theme_stylebox_override("panel", box)


func _show(panel: Control) -> void:
	for child in _stage.get_children():
		child.queue_free()
	_stage.add_child(UiKit.fitted(panel, _stage.get_parent().get_child(0) as Control))


func _intro() -> void:
	var body := "Dix questions d'automatismes, à ton rythme : pas de chrono à l'écran. À la fin, ton temps est comparé à ton record."
	if Accessibility.on("no_speed"):
		body = "Dix questions d'automatismes, à ton rythme. Prends tout ton temps : seules les bonnes réponses comptent."
	if _day == "":
		body += "\nTu as déjà relevé le défi aujourd'hui : celui-ci est pour t'entraîner."
	elif _day != _today:
		body += "\nTu as manqué hier : ce défi le rattrape, et ta série continue !"
	var panel := UiKit.message_panel(_wt, "Prêt ?", body, "C'est parti !")
	_show(panel[0])
	await (panel[1] as Button).pressed


func _run() -> void:
	for i in DailyChallenge.QUESTIONS:
		if i > 0 and Accessibility.pause_due() and not await _continue_after_pause():
			_leave()
			return
		_counter.text = "%d / %d" % [i + 1, DailyChallenge.QUESTIONS]
		var item := QuestionService.next_item("automatisme")
		if item.is_empty():
			var panel := UiKit.message_panel(_wt, "Défi indisponible", "Il faut une connexion pour préparer le défi du jour.", "Retour à la Citadelle")
			_show(panel[0])
			await (panel[1] as Button).pressed
			return
		var question := QuestionPanel.new()
		question.setup(item, "Question %d" % (i + 1), _wt, false)  # défi du jour : sans objets
		_show(question)
		var res: Array = await question.answered
		item = question.item  # « Pas vu en classe » a pu remplacer la question
		var result := QuestionService.submit(item, res[0], res[1], res[2], GAME_MODE)
		_time_ms += int(res[1])
		question.reveal(result.correct)
		_mark(_pips[i], result.correct)
		if result.correct:
			_correct += 1
			_xp += roundi(Progression.answer_xp(int(item["difficulty"])) * float(result.reward_factor))
			Sfx.play("correct")
			await get_tree().create_timer(0.6).timeout
		else:
			Sfx.play("wrong")
			await get_tree().create_timer(0.8).timeout
			var explanation := ExplanationPanel.new()
			explanation.setup(item, _wt)
			_show(explanation)
			await explanation.closed


func _results() -> void:
	if QuestionService.answered < DailyChallenge.QUESTIONS:
		return  # défi interrompu (hors connexion) : rien n'est compté
	var before: Dictionary = (SaveManager.daily()["best"] as Dictionary).duplicate()
	if _day != "":
		_xp += DailyChallenge.COMPLETION_XP
	SaveManager.add_xp(_xp)
	SaveManager.record_daily(_day, _correct, _time_ms, _today)
	var days := SaveManager.daily_days()
	var lines: Array[String] = [
		"%d bonnes réponses sur %d%s." % [_correct, DailyChallenge.QUESTIONS, _time_text(_time_ms)],
	]
	var record := _correct > int(before["correct"]) or (_correct == int(before["correct"]) and _time_ms < int(before["ms"]))
	if int(before["correct"]) == 0 and int(before["ms"]) == 0:
		lines.append("Premier défi : c'est ton record à battre !")
	elif record:
		lines.append("Nouveau record ! (avant : %d sur %d%s)" % [int(before["correct"]), DailyChallenge.QUESTIONS, _time_text(int(before["ms"]))])
	else:
		lines.append("Ton record : %d sur %d%s." % [int(before["correct"]), DailyChallenge.QUESTIONS, _time_text(int(before["ms"]))])
	var streak := DailyChallenge.streak(days, _today)
	lines.append("Série : %d jour%s d'affilée." % [streak, "s" if streak > 1 else ""])
	lines.append("Coffre de la semaine : %d / %d défis." % [mini(DailyChallenge.week_count(days, _today), DailyChallenge.WEEKLY_GOAL), DailyChallenge.WEEKLY_GOAL])
	lines.append("+%d XP" % _xp)
	Sfx.play("victory")
	var title := "Défi réussi !" if _correct >= 7 else "Défi terminé !"
	if SaveManager.weekly_chest_ready(_today):
		var chest := UiKit.message_panel(_wt, title, "\n".join(lines), "Ouvrir le coffre de la semaine")
		_show(chest[0])
		await (chest[1] as Button).pressed
		SaveManager.open_weekly_chest(_today)
		var found := SaveManager.give_items(2)
		Sfx.play("victory")
		lines = ["Cinq défis cette semaine : le coffre s'ouvre !", "+%d XP" % DailyChallenge.WEEKLY_CHEST_XP]
		if not found.is_empty():
			lines.append(Inventory.found_text(found))
		title = "Coffre de la semaine"
	var panel := UiKit.message_panel(_wt, title, "\n".join(lines), "Retour à la Citadelle")
	_show(panel[0])
	await (panel[1] as Button).pressed
