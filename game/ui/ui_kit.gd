class_name UiKit
extends RefCounted
## Thème d'interface construit à partir de l'ambiance d'un monde.
## Contraintes (TRD §2.4) : cibles tactiles ≥ 48 px, aucune interaction au survol,
## contraste suffisant, taille de texte réglable (3 niveaux).

const TEXT_SCALES := [1.0, 1.15, 1.3]
const BASE_FONT := 24

static var text_scale := 1.0


static func font_size(base := BASE_FONT) -> int:
	return roundi(base * text_scale)


static func make_theme(wt: WorldTheme) -> Theme:
	var theme := Theme.new()
	theme.default_font_size = font_size()

	theme.set_stylebox("panel", "PanelContainer", _box(wt.panel, wt.panel_border, 3, 18, 22))
	theme.set_stylebox("panel", "Panel", _box(wt.panel, wt.panel_border, 3, 18, 0))
	theme.set_color("font_color", "Label", wt.text)

	var normal := _box(wt.accent, wt.accent.darkened(0.25), 0, 14, 12)
	normal.border_width_bottom = 4
	var pressed := _box(wt.accent.darkened(0.15), wt.accent.darkened(0.35), 0, 14, 12)
	pressed.border_width_top = 4
	var disabled := _box(wt.text_dim.lerp(wt.panel, 0.5), wt.text_dim, 0, 14, 12)
	theme.set_stylebox("normal", "Button", normal)
	theme.set_stylebox("hover", "Button", normal)  # pas d'effet de survol (tablette)
	theme.set_stylebox("pressed", "Button", pressed)
	theme.set_stylebox("hover_pressed", "Button", pressed)
	theme.set_stylebox("disabled", "Button", disabled)
	theme.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	var on_accent := Color.WHITE if wt.accent.get_luminance() < 0.6 else Color.BLACK
	for state in ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color", "font_focus_color"]:
		theme.set_color(state, "Button", on_accent)
	theme.set_color("font_disabled_color", "Button", wt.panel)

	var bar_bg := _box(wt.text_dim.lerp(wt.panel, 0.6), Color.TRANSPARENT, 0, 8, 0)
	var bar_fill := _box(wt.good, Color.TRANSPARENT, 0, 8, 0)
	theme.set_stylebox("background", "ProgressBar", bar_bg)
	theme.set_stylebox("fill", "ProgressBar", bar_fill)
	theme.set_color("font_color", "ProgressBar", Color.TRANSPARENT)
	return theme


## Bouton secondaire (contour, sans fond plein).
static func style_secondary(target: Button, wt: WorldTheme) -> void:
	var outline := _box(wt.panel, wt.accent, 3, 14, 12)
	target.add_theme_stylebox_override("normal", outline)
	target.add_theme_stylebox_override("hover", outline)
	target.add_theme_stylebox_override("pressed", _box(wt.accent.lerp(wt.panel, 0.7), wt.accent, 3, 14, 12))
	for state in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		target.add_theme_color_override(state, wt.accent if wt.panel.get_luminance() > 0.5 else wt.text)


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
	b.custom_minimum_size = Vector2(0, min_height)
	b.focus_mode = Control.FOCUS_NONE
	b.pressed.connect(func() -> void: Sfx.play("click"))
	return b


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
