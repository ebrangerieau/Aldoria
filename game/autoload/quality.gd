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
	# PC familial : vraies lumières, ombres, éclairage par pixel.
	&"haut": {
		"scale_3d": 1.0,
		"msaa": Viewport.MSAA_2X,
		"shadows": true,
		"shadow_size": 2048,
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
		"particle_ratio": 0.3,
		"lights": "fake",
		"vertex_shading": true,
		"min_dynamic_scale": 0.5,
	},
}
const ORDER: Array[StringName] = [&"haut", &"tablette", &"bas"]
const STRUCTURAL_KEYS: Array[String] = ["lights", "vertex_shading"]

# Résolution dynamique : sous ce seuil (moyenne sur la fenêtre), on baisse d'un palier.
const DYNAMIC_FPS_FLOOR := 27.0
const DYNAMIC_WINDOW_S := 3.0
const DYNAMIC_STEP := 0.15

var current: StringName = &"haut"
var _dynamic_scale := 1.0
var _window_time := 0.0
var _window_frames := 0
var _options: Dictionary = {}


func _ready() -> void:
	apply(_initial_profile())


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
	changed.emit(profile)


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
func option(name: String, default := "") -> String:
	if _options.is_empty():
		_options = _read_options()
	return _options.get(name, default)


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
