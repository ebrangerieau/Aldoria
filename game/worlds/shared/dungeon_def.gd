class_name DungeonDef
extends Resource
## Un donjon : les chapitres dont viennent ses questions « Sort », son énigme, ses
## salles, ses ennemis et son décor (IMPLEMENTATION_PLAN, phases 2 et 3). Le gameplay
## ne connaît pas le contenu des questions : il transmet `session_params()` au
## serveur, qui compose le paquet (chapitres ciblés + items de l'énigme).
##
## Les donjons d'une classe sont rangés par matière (`subject`), une région par matière
## (`REGIONS`) : dans une région, ils s'ouvrent l'un après l'autre (le suivant quand le
## précédent a été terminé une fois). Chaque région a son premier donjon ouvert.
##
## Salles, d'ouest en est : `kind` = entree | combat | enigme | boss.
## Ennemi : {model, name, hp, tier (force), xp, at: Vector2 (position dans la salle,
## en mètres depuis son coin nord-ouest), scale}. Le quart est de la salle, autour de la
## porte (x > 11, z de 7 à 13), est réservé à l'escalier qui monte vers la salle suivante.
## Décor (`decor`, lu par DungeonLevel) : sol, murs du fond, bannières, objets le long
## des murs, couleur des torches. Absent : décor de la Tour et du Labyrinthe.

const REGIONS := {
	"maths": "Les Cimes Fractales",
	"anglais": "La Bibliothèque des Langues",
	"francais": "La Salle des Chroniques",
}
const SUBJECT_LABELS := {"maths": "Maths", "anglais": "Anglais", "francais": "Français"}

@export var code := ""
@export var title := ""
@export var subject := "maths"
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
## Carte du royaume (docs/histoire.md) : bâtiment sur la carte (pièce du pack KayKit Medieval
## Hexagon), page de la Grande Chronique gardée par l'Effaceur (le boss), et texte du seuil
## (Maître Ysaline présente le lieu et la quête avant d'y entrer).
@export var map_piece := "building_tower_A_blue"
@export var page := ""
@export var threshold := ""
## Répliques de l'Effaceur (le boss) à l'entrée du combat et à sa défaite, et ce que la page
## rendue rapporte au royaume (scène du coffre, première fois).
@export var boss_intro := ""
@export var boss_defeat := ""
@export var page_text := ""


## Donjons d'une classe (leurs chapitres en dépendent) ; l'ambiance vient du monde de
## l'enfant (WorldTheme). Une classe sans donjon pour l'instant renvoie une liste vide :
## le camp propose alors l'arène, le défi du jour et le village s'il existe.
static func all_for_level(level: String) -> Array[DungeonDef]:
	match level:
		"6e":
			return [tour_fractions(), atelier_balances(), observatoire_angles(), bibliotheque_langues()]
		"2nde":
			return [labyrinthe_vecteurs(), forge_algebre(), citadelle_fonctions(), theatre_verdure()]
	return []


## Donjon d'après son code (null si la classe n'en a pas) ; code inconnu : le premier.
static func by_code(level: String, dungeon_code: String) -> DungeonDef:
	var dungeons := all_for_level(level)
	for d in dungeons:
		if d.code == dungeon_code:
			return d
	return dungeons[0] if not dungeons.is_empty() else null


## Donjon à terminer avant celui-ci (le précédent de sa région), null pour le premier.
static func previous(dungeons: Array[DungeonDef], index: int) -> DungeonDef:
	for i in range(index - 1, -1, -1):
		if dungeons[i].subject == dungeons[index].subject:
			return dungeons[i]
	return null


## Matières qui ont des donjons, dans l'ordre de la liste (maths d'abord).
static func subjects(dungeons: Array[DungeonDef]) -> Array[String]:
	var out: Array[String] = []
	for d in dungeons:
		if not d.subject in out:
			out.append(d.subject)
	return out


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
	d.boss_intro = "Ha ! Encore un petit Archiviste ! Moi, je coupe tout en morceaux… et je ne recolle jamais rien. Ta page des Fractions, tu ne la reverras pas !"
	d.boss_defeat = "Non… mes morceaux se recollent tout seuls ! Malvrek va être furieux…"
	d.page_text = "Sur la page des Fractions, les parts se remettent en ordre : moitiés, tiers, quarts. Les habitants de la Tour savent de nouveau partager."
	d.map_piece = "building_tower_A_blue"
	d.page = "la page des Fractions"
	d.threshold = "La Tour des Fractions se dresse au-dessus des Cimes. Ses habitants savaient partager une tarte en parts égales. Depuis que le Grand Diviseur a volé leur page, ils coupent tout de travers. Rapporte la page des Fractions, et la Tour se souviendra."
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
			_enemy("Mushnub", "Champignon des moitiés", 60, 1, 30, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "Le Couloir des Quarts", "enemies": [
			_enemy("Skeleton_Minion", "Squelette grognon", 70, 2, 35, Vector2(8, 5)),
			_enemy("GreenBlob", "Gelée farceuse", 80, 2, 35, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Salle des Balances"},
		{"kind": "combat", "title": "La Galerie des Tiers", "enemies": [
			_enemy("Skeleton_Warrior", "Gardien des os", 110, 3, 50, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "Le Sommet de la Tour", "enemies": [
			_enemy("MushnubEvolved", "Le Grand Diviseur", 200, 4, 150, Vector2(11, 6), 1.45),
		]},
	]
	return d


static func atelier_balances() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "atelier_balances"
	d.boss_intro = "Bienvenue dans mon atelier ! Ici, un kilo pèse ce que JE décide. Essaie donc de m'équilibrer, petit Archiviste !"
	d.boss_defeat = "Mes plateaux… ils sont justes à nouveau. Quelle horreur, la vérité !"
	d.page_text = "La page des Mesures retrouve ses poids et ses échelles. Dans l'Atelier, les balances disent vrai et les cartes montrent le bon chemin."
	d.map_piece = "building_blacksmith_blue"
	d.page = "la page des Mesures"
	d.threshold = "Dans l'Atelier des Balances, on pesait tout au gramme près. Le Faux Peseur a volé la page des Mesures : les poids mentent et les cartes sont fausses. Retrouve-la, et l'Atelier saura de nouveau peser juste."
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
			_enemy("Goleling", "Petit golem de poids", 70, 1, 35, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "La Réserve des Barres", "enemies": [
			_enemy("Skeleton_Rogue", "Chapardeur de poids", 80, 2, 40, Vector2(8, 5)),
			_enemy("Cactoro", "Cactus mal mesuré", 80, 2, 40, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Salle des Cartes"},
		{"kind": "combat", "title": "Le Comptoir des Échelles", "enemies": [
			_enemy("Skeleton_Mage", "Arpenteur maudit", 120, 3, 55, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "La Grande Balance", "enemies": [
			_enemy("GolelingEvolved", "Le Faux Peseur", 220, 4, 160, Vector2(11, 6), 1.45),
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
	d.boss_intro = "Grrr… Qui ose monter jusqu'à mes étoiles ? Ici, les angles sont tordus et le hasard m'obéit. Tu n'as aucune chance !"
	d.boss_defeat = "Aucune chance… C'est moi qui n'en avais aucune. Reprends ta page, Archiviste."
	d.page_text = "La page des Étoiles brille de nouveau : les angles se redressent, les chances se calculent. Les lunettes de l'Observatoire retrouvent le ciel."
	d.map_piece = "building_tower_B_blue"
	d.page = "la page des Étoiles"
	d.threshold = "Tout en haut des Cimes, l'Observatoire visait les étoiles. Le Dragon des Constellations a emporté la page des Étoiles. Sans elle, les lunettes visent de travers et personne ne sait plus calculer ses chances."
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
			_enemy("Armabee", "Abeille pointue", 80, 2, 40, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "La Rotonde des Angles droits", "enemies": [
			_enemy("Skeleton_Minion", "Squelette à l'équerre", 90, 2, 45, Vector2(8, 5)),
			_enemy("Ghost", "Feu follet astral", 90, 3, 45, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Salle des Automates"},
		{"kind": "combat", "title": "Le Belvédère des Hasards", "enemies": [
			_enemy("Skeleton_Warrior", "Gardien des dés", 130, 3, 60, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "La Coupole", "enemies": [
			_enemy("Dragon", "Le Dragon des Constellations", 240, 5, 170, Vector2(11, 6), 1.45),
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


# Anglais : la Bibliothèque des Langues (matière pilote de Jules, étape C).
static func bibliotheque_langues() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "bibliotheque_langues"
	d.boss_intro = "(Le Bibliothécaire Muet pose un doigt sur sa bouche et serre la page contre lui. Sur un parchemin, il griffonne : « SILENCE ! »)"
	d.boss_defeat = "(Le Bibliothécaire laisse tomber la page. Pour la première fois depuis longtemps, il murmure : « … thank you. »)"
	d.page_text = "La page de l'Anglais se remplit de mots : colours, numbers, family… Les livres de la Bibliothèque parlent de nouveau."
	d.map_piece = "building_church_blue"
	d.page = "la page de l'Anglais"
	d.threshold = "Au bord de la mer se dresse la Bibliothèque des Langues. On y parlait toutes les langues du monde. Le Bibliothécaire Muet a volé la page de l'Anglais : les livres sont devenus blancs. Reprends-lui chaque mot."
	d.title = "La Bibliothèque des Langues"
	d.subject = "anglais"
	d.chapter_codes = ["6e.anglais.vocabulaire", "6e.anglais.grammaire", "6e.anglais.communication"]
	d.chapter_title = "Anglais : vocabulaire et grammaire"
	d.intro = "Le Bibliothécaire Muet a volé les mots anglais des livres : les pages sont blanches ! Reprends-lui chaque mot, salle après salle."
	d.enigma_generator = "6e.anglais.lettres"
	d.enigma_title = "Les Livres en désordre"
	d.enigma_intro = "Trois livres ont perdu leur titre : les lettres sont tombées en vrac. Écoute chaque mot et remets ses lettres dans l'ordre."
	d.enigma_xp = 45
	d.chest_xp = 120
	d.outro = "Les livres parlent de nouveau anglais. « Thank you, Archivist! » murmure la Bibliothèque."
	d.rooms = [
		{"kind": "entree", "title": "Le Hall des Langues"},
		{"kind": "combat", "title": "Le Rayon des Couleurs", "enemies": [
			_enemy("Ghost", "Fantôme des pages", 60, 1, 30, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "La Salle des Dictionnaires", "enemies": [
			_enemy("Skeleton_Rogue", "Voleur de mots", 75, 2, 35, Vector2(8, 5)),
			_enemy("GreenBlob", "Gelée d'encre", 75, 2, 35, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Salle des Livres en désordre"},
		{"kind": "combat", "title": "La Galerie des Grammaires", "enemies": [
			_enemy("Skeleton_Mage", "Grammairien d'os", 110, 3, 50, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "Le Bureau du Bibliothécaire", "enemies": [
			_enemy("Skeleton_Mage", "Le Bibliothécaire Muet", 210, 4, 155, Vector2(11, 6), 1.45),
		]},
	]
	d.decor = {
		"floor": "floor_wood_large",
		"floor_accent": "floor_wood_large_dark",
		"walls": ["wall_shelves", "wall_window_open"],
		"banners": ["banner_patternA_blue", "banner_patternC_white"],
		"props": [
			["shelf_large", Vector3(1.4, 0, 4.0), 90.0, 0.9],
			["table_long_decorated_A", Vector3(2.4, 0, 1.4), 0.0, 1.0],
			["candle_triple", Vector3(13.2, 0, 1.0), 0.0, 0.3],
			["shelves", Vector3(14.9, 0, 5.2), -90.0, 0.8],
			["shelf_small_candles", Vector3(14.4, 0, 1.0), 0.0, 0.6],
		],
		"torch_color": Color(1.0, 0.86, 0.62),
	}
	return d


# --- Tom (2nde) -------------------------------------------------------------------------

static func labyrinthe_vecteurs() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "labyrinthe_vecteurs"
	d.boss_intro = "Tu crois sortir de mon Labyrinthe ? Chaque couloir est une flèche qui ne mène nulle part. Ton phare restera éteint."
	d.boss_defeat = "Mes flèches… elles indiquent toutes le centre. Le phare se rallume. Malvrek ne va pas aimer ça."
	d.page_text = "La page des Vecteurs retrouve ses flèches : direction, sens, longueur. Le phare du Labyrinthe perce le Brouillard."
	d.map_piece = "building_tower_A_green"
	d.page = "la page des Vecteurs"
	d.threshold = "Au cœur des Cimes, le Labyrinthe guidait les voyageurs grâce à ses flèches de lumière. L'Architecte du Brouillard a volé la page des Vecteurs : les couloirs se sont figés. Rallume le phare du centre."
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
			_enemy("Skeleton_Warrior", "Gardien oublié", 90, 3, 40, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Salle des Miroirs"},
		{"kind": "combat", "title": "La Galerie Colinéaire", "enemies": [
			_enemy("GhostSkull", "Héraut du Brouillard", 120, 3, 55, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "Le Cœur du Labyrinthe", "enemies": [
			_enemy("BlueDemon", "L'Architecte du Brouillard", 220, 5, 150, Vector2(11, 6), 1.45),
		]},
	]
	return d


static func forge_algebre() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "forge_algebre"
	d.boss_intro = "Approche, Archiviste. Dans ma forge, les formules sortent tordues, et j'aime ça. Voyons si tu sais redresser le métal."
	d.boss_defeat = "L'enclume refroidit… et tes formules sont droites. Bien joué. Pour cette fois."
	d.page_text = "La page du Calcul est reforgée : développer, factoriser, résoudre. Les formules sortent droites de l'enclume."
	d.map_piece = "building_blacksmith_blue"
	d.page = "la page du Calcul"
	d.threshold = "La Forge de l'Algèbre façonnait les formules du royaume. Le Maître de Forge, un démon de feu, a volé la page du Calcul : tout sort tordu de l'enclume. Reprends-la et redresse les formules."
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
			_enemy("Orc", "Marteleur d'inconnues", 90, 3, 45, Vector2(8, 5)),
			_enemy("Skeleton_Minion", "Soufflet hargneux", 85, 2, 45, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Salle des Sceaux"},
		{"kind": "combat", "title": "La Fonderie des Inéquations", "enemies": [
			_enemy("Skeleton_Mage", "Fondeur de l'ombre", 130, 4, 60, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "L'Enclume", "enemies": [
			_enemy("Demon", "Le Maître de Forge", 240, 5, 170, Vector2(11, 6), 1.45),
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
	d.boss_intro = "Le Veilleur ne voit plus rien, et c'est très bien ainsi. Mes courbes montent et descendent quand je veux. Lis-les donc, si tu peux."
	d.boss_defeat = "Tu lis mes courbes mieux que moi… Le Veilleur rouvre les yeux. Je me retire."
	d.page_text = "La page des Courbes se dessine à nouveau : images, antécédents, variations. Le Veilleur relit l'avenir dans ses courbes."
	d.map_piece = "building_tower_B_blue"
	d.page = "la page des Courbes"
	d.threshold = "Le Veilleur de la Citadelle lisait l'avenir dans les courbes. Le Seigneur des Courbes, un dragon, a volé la page des Courbes, et le Veilleur ne voit plus rien. Rends-lui la vue."
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
			_enemy("GhostSkull", "Liseur d'ombres", 95, 3, 50, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Salle des Vigies"},
		{"kind": "combat", "title": "La Tour des Variations", "enemies": [
			_enemy("Yeti", "Capitaine décroissant", 140, 4, 65, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "Le Donjon du Veilleur", "enemies": [
			_enemy("Dragon", "Le Seigneur des Courbes", 260, 5, 180, Vector2(11, 6), 1.45),
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


## Bois des Mots (français de Tom) : premier lieu de la région, sur une scène de théâtre.
static func theatre_verdure() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "theatre_verdure"
	d.boss_intro = "Un mot de trop, Archiviste, et je te rature. Ici, j'efface tout ce qui a du sens : les vers, les figures, les règles."
	d.boss_defeat = "Mon encre… pâlit. Les mots reviennent sous les ratures. Malvrek saura que tu lis entre les lignes."
	d.page_text = "La page du Français se relit sans rature : règles d'accord, figures de style, vers et répliques. Les arbres du Bois murmurent de nouveau."
	d.map_piece = "building_stage_A"
	d.page = "la page du Français"
	d.threshold = "Au cœur du Bois des Mots, le Théâtre de Verdure donnait la parole aux arbres : chaque feuille portait un vers. Le Ratureur a volé la page du Français. Il barre chaque mot d'un trait d'encre, et le théâtre s'est tu. Reprends-lui la page, scène après scène."
	d.title = "Le Théâtre de Verdure"
	d.subject = "francais"
	d.chapter_codes = ["2nde.francais.langue", "2nde.francais.figures", "2nde.francais.poesie", "2nde.francais.idees", "2nde.francais.recit", "2nde.francais.theatre"]
	d.chapter_title = "Langue, figures de style, poésie, récit et théâtre"
	d.intro = "Les feuilles du Bois sont couvertes de ratures. Traverse le Théâtre et rends ses mots au royaume."
	d.enigma_generator = "2nde.francais.vers"
	d.enigma_title = "Les Vers défaits"
	d.enigma_intro = "Trois vers célèbres gisent en morceaux sur la scène. Remets leurs mots dans l'ordre pour rendre la voix aux acteurs."
	d.enigma_xp = 50
	d.chest_xp = 130
	d.outro = "Le rideau de feuilles se lève. Le Théâtre de Verdure parle de nouveau."
	d.rooms = [
		{"kind": "entree", "title": "L'Allée des Chênes"},
		{"kind": "combat", "title": "La Clairière des Accords", "enemies": [
			_enemy("GhostSkull", "Spectre des ratures", 80, 2, 40, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "Le Sentier des Figures", "enemies": [
			_enemy("Goleling", "Golem de grimoire", 90, 3, 45, Vector2(8, 5)),
			_enemy("Armabee", "Guêpe d'encre", 85, 2, 45, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Scène des Vers défaits"},
		{"kind": "combat", "title": "Les Coulisses", "enemies": [
			_enemy("MushnubEvolved", "Souffleur d'ombre", 130, 4, 60, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "La Grande Scène", "enemies": [
			_enemy("BlueDemon", "Le Ratureur", 240, 5, 170, Vector2(11, 6), 1.2),
		]},
	]
	d.decor = {
		"floor": "floor_dirt_large",
		"floor_accent": "floor_wood_large_dark",
		"walls": ["wall_arched", "wall"],
		"banners": ["banner_patternB_green", "banner_patternC_white"],
		"props": [
			["column", Vector3(1.4, 0, 4.0), 0.0, 0.6],
			["rubble_half", Vector3(2.6, 0, 1.4), 0.0, 0.8],
			["candle_triple", Vector3(13.2, 0, 1.0), 0.0, 0.3],
			["trunk_large_A", Vector3(14.6, 0, 4.6), -90.0, 0.8],
			["table_medium_decorated_A", Vector3(12.0, 0, 1.6), 0.0, 0.9],
		],
		"torch_color": Color(0.62, 0.95, 0.72),
	}
	return d


static func _enemy(model: String, name_text: String, hp: int, tier: int, xp: int, at: Vector2, scale := 1.0) -> Dictionary:
	return {"model": model, "name": name_text, "hp": hp, "tier": tier, "xp": xp, "at": at, "scale": scale}
