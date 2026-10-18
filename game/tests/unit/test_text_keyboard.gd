extends GutTest
## Clavier de lettres des réponses écrites : rangée d'accents française, ou espagnole (á, ñ, ¿)
## pour une question d'espagnol.


func _keys(widget: TextAnswerWidget) -> Array[String]:
	var out: Array[String] = []
	for row in widget.get_children():
		for key in row.get_children():
			if key is Button:
				out.append((key as Button).text)
	return out


func test_spanish_questions_get_spanish_letters() -> void:
	var widget := TextAnswerWidget.new()
	widget.setup(WorldTheme.brouillard(), true, true)
	add_child_autofree(widget)
	var keys := _keys(widget)
	for letter in ["ñ", "á", "ó", "¿"]:
		assert_has(keys, letter)
	assert_does_not_have(keys, "œ", "pas la rangée française")


func test_french_spelling_keeps_french_accents() -> void:
	var widget := TextAnswerWidget.new()
	widget.setup(WorldTheme.lumineux(), true)
	add_child_autofree(widget)
	var keys := _keys(widget)
	assert_has(keys, "é")
	assert_has(keys, "ç")
	assert_does_not_have(keys, "ñ")
