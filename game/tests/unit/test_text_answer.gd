extends GutTest
## Formats de l'étape B : réponse écrite (clavier de lettres) et écoute en langue
## étrangère, sur les items d'anglais des paquets de test.

const PACK := "res://tests/fixtures/pack_6e.json"


func _english(type: String, listening: bool) -> Dictionary:
	var pack: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(PACK))
	for item: Dictionary in pack["items"]:
		if item["type"] == type and (item.get("listen") is Dictionary) == listening and str(item.get("generator", "")).begins_with("6e.anglais"):
			return item
	return {}


func test_letter_keyboard_types_and_submits() -> void:
	var widget := TextAnswerWidget.new()
	widget.setup(WorldTheme.lumineux(), false)
	add_child_autofree(widget)
	watch_signals(widget)
	for key in ["d", "o", "g", "g", "⌫", "espace", "espace"]:
		widget.press(key)
	assert_eq(widget.text(), "dog ", "un seul espace d'affilée")
	widget.press("OK")
	assert_signal_emitted_with_parameters(widget, "submitted", ["dog"])
	widget.press("x")
	assert_eq(widget.text(), "dog ", "plus de saisie après validation")


func test_accent_keys_only_when_spelling_counts() -> void:
	var english := TextAnswerWidget.new()
	english.setup(WorldTheme.lumineux(), false)
	add_child_autofree(english)
	var french := TextAnswerWidget.new()
	french.setup(WorldTheme.lumineux(), true)
	add_child_autofree(french)
	var labels := func(w: Control) -> Array:
		return w.find_children("*", "Button", true, false).map(func(b: Button) -> String: return b.text)
	assert_does_not_have(labels.call(english), "é")
	assert_has(labels.call(french), "é")


func test_written_answer_item_is_checked_like_the_server() -> void:
	var item := _english("text", false)
	assert_false(item.is_empty(), "item d'écriture dans le paquet de test")
	var right := str(item["answer"]["value"][0])
	assert_true(AnswerChecker.check(item["answer"], right.to_upper() + "."))
	assert_false(AnswerChecker.check(item["answer"], right + "zz"))


func test_listening_item_shows_a_listen_button_but_not_the_word() -> void:
	var item := _english("text", true)
	assert_false(item.is_empty(), "dictée dans le paquet de test")
	var panel := QuestionPanel.new()
	panel.setup(item, "Test", WorldTheme.lumineux())
	add_child_autofree(panel)
	var texts: Array[String] = []
	for node in panel.find_children("*", "Label", true, false):
		texts.append((node as Label).text)
	for node in panel.find_children("*", "Button", true, false):
		texts.append((node as Button).text)
	assert_true(texts.any(func(t: String) -> bool: return t.begins_with("Écouter (anglais)")))
	assert_false(texts.has(str(item["listen"]["text"])), "le mot à écouter n'est pas écrit")
	assert_not_null(panel.find_children("*", "TextAnswerWidget", true, false).front())


func test_english_choices_are_read_with_an_english_voice() -> void:
	var item := {
		"type": "mcq", "prompt": "Comment dit-on « chien » en anglais ?",
		"choices": ["cat", "dog"], "choices_lang": "en-GB",
	}
	var parts := Accessibility.question_parts(item)
	assert_eq(parts[0], ["Comment dit-on « chien » en anglais ?", "fr-FR"])
	assert_has(parts, ["dog", "en-GB"])
	assert_has(parts, ["Proposition 2 :", "fr-FR"])
	assert_eq(Accessibility.question_speech({"type": "mcq", "prompt": "Q ?", "choices": ["a", "b"]}),
		"Q ? Proposition 1 : a. Proposition 2 : b.")
