class_name ExplanationPanel
extends PanelContainer
## Après une erreur : la bonne réponse et la méthode, jamais un simple « faux »
## (PRD §6, gestion de l'erreur). Se ferme par « Compris ! ».

signal closed


func setup(question: Dictionary, wt: WorldTheme) -> void:
	theme = UiKit.make_theme(wt)
	custom_minimum_size = Vector2(900, 0)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 16)
	add_child(box)
	box.add_child(UiKit.label(wt.wrong_title, 28, wt.accent))
	box.add_child(UiKit.label("Réponse : %s" % QuestionPanel.expected_text(question), 30, wt.good))
	box.add_child(UiKit.label(str(question.get("explanation", "")), 24))
	var ok := UiKit.button("Compris !", 64.0)
	ok.pressed.connect(func() -> void: closed.emit())
	box.add_child(ok)
