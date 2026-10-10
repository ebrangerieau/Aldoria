extends Node
## Profils de qualité graphique (IMPLEMENTATION_PLAN §1.2 : profil « tablette »).
## Les scènes écoutent `changed` pour régler ombres, particules, etc.
## Sur le web, `?quality=haut|moyen|bas` dans l'URL force un profil.

signal changed(profile: StringName)

const PROFILES := {
	&"haut": {
		"scale_3d": 1.0,
		"msaa": Viewport.MSAA_2X,
		"shadows": true,
		"shadow_size": 2048,
		"particle_ratio": 1.0,
	},
	&"moyen": {
		"scale_3d": 0.85,
		"msaa": Viewport.MSAA_DISABLED,
		"shadows": true,
		"shadow_size": 1024,
		"particle_ratio": 0.6,
	},
	&"bas": {
		"scale_3d": 0.75,
		"msaa": Viewport.MSAA_DISABLED,
		"shadows": false,
		"shadow_size": 512,
		"particle_ratio": 0.3,
	},
}
const ORDER: Array[StringName] = [&"haut", &"moyen", &"bas"]

var current: StringName = &"haut"


func _ready() -> void:
	apply(_initial_profile())


## Réglages du profil courant, après les surcharges de diagnostic de l'URL
## (`?scale=0.5`, `?shadows=0`, `?particles=0`).
func settings() -> Dictionary:
	var p: Dictionary = PROFILES[current].duplicate()
	var scale := option("scale")
	if scale.is_valid_float():
		p.scale_3d = clampf(scale.to_float(), 0.25, 1.0)
	if option("shadows") == "0":
		p.shadows = false
	if option("particles") == "0":
		p.particle_ratio = 0.0
	return p


func apply(profile: StringName) -> void:
	if not PROFILES.has(profile):
		push_warning("Profil de qualité inconnu : %s" % profile)
		return
	current = profile
	var p := settings()
	var vp := get_viewport()
	vp.scaling_3d_scale = p.scale_3d
	vp.msaa_3d = p.msaa
	RenderingServer.directional_shadow_atlas_set_size(p.shadow_size, true)
	changed.emit(profile)


func cycle() -> void:
	apply(ORDER[(ORDER.find(current) + 1) % ORDER.size()])


func is_mobile_web() -> bool:
	return OS.has_feature("web_android") or OS.has_feature("web_ios")


## Option de test : `?nom=valeur` dans l'URL sur le web, `-- --nom=valeur` sur PC.
func option(name: String, default := "") -> String:
	if OS.has_feature("web"):
		# get_interface plutôt que eval : compatible avec la CSP stricte (TRD §8).
		var search := str(JavaScriptBridge.get_interface("location").search)
		for pair in search.trim_prefix("?").split("&", false):
			var kv := pair.split("=", true, 1)
			if kv[0].uri_decode() == name:
				return kv[1].uri_decode() if kv.size() > 1 else "1"
		return default
	var prefix := "--%s=" % name
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with(prefix):
			return arg.trim_prefix(prefix)
	return default


func _initial_profile() -> StringName:
	var forced := StringName(option("quality"))
	if PROFILES.has(forced):
		return forced
	if is_mobile_web() or OS.has_feature("mobile"):
		return &"moyen"
	return &"haut"
