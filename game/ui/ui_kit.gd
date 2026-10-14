class_name UiKit
extends RefCounted
## Thème d'interface construit à partir de l'ambiance d'un monde : « grimoire enluminé »,
## parchemin et cadre doré (monde lumineux), pierre et cadre argenté (Brouillard). Textures
## dessinées par tools/make_ui_textures.py (9-patch : marges dans `MARGINS`), titres en Cinzel
## (`title`), icônes de game-icons.net (`icon`, assets/ui/icons).
## Contraintes (TRD §2.4) : cibles tactiles ≥ 48 px, aucune interaction au survol,
## contraste suffisant, taille de texte réglable (3 niveaux).

const TEXT_SCALES := [1.0, 1.15, 1.3]
const BASE_FONT := 24
const UI := "res://assets/ui/%s.png"
const ICONS := "res://assets/ui/icons/%s.svg"
## Marges des textures 9-patch (pixels de la texture : coins non étirés).
const MARGINS := {"panel": 30, "card": 22, "button": 18}
## Couleur du texte sur un bouton principal ou secondaire, par monde.
const BUTTON_TEXT := {"lumineux": Color("#3b2410"), "brouillard": Color("#ffffff")}
const BUTTON2_TEXT := {"lumineux": Color("#6b3d12"), "brouillard": Color("#d5e0ea")}

static var text_scale := 1.0
## Cibles agrandies (aménagement « gestes ») : hauteur des boutons multipliée.
static var target_scale := 1.0


static func font_size(base := BASE_FONT) -> int:
	return roundi(base * text_scale)


static func make_theme(wt: WorldTheme) -> Theme:
	var theme := Theme.new()
	theme.default_font_size = font_size()
	# Police et espacement des aménagements (lisibilité, troubles « dys »).
	theme.default_font = Accessibility.font()
	theme.set_constant("line_spacing", "Label", Accessibility.line_spacing())

	theme.set_stylebox("panel", "PanelContainer", texture_box("panel_" + wt.id, MARGINS["panel"], 28))
	theme.set_stylebox("panel", "Panel", texture_box("panel_" + wt.id, MARGINS["panel"], 0))
	theme.set_color("font_color", "Label", wt.text)

	var normal := _button_box("button_" + wt.id, false)
	var pressed := _button_box("button_%s_pressed" % wt.id, true)
	theme.set_stylebox("normal", "Button", normal)
	theme.set_stylebox("hover", "Button", normal)  # pas d'effet de survol (tablette)
	theme.set_stylebox("pressed", "Button", pressed)
	theme.set_stylebox("hover_pressed", "Button", pressed)
	theme.set_stylebox("disabled", "Button", _button_box("button_%s_disabled" % wt.id, true))
	theme.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	for state in ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color", "font_focus_color"]:
		theme.set_color(state, "Button", BUTTON_TEXT.get(wt.id, wt.text))
	theme.set_color("font_disabled_color", "Button", wt.text_dim)
	for state in ["icon_normal_color", "icon_hover_color", "icon_pressed_color", "icon_hover_pressed_color", "icon_focus_color"]:
		theme.set_color(state, "Button", BUTTON_TEXT.get(wt.id, wt.text))
	theme.set_constant("icon_max_width", "Button", roundi(34 * text_scale))
	theme.set_constant("h_separation", "Button", 10)

	var bar_bg := _box(Color(0, 0, 0, 0.35), wt.panel_border.darkened(0.3), 2, 8, 0)
	var bar_fill := _box(wt.good, wt.good.lightened(0.35), 1, 8, 0)
	bar_fill.border_width_bottom = 0
	bar_fill.border_width_left = 0
	bar_fill.border_width_right = 0
	theme.set_stylebox("background", "ProgressBar", bar_bg)
	theme.set_stylebox("fill", "ProgressBar", bar_fill)
	theme.set_color("font_color", "ProgressBar", Color.TRANSPARENT)
	return theme


## Bouton secondaire (parchemin clair ou pierre, filet coloré).
static func style_secondary(target: Button, wt: WorldTheme) -> void:
	var normal := _button_box("button2_" + wt.id, false)
	target.add_theme_stylebox_override("normal", normal)
	target.add_theme_stylebox_override("hover", normal)
	var pressed := _button_box("button2_%s_pressed" % wt.id, true)
	target.add_theme_stylebox_override("pressed", pressed)
	target.add_theme_stylebox_override("hover_pressed", pressed)
	var color: Color = BUTTON2_TEXT.get(wt.id, wt.accent)
	for state in ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color", "font_focus_color"]:
		target.add_theme_color_override(state, color)
	for state in ["icon_normal_color", "icon_hover_color", "icon_pressed_color", "icon_hover_pressed_color", "icon_focus_color"]:
		target.add_theme_color_override(state, color)


## Remplace un nœud par un autre à la même place (sans reprendre ses enfants, contrairement à
## `Node.replace_by`) ; l'ancien est libéré. Renvoie le nouveau.
static func swap(old: Node, fresh: Node) -> Node:
	var parent := old.get_parent()
	var at := old.get_index()
	parent.remove_child(old)
	old.queue_free()
	parent.add_child(fresh)
	parent.move_child(fresh, at)
	return fresh


## Barre de progression : creux sombre cerné, remplissage `fill` avec un reflet en haut.
static func style_bar(bar: ProgressBar, wt: WorldTheme, fill: Color) -> void:
	bar.add_theme_stylebox_override("background", _box(Color(0, 0, 0, 0.35), wt.panel_border.darkened(0.3), 2, 8, 0))
	var full := _box(fill, fill.lightened(0.4), 0, 8, 0)
	full.border_width_top = 2
	bar.add_theme_stylebox_override("fill", full)


## Ligne « qui parle » : petit portrait (icône dans un médaillon) et nom.
static func speaker(wt: WorldTheme, who: String, icon_name := "pointy-hat") -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	var medal := PanelContainer.new()
	var ring := _box(wt.panel_border.darkened(0.1) if wt.id == "lumineux" else Color("#1a2230"), wt.panel_border, 2, 22, 5)
	medal.add_theme_stylebox_override("panel", ring)
	medal.add_child(icon(icon_name, 30, Color("#fff3d6") if wt.id == "lumineux" else wt.accent))
	row.add_child(medal)
	var name_label := label(who, 19, wt.text_dim)
	name_label.autowrap_mode = TextServer.AUTOWRAP_OFF  # dans une rangée, un retour à la ligne la réduirait à une lettre
	name_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(name_label)
	return row


## Ligne d'information avec une icône (détails d'un seuil, d'une récompense).
static func info_line(wt: WorldTheme, icon_name: String, text: String, size := 20, color := Color(0, 0, 0, 0)) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	var c := color if color.a > 0.0 else wt.accent
	var i := icon(icon_name, size + 4, c)
	i.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	row.add_child(i)
	var l := label(text, size, c)
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(l)
	return row


## Titre gravé (Cinzel ; police lisible si le parent l'a choisie).
static func title(text: String, size := 32, color := Color(0, 0, 0, 0)) -> Label:
	var l := label(text, size, color)
	l.add_theme_font_override("font", Accessibility.title_font())
	return l


## Icône (game-icons.net), teinte au choix ; `size` en pixels avant la taille du texte.
static func icon(name: String, size := 32, color := Color.WHITE) -> TextureRect:
	var t := TextureRect.new()
	t.texture = load(ICONS % name)
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	t.custom_minimum_size = Vector2.ONE * font_size(size)
	t.modulate = color
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return t


## Bouton avec une icône à gauche du texte.
static func icon_button(text: String, icon_name: String, min_height := 64.0) -> Button:
	var b := button(text, min_height)
	b.icon = load(ICONS % icon_name)  # taille : constante `icon_max_width` du thème
	return b


## Bandeau de titre (ruban rouge et or, ou bleu nuit et argent), texte gravé au centre.
static func ribbon(wt: WorldTheme, text: String, size := 30) -> Control:
	var holder := PanelContainer.new()
	var box := texture_box("ribbon_" + wt.id, 0, 0)
	box.texture_margin_left = 44
	box.texture_margin_right = 44
	box.texture_margin_top = 14
	box.texture_margin_bottom = 14
	box.content_margin_left = 64
	box.content_margin_right = 64
	box.content_margin_top = 6
	box.content_margin_bottom = 14
	holder.add_theme_stylebox_override("panel", box)
	holder.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var l := title(text, size, Color("#fff3d6") if wt.id == "lumineux" else Color("#e6edf3"))
	l.autowrap_mode = TextServer.AUTOWRAP_OFF
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.45))
	l.add_theme_constant_override("outline_size", 6)
	holder.add_child(l)
	return holder


## Fond des écrans de menu : la salle de la Citadelle en 3D (CitadelHall), assombrie sur les
## bords pour que les panneaux restent lisibles. `live` : rendue à chaque image (personnages
## animés) ; sinon une seule fois (aucun coût ensuite). `people` : le héros (et son renard)
## avec Maître Ysaline près de la Chronique ; `shift` décale la vue (mètres). Renvoie la salle.
static func backdrop(parent: Control, wt: WorldTheme, live := false, people := false, shift := 0.0) -> CitadelHall:
	var holder := SubViewportContainer.new()
	holder.name = "Backdrop"
	holder.stretch = true
	holder.set_anchors_preset(Control.PRESET_FULL_RECT)
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(holder)
	var viewport := SubViewport.new()
	viewport.own_world_3d = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS if live else SubViewport.UPDATE_ONCE
	holder.add_child(viewport)
	if not live:  # taille changée : une nouvelle image
		holder.resized.connect(func() -> void: viewport.render_target_update_mode = SubViewport.UPDATE_ONCE)
	var hall := CitadelHall.new()
	viewport.add_child(hall)
	hall.build()
	hall.daylight(wt)
	if people:
		var hero := Fighter.create_hero(SaveManager.look(), wt.hero_name, 1)
		hall.add_child(hero)
		CitadelHall.place(hero, Vector3(5.6, 0, 6.0), Vector3(8, 0, 12))
		if wt.companion:
			var pet := Companion.create(SaveManager.look())
			hall.add_child(pet)
			CitadelHall.place(pet, Vector3(4.3, 0, 6.8), Vector3(8, 0, 12))
		CitadelHall.place(CitadelHall.ysaline(hall), Vector3(10.4, 0, 5.4), Vector3(8, 0, 12))
		if Quality.settings().vertex_shading:
			MobileLighting.apply_vertex_shading(hall)
	var camera := Camera3D.new()
	camera.fov = 52.0
	hall.add_child(camera)
	camera.position = Vector3(8, 3.6, 14.5)
	camera.look_at(Vector3(8, 1.6, 4.6))
	camera.h_offset = shift  # > 0 : la salle glisse vers la gauche (menus à droite)
	camera.current = true
	# Voile : bords et bas assombris (lisibilité des panneaux), centre dégagé.
	var veil := TextureRect.new()
	var gradient := Gradient.new()
	gradient.set_color(0, Color(wt.bg, 0.0))
	gradient.set_color(1, Color(wt.bg, 0.8))
	gradient.add_point(0.55, Color(wt.bg, 0.15))
	var texture := GradientTexture2D.new()
	texture.gradient = gradient
	texture.fill = GradientTexture2D.FILL_RADIAL
	texture.fill_from = Vector2(0.5, 0.42)
	texture.fill_to = Vector2(1.05, 1.05)
	veil.texture = texture
	veil.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	veil.stretch_mode = TextureRect.STRETCH_SCALE
	veil.set_anchors_preset(Control.PRESET_FULL_RECT)
	veil.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(veil)
	return hall


## Texte posé sur la scène 3D : clair, cerné de sombre.
static func on_scene(target: Label) -> Label:
	target.add_theme_color_override("font_color", Color.WHITE)
	target.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.75))
	target.add_theme_constant_override("outline_size", 8)
	return target


## Rangée d'icônes d'objets du sac avec leur nombre (vide : « Sac vide »).
static func bag_row(owned: Dictionary, color: Color, size := 18) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var any := false
	for id in Inventory.ORDER:
		var n := int(owned.get(id, 0))
		if n <= 0:
			continue
		any = true
		row.add_child(icon(Inventory.ICONS[id], size + 6, color))
		var count := label("×%d" % n, size, color)
		count.autowrap_mode = TextServer.AUTOWRAP_OFF
		count.tooltip_text = Inventory.ITEMS[id]["name"]
		row.add_child(count)
		var gap := Control.new()
		gap.custom_minimum_size.x = 6
		row.add_child(gap)
	if not any:
		var empty := label("Sac vide pour l'instant", size, color)
		empty.autowrap_mode = TextServer.AUTOWRAP_OFF
		row.add_child(empty)
	return row


## Titre d'un écran (Archives, Apparence, Défi du jour) : bandeau calé à gauche, qui prend la
## place libre de la rangée d'en-tête.
static func screen_title(wt: WorldTheme, text: String) -> Control:
	var holder := HBoxContainer.new()
	holder.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var r := ribbon(wt, text, 30)
	r.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	r.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	holder.add_child(r)
	return holder


## Filet orné de séparation (losange au centre).
static func divider(wt: WorldTheme, width := 420.0) -> TextureRect:
	var t := TextureRect.new()
	t.texture = load(UI % ("divider_" + wt.id))
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	t.custom_minimum_size = Vector2(width, 22)
	t.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return t


## Petite carte (cadre plus fin) pour les éléments d'une liste ou d'une grille.
static func card_box(wt: WorldTheme, margin := 18) -> StyleBoxTexture:
	return texture_box("card_" + wt.id, MARGINS["card"], margin)


static func texture_box(name: String, margin: int, content: int) -> StyleBoxTexture:
	var box := StyleBoxTexture.new()
	box.texture = load(UI % name)
	box.set_texture_margin_all(margin)
	box.set_content_margin_all(content)
	return box


static func _button_box(name: String, pressed: bool) -> StyleBoxTexture:
	var box := texture_box(name, MARGINS["button"], 0)
	box.texture_margin_bottom = 20
	box.content_margin_left = 20
	box.content_margin_right = 20
	box.content_margin_top = 9 if not pressed else 11
	box.content_margin_bottom = 13 if not pressed else 11
	return box


static func label(text: String, size := BASE_FONT, color := Color(0, 0, 0, 0)) -> Label:
	var l := Label.new()
	l.text = text
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.add_theme_font_size_override("font_size", font_size(size))
	if color.a > 0.0:
		l.add_theme_color_override("font_color", color)
	return l


static func button(text: String, min_height := 64.0) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(0, min_height * target_scale)
	b.focus_mode = Control.FOCUS_NONE
	b.pressed.connect(func() -> void: Sfx.play("click"))
	return b


## Panneau de message (victoire, repli, fin de session) : [panneau, bouton principal].
static func message_panel(wt: WorldTheme, heading: String, body: String, button_text: String) -> Array:
	var panel := PanelContainer.new()
	panel.theme = make_theme(wt)
	panel.custom_minimum_size = Vector2(640, 0)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 14)
	panel.add_child(box)
	box.add_child(title(heading, 32, wt.accent))
	box.add_child(divider(wt, 320))
	box.add_child(label(body, 24))
	if Accessibility.can_speak():
		box.add_child(listen_button(wt, "%s. %s" % [heading, body], Accessibility.auto_read()))
	var main := button(button_text, 64.0)
	box.add_child(main)
	return [panel, main]


## Bouton « Écouter » (aménagement lecture à voix haute) ; `auto` : lit dès l'affichage.
## La lecture s'arrête quand le bouton disparaît.
## Bouton « Écouter » (lecture à voix haute) : un texte en français, ou des morceaux
## [[texte, langue], …] (Accessibility.question_parts).
static func listen_button(wt: WorldTheme, content: Variant, auto := false) -> Button:
	var b := icon_button("Écouter", "speaker", 52.0)
	style_secondary(b, wt)
	b.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	b.custom_minimum_size.x = 170
	var read := func() -> void:
		if content is Array:
			Accessibility.speak_parts(content)
		else:
			Accessibility.speak(str(content))
	b.pressed.connect(read)
	b.tree_exiting.connect(Accessibility.stop_speaking)
	if auto:
		b.ready.connect(read, CONNECT_ONE_SHOT)
	return b


## Rappel de pause (aménagement attention, bien-être) : [panneau, continuer, arrêter].
static func pause_panel(wt: WorldTheme) -> Array:
	var minutes := roundi(Session.played_seconds / 60.0)
	var panel := message_panel(wt, "Petite pause ?",
		"Tu joues depuis %d minutes. Bois un verre d'eau, étire-toi, regarde au loin… Ta progression est sauvegardée." % minutes,
		"Je fais une pause")
	var box: VBoxContainer = (panel[0] as PanelContainer).get_child(0)
	var keep := button("Je continue encore un peu", 56.0)
	style_secondary(keep, wt)
	box.add_child(keep)
	return [panel[0], keep, panel[1]]


## Affichage « joli » d'une saisie : x² au lieu de x^2, × au lieu de *, − au lieu de -.
static func pretty_math(text: String) -> String:
	return text.replace("^2", "²").replace("^3", "³").replace("*", "×").replace("-", "−")


static func _box(bg: Color, border: Color, border_width: int, radius: int, margin: int) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = bg
	box.border_color = border
	box.set_border_width_all(border_width)
	box.set_corner_radius_all(radius)
	box.set_content_margin_all(margin)
	box.anti_aliasing = true
	return box
