class_name Departure
extends RefCounted
## Départ vers une activité (donjon, village, défi, Lice), commun à la carte et à la Citadelle :
## pause imposée par le parent, ouverture de la session, changement de scène, jeton expiré.

const MAP_SCENE := "res://scenes/world_map/world_map.tscn"
const CITADEL_SCENE := "res://scenes/hub/hub.tscn"


## Rend "" si l'on est parti (ou si la connexion est à refaire), « pause » si la durée de jeu
## est atteinte, sinon le message d'erreur à afficher.
static func go(tree: SceneTree, mode: String, params: Dictionary, scene: String, cache := "") -> String:
	if Session.time_over():
		return "pause"
	var res := await Session.start(mode, params, cache)
	if res.ok:
		tree.change_scene_to_file(scene)
		return ""
	if res.status == 401:
		await Session.logout()  # jeton expiré : on redemande le code
		tree.change_scene_to_file("res://scenes/profile/profile_select.tscn")
		return ""
	return "%s Réessaie dans un instant." % res.error.get("message", "")


## Panneau « Temps de jeu terminé » par-dessus une scène (carte ou Citadelle).
static func show_rest(host: Node, wt: WorldTheme) -> void:
	var layer := CanvasLayer.new()
	layer.layer = 20
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.55)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(shade)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(center)
	var panel := UiKit.message_panel(wt, "Temps de jeu terminé", Session.rest_text(), "D'accord")
	center.add_child(UiKit.fitted(panel[0]))
	host.add_child(layer)
	(panel[1] as Button).pressed.connect(layer.queue_free)
