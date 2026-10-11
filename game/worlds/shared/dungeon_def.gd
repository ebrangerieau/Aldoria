class_name DungeonDef
extends Resource
## Un donjon : le chapitre dont viennent ses questions « Sort », son énigme, ses
## salles et ses ennemis (IMPLEMENTATION_PLAN, phase 2). Le gameplay ne connaît pas
## le contenu des questions : il transmet `session_params()` au serveur, qui compose
## le paquet (chapitre ciblé + items de l'énigme).
##
## Salles, d'ouest en est : `kind` = entree | combat | enigme | boss.
## Ennemi : {model, name, hp, tier (force), xp, at: Vector2 (position dans la salle,
## en mètres depuis son coin nord-ouest), scale}.

@export var code := ""
@export var title := ""
@export var chapter_code := ""
@export var chapter_title := ""
@export var intro := ""
@export var enigma_kind := ""  # « balance » (Jules) ou « miroirs » (Tom)
@export var enigma_generator := ""
@export var enigma_title := ""
@export var enigma_intro := ""
@export var enigma_xp := 40
@export var chest_xp := 100
@export var outro := ""
@export var rooms: Array[Dictionary] = []


static func for_world(world: String) -> DungeonDef:
	return labyrinthe_vecteurs() if world == "tom" else tour_fractions()


## Paramètres de `POST /play/session/start`.
func session_params() -> Dictionary:
	return {"focus_chapter": chapter_code, "enigma": {"generator": enigma_generator, "count": 6}}


func room_count() -> int:
	return rooms.size()


func enemy_count() -> int:
	var total := 0
	for room in rooms:
		total += (room.get("enemies", []) as Array).size()
	return total


static func tour_fractions() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "tour_fractions"
	d.title = "La Tour des Fractions"
	d.chapter_code = "6e.maths.fractions"
	d.chapter_title = "Fractions"
	d.intro = "Les squelettes ont mis la Tour sens dessus dessous. Monte jusqu'au sommet et rends ses fractions au royaume !"
	d.enigma_kind = "balance"
	d.enigma_generator = "6e.prealgebre.balance"
	d.enigma_title = "Les Balances du Gardien"
	d.enigma_intro = "Trois balances bloquent la porte. Trouve ce que pèse chaque boîte pour les remettre en marche."
	d.outro = "La Tour des Fractions brille à nouveau. Les Archives se souviennent de toi, Archiviste !"
	d.rooms = [
		{"kind": "entree", "title": "Le Hall d'entrée"},
		{"kind": "combat", "title": "La Salle des Moitiés", "enemies": [
			_enemy("Skeleton_Minion", "Petit squelette égaré", 60, 1, 30, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "Le Couloir des Quarts", "enemies": [
			_enemy("Skeleton_Minion", "Squelette grognon", 70, 2, 35, Vector2(8, 5)),
			_enemy("Skeleton_Minion", "Squelette farceur", 80, 2, 35, Vector2(12.5, 10)),
		]},
		{"kind": "enigme", "title": "La Salle des Balances"},
		{"kind": "combat", "title": "La Galerie des Tiers", "enemies": [
			_enemy("Skeleton_Warrior", "Gardien des os", 110, 3, 50, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "Le Sommet de la Tour", "enemies": [
			_enemy("Skeleton_Warrior", "Le Grand Diviseur", 200, 4, 150, Vector2(11, 6), 1.45),
		]},
	]
	return d


static func labyrinthe_vecteurs() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "labyrinthe_vecteurs"
	d.title = "Le Labyrinthe des Vecteurs"
	d.chapter_code = "2nde.maths.vecteurs"
	d.chapter_title = "Vecteurs"
	d.intro = "Le Brouillard a figé les couloirs du Labyrinthe. Traverse-le et rallume le phare du centre."
	d.enigma_kind = "miroirs"
	d.enigma_generator = "2nde.vecteurs.rayon"
	d.enigma_title = "La Salle des Miroirs"
	d.enigma_intro = "Trois cristaux éteints. Donne à chaque rayon le bon vecteur pour les rallumer."
	d.outro = "Le phare du Labyrinthe perce le Brouillard. Une archive de plus restaurée."
	d.rooms = [
		{"kind": "entree", "title": "L'Entrée du Labyrinthe"},
		{"kind": "combat", "title": "Le Couloir des Coordonnées", "enemies": [
			_enemy("Skeleton_Warrior", "Sentinelle du Brouillard", 70, 2, 35, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "La Salle des Translations", "enemies": [
			_enemy("Skeleton_Minion", "Spectre d'os", 80, 2, 40, Vector2(8, 5)),
			_enemy("Skeleton_Warrior", "Gardien oublié", 90, 3, 40, Vector2(12.5, 10)),
		]},
		{"kind": "enigme", "title": "La Salle des Miroirs"},
		{"kind": "combat", "title": "La Galerie Colinéaire", "enemies": [
			_enemy("Skeleton_Warrior", "Héraut du Brouillard", 120, 3, 55, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "Le Cœur du Labyrinthe", "enemies": [
			_enemy("Skeleton_Warrior", "L'Architecte du Brouillard", 220, 5, 150, Vector2(11, 6), 1.45),
		]},
	]
	return d


static func _enemy(model: String, name_text: String, hp: int, tier: int, xp: int, at: Vector2, scale := 1.0) -> Dictionary:
	return {"model": model, "name": name_text, "hp": hp, "tier": tier, "xp": xp, "at": at, "scale": scale}
