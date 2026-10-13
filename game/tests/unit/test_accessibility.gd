extends GutTest
## Aménagements d'accessibilité (troubles « dys ») : chaque réglage du parent change
## bien le jeu, et l'enfant ne peut qu'ajouter du confort.


func before_each() -> void:
	Accessibility.prefs = {}
	Accessibility.apply_parent(Accessibility.DEFAULTS)


func after_each() -> void:
	Accessibility.prefs = {}
	Accessibility.apply_parent(Accessibility.DEFAULTS)
	Accessibility._apply()


func _with(changes: Dictionary) -> void:
	var settings := Accessibility.DEFAULTS.duplicate()
	settings.merge(changes, true)
	Accessibility.apply_parent(settings)


func test_text_size_and_targets_follow_parent_and_child() -> void:
	_with({"text_size": 1, "big_targets": true})
	assert_eq(UiKit.text_scale, UiKit.TEXT_SCALES[1])
	assert_eq(UiKit.button("OK", 60.0).custom_minimum_size.y, 78.0, "boutons agrandis")
	Accessibility.prefs["text_size"] = 0
	Accessibility._apply()
	assert_eq(Accessibility.text_size(), 1, "l'enfant ne descend pas sous le choix du parent")
	Accessibility.prefs["text_size"] = 2
	Accessibility._apply()
	assert_eq(UiKit.text_scale, UiKit.TEXT_SCALES[2], "mais peut agrandir")


func test_readable_and_spaced_font() -> void:
	_with({"readable_font": true, "spacing": true})
	var font := Accessibility.font() as FontVariation
	assert_eq(font.spacing_glyph, 2)
	assert_eq((font.base_font as FontFile).resource_path, Accessibility.READABLE_FONT)
	var theme := UiKit.make_theme(WorldTheme.lumineux())
	assert_eq(theme.default_font, font)
	assert_eq(theme.get_constant("line_spacing", "Label"), 8)
	# Les symboles mathématiques (absents de la police lisible) restent affichables.
	assert_true(font.has_char("×".unicode_at(0)) or (font.base_font as FontFile).fallbacks.size() >= 1)


func test_colorblind_palette_avoids_red_and_green() -> void:
	var normal := WorldTheme.lumineux()
	_with({"colorblind": true})
	var adapted := WorldTheme.for_world("lumineux")
	assert_ne(adapted.good, normal.good)
	assert_true(adapted.good.b > adapted.good.g, "juste en bleu")
	assert_true(adapted.bad.r > adapted.bad.b, "faux en orange")


func test_question_panel_reads_aloud_and_hides_speed_bonus() -> void:
	var item := {
		"id": "t", "type": "mcq", "difficulty": 1, "role": "chapitre", "prompt": "Compare 3/4 et 1/2.",
		"choices": ["<", "=", ">"], "answer": {"kind": "choice", "index": 2}, "time_target_ms": 20000,
		"speech": {"prompt": "Compare 3 sur 4 et 1 sur 2.", "choices": ["inférieur à", "égale", "supérieur à"]},
	}
	var plain := QuestionPanel.new()
	plain.setup(item, "Test", WorldTheme.lumineux())
	add_child_autofree(plain)
	assert_true(plain._bonus.visible)
	assert_eq(_buttons(plain, "Écouter"), 0, "sans aménagement : pas de bouton Écouter")
	_with({"read_aloud": true, "no_speed": true, "math_tools": true})
	var adapted := QuestionPanel.new()
	adapted.setup(item, "Test", WorldTheme.lumineux())
	add_child_autofree(adapted)
	assert_false(adapted._bonus.visible, "pas de bonus de vitesse")
	assert_eq(_buttons(adapted, "Écouter"), 1)
	assert_eq(_buttons(adapted, "Outils"), 1)
	assert_eq(Accessibility.question_speech(item),
		"Compare 3 sur 4 et 1 sur 2. Proposition 1 : inférieur à. Proposition 2 : égale. Proposition 3 : supérieur à.")


func test_numeration_table_places_each_digit() -> void:
	var tools := MathTools.new()
	tools.setup(WorldTheme.lumineux())
	add_child_autofree(tools)
	tools.show_number("2,15")
	var digits: Array = tools._digits.map(func(l: Label) -> String: return l.text)
	assert_eq(digits, ["", "", "", "2", "1", "5", ""])
	tools.show_number("1204")
	digits = tools._digits.map(func(l: Label) -> String: return l.text)
	assert_eq(digits, ["1", "2", "0", "4", "", "", ""])
	tools.show_number("3/4")
	assert_true(tools._digits.all(func(l: Label) -> bool: return l.text == ""), "une fraction ne se range pas")


func test_easy_start_lowers_starting_level() -> void:
	Session.start_levels = {"automatisme": 3, "chapitre": 1}
	_with({"easy_start": true})
	QuestionService.reset()
	assert_eq(QuestionService.level_for("automatisme"), 2)
	assert_eq(QuestionService.level_for("chapitre"), 1, "jamais sous le niveau 1")
	Session.start_levels = {}


func test_tap_only_turns_drags_into_taps() -> void:
	_with({"tap_only": true})
	var stick := TouchStick.new()
	stick.setup(Color.WHITE)
	add_child_autofree(stick)
	watch_signals(stick)
	var press := InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	press.position = Vector2(100, 100)
	stick._gui_input(press)
	var motion := InputEventMouseMotion.new()
	motion.position = Vector2(220, 100)
	stick._gui_input(motion)
	assert_eq(stick.vector, Vector2.ZERO, "pas de joystick")
	var release := press.duplicate()
	release.pressed = false
	release.position = Vector2(220, 100)
	stick._gui_input(release)
	assert_signal_emitted(stick, "tapped")


func test_calm_mode_removes_shake() -> void:
	_with({"calm": true})
	var fx := CombatFx.new()
	add_child_autofree(fx)
	fx.shake(0.5, 1.0)
	assert_eq(fx._shake_time, 0.0)


func test_pause_reminder_after_the_chosen_time() -> void:
	var played := Session.played_seconds
	assert_false(Accessibility.pause_due(), "aucun rappel par défaut")
	_with({"pause_minutes": 15})
	Session.played_seconds = 14 * 60.0
	assert_false(Accessibility.pause_due())
	Session.played_seconds = 15 * 60.0
	assert_true(Accessibility.pause_due())
	Accessibility.snooze_pause()
	assert_false(Accessibility.pause_due(), "l'enfant continue : prochain rappel 15 min plus tard")
	Session.played_seconds = 30 * 60.0
	assert_true(Accessibility.pause_due())
	Session.played_seconds = played


func _buttons(root: Node, text: String) -> int:
	return root.find_children("*", "Button", true, false).filter(
		func(b: Button) -> bool: return b.text == text).size()


func test_same_settings_from_json_are_not_a_change() -> void:
	watch_signals(Accessibility)
	# Le JSON rend 0 en 0.0 : ce n'est pas un changement (le camp ne se recharge pas).
	Accessibility.apply_parent({"text_size": 0.0, "pause_minutes": 0.0, "read_aloud": false})
	assert_signal_not_emitted(Accessibility, "changed")
	Accessibility.apply_parent({"text_size": 1.0})
	assert_signal_emitted(Accessibility, "changed")
	assert_true(Accessibility.parent["text_size"] is int)
