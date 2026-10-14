extends CanvasLayer
## Overlay de mesure des performances (budgets du TRD §2.2).
## Bascule : F3, ou appui à trois doigts sur écran tactile, ou `?perf=1` dans l'URL.
## Toutes les 10 s, une ligne JSON préfixée `[Aldoria/perf]` part dans la console
## (lisible sur la tablette via chrome://inspect).

const WINDOW_S := 10.0
const LOG_PREFIX := "[Aldoria/perf]"

var _label: Label
var _quality_button: Button
var _frame_times: PackedFloat32Array = []
var _window_elapsed := 0.0
var _boot_ms_engine := -1
var _boot_ms_browser := -1.0
var _touches: Dictionary = {}
var _last_stats: Dictionary = {}
var _cpu_ms_sum := 0.0


func _ready() -> void:
	layer = 100
	process_mode = Node.PROCESS_MODE_ALWAYS
	_build_ui()
	# `--perf=0` (PC) : captures d'écran sans le compteur.
	visible = (OS.is_debug_build() or Quality.option("perf") != "") and Quality.option("perf") != "0"
	RenderingServer.viewport_set_measure_render_time(get_viewport().get_viewport_rid(), true)
	Quality.changed.connect(func(_p: StringName) -> void: _refresh_quality_button())
	_refresh_quality_button()
	_maybe_take_screenshot()


func show_overlay() -> void:
	visible = true


## Développement (PC uniquement) : `-- --screenshot=chemin.png [--shot-delay=2.5]`
## enregistre une capture de la fenêtre après le délai, puis quitte.
func _maybe_take_screenshot() -> void:
	var path := Quality.option("screenshot")
	if path == "" or OS.has_feature("web"):
		return
	var delay := float(Quality.option("shot-delay", "1.5"))
	await get_tree().create_timer(delay, true, false, true).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(path)
	print("Capture enregistrée : ", path)
	get_tree().quit()


func _process(delta: float) -> void:
	if _boot_ms_engine < 0:
		_record_boot_time()
	_frame_times.append(delta)
	_cpu_ms_sum += _cpu_frame_ms()
	_window_elapsed += delta
	if _window_elapsed >= WINDOW_S:
		_last_stats = _window_stats()
		print("%s %s" % [LOG_PREFIX, JSON.stringify(_last_stats)])
		_frame_times.clear()
		_cpu_ms_sum = 0.0
		_window_elapsed = 0.0
	if visible:
		_label.text = _format_text()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"toggle_perf_overlay"):
		visible = not visible
		return
	if event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		if touch.pressed:
			_touches[touch.index] = true
			if _touches.size() == 3:
				visible = not visible
		else:
			_touches.erase(touch.index)


func _record_boot_time() -> void:
	_boot_ms_engine = Time.get_ticks_msec()
	if OS.has_feature("web"):
		var value: Variant = JavaScriptBridge.get_interface("performance").now()
		if value != null:
			_boot_ms_browser = float(value)


func _window_stats() -> Dictionary:
	var count := _frame_times.size()
	if count == 0:
		return {}
	var sorted := _frame_times.duplicate()
	sorted.sort()
	var worst_index := clampi(int(ceil(count * 0.99)) - 1, 0, count - 1)
	var frame_ms := _window_elapsed * 1000.0 / count
	var cpu_ms := _cpu_ms_sum / count
	return {
		"quality": String(Quality.current),
		"options": _active_options(),
		"fps_avg": snappedf(count / _window_elapsed, 0.1),
		"frame_ms": snappedf(frame_ms, 0.1),
		# Indicatif seulement : sur le web, Godot semble compter certains temps en double
		# (cpu_ms > frame_ms observé). Le diagnostic fiable reste la comparaison ?scale=.
		"cpu_ms": snappedf(cpu_ms, 0.1),
		"render_px": _render_resolution(),
		"dpr": snappedf(DisplayServer.screen_get_scale(), 0.01),
		"fps_1pct_low": snappedf(1.0 / maxf(sorted[worst_index], 0.0001), 0.1),
		"draw_calls": int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)),
		"primitives": int(Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)),
		"video_mem_mb": snappedf(Performance.get_monitor(Performance.RENDER_VIDEO_MEM_USED) / 1048576.0, 0.1),
		"static_mem_mb": snappedf(Performance.get_monitor(Performance.MEMORY_STATIC) / 1048576.0, 0.1),
		"boot_engine_ms": _boot_ms_engine,
		"boot_browser_ms": int(_boot_ms_browser),
		"viewport": "%dx%d" % [get_viewport().get_visible_rect().size.x, get_viewport().get_visible_rect().size.y],
		"adapter": RenderingServer.get_video_adapter_name(),
		"platform": _platform_label(),
	}


func _format_text() -> String:
	var lines: PackedStringArray = []
	lines.append("FPS %d" % Engine.get_frames_per_second())
	if not _last_stats.is_empty():
		lines.append("Moy. 10 s : %.1f   1%% bas : %.1f" % [_last_stats.fps_avg, _last_stats.fps_1pct_low])
		lines.append("Image : %.1f ms" % _last_stats.frame_ms)
	else:
		lines.append("Moy. 10 s : mesure en cours…")
	lines.append("Rendu 3D : %s px   (écran x%.2f)" % [_render_resolution(), DisplayServer.screen_get_scale()])
	var options := _active_options()
	if not options.is_empty():
		lines.append("Options : %s" % options)
	lines.append("Appels de dessin : %d" % Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))
	lines.append("Triangles : %d" % Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME))
	var mem := "Mém. vidéo : %.0f Mo" % (Performance.get_monitor(Performance.RENDER_VIDEO_MEM_USED) / 1048576.0)
	var static_mem := Performance.get_monitor(Performance.MEMORY_STATIC)
	if static_mem > 0: # non mesurée dans les builds de release (web)
		mem += "   statique : %.0f Mo" % (static_mem / 1048576.0)
	lines.append(mem)
	if _boot_ms_browser >= 0.0:
		lines.append("Démarrage (navigateur) : %.1f s" % (_boot_ms_browser / 1000.0))
	lines.append("Démarrage (moteur) : %.1f s" % (maxi(_boot_ms_engine, 0) / 1000.0))
	lines.append("%s · %s" % [_platform_label(), RenderingServer.get_video_adapter_name()])
	return "\n".join(lines)


## Temps CPU de l'image : logique (process + physique) + préparation du rendu.
func _cpu_frame_ms() -> float:
	var rid := get_viewport().get_viewport_rid()
	return (Performance.get_monitor(Performance.TIME_PROCESS)
		+ Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS)) * 1000.0 \
		+ RenderingServer.viewport_get_measured_render_time_cpu(rid) \
		+ RenderingServer.get_frame_setup_time_cpu()


## Taille réelle (pixels physiques) de l'image 3D, après le facteur scale_3d.
func _render_resolution() -> String:
	var size := Vector2(get_window().size) * get_viewport().scaling_3d_scale
	return "%dx%d" % [size.x, size.y]


func _active_options() -> String:
	var parts: PackedStringArray = []
	for key in ["scale", "shadows", "lights", "vertex", "particles", "chars", "merge"]:
		var value := Quality.option(key)
		if value != "":
			parts.append("%s=%s" % [key, value])
	return " ".join(parts)


func _platform_label() -> String:
	for tag in ["web_android", "web_ios", "web_windows", "web_macos", "web_linuxbsd"]:
		if OS.has_feature(tag):
			return tag
	return OS.get_name()


func _refresh_quality_button() -> void:
	if _quality_button:
		_quality_button.text = "Qualité : %s" % String(Quality.current)


func _build_ui() -> void:
	var panel := PanelContainer.new()
	panel.position = Vector2(12, 12)
	panel.mouse_filter = Control.MOUSE_FILTER_PASS
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0, 0, 0, 0.6)
	style.set_corner_radius_all(8)
	style.set_content_margin_all(10)
	panel.add_theme_stylebox_override(&"panel", style)
	add_child(panel)

	var box := VBoxContainer.new()
	panel.add_child(box)

	_label = Label.new()
	_label.add_theme_font_size_override(&"font_size", 16)
	box.add_child(_label)

	_quality_button = Button.new()
	_quality_button.custom_minimum_size = Vector2(220, 48)
	_quality_button.pressed.connect(Quality.cycle)
	box.add_child(_quality_button)

