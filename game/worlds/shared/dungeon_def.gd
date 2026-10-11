class_name DungeonDef
extends Resource
## Un donjon : les chapitres dont viennent ses questions « Sort », son énigme, ses
## salles, ses ennemis et son décor (IMPLEMENTATION_PLAN, phases 2 et 3). Le gameplay
## ne connaît pas le contenu des questions : il transmet `session_params()` au
## serveur, qui compose le paquet (chapitres ciblés + items de l'énigme).
##
## Trois donjons par monde, ouverts l'un après l'autre : le suivant s'ouvre quand le
## précédent a été terminé une fois.
##
## Salles, d'ouest en est : `kind` = entree | combat | enigme | boss.
## Ennemi : {model, name, hp, tier (force), xp, at: Vector2 (position dans la salle,
## en mètres depuis son coin nord-ouest), scale}.
## Décor (`decor`, lu par DungeonLevel) : sol, murs du fond, bannières, objets le long
## des murs, couleur des torches. Absent : décor de la Tour et du Labyrinthe.

@export var code := ""
@export var title := ""
@export var chapter_codes: Array[String] = []
@export var chapter_title := ""
@export var intro := ""
@export var enigma_generator := ""
@export var enigma_title := ""
@export var enigma_intro := ""
@export var enigma_xp := 40
@export var chest_xp := 100
@export var outro := ""
@export var rooms: Array[Dictionary] = []
@export var decor: Dictionary = {}


static func all_for_world(world: String) -> Array[DungeonDef]:
	if world == "tom":
		return [labyrinthe_vecteurs(), forge_algebre(), citadelle_fonctions()]
	return [tour_fractions(), atelier_balances(), observatoire_angles()]


static func by_code(world: String, dungeon_code: String) -> DungeonDef:
	for d in all_for_world(world):
		if d.code == dungeon_code:
			return d
	return all_for_world(world)[0]


## Premier donjon du monde (raccourci des tests et de la tranche verticale).
static func for_world(world: String) -> DungeonDef:
	return all_for_world(world)[0]


## Paramètres de `POST /play/session/start`.
func session_params() -> Dictionary:
	return {
		"mode": "donjon",
		"focus_chapters": chapter_codes.duplicate(),
		"enigma": {"generator": enigma_generator, "count": 6},
	}


func room_count() -> int:
	return rooms.size()


func enemy_count() -> int:
	var total := 0
	for room in rooms:
		total += (room.get("enemies", []) as Array).size()
	return total


# --- Jules (6e) -----------------------------------------------------------------------

static func tour_fractions() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "tour_fractions"
	d.title = "La Tour des Fractions"
	d.chapter_codes = ["6e.maths.fractions"]
	d.chapter_title = "Fractions"
	d.intro = "Les squelettes ont mis la Tour sens dessus dessous. Monte jusqu'au sommet et rends ses fractions au royaume !"
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


static func atelier_balances() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "atelier_balances"
	d.title = "L'Atelier des Balances"
	d.chapter_codes = ["6e.maths.prealgebre", "6e.maths.proportionnalite"]
	d.chapter_title = "Pré-algèbre, proportionnalité et échelles"
	d.intro = "Dans l'Atelier, plus rien n'est à la bonne mesure : les poids mentent et les cartes sont fausses. Remets de l'ordre !"
	d.enigma_generator = "6e.proportionnalite.carte"
	d.enigma_title = "La Carte du Cartographe"
	d.enigma_intro = "Trois cartes gardent la réserve. Compte les carreaux, lis l'échelle et trouve les vraies distances."
	d.enigma_xp = 45
	d.chest_xp = 120
	d.outro = "Les balances sont justes et les cartes disent vrai. L'Atelier reprend son travail grâce à toi !"
	d.rooms = [
		{"kind": "entree", "title": "La Cour de l'Atelier"},
		{"kind": "combat", "title": "L'Établi des Poids", "enemies": [
			_enemy("Skeleton_Minion", "Apprenti tout en os", 70, 1, 35, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "La Réserve des Barres", "enemies": [
			_enemy("Skeleton_Rogue", "Chapardeur de poids", 80, 2, 40, Vector2(8, 5)),
			_enemy("Skeleton_Minion", "Squelette mal mesuré", 80, 2, 40, Vector2(12.5, 10)),
		]},
		{"kind": "enigme", "title": "La Salle des Cartes"},
		{"kind": "combat", "title": "Le Comptoir des Échelles", "enemies": [
			_enemy("Skeleton_Mage", "Arpenteur maudit", 120, 3, 55, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "La Grande Balance", "enemies": [
			_enemy("Skeleton_Warrior", "Le Faux Peseur", 220, 4, 160, Vector2(11, 6), 1.45),
		]},
	]
	d.decor = {
		"floor": "floor_wood_large",
		"floor_accent": "floor_wood_large_dark",
		"banners": ["banner_patternB_yellow", "banner_patternB_green"],
		"props": [
			["table_long_decorated_A", Vector3(1.4, 0, 4.2), 90.0, 1.2],
			["barrel_large", Vector3(3.2, 0, 1.4), 0.0, 0.8],
			["barrel_large_decorated", Vector3(14.5, 0, 1.6), 0.0, 0.8],
			["coin_stack_large", Vector3(13.0, 0, 1.1), 0.0, 0.5],
			["crates_stacked", Vector3(14.6, 0, 5.2), 90.0, 0.9],
		],
		"torch_color": Color(1.0, 0.72, 0.38),
	}
	return d


static func observatoire_angles() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "observatoire_angles"
	d.title = "L'Observatoire des Angles"
	d.chapter_codes = ["6e.maths.angles", "6e.maths.probabilites"]
	d.chapter_title = "Angles et probabilités"
	d.intro = "Là-haut, les automates de l'Observatoire visent les étoiles de travers. Redresse leurs angles et calcule leurs chances !"
	d.enigma_generator = "6e.algorithmique.boucles"
	d.enigma_title = "Les Automates de l'Observatoire"
	d.enigma_intro = "Trois automates attendent leur programme. Suis chaque instruction pour savoir où ils s'arrêteront."
	d.enigma_xp = 50
	d.chest_xp = 140
	d.outro = "La lunette de l'Observatoire pointe de nouveau vers les étoiles. Les Archives brillent un peu plus !"
	d.rooms = [
		{"kind": "entree", "title": "Le Parvis des Étoiles"},
		{"kind": "combat", "title": "La Galerie des Angles aigus", "enemies": [
			_enemy("Skeleton_Rogue", "Guetteur pointu", 80, 2, 40, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "La Rotonde des Angles droits", "enemies": [
			_enemy("Skeleton_Minion", "Squelette à l'équerre", 90, 2, 45, Vector2(8, 5)),
			_enemy("Skeleton_Mage", "Astrologue d'os", 90, 3, 45, Vector2(12.5, 10)),
		]},
		{"kind": "enigme", "title": "La Salle des Automates"},
		{"kind": "combat", "title": "Le Belvédère des Hasards", "enemies": [
			_enemy("Skeleton_Warrior", "Gardien des dés", 130, 3, 60, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "La Coupole", "enemies": [
			_enemy("Skeleton_Mage", "L'Astronome Squelette", 240, 5, 170, Vector2(11, 6), 1.45),
		]},
	]
	d.decor = {
		"walls": ["wall_shelves", "wall_arched"],
		"banners": ["banner_patternC_blue", "banner_patternC_white"],
		"props": [
			["shelf_large", Vector3(1.4, 0, 4.0), 90.0, 0.9],
			["shelf_small_candles", Vector3(3.2, 0, 1.0), 0.0, 0.6],
			["trunk_large_A", Vector3(14.4, 0, 1.6), -15.0, 0.9],
			["candle_lit", Vector3(13.0, 0, 1.0), 0.0, 0.3],
			["shelves", Vector3(14.9, 0, 5.2), -90.0, 0.8],
		],
		"torch_color": Color(0.78, 0.82, 1.0),
	}
	return d


# --- Tom (2nde) -------------------------------------------------------------------------

static func labyrinthe_vecteurs() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "labyrinthe_vecteurs"
	d.title = "Le Labyrinthe des Vecteurs"
	d.chapter_codes = ["2nde.maths.vecteurs"]
	d.chapter_title = "Vecteurs"
	d.intro = "Le Brouillard a figé les couloirs du Labyrinthe. Traverse-le et rallume le phare du centre."
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


static func forge_algebre() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "forge_algebre"
	d.title = "La Forge de l'Algèbre"
	d.chapter_codes = ["2nde.maths.calcul_litteral", "2nde.maths.equations", "2nde.maths.valeur_absolue"]
	d.chapter_title = "Calcul littéral, équations, valeur absolue"
	d.intro = "Les forgerons d'os ont tordu toutes les formules du royaume. Descends dans la Forge et redresse-les."
	d.enigma_generator = "2nde.equations.signe"
	d.enigma_title = "Les Sceaux de la Forge"
	d.enigma_intro = "Trois sceaux verrouillent la fonderie. Chacun ne s'ouvre qu'avec un tableau de signes exact."
	d.enigma_xp = 50
	d.chest_xp = 130
	d.outro = "Le feu de la Forge reprend, clair et régulier. Les formules sortent droites de l'enclume."
	d.rooms = [
		{"kind": "entree", "title": "Les Portes de la Forge"},
		{"kind": "combat", "title": "La Salle des Identités", "enemies": [
			_enemy("Skeleton_Rogue", "Faussaire de formules", 80, 2, 40, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "Le Hall des Équations", "enemies": [
			_enemy("Skeleton_Warrior", "Marteleur d'inconnues", 90, 3, 45, Vector2(8, 5)),
			_enemy("Skeleton_Minion", "Soufflet hargneux", 85, 2, 45, Vector2(12.5, 10)),
		]},
		{"kind": "enigme", "title": "La Salle des Sceaux"},
		{"kind": "combat", "title": "La Fonderie des Inéquations", "enemies": [
			_enemy("Skeleton_Mage", "Fondeur de l'ombre", 130, 4, 60, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "L'Enclume", "enemies": [
			_enemy("Skeleton_Warrior", "Le Maître de Forge", 240, 5, 170, Vector2(11, 6), 1.45),
		]},
	]
	d.decor = {
		"floor_accent": "floor_dirt_large",
		"banners": ["banner_shield_red", "banner_patternA_red"],
		"props": [
			["sword_shield", Vector3(1.2, 0, 4.0), 90.0, 0.6],
			["barrel_large_decorated", Vector3(1.6, 0, 1.6), 0.0, 0.8],
			["barrel_small_stack", Vector3(3.3, 0, 1.1), 0.0, 0.7],
			["crates_stacked", Vector3(14.4, 0, 1.8), -20.0, 0.9],
			["keg_decorated", Vector3(14.9, 0, 5.0), 90.0, 0.7],
		],
		"torch_color": Color(1.0, 0.5, 0.2),
	}
	return d


static func citadelle_fonctions() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "citadelle_fonctions"
	d.title = "La Citadelle des Fonctions"
	d.chapter_codes = ["2nde.maths.fonctions", "2nde.maths.geometrie_reperee"]
	d.chapter_title = "Fonctions, droites et repères"
	d.intro = "Au sommet de la Citadelle, le Veilleur lisait l'avenir dans les courbes. Le Brouillard les a brouillées : rends-lui la vue."
	d.enigma_generator = "2nde.automatismes.lecture_graphique"
	d.enigma_title = "Les Courbes du Veilleur"
	d.enigma_intro = "Trois courbes gravées sur les piliers. Lis chacune avec soin pour réveiller les vigies."
	d.enigma_xp = 55
	d.chest_xp = 150
	d.outro = "Le Veilleur relit ses courbes, et le Brouillard recule jusqu'aux montagnes. Belle victoire, Archiviste."
	d.rooms = [
		{"kind": "entree", "title": "Le Pont-levis"},
		{"kind": "combat", "title": "La Cour des Images", "enemies": [
			_enemy("Skeleton_Warrior", "Vigie sans visage", 90, 3, 45, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "Le Chemin de ronde", "enemies": [
			_enemy("Skeleton_Rogue", "Archer des pentes", 90, 3, 50, Vector2(8, 5)),
			_enemy("Skeleton_Mage", "Liseur d'ombres", 95, 3, 50, Vector2(12.5, 10)),
		]},
		{"kind": "enigme", "title": "La Salle des Vigies"},
		{"kind": "combat", "title": "La Tour des Variations", "enemies": [
			_enemy("Skeleton_Warrior", "Capitaine décroissant", 140, 4, 65, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "Le Donjon du Veilleur", "enemies": [
			_enemy("Skeleton_Mage", "Le Seigneur des Courbes", 260, 5, 180, Vector2(11, 6), 1.45),
		]},
	]
	d.decor = {
		"walls": ["wall_window_open", "wall_arched"],
		"banners": ["banner_triple_yellow", "banner_patternC_white"],
		"props": [
			["shelves", Vector3(1.3, 0, 4.2), 90.0, 0.8],
			["trunk_large_A", Vector3(1.8, 0, 1.6), 15.0, 0.9],
			["barrel_small_stack", Vector3(3.4, 0, 1.1), 0.0, 0.7],
			["shelf_small_candles", Vector3(14.5, 0, 1.0), 0.0, 0.6],
			["sword_shield", Vector3(14.8, 0, 5.0), -90.0, 0.6],
		],
		"torch_color": Color(0.6, 0.78, 1.0),
	}
	return d


static func _enemy(model: String, name_text: String, hp: int, tier: int, xp: int, at: Vector2, scale := 1.0) -> Dictionary:
	return {"model": model, "name": name_text, "hp": hp, "tier": tier, "xp": xp, "at": at, "scale": scale}
