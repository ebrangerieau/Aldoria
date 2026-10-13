class_name Wardrobe
extends RefCounted
## Personnalisation (PRD §6) : apparence du héros (silhouette KayKit, arme, main
## gauche, couvre-chef, cape et sa couleur) et compagnon animal du monde de Jules
## (nom, pelage). Purement cosmétique : aucun effet sur les combats.
##
## Certains choix se débloquent avec le niveau du héros ou les donjons terminés
## (`requirement_met`) : de quoi donner un sens aux coffres sans rien vendre.
## L'apparence est rangée dans la partie (`SaveManager.look()`), sous la forme
## {model, main, off, head, cape, cape_color, pet_name, pet_fur, seen}.

## Silhouettes : modèles KayKit Adventurers (voir game/assets/LICENSES.md).
const SILHOUETTES := [
	{"model": "Knight", "name": "Chevalier", "level": 1},
	{"model": "Rogue_Hooded", "name": "Rôdeur", "level": 1},
	{"model": "Rogue", "name": "Voleur", "level": 2},
	{"model": "Barbarian", "name": "Barbare", "level": 3},
	{"model": "Mage", "name": "Mage", "level": 5},
]
const _ROGUE := {
	"main": [["Knife", "Dague"], ["1H_Crossbow", "Arbalète"], ["2H_Crossbow", "Grande arbalète"]],
	"off": [["", "Rien"], ["Knife_Offhand", "Deuxième dague"], ["Throwable", "Bombe fumigène"]],
	"head": "", "cape": "Rogue_Cape", "default_off": "Knife_Offhand",
}
## Pièces de chaque modèle : noms des maillages dans le .glb (une seule arme par main).
const PARTS := {
	"Knight": {
		"main": [["1H_Sword", "Épée"], ["2H_Sword", "Grande épée"]],
		"off": [["", "Rien"], ["Round_Shield", "Bouclier rond"], ["Badge_Shield", "Bouclier à blason"],
			["Rectangle_Shield", "Bouclier carré"], ["Spike_Shield", "Bouclier à pointes"],
			["1H_Sword_Offhand", "Deuxième épée"]],
		"head": "Knight_Helmet", "cape": "Knight_Cape", "default_off": "Round_Shield",
	},
	"Barbarian": {
		"main": [["1H_Axe", "Hache"], ["2H_Axe", "Grande hache"], ["Mug", "Chope"]],
		"off": [["", "Rien"], ["Barbarian_Round_Shield", "Bouclier"], ["1H_Axe_Offhand", "Deuxième hache"]],
		"head": "Barbarian_Hat", "cape": "Barbarian_Cape", "default_off": "Barbarian_Round_Shield",
	},
	"Mage": {
		"main": [["1H_Wand", "Baguette"], ["2H_Staff", "Bâton"]],
		"off": [["", "Rien"], ["Spellbook", "Grimoire fermé"], ["Spellbook_open", "Grimoire ouvert"]],
		"head": "Mage_Hat", "cape": "Mage_Cape", "default_off": "Spellbook",
	},
	"Rogue": _ROGUE,
	"Rogue_Hooded": _ROGUE,
}
## Couleurs de cape : « origine » garde la texture du modèle.
const CAPE_COLORS := [
	{"id": "origine", "name": "D'origine", "color": Color.WHITE, "dungeons": 0},
	{"id": "rouge", "name": "Rouge", "color": Color("#d64545"), "dungeons": 0},
	{"id": "bleu", "name": "Bleu", "color": Color("#3f6fd8"), "dungeons": 0},
	{"id": "vert", "name": "Vert forêt", "color": Color("#3a9a52"), "dungeons": 1},
	{"id": "violet", "name": "Violet", "color": Color("#8a52d0"), "dungeons": 2},
	{"id": "or", "name": "Or", "color": Color("#e8b030"), "dungeons": 3},
]
## Pelages du renard (matériaux « Main » et « Main_Light » du modèle Quaternius).
const PET_FURS := [
	{"id": "roux", "name": "Roux", "main": Color("#a5602a"), "light": Color("#f2e6d0"), "dungeons": 0},
	{"id": "sable", "name": "Sable", "main": Color("#d6b07a"), "light": Color("#fbf3e4"), "dungeons": 0},
	{"id": "arctique", "name": "Arctique", "main": Color("#e9edf2"), "light": Color("#ffffff"), "dungeons": 1},
	{"id": "nuit", "name": "Nuit", "main": Color("#3d4258"), "light": Color("#9aa0ba"), "dungeons": 2},
	{"id": "dore", "name": "Doré", "main": Color("#f0b52e"), "light": Color("#fff2c2"), "dungeons": 3},
]
const PET_NAMES := ["Roux", "Noisette", "Filou", "Biscuit", "Plume", "Comète", "Pixel", "Zéphyr"]
## Attaques (animations KayKit) selon l'arme tenue en main droite.
const ATTACKS := {
	"1H": ["1H_Melee_Attack_Chop", "1H_Melee_Attack_Slice_Diagonal"],
	"dual": ["Dualwield_Melee_Attack_Chop", "1H_Melee_Attack_Chop"],
	"2H": ["2H_Melee_Attack_Chop", "2H_Melee_Attack_Slice"],
	"magic": ["Spellcast_Shoot", "Spellcast_Raise"],
	"1H_ranged": ["1H_Ranged_Shoot", "1H_Melee_Attack_Chop"],
	"2H_ranged": ["2H_Ranged_Shoot", "2H_Melee_Attack_Chop"],
	"unarmed": ["Unarmed_Melee_Attack_Punch_A", "Unarmed_Melee_Attack_Kick"],
}


## Apparence de départ d'un monde : celle du héros d'avant la personnalisation.
static func default_look(world: String) -> Dictionary:
	var model := "Rogue_Hooded" if world == "brouillard" else "Knight"
	var look := defaults_for(model)
	look["pet_name"] = PET_NAMES[0]
	look["pet_fur"] = PET_FURS[0]["id"]
	look["seen"] = 0
	return look


## Pièces par défaut d'une silhouette (au changement de silhouette).
static func defaults_for(model: String) -> Dictionary:
	var parts: Dictionary = PARTS[model]
	return {
		"model": model, "main": parts["main"][0][0], "off": parts["default_off"],
		"head": true, "cape": true, "cape_color": "origine",
	}


## Apparence valide et autorisée : toute valeur inconnue, verrouillée ou incompatible
## (arme à deux mains + main gauche) reprend sa valeur par défaut.
static func sanitize(raw: Variant, world: String, level: int, dungeons_done: int) -> Dictionary:
	var look := default_look(world)
	if not raw is Dictionary:
		return look
	var given: Dictionary = raw
	var model := str(given.get("model", look["model"]))
	if not PARTS.has(model) or not requirement_met(_silhouette(model), level, dungeons_done):
		model = look["model"]
	if model != look["model"]:
		look.merge(defaults_for(model), true)
	var parts: Dictionary = PARTS[model]
	if _ids(parts["main"]).has(str(given.get("main", ""))):
		look["main"] = str(given["main"])
	if _ids(parts["off"]).has(str(given.get("off", "-"))):
		look["off"] = str(given["off"])
	if is_two_handed(look["main"]):
		look["off"] = ""
	look["head"] = bool(given.get("head", true)) if parts["head"] != "" else false
	look["cape"] = bool(given.get("cape", true))
	look["cape_color"] = _allowed(CAPE_COLORS, given.get("cape_color"), level, dungeons_done, "origine")
	look["pet_fur"] = _allowed(PET_FURS, given.get("pet_fur"), level, dungeons_done, PET_FURS[0]["id"])
	if PET_NAMES.has(str(given.get("pet_name", ""))):
		look["pet_name"] = str(given["pet_name"])
	look["seen"] = maxi(0, int(given.get("seen", 0)))
	return look


static func is_two_handed(part: String) -> bool:
	return part.begins_with("2H_")


## Condition de déblocage : {"level": n} ou {"dungeons": n} (donjons du monde terminés).
static func requirement_met(item: Dictionary, level: int, dungeons_done: int) -> bool:
	return level >= int(item.get("level", 1)) and dungeons_done >= int(item.get("dungeons", 0))


static func requirement_text(item: Dictionary) -> String:
	var needed := int(item.get("dungeons", 0))
	if needed > 0:
		return "Termine %d donjon%s" % [needed, "s" if needed > 1 else ""]
	return "Niveau %d" % int(item.get("level", 1))


## Nombre de choix débloqués (silhouettes, couleurs de cape, pelages si compagnon) :
## comparé à `look.seen` pour signaler les nouveautés au camp.
static func unlocked_count(level: int, dungeons_done: int, with_pet: bool) -> int:
	var lists: Array = [SILHOUETTES, CAPE_COLORS]
	if with_pet:
		lists.append(PET_FURS)
	var count := 0
	for list: Array in lists:
		for item: Dictionary in list:
			if requirement_met(item, level, dungeons_done):
				count += 1
	return count


## Noms des choix qui se débloquent en passant d'un état à l'autre (coffre, niveau).
static func newly_unlocked(before: Vector2i, after: Vector2i, with_pet: bool) -> Array[String]:
	var names: Array[String] = []
	var lists := {"Silhouette": SILHOUETTES, "Cape": CAPE_COLORS}
	if with_pet:
		lists["Pelage"] = PET_FURS
	for kind: String in lists:
		for item: Dictionary in lists[kind]:
			if requirement_met(item, after.x, after.y) and not requirement_met(item, before.x, before.y):
				names.append("%s : %s" % [kind, String(item["name"]).to_lower()])
	return names


static func attacks_for(look: Dictionary) -> Array:
	var main := str(look.get("main", ""))
	if main.ends_with("Wand") or main.ends_with("Staff"):
		return ATTACKS["magic"]
	if main.ends_with("Crossbow"):
		return ATTACKS["2H_ranged" if is_two_handed(main) else "1H_ranged"]
	if main == "Mug":
		return ATTACKS["unarmed"]
	if is_two_handed(main):
		return ATTACKS["2H"]
	return ATTACKS["dual" if str(look.get("off", "")).ends_with("Offhand") else "1H"]


## Habille un modèle instancié : une arme par main, couvre-chef et cape selon le choix.
## Sans `look`, applique l'apparence par défaut du modèle (habitants du village…).
static func dress(body: Node3D, model: String, look := {}) -> void:
	if not PARTS.has(model):
		return
	var parts: Dictionary = PARTS[model]
	var chosen := look if not look.is_empty() else defaults_for(model)
	var visible := {}
	for pair: Array in parts["main"]:
		visible[pair[0]] = pair[0] == chosen.get("main")
	for pair: Array in parts["off"]:
		if pair[0] != "":
			visible[pair[0]] = pair[0] == chosen.get("off")
	if parts["head"] != "":
		visible[parts["head"]] = bool(chosen.get("head", true))
	visible[parts["cape"]] = bool(chosen.get("cape", true))
	for node in body.find_children("*", "MeshInstance3D", true, false):
		if visible.has(String(node.name)):
			(node as MeshInstance3D).visible = visible[String(node.name)]
	var color := _entry(CAPE_COLORS, str(chosen.get("cape_color", "origine")))
	var cape := body.find_child(parts["cape"], true, false) as MeshInstance3D
	if cape != null and color.get("id") != "origine":
		_paint(cape, color["color"])


## Couleur unie sur un maillage texturé (la cape KayKit) : même matériau, sans texture.
static func _paint(mesh_instance: MeshInstance3D, color: Color) -> void:
	for surface in mesh_instance.mesh.get_surface_count():
		var source := mesh_instance.get_active_material(surface) as BaseMaterial3D
		if source == null:
			continue
		var mat := source.duplicate() as BaseMaterial3D
		mat.albedo_texture = null
		mat.albedo_color = color
		mesh_instance.set_surface_override_material(surface, mat)


static func fur(id: String) -> Dictionary:
	var entry := _entry(PET_FURS, id)
	return entry if not entry.is_empty() else PET_FURS[0]


static func _silhouette(model: String) -> Dictionary:
	for item: Dictionary in SILHOUETTES:
		if item["model"] == model:
			return item
	return {}


static func _entry(list: Array, id: String) -> Dictionary:
	for item: Dictionary in list:
		if item["id"] == id:
			return item
	return {}


static func _allowed(list: Array, value: Variant, level: int, dungeons_done: int, fallback: String) -> String:
	var entry := _entry(list, str(value))
	return str(value) if not entry.is_empty() and requirement_met(entry, level, dungeons_done) else fallback


static func _ids(pairs: Array) -> Array:
	return pairs.map(func(pair: Array) -> String: return pair[0])
