class_name Fighter
extends Node3D
## Un combattant : modèle animé (KayKit, ou monstre Quaternius) et points de vie.

signal hp_changed(hp: int, max_hp: int)

const MODELS := "res://assets/kaykit/characters/%s.glb"
## Animations partagées (poids de l'export web) : tous les personnages KayKit ont le même
## squelette. Seuls le Guerrier squelette et le Chevalier importent leurs animations ;
## les autres modèles sont importés sans (`animation/import=false`) et empruntent la
## bibliothèque de leur donneur.
const ANIMATION_DONORS := {
	"Skeleton_Minion": "Skeleton_Warrior",
	"Skeleton_Mage": "Skeleton_Warrior",
	"Skeleton_Rogue": "Skeleton_Warrior",
	"Rogue_Hooded": "Knight",
	"Barbarian": "Knight",
	"Mage": "Knight",
	"Rogue": "Knight",
}
## Monstres (Quaternius, CC0 ; souhait des enfants : pas seulement des squelettes) : hauteur
## visée en mètres (un squelette KayKit mesure environ 2,5 m). Taille et hauteur au sol
## viennent de la boîte englobante du modèle, mesurée une fois. Leurs animations portent
## d'autres noms (« CharacterArmature|HitReact ») : `play` traduit les noms KayKit (MONSTER_ANIMS).
const MONSTER_MODELS := "res://assets/quaternius/monsters/%s.glb"
const MONSTERS := {
	"Mushnub": 1.7, "MushnubEvolved": 2.6, "GreenBlob": 1.4, "Goleling": 2.2, "GolelingEvolved": 2.8,
	"Cactoro": 3.2, "Armabee": 2.2, "Dragon": 2.3, "Ghost": 2.4, "GhostSkull": 2.5, "BlueDemon": 3.4,
	"Demon": 2.9, "Orc": 2.7, "Yeti": 2.8,
}
## Monstres modélisés de profil : quart de tour pour faire face à l'adversaire.
const MONSTER_YAW := {"Dragon": 90.0}
## Nom KayKit demandé → noms possibles chez les monstres (sans le préfixe « Armature| »).
const MONSTER_ANIMS := {
	"Idle": ["Idle", "Flying_Idle", "Dragon_Flying"],
	"hit": ["HitReact", "HitRecieve", "Dragon_Hit"],
	"death": ["Death", "Dragon_Death"],
	"attack": ["Punch", "Bite_Front", "Headbutt", "Weapon", "Dragon_Attack", "Dragon_Attack2"],
	"awake": ["Jump", "Yes", "Flying_Idle", "Dragon_Flying"],
	"taunt": ["Dance", "Wave", "Yes", "Dragon_Attack2"],
}
const MONSTER_GROUPS := {
	"Idle_Combat": "Idle", "Hit_A": "hit", "Hit_B": "hit", "Block_Hit": "hit", "Death_A": "death",
	"Death_B": "death", "Spawn_Ground": "awake", "Skeletons_Awaken_Floor": "awake",
	"Skeletons_Awaken_Standing": "awake", "Taunt": "taunt", "Cheer": "taunt",
}
## Attaque propre à certains modèles (le mage lance un sort, le voleur frappe d'estoc).
const ATTACKS := {
	"Skeleton_Mage": ["Spellcast_Shoot", "Spellcast_Raise"],
	"Skeleton_Rogue": ["1H_Melee_Attack_Stab", "1H_Melee_Attack_Chop"],
}

var display_name := ""
var max_hp := 100
var hp := 100
var idle_animation := "Idle"
var attack_animations: Array = ["1H_Melee_Attack_Chop", "2H_Melee_Attack_Chop", "Unarmed_Melee_Attack_Punch_A"]
var _anim: AnimationPlayer
var _short_names: Dictionary = {}  # monstre : nom court (« HitReact ») → nom complet
var _chest_height := 1.3

static var _libraries: Dictionary = {}  # donneur → AnimationLibrary
static var _monster_fit: Dictionary = {}  # monstre → [échelle, hauteur au sol]


static func create(model: String, name_text: String, hp_max: int, idle_name := "Idle") -> Fighter:
	var f := Fighter.new()
	f.display_name = name_text
	f.max_hp = hp_max
	f.hp = hp_max
	f.idle_animation = idle_name
	if ATTACKS.has(model):
		f.attack_animations = ATTACKS[model]
	var body := _instantiate_monster(model) if MONSTERS.has(model) else instantiate_model(model)
	f.add_child(body)
	f._anim = body.find_child("AnimationPlayer", true, false) as AnimationPlayer
	if MONSTERS.has(model):
		f._chest_height = float(MONSTERS[model]) * 0.55
		if f._anim:
			for full in f._anim.get_animation_list():
				f._short_names[String(full).get_slice("|", String(full).get_slice_count("|") - 1)] = String(full)
			f.idle_animation = f._monster_anim("Idle")
			if f.idle_animation != "":
				f._anim.get_animation(f.idle_animation).loop_mode = Animation.LOOP_LINEAR
	if f._anim:
		for loop in [idle_name, "Idle", "Idle_Combat", "2H_Melee_Idle"]:
			if f._anim.has_animation(loop):
				f._anim.get_animation(loop).loop_mode = Animation.LOOP_LINEAR
		f._anim.animation_finished.connect(f._on_animation_finished)
	return f


## Le héros, habillé selon l'apparence choisie (Wardrobe) ; son attaque suit son arme.
static func create_hero(look: Dictionary, name_text: String, hp_max: int) -> Fighter:
	var model := str(look["model"])
	var f := create(model, name_text, hp_max)
	Wardrobe.dress(f.get_child(0) as Node3D, model, look)
	f.attack_animations = Wardrobe.attacks_for(look)
	return f


## Modèle prêt à animer : son AnimationPlayer, ou un nouveau qui reçoit la
## bibliothèque d'animations de son donneur. Un aventurier ne tient qu'une arme par
## main (le .glb les contient toutes) : apparence par défaut de Wardrobe.
static func instantiate_model(model: String) -> Node3D:
	var body: Node3D = (load(MODELS % model) as PackedScene).instantiate()
	Wardrobe.dress(body, model)
	if ANIMATION_DONORS.has(model) and body.find_child("AnimationPlayer", true, false) == null:
		var player := AnimationPlayer.new()
		player.name = "AnimationPlayer"
		body.add_child(player)
		player.root_node = NodePath("..")
		player.add_animation_library("", _library(ANIMATION_DONORS[model]))
	return body


## Fichier du modèle (personnage KayKit ou monstre Quaternius).
static func model_path(model: String) -> String:
	return (MONSTER_MODELS if MONSTERS.has(model) else MODELS) % model


## Monstre Quaternius à sa taille : mis à l'échelle et posé au sol dans un pivot, pour que
## l'échelle du combattant (boss) reste libre.
static func _instantiate_monster(model: String) -> Node3D:
	var body: Node3D = (load(model_path(model)) as PackedScene).instantiate()
	if not _monster_fit.has(model):
		var box := _bounds(body)
		var top := box.position.y + box.size.y
		var fit := float(MONSTERS[model]) / maxf(0.1, top - minf(0.0, box.position.y))
		_monster_fit[model] = [fit, -minf(0.0, box.position.y) * fit]
	var pivot := Node3D.new()
	pivot.name = model
	body.scale = Vector3.ONE * float(_monster_fit[model][0])
	body.position.y = float(_monster_fit[model][1])
	body.rotation_degrees.y = float(MONSTER_YAW.get(model, 0.0))
	pivot.add_child(body)
	return pivot


## Boîte englobante des maillages d'un modèle, dans son propre repère (pose de repos).
static func _bounds(root: Node3D) -> AABB:
	var box := AABB()
	var first := true
	for node in root.find_children("*", "MeshInstance3D", true, false):
		var mesh := node as MeshInstance3D
		var to_root := Transform3D.IDENTITY
		var n: Node = mesh
		while n != root and n is Node3D:
			to_root = (n as Node3D).transform * to_root
			n = n.get_parent()
		var b := to_root * mesh.get_aabb()
		box = b if first else box.merge(b)
		first = false
	return box


## Nom complet d'une animation de monstre pour un nom KayKit (ou un groupe), "" sinon.
func _monster_anim(kaykit_name: String) -> String:
	var group: String = MONSTER_GROUPS.get(kaykit_name, kaykit_name)
	if not MONSTER_ANIMS.has(group):
		group = "attack" if kaykit_name.contains("Attack") or kaykit_name.begins_with("Spellcast") else ""
	for short in MONSTER_ANIMS.get(group, []):
		if _short_names.has(short):
			return _short_names[short]
	return ""


static func _library(donor: String) -> AnimationLibrary:
	if not _libraries.has(donor):
		var scene: Node = (load(MODELS % donor) as PackedScene).instantiate()
		var player := scene.find_child("AnimationPlayer", true, false) as AnimationPlayer
		_libraries[donor] = player.get_animation_library("")
		scene.free()
	return _libraries[donor]


func _ready() -> void:
	idle()


func is_alive() -> bool:
	return hp > 0


func damage(amount: int) -> void:
	hp = maxi(0, hp - amount)
	hp_changed.emit(hp, max_hp)


func heal(amount: int) -> int:
	var before := hp
	hp = mini(max_hp, hp + amount)
	hp_changed.emit(hp, max_hp)
	return hp - before


func restore() -> void:
	hp = max_hp
	hp_changed.emit(hp, max_hp)
	idle()


## Joue une animation (la première disponible de la liste), puis revient au repos.
## Tableau non typé : accepte aussi le résultat d'un ternaire (`[a] if x else [b]`).
func play(candidates: Array, speed := 1.0) -> float:
	if _anim == null:
		return 0.0
	for anim_name in candidates:
		if _anim.has_animation(anim_name):
			_anim.play(anim_name, 0.1, speed)
			return _anim.get_animation(anim_name).length / speed
	if not _short_names.is_empty():  # monstre : premier nom KayKit qui a un équivalent
		for anim_name in candidates:
			var full := _monster_anim(anim_name)
			if full != "":
				_anim.play(full, 0.1, speed)
				return _anim.get_animation(full).length / speed
		idle()  # poses d'attente des squelettes : un monstre attend au repos
	return 0.0


## Animation en boucle (course, marche) ; ne relance pas si elle tourne déjà.
func loop(anim_name: String, speed := 1.0) -> void:
	if _anim == null or not _anim.has_animation(anim_name):
		return
	_anim.get_animation(anim_name).loop_mode = Animation.LOOP_LINEAR
	if _anim.current_animation != anim_name:
		_anim.play(anim_name, 0.15, speed)


func is_playing(anim_name: String) -> bool:
	return _anim != null and _anim.current_animation == anim_name


func idle() -> void:
	if _anim and _anim.has_animation(idle_animation):
		_anim.play(idle_animation, 0.2)


## Point d'impact approximatif (poitrine), pour les effets.
func chest() -> Vector3:
	return global_position + Vector3(0, _chest_height * scale.y if not _short_names.is_empty() else 1.3, 0)


func _on_animation_finished(anim_name: StringName) -> void:
	# Les animations de mort restent figées sur leur dernière image (« CharacterArmature|Death »
	# et « Dragon_Death » chez les monstres).
	if not String(anim_name).contains("Death") and not String(anim_name).ends_with("_Pose"):
		idle()
