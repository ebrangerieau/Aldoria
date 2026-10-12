class_name ExplanationPanel
extends PanelContainer
## Après une erreur : la bonne réponse et la méthode, jamais un simple « faux »
## (PRD §6, gestion de l'erreur). Se ferme par « Compris ! ».
##
## « Signaler une erreur » : l'enfant pense que la question est fausse ; il choisit un
## motif et la question part au parent (`POST /play/reports`), avec sa réponse.

signal closed
signal reported(reason: String)

const REASONS := [
	["reponse", "La réponse attendue est fausse"],
	["enonce", "L'énoncé est faux"],
	["incomprehensible", "Je ne comprends pas la question"],
]

var _question: Dictionary
var _wt: WorldTheme
var _report_box: VBoxContainer
var _report_button: Button
var _report_status: Label


func setup(question: Dictionary, wt: WorldTheme) -> void:
	_question = question
	_wt = wt
	theme = UiKit.make_theme(wt)
	custom_minimum_size = Vector2(900, 0)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 16)
	add_child(box)
	box.add_child(UiKit.label(wt.wrong_title, 28, wt.accent))
	box.add_child(UiKit.label("Réponse : %s" % QuestionPanel.expected_text(question), 30, wt.good))
	box.add_child(UiKit.label(str(question.get("explanation", "")), 24))

	_report_box = VBoxContainer.new()
	_report_box.add_theme_constant_override("separation", 8)
	_report_box.visible = false
	for reason in REASONS:
		var b := UiKit.button(reason[1], 52.0)
		UiKit.style_secondary(b, wt)
		b.pressed.connect(_send_report.bind(reason[0]))
		_report_box.add_child(b)
	box.add_child(_report_box)
	_report_status = UiKit.label("", 20, wt.text_dim)
	_report_status.visible = false
	box.add_child(_report_status)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	_report_button = UiKit.button("Signaler une erreur", 64.0)
	UiKit.style_secondary(_report_button, wt)
	_report_button.pressed.connect(func() -> void:
		_report_box.visible = true
		_report_button.visible = false)
	row.add_child(_report_button)
	var ok := UiKit.button("Compris !", 64.0)
	ok.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ok.pressed.connect(func() -> void: closed.emit())
	row.add_child(ok)
	box.add_child(row)


func _send_report(reason: String) -> void:
	_report_box.visible = false
	_report_status.visible = true
	_report_status.text = "Envoi au parent…"
	reported.emit(reason)
	var body := {"item": _question, "reason": reason}
	var given := QuestionService.last_input_for(_question)
	if given != "":
		body["user_input"] = given.left(200)
	var res := await ApiClient.post_json("/play/reports", body)
	if not is_inside_tree():
		return
	_report_status.text = "Merci ! Ton parent va vérifier cette question." if res.ok \
		else "Pas de connexion : signalement non envoyé, réessaie une autre fois."
