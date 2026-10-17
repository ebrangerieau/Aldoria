extends Node
## Profils de qualité graphique, calés sur les mesures tablette du 2026-10-10
## (docs/perf-log.md) : sur la tablette (Android 10, Chrome 138), seules les
## fausses lumières + l'éclairage par sommet tiennent 30 fps à pleine résolution.
##
## Sur le web, `?quality=haut|tablette|bas` force un profil. Options de diagnostic :
## `?scale=0.5`, `?shadows=0`, `?particles=0`, `?lights=fake|real|0`, `?vertex=0|1`.
##
## Les réglages « structurels » (lumières, éclairage par sommet) se lisent à la
## construction d'une scène : après un changement, la scène doit être rechargée
## (voir `needs_rebuild`).

signal changed(profile: StringName)

const PROFILES := {
	# PC familial : vraies lumières, ombres fines et adoucies, éclairage par pixel, lissage 4×.
	# Pas de halo (glow) : en rendu web (WebGL 2, sans HDR) il blanchit le sol clair au lieu
	# de faire rayonner les flammes (essai du 2026-10-14).
	&"haut": {
		"scale_3d": 1.0,
		"msaa": Viewport.MSAA_4X,
		"shadows": true,
		"shadow_size": 4096,
		"soft_shadows": true,
		"particle_ratio": 1.0,
		"lights": "real",
		"vertex_shading": false,
		"min_dynamic_scale": 1.0,
	},
	# Tablette : réglage « D » des mesures (30 fps, pleine résolution).
	# La résolution 3D baisse seule jusqu'à 65 % si une scène fait chuter les fps.
	&"tablette": {
		"scale_3d": 1.0,
		"msaa": Viewport.MSAA_DISABLED,
		"shadows": false,
		"shadow_size": 512,
		"soft_shadows": false,
		"particle_ratio": 0.6,
		"lights": "fake",
		"vertex_shading": true,
		"min_dynamic_scale": 0.65,
	},
	# Secours pour un appareil plus faible.
	&"bas": {
		"scale_3d": 0.65,
		"msaa": Viewport.MSAA_DISABLED,
		"shadows": false,
		"shadow_size": 512,
		"soft_shadows": false,
		"particle_ratio": 0.3,
		"lights": "fake",
		"vertex_shading": true,
		"min_dynamic_scale": 0.5,
	},
}
const ORDER: Array[StringName] = [&"haut", &"tablette", &"bas"]
const STRUCTURAL_KEYS: Array[String] = ["lights", "vertex_shading"]
## Interface sur ordinateur (souris) : elle suit la taille de l'écran à 80 % seulement, sans
## descendre sous sa taille de conception (1280 × 720). Plus de place pour la scène, boutons
## toujours confortables. Tablette et téléphone : agrandissement proportionnel, inchangé.
const DESKTOP_UI_RATIO := 0.8
## Téléphone (petit écran tactile) : interface 1,3 fois plus grande que l'agrandissement proportionnel,
## pour un texte lisible et des boutons d'au moins 44 points au doigt (les panneaux trop hauts défilent).
const PHONE_UI_RATIO := 1.3
## Côté court de l'écran, en points CSS, sous lequel un appareil tactile est un téléphone.
const PHONE_SHORT_SIDE := 520.0
const DESIGN_SIZE := Vector2(1280, 720)

# Résolution dynamique : sous ce seuil (moyenne sur la fenêtre), on baisse d'un palier.
const DYNAMIC_FPS_FLOOR := 27.0
const DYNAMIC_WINDOW_S := 3.0
const DYNAMIC_STEP := 0.15

var current: StringName = &"haut"
var _dynamic_scale := 1.0
var _window_time := 0.0
var _window_frames := 0
var _options: Dictionary = {}
var _kind := ""  # « ordinateur », « tablette » ou « telephone » (device_kind)
var _rotate: CanvasLayer  # « Tourne ton téléphone » (appareil tactile tenu en portrait)


func _ready() -> void:
	apply(_initial_profile())
	get_tree().root.size_changed.connect(_fit_ui)
	_fit_ui()


## Ordinateur : ni tablette ni téléphone (`?ui=tablette` garde l'interface de la tablette).
func is_desktop() -> bool:
	return device_kind() == "ordinateur"


## Téléphone : appareil tactile au petit écran (`?ui=telephone` le force, pour les essais sur PC).
func is_phone() -> bool:
	return device_kind() == "telephone"


## « ordinateur », « tablette » ou « telephone » ; `?ui=` impose l'un des trois.
func device_kind() -> String:
	if _kind != "":
		return _kind
	var forced := option("ui")
	if forced in ["ordinateur", "tablette", "telephone"]:
		_kind = forced
	elif is_mobile_web() or OS.has_feature("mobile"):
		_kind = "telephone" if _short_side_points() < PHONE_SHORT_SIDE else "tablette"
	else:
		_kind = "ordinateur"
	return _kind


## Côté court de l'écran en points (pixels CSS sur le web, indépendants de la densité).
func _short_side_points() -> float:
	if OS.has_feature("web"):
		var window: JavaScriptObject = JavaScriptBridge.get_interface("window")
		return minf(float(window.innerWidth), float(window.innerHeight))
	var screen := Vector2(DisplayServer.screen_get_size()) / maxf(1.0, DisplayServer.screen_get_scale())
	return minf(screen.x, screen.y)


## Échelle de l'interface pour une fenêtre de taille `window`, relative à l'agrandissement
## proportionnel (1,0 : celui de la tablette).
static func ui_factor(window: Vector2, desktop: bool, phone := false) -> float:
	if phone:
		return PHONE_UI_RATIO
	var natural := minf(window.x / DESIGN_SIZE.x, window.y / DESIGN_SIZE.y)
	if not desktop or natural <= 1.0:
		return 1.0
	return maxf(1.0, natural * DESKTOP_UI_RATIO) / natural


func _fit_ui() -> void:
	var root := get_tree().root
	root.content_scale_factor = ui_factor(Vector2(root.size), is_desktop(), is_phone())
	# Le jeu se joue à l'horizontale : tenu en portrait, un appareil tactile demande de tourner.
	var portrait := not is_desktop() and root.size.x < root.size.y
	if portrait and _rotate == null:
		_rotate = _rotate_screen()
		root.add_child.call_deferred(_rotate)
	if _rotate != null:
		_rotate.visible = portrait


## Écran « Tourne ton téléphone » : au-dessus de tout, il arrête les appuis tant qu'il est là.
func _rotate_screen() -> CanvasLayer:
	var layer := CanvasLayer.new()
	layer.layer = 128
	var shade := ColorRect.new()
	shade.color = Color(0.07, 0.06, 0.1)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_STOP
	layer.add_child(shade)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(center)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 28)
	column.alignment = BoxContainer.ALIGNMENT_CENTER
	center.add_child(column)
	var holder := Control.new()  # le petit téléphone qui pivote
	holder.custom_minimum_size = Vector2(140, 140)
	holder.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	column.add_child(holder)
	var phone := Panel.new()
	var box := StyleBoxFlat.new()
	box.bg_color = Color(0.12, 0.11, 0.17)
	box.border_color = Color("#f2d79a")
	box.set_border_width_all(5)
	box.set_corner_radius_all(14)
	phone.add_theme_stylebox_override("panel", box)
	phone.size = Vector2(66, 120)
	phone.position = Vector2(37, 10)
	phone.pivot_offset = phone.size / 2.0
	holder.add_child(phone)
	var spin := phone.create_tween().set_loops()
	spin.tween_interval(0.6)
	spin.tween_property(phone, "rotation_degrees", -90.0, 0.7).set_trans(Tween.TRANS_SINE)
	spin.tween_interval(1.2)
	spin.tween_property(phone, "rotation_degrees", 0.0, 0.01)
	for line in [["Tourne ton téléphone", 44], ["Les Chroniques d'Aldoria se jouent à l'horizontale.", 26]]:
		var label := Label.new()
		label.text = line[0]
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		label.custom_minimum_size.x = 560
		label.add_theme_font_size_override("font_size", line[1])
		label.add_theme_color_override("font_color", Color("#f2d79a") if line[1] == 44 else Color("#e6e1f0"))
		column.add_child(label)
	return layer


func _process(delta: float) -> void:
	var p := settings()
	if p.min_dynamic_scale >= p.scale_3d or _dynamic_scale <= p.min_dynamic_scale:
		return
	_window_time += delta
	_window_frames += 1
	if _window_time < DYNAMIC_WINDOW_S:
		return
	var fps := _window_frames / _window_time
	_window_time = 0.0
	_window_frames = 0
	if fps < DYNAMIC_FPS_FLOOR:
		_dynamic_scale = maxf(p.min_dynamic_scale, _dynamic_scale - DYNAMIC_STEP)
		get_viewport().scaling_3d_scale = p.scale_3d * _dynamic_scale
		print("[Aldoria/quality] %.1f fps : résolution 3D abaissée à %d %%" % [fps, roundi(p.scale_3d * _dynamic_scale * 100)])


## Réglages du profil courant, après les surcharges de diagnostic de l'URL.
func settings() -> Dictionary:
	var p: Dictionary = PROFILES[current].duplicate()
	var scale := option("scale")
	if scale.is_valid_float():
		p.scale_3d = clampf(scale.to_float(), 0.25, 1.0)
		p.min_dynamic_scale = p.scale_3d # échelle imposée : pas d'ajustement auto
	if option("shadows") == "0":
		p.shadows = false
	if option("particles") == "0":
		p.particle_ratio = 0.0
	var lights := option("lights")
	if lights in ["real", "fake", "0"]:
		p.lights = lights
	if is_phone():
		# Téléphones (Galaxy A52s de Tom, 2026-10-17) : l'éclairage par sommet y rend invisibles les
		# décors fusionnés (carte vide). Bien plus puissants que la tablette, ils éclairent par pixel.
		p.vertex_shading = false
	var vertex := option("vertex")
	if vertex in ["0", "1"]:
		p.vertex_shading = vertex == "1"
	return p


func apply(profile: StringName) -> void:
	if not PROFILES.has(profile):
		push_warning("Profil de qualité inconnu : %s" % profile)
		return
	current = profile
	_dynamic_scale = 1.0
	var p := settings()
	var vp := get_viewport()
	vp.scaling_3d_scale = p.scale_3d
	vp.msaa_3d = p.msaa
	RenderingServer.directional_shadow_atlas_set_size(p.shadow_size, true)
	RenderingServer.directional_soft_shadow_filter_set_quality(
		RenderingServer.SHADOW_QUALITY_SOFT_LOW if p.soft_shadows else RenderingServer.SHADOW_QUALITY_HARD)
	changed.emit(profile)


## Soleil d'une scène selon le profil : sur PC, ombres découpées en deux zones (plus fines
## près de la caméra) et adoucies.
func dress_sun(sun: DirectionalLight3D) -> void:
	var p := settings()
	if not p.shadows:
		return
	if p.soft_shadows:
		sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
		sun.shadow_blur = 1.5


## Vrai si une scène construite avec `built` doit être reconstruite pour refléter
## les réglages actuels (lumières, éclairage par sommet).
func needs_rebuild(built: Dictionary) -> bool:
	var p := settings()
	for key in STRUCTURAL_KEYS:
		if built.get(key) != p[key]:
			return true
	return false


func cycle() -> void:
	apply(ORDER[(ORDER.find(current) + 1) % ORDER.size()])


func is_mobile_web() -> bool:
	return OS.has_feature("web_android") or OS.has_feature("web_ios")


## Option de test : `?nom=valeur` dans l'URL sur le web, `-- --nom=valeur` sur PC.
func option(key: String, default := "") -> String:
	if _options.is_empty():
		_options = _read_options()
	return _options.get(key, default)


## Lu une seule fois : sur le web, chaque accès à `location` traverse le pont JavaScript.
func _read_options() -> Dictionary:
	var result := {"_read": "1"} # garantit un cache non vide
	if OS.has_feature("web"):
		# get_interface plutôt que eval : compatible avec la CSP stricte (TRD §8).
		var search := str(JavaScriptBridge.get_interface("location").search)
		for pair in search.trim_prefix("?").split("&", false):
			var kv := pair.split("=", true, 1)
			result[kv[0].uri_decode()] = kv[1].uri_decode() if kv.size() > 1 else "1"
		return result
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--") and "=" in arg:
			var kv := arg.trim_prefix("--").split("=", true, 1)
			result[kv[0]] = kv[1]
	return result


func _initial_profile() -> StringName:
	var forced := StringName(option("quality"))
	if forced == &"moyen": # ancien nom, conservé pour les liens déjà notés
		forced = &"tablette"
	if PROFILES.has(forced):
		return forced
	if is_mobile_web() or OS.has_feature("mobile"):
		return &"tablette"
	return &"haut"
