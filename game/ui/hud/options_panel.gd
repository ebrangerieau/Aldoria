class_name OptionsPanel
extends PanelContainer
## Options de l'enfant sur cet appareil : taille du texte, volume des sons et de la musique, lecture
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
	box.add_child(UiKit.title("Options", 32, wt.accent))
	box.add_child(UiKit.divider(wt, 320))

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

	box.add_child(UiKit.label("Musique", 24))
	var music := HSlider.new()
	music.min_value = 0.0
	music.max_value = 1.0
	music.step = 0.1
	music.value = Accessibility.music_volume()
	music.custom_minimum_size = Vector2(0, 48)
	music.value_changed.connect(func(value: float) -> void:
		Accessibility.set_pref("music", value, false)
		Accessibility.set_pref("music_off", false, false)  # bouger le curseur remet la musique
		Music.refresh_button())
	box.add_child(music)

	if Accessibility.can_speak():
		var auto := CheckButton.new()
		auto.text = "Lire chaque question à voix haute"
		auto.add_theme_font_size_override("font_size", UiKit.font_size(24))
		auto.button_pressed = Accessibility.auto_read()
		auto.custom_minimum_size = Vector2(0, 56 * UiKit.target_scale)
		auto.toggled.connect(func(on: bool) -> void: Accessibility.set_pref("auto_read", on))
		box.add_child(auto)

	# Crédits demandés par la licence des voix (CC BY 4.0).
	box.add_child(UiKit.label("Voix du jeu : Piper, voix « siwis » (français) et « alba » (anglais), sous licence CC BY 4.0.", 15, wt.text_dim))
	if Voice.recorded_count() > 0:  # voix enregistrées (tools/voix_elevenlabs.py)
		box.add_child(UiKit.label("Voix du narrateur et de Maître Ysaline : ElevenLabs.", 15, wt.text_dim))
	if Music.is_loaded():
		box.add_child(UiKit.label("Musique : « Ritual of the Cursed », créée avec Suno.", 15, wt.text_dim))
	# Crédit demandé par la licence des icônes (CC BY 3.0).
	box.add_child(UiKit.label("Icônes : game-icons.net (Lorc, Delapouite, Carl Olsen, Skoll, Zeromancer, Sbed), sous licence CC BY 3.0. Titres : police Cinzel (OFL).", 15, wt.text_dim))
	var close := UiKit.icon_button("Fermer", "check-mark", 64.0)
	close.pressed.connect(func() -> void: closed.emit())
	box.add_child(close)
