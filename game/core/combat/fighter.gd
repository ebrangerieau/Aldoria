class_name Fighter
extends Node3D
## Un combattant : modèle KayKit animé et points de vie.

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

static var _libraries: Dictionary = {}  # donneur → AnimationLibrary


static func create(model: String, name_text: String, hp_max: int, idle_name := "Idle") -> Fighter:
	var f := Fighter.new()
	f.display_name = name_text
	f.max_hp = hp_max
	f.hp = hp_max
	f.idle_animation = idle_name
	if ATTACKS.has(model):
		f.attack_animations = ATTACKS[model]
	var body := instantiate_model(model)
	f.add_child(body)
	f._anim = body.find_child("AnimationPlayer", true, false) as AnimationPlayer
	if f._anim:
		for loop in [idle_name, "Idle", "Idle_Combat", "2H_Melee_Idle"]:
			if f._anim.has_animation(loop):
				f._anim.get_animation(loop).loop_mode = Animation.LOOP_LINEAR
		f._anim.animation_finished.connect(f._on_animation_finished)
	return f


## Modèle prêt à animer : son AnimationPlayer, ou un nouveau qui reçoit la
## bibliothèque d'animations de son donneur.
static func instantiate_model(model: String) -> Node3D:
	var body: Node3D = (load(MODELS % model) as PackedScene).instantiate()
	if ANIMATION_DONORS.has(model) and body.find_child("AnimationPlayer", true, false) == null:
		var player := AnimationPlayer.new()
		player.name = "AnimationPlayer"
		body.add_child(player)
		player.root_node = NodePath("..")
		player.add_animation_library("", _library(ANIMATION_DONORS[model]))
	return body


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
	return global_position + Vector3(0, 1.3, 0)


func _on_animation_finished(anim_name: StringName) -> void:
	# Les animations de mort restent figées sur leur dernière image.
	if not String(anim_name).begins_with("Death") and not String(anim_name).ends_with("_Pose"):
		idle()
