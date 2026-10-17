extends Control
## Les Archives : étoiles de maîtrise par notion, groupées par chapitre
## (`GET /play/progress`), et bestiaire des créatures vaincues (sauvegarde).
## 0 étoile = jamais vue ; ★ en cours ; ★★ fragile ; ★★★ acquise (TRD §5.4).
## Le dernier état reçu est gardé pour une consultation hors connexion.

const CACHE := "user://progress_%d.json"
const STATUS_TEXT := {"en_cours": "en classe en ce moment", "controle_bientot": "contrôle bientôt !"}

var _wt: WorldTheme
var _summary: Label
var _list: VBoxContainer
var _tabs: Dictionary = {}
var _chapters: Array = []


func _ready() -> void:
	_wt = WorldTheme.for_world(Session.world())
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = UiKit.make_theme(_wt)
	_build()
	_summary.text = "Ouverture des Archives…"
	var res := await ApiClient.get_json("/play/progress")
	var cache_path := CACHE % int(Session.profile.get("id", 0))
	if res.ok:
		_chapters = res.data["chapters"]
		var file := FileAccess.open(cache_path, FileAccess.WRITE)
		if file:
			file.store_string(JSON.stringify(_chapters))
	elif FileAccess.file_exists(cache_path):
		_chapters = JSON.parse_string(FileAccess.get_file_as_string(cache_path))
	_show("notions")


func _build() -> void:
	var bg := ColorRect.new()
	bg.color = _wt.bg
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	UiKit.backdrop(self, _wt)
	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 24)
	add_child(margin)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 14)
	margin.add_child(column)

	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 16)
	top.add_child(UiKit.screen_title(_wt, "Les Archives"))
	for tab in ["notions", "bestiaire"]:
		var b := UiKit.icon_button("Notions" if tab == "notions" else "Bestiaire", "open-book" if tab == "notions" else "dragon-head", 56.0)
		b.custom_minimum_size.x = 180
		b.pressed.connect(_show.bind(tab))
		top.add_child(b)
		_tabs[tab] = b
	var back := UiKit.icon_button("Retour à la Citadelle", "castle", 56.0)
	UiKit.style_secondary(back, _wt)
	back.pressed.connect(func() -> void: get_tree().change_scene_to_file("res://scenes/hub/hub.tscn"))
	top.add_child(back)
	column.add_child(top)

	_summary = UiKit.on_scene(UiKit.label("", 22))
	column.add_child(_summary)

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	column.add_child(scroll)
	TouchScroll.attach(scroll)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 12)
	scroll.add_child(_list)


func _show(tab: String) -> void:
	for key in _tabs:
		if key == tab:
			(_tabs[key] as Button).remove_theme_stylebox_override("normal")
			(_tabs[key] as Button).remove_theme_stylebox_override("hover")
			(_tabs[key] as Button).remove_theme_stylebox_override("pressed")
			(_tabs[key] as Button).remove_theme_color_override("font_color")
		else:
			UiKit.style_secondary(_tabs[key], _wt)
	for child in _list.get_children():
		child.queue_free()
	if tab == "notions":
		_show_notions()
	else:
		_show_bestiary()


func _show_notions() -> void:
	if _chapters.is_empty():
		_summary.text = "Les Archives sont hors de portée : pas de connexion au serveur."
		return
	var counts := [0, 0, 0, 0]
	for chapter in _chapters:
		var playable: Array = (chapter["notions"] as Array).filter(func(n: Dictionary) -> bool: return n["playable"])
		for n in playable:
			counts[int(n["stars"])] += 1
		var panel := PanelContainer.new()
		_list.add_child(panel)
		var box := VBoxContainer.new()
		box.add_theme_constant_override("separation", 6)
		panel.add_child(box)
		var header := HBoxContainer.new()
		header.add_theme_constant_override("separation", 14)
		var name_label := UiKit.title(str(chapter["title"]), 24, _wt.accent)
		name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		header.add_child(name_label)
		if STATUS_TEXT.has(chapter["status"]):
			var status := UiKit.label(STATUS_TEXT[chapter["status"]], 20, _wt.good_ink if chapter["status"] == "en_cours" else _wt.bad_ink)
			status.autowrap_mode = TextServer.AUTOWRAP_OFF
			header.add_child(status)
		box.add_child(header)
		if playable.is_empty():
			box.add_child(UiKit.label("Archive encore scellée : ses épreuves arrivent bientôt.", 20, _wt.text_dim))
			continue
		for n in playable:
			box.add_child(_notion_row(n))
	_summary.text = "%d notion%s acquise%s ★★★ · %d fragile%s · %d en cours · %d à découvrir" % [
		counts[3], _s(counts[3]), _s(counts[3]), counts[2], _s(counts[2]), counts[1], counts[0]]


func _notion_row(n: Dictionary) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 16)
	var label := UiKit.label(str(n["label"]), 22, _wt.text)
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(label)
	var stars := int(n["stars"])
	var star_label := UiKit.label("★".repeat(stars) + "☆".repeat(3 - stars), 30, _wt.accent if stars > 0 else _wt.text_dim)
	star_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	row.add_child(star_label)
	var state := UiKit.label(str(n["state"]), 20, _wt.text_dim)
	state.autowrap_mode = TextServer.AUTOWRAP_OFF
	state.custom_minimum_size.x = 130
	row.add_child(state)
	return row


func _show_bestiary() -> void:
	var beasts := SaveManager.bestiary()
	var total := 0
	for beast in beasts:
		total += int(beasts[beast])
	_summary.text = "%d créature%s vaincue%s, %d espèce%s rencontrée%s." % [
		total, _s(total), _s(total), beasts.size(), _s(beasts.size()), _s(beasts.size())]
	if beasts.is_empty():
		_list.add_child(UiKit.on_scene(UiKit.label("Aucune créature pour l'instant. Le donjon t'attend !", 24)))
		return
	var names: Array = beasts.keys()
	names.sort_custom(func(a: String, b: String) -> bool: return int(beasts[a]) > int(beasts[b]))
	for beast in names:
		var panel := PanelContainer.new()
		panel.add_theme_stylebox_override("panel", UiKit.card_box(_wt, 16))
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 12)
		panel.add_child(row)
		row.add_child(UiKit.icon("dragon-head", 30, _wt.accent))
		var label := UiKit.title(str(beast), 22, _wt.text)
		label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(label)
		var count := UiKit.label("× %d" % int(beasts[beast]), 26, _wt.accent)
		count.autowrap_mode = TextServer.AUTOWRAP_OFF
		row.add_child(count)
		_list.add_child(panel)


static func _s(n: int) -> String:
	return "s" if n > 1 else ""
