class_name HeroBadge
extends PanelContainer
## Panneau du héros (Citadelle, carte du royaume) : nom gravé, niveau et barre d'expérience
## dorée, pages de la Grande Chronique retrouvées (si `dungeons` n'est pas vide) et objets du sac
## en icônes. Se met à jour avec la sauvegarde (`refresh`).

var _wt: WorldTheme
var _dungeons: Array[DungeonDef] = []
var _level: Label
var _xp_bar: ProgressBar
var _xp_text: Label
var _pages: Label
var _bag: HBoxContainer
var _lines: VBoxContainer


static func create(wt: WorldTheme, dungeons: Array[DungeonDef] = []) -> HeroBadge:
	var badge := HeroBadge.new()
	badge._wt = wt
	badge._dungeons = dungeons
	badge._build()
	badge.refresh()
	return badge


func _build() -> void:
	add_theme_stylebox_override("panel", UiKit.card_box(_wt, 16))
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_lines = VBoxContainer.new()
	_lines.add_theme_constant_override("separation", 4)
	add_child(_lines)
	var name_label := UiKit.title(_wt.hero_name, 26, _wt.accent)
	name_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	_lines.add_child(name_label)
	var level_row := HBoxContainer.new()
	level_row.add_theme_constant_override("separation", 10)
	_lines.add_child(level_row)
	_level = UiKit.label("", 21, _wt.text)
	_level.autowrap_mode = TextServer.AUTOWRAP_OFF
	level_row.add_child(_level)
	_xp_bar = ProgressBar.new()
	_xp_bar.custom_minimum_size = Vector2(200, 16)
	_xp_bar.show_percentage = false
	_xp_bar.max_value = 1.0
	_xp_bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	UiKit.style_bar(_xp_bar, _wt, Color("#e8b030") if _wt.id == "lumineux" else Color("#7fb2ff"))
	level_row.add_child(_xp_bar)
	_xp_text = UiKit.label("", 17, _wt.text_dim)
	_xp_text.autowrap_mode = TextServer.AUTOWRAP_OFF
	level_row.add_child(_xp_text)
	if not _dungeons.is_empty():
		var pages_row := HBoxContainer.new()
		pages_row.add_theme_constant_override("separation", 8)
		pages_row.add_child(UiKit.icon("scroll-quill", 22, _wt.accent))
		_pages = UiKit.label("", 18, _wt.text)
		_pages.autowrap_mode = TextServer.AUTOWRAP_OFF
		pages_row.add_child(_pages)
		_lines.add_child(pages_row)
	_bag = HBoxContainer.new()
	_lines.add_child(_bag)


func refresh() -> void:
	var xp := SaveManager.xp()
	var level := Progression.level_for_xp(xp)
	_level.text = "Niveau %d" % level
	_xp_bar.value = Progression.level_progress(xp)
	_xp_text.text = "%d / %d XP" % [xp, Progression.xp_for_level(level + 1)]
	if _pages != null:
		var found := _dungeons.filter(func(d: DungeonDef) -> bool: return int(SaveManager.dungeon(d.code)["completed"]) > 0).size()
		_pages.text = "Pages de la Chronique : %d / %d" % [found, _dungeons.size()]
	_bag = UiKit.swap(_bag, UiKit.bag_row(SaveManager.items(), _wt.text_dim))


func pages_text() -> String:
	return _pages.text if _pages != null else ""
