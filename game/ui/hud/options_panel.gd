class_name OptionsPanel
extends PanelContainer
## Options de l'enfant sur cet appareil : taille du texte, volume des sons, lecture
## automatique. Il ne peut pas descendre sous les aménagements choisis par le parent
## (taille minimale, lecture à voix haute).

signal closed

const SIZES := ["Normal", "Grand", "Très grand"]


func setup(wt: WorldTheme) -> void:
	theme = UiKit.make_theme(wt)
	custom_minimum_size = Vector2(700, 0)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 14)
	add_child(box)
	box.add_child(UiKit.label("Options", 34, wt.accent))

	box.add_child(UiKit.label("Taille du texte", 24))
	var sizes := HBoxContainer.new()
	sizes.add_theme_constant_override("separation", 10)
	var minimum := int(Accessibility.parent.get("text_size", 0))
	for i in SIZES.size():
		var b := UiKit.button(SIZES[i], 56.0)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.add_theme_font_size_override("font_size", roundi(UiKit.BASE_FONT * UiKit.TEXT_SCALES[i]))
		if i != Accessibility.text_size():
			UiKit.style_secondary(b, wt)
		b.disabled = i < minimum
		b.pressed.connect(func() -> void: Accessibility.set_pref("text_size", i))
		sizes.add_child(b)
	box.add_child(sizes)

	box.add_child(UiKit.label("Volume des sons", 24))
	var volume := HSlider.new()
	volume.min_value = 0.0
	volume.max_value = 1.0
	volume.step = 0.1
	volume.value = Accessibility.volume()
	volume.custom_minimum_size = Vector2(0, 48)
	volume.drag_ended.connect(func(_changed: bool) -> void:
		Accessibility.set_pref("volume", volume.value)
		Sfx.play("correct"))
	box.add_child(volume)

	if Accessibility.can_speak():
		var auto := CheckButton.new()
		auto.text = "Lire chaque question à voix haute"
		auto.add_theme_font_size_override("font_size", UiKit.font_size(24))
		auto.button_pressed = Accessibility.auto_read()
		auto.custom_minimum_size = Vector2(0, 56 * UiKit.target_scale)
		auto.toggled.connect(func(on: bool) -> void: Accessibility.set_pref("auto_read", on))
		box.add_child(auto)

	var close := UiKit.button("Fermer", 64.0)
	close.pressed.connect(func() -> void: closed.emit())
	box.add_child(close)
