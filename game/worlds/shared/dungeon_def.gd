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
## Forme de l'énigme : "" (trois piédestaux, une question chacun) ou "balance" (balance géante
## en 3D, trois manches résolues sur la balance elle-même : `BalanceEnigma`).
@export var enigma_mode := ""
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
			return [tour_fractions(), atelier_balances(), observatoire_angles(), bibliotheque_langues(), porte_origines(), porte_horizons(), moulin_phrases(), puits_contes(), tour_experiences(), maison_naturaliste()]
		"2nde":
			return [labyrinthe_vecteurs(), forge_algebre(), citadelle_fonctions(), theatre_verdure(), bibliotheque_engloutie(), port_couronnes(), porte_empires(), porte_transitions(), alambic_elements(), laboratoire_foudroye(), pont_paquets(), atelier_automates()]
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
	d.enigma_mode = "balance"
	d.enigma_title = "Les Balances du Gardien"
	d.enigma_intro = "Une balance géante bloque la porte. Trois fois de suite, trouve ce que pèse une boîte : essaie une masse, regarde de quel côté penche la balance, et remets-la en équilibre."
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


# --- Portes du Temps (histoire-géographie de Jules) ----------------------------------------------

static func porte_origines() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "porte_origines"
	d.boss_intro = "Ha ha ! Je suis Dame Sablière ! J'ai envoyé les pharaons chez les Romains et Jules César à l'âge de pierre ! Ta page de l'Histoire ? Perdue au fond de mon sablier !"
	d.boss_defeat = "Mon sablier… le sable retombe dans le bon sens ! Chaque époque retrouve sa place. Malvrek ne va pas être content…"
	d.page_text = "Sur la page de l'Histoire, les époques se remettent en ordre : les premiers humains, l'écriture, les cités grecques, Rome. La frise du temps est réparée."
	d.map_piece = "building_destroyed"
	d.page = "la page de l'Histoire"
	d.threshold = "Au bord du royaume, un cercle de pierres garde les Portes du Temps. La première s'ouvre sur les origines : les premiers humains, les pharaons, les Grecs et les Romains. Dame Sablière y a tout mélangé, les pyramides côtoient les gladiateurs ! Rapporte la page de l'Histoire et remets les époques dans l'ordre."
	d.title = "La Porte des Origines"
	d.subject = "histoire_geo"
	d.chapter_codes = ["6e.histoire_geo.reperes", "6e.histoire_geo.humanite", "6e.histoire_geo.antiquite", "6e.histoire_geo.empire_romain"]
	d.chapter_title = "Les débuts de l'humanité, les Grecs et les Romains"
	d.intro = "Le sable du temps coule de travers ! Traverse les époques et retrouve Dame Sablière."
	d.enigma_generator = "6e.histoire_geo.frise"
	d.enigma_title = "La Frise du Temps"
	d.enigma_intro = "Trois frises ont perdu leur ordre : les événements s'y bousculent. Remets-les du plus ancien au plus récent."
	d.enigma_xp = 45
	d.chest_xp = 120
	d.outro = "Les Portes du Temps se referment doucement : chaque époque est de nouveau à sa place."
	d.rooms = [
		{"kind": "entree", "title": "Le Cercle de Pierres"},
		{"kind": "combat", "title": "La Grotte des Premiers Humains", "enemies": [
			_enemy("Mushnub", "Champignon des cavernes", 60, 1, 30, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "Les Rives du Nil", "enemies": [
			_enemy("Skeleton_Warrior", "Garde du pharaon", 75, 2, 35, Vector2(8, 5)),
			_enemy("Cactoro", "Cactus du désert", 75, 2, 35, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Salle de la Frise"},
		{"kind": "combat", "title": "Le Forum de Rome", "enemies": [
			_enemy("Skeleton_Rogue", "Gladiateur d'os", 110, 3, 50, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "Le Grand Sablier", "enemies": [
			_enemy("Ghost", "Dame Sablière", 210, 4, 155, Vector2(11, 6), 1.4),
		]},
	]
	d.decor = {
		"floor": "floor_tile_large",
		"floor_accent": "floor_dirt_large",
		"banners": ["banner_triple_yellow", "banner_patternB_yellow"],
		"props": [
			["column", Vector3(1.4, 0, 4.0), 0.0, 0.6],
			["rubble_half", Vector3(2.6, 0, 1.4), 0.0, 0.8],
			["chest_gold", Vector3(13.4, 0, 1.4), 0.0, 0.8],
			["trunk_large_A", Vector3(14.6, 0, 4.6), -90.0, 0.8],
		],
		"torch_color": Color(1.0, 0.8, 0.45),
	}
	return d


static func porte_horizons() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "porte_horizons"
	d.boss_intro = "Nord, sud, est, ouest… je mélange tout ! J'ai posé le Sahara au milieu de Paris et la mer dans le désert. Tu ne retrouveras jamais ton chemin !"
	d.boss_defeat = "Ma boussole… elle montre le nord à nouveau ! Les cartes se remettent en place. Zut, zut et zut !"
	d.page_text = "La page de la Géographie se déplie : métropoles, déserts, littoraux, foyers de peuplement. Chaque lieu retrouve sa place sur la carte du monde."
	d.map_piece = "building_bridge_A"
	d.page = "la page de la Géographie"
	d.threshold = "La deuxième Porte du Temps ne s'ouvre pas sur une époque, mais sur le monde entier : des villes géantes, des déserts, des côtes. Le Brouille-Cartes, complice de Dame Sablière, a mélangé tous les atlas. Rapporte la page de la Géographie et remets chaque lieu à sa place."
	d.title = "La Porte des Horizons"
	d.subject = "histoire_geo"
	d.chapter_codes = ["6e.histoire_geo.metropoles", "6e.histoire_geo.faible_densite", "6e.histoire_geo.littoraux", "6e.histoire_geo.monde_habite"]
	d.chapter_title = "Habiter le monde : villes, déserts, littoraux"
	d.intro = "Les cartes du monde sont toutes mélangées ! Traverse les paysages et retrouve le Brouille-Cartes."
	d.enigma_generator = "6e.histoire_geo.population"
	d.enigma_title = "L'Atlas mélangé"
	d.enigma_intro = "Trois pages de l'atlas sont en désordre. Classe les pays du plus peuplé au moins peuplé pour les remettre en place."
	d.enigma_xp = 45
	d.chest_xp = 120
	d.outro = "Les atlas sont rangés, les cartes disent vrai. Le monde retrouve ses horizons !"
	d.rooms = [
		{"kind": "entree", "title": "Le Seuil des Horizons"},
		{"kind": "combat", "title": "La Métropole", "enemies": [
			_enemy("GreenBlob", "Gelée des embouteillages", 60, 1, 30, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "Le Grand Désert", "enemies": [
			_enemy("Cactoro", "Cactus des sables", 75, 2, 35, Vector2(8, 5)),
			_enemy("Armabee", "Guêpe des oasis", 75, 2, 35, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Salle de l'Atlas"},
		{"kind": "combat", "title": "Le Port aux Conteneurs", "enemies": [
			_enemy("Goleling", "Golem des conteneurs", 110, 3, 50, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "La Rose des Vents", "enemies": [
			_enemy("GolelingEvolved", "Le Brouille-Cartes", 210, 4, 155, Vector2(11, 6), 1.25),
		]},
	]
	d.decor = {
		"floor": "floor_wood_large",
		"floor_accent": "floor_tile_large_rocks",
		"walls": ["wall_shelves", "wall_window_open"],
		"banners": ["banner_patternC_blue", "banner_patternB_green"],
		"props": [
			["table_long_decorated_A", Vector3(2.4, 0, 1.4), 0.0, 1.0],
			["shelf_large", Vector3(1.4, 0, 4.4), 90.0, 0.9],
			["barrel_large", Vector3(13.6, 0, 1.4), 0.0, 0.8],
			["crates_stacked", Vector3(14.6, 0, 4.4), -20.0, 0.9],
		],
		"torch_color": Color(0.95, 0.9, 0.7),
	}
	return d


# --- Bois des Mots (français de Jules) ------------------------------------------------------------

static func moulin_phrases() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "moulin_phrases"
	d.boss_intro = "Miam ! Je suis le Gobe-Lettres ! J'avale les accords, je croque les terminaisons et je recrache les phrases toutes de travers. Ta page de la Grammaire ? Elle a un goût de virgule !"
	d.boss_defeat = "Beurk… j'ai trop mangé de mots. Tiens, reprends-les, je ne digère pas les phrases bien construites !"
	d.page_text = "Sur la page de la Grammaire, chaque mot retrouve sa place : le sujet devant le verbe, les accords bien faits, les verbes conjugués au bon temps."
	d.map_piece = "building_windmill_yellow"
	d.page = "la page de la Grammaire"
	d.threshold = "À l'orée du Bois des Mots tourne le Moulin des Phrases. Ses ailes broyaient les mots en jolies phrases bien rangées. Mais le Gobe-Lettres s'y est installé : il avale les accords et mélange les verbes. Rapporte la page de la Grammaire et remets le moulin en marche."
	d.title = "Le Moulin des Phrases"
	d.subject = "francais"
	d.chapter_codes = ["6e.francais.grammaire", "6e.francais.conjugaison", "6e.francais.orthographe", "6e.francais.vocabulaire"]
	d.chapter_title = "Grammaire, conjugaison, orthographe et vocabulaire"
	d.intro = "Les ailes du moulin grincent : les phrases sortent en miettes ! Monte jusqu'au Gobe-Lettres."
	d.enigma_generator = "6e.francais.fables"
	d.enigma_title = "Les Fables défaites"
	d.enigma_intro = "Le Gobe-Lettres a mâchouillé trois vers de La Fontaine. Remets leurs mots dans l'ordre pour rendre les fables entières."
	d.enigma_xp = 45
	d.chest_xp = 120
	d.outro = "Les ailes du moulin tournent de nouveau, et les phrases en sortent bien rangées."
	d.rooms = [
		{"kind": "entree", "title": "La Meule"},
		{"kind": "combat", "title": "Le Grenier des Mots", "enemies": [
			_enemy("Mushnub", "Champignon des virgules", 60, 1, 30, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "L'Escalier des Verbes", "enemies": [
			_enemy("Armabee", "Abeille des accords", 75, 2, 35, Vector2(8, 5)),
			_enemy("Goleling", "Golem des conjugaisons", 75, 2, 35, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Salle des Fables"},
		{"kind": "combat", "title": "Les Ailes du Moulin", "enemies": [
			_enemy("GhostSkull", "Fantôme des fautes", 110, 3, 50, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "Le Sommet du Moulin", "enemies": [
			_enemy("GreenBlob", "Le Gobe-Lettres", 210, 4, 155, Vector2(11, 6), 1.7),
		]},
	]
	d.decor = {
		"floor": "floor_wood_large",
		"floor_accent": "floor_wood_large_dark",
		"walls": ["wall", "wall_window_open"],
		"banners": ["banner_patternB_yellow", "banner_shield_red"],
		"props": [
			["barrel_large", Vector3(1.6, 0, 4.0), 0.0, 0.8],
			["crates_stacked", Vector3(2.6, 0, 1.4), 15.0, 0.9],
			["table_medium_decorated_A", Vector3(12.0, 0, 1.6), 0.0, 0.9],
			["shelf_small_candles", Vector3(14.4, 0, 1.0), 0.0, 0.6],
		],
		"torch_color": Color(1.0, 0.88, 0.6),
	}
	return d


static func puits_contes() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "puits_contes"
	d.boss_intro = "Grrr… Qui ose descendre dans mon puits ? Je suis l'Ogre Oublieux ! J'ai mangé la fin de tous les contes : plus personne ne sait comment finissent les histoires. Et toi, je vais te manger aussi… enfin, si je m'en souviens !"
	d.boss_defeat = "Ah… je me souviens ! Il était une fois… un Archiviste très courageux. Reprends tes contes, ils me donnaient mal au ventre."
	d.page_text = "La page des Contes se remplit de nouveau : les dieux de l'Olympe, Ulysse et le Cyclope, les fables, Scapin et ses ruses, le Minotaure… Chaque histoire retrouve sa fin."
	d.map_piece = "building_well_yellow"
	d.page = "la page des Contes"
	d.threshold = "Au cœur du Bois des Mots se cache le Puits aux Contes. On raconte qu'au fond, toutes les histoires du monde dorment en attendant qu'on les lise. L'Ogre Oublieux y est descendu et a dévoré la fin de chaque conte. Va chercher la page des Contes : mythes, fables, théâtre, aventures et monstres t'attendent."
	d.title = "Le Puits aux Contes"
	d.subject = "francais"
	d.chapter_codes = ["6e.francais.lectures"]
	d.chapter_title = "Récits des origines, poésie, théâtre, aventures et monstres"
	d.intro = "Au fond du puits, les histoires s'emmêlent. Descends jusqu'à l'Ogre Oublieux !"
	d.enigma_generator = "6e.francais.conte"
	d.enigma_title = "Le Conte en désordre"
	d.enigma_intro = "L'Ogre a mélangé les pages de trois histoires. Remets leurs étapes dans l'ordre, du début à la fin."
	d.enigma_xp = 45
	d.chest_xp = 120
	d.outro = "Une lumière douce remonte du puits : toutes les histoires ont retrouvé leur fin."
	d.rooms = [
		{"kind": "entree", "title": "La Margelle"},
		{"kind": "combat", "title": "La Grotte des Origines", "enemies": [
			_enemy("Cactoro", "Cactus de l'Olympe", 60, 1, 30, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "Le Labyrinthe", "enemies": [
			_enemy("Yeti", "Minotaure des neiges", 80, 2, 35, Vector2(8, 5)),
			_enemy("MushnubEvolved", "Champignon du Cyclope", 75, 2, 35, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Salle des Pages volantes"},
		{"kind": "combat", "title": "L'Antre du Dragon", "enemies": [
			_enemy("Dragon", "Dragon des légendes", 110, 3, 50, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "Le Fond du Puits", "enemies": [
			_enemy("Orc", "L'Ogre Oublieux", 210, 4, 155, Vector2(11, 6), 1.4),
		]},
	]
	d.decor = {
		"floor": "floor_tile_large",
		"floor_accent": "floor_dirt_large",
		"walls": ["wall_arched", "wall_shelves"],
		"banners": ["banner_patternB_green", "banner_patternC_white"],
		"props": [
			["shelf_large", Vector3(1.4, 0, 4.0), 90.0, 0.9],
			["trunk_large_A", Vector3(2.6, 0, 1.4), 0.0, 0.8],
			["candle_triple", Vector3(13.2, 0, 1.0), 0.0, 0.3],
			["chest_gold", Vector3(14.6, 0, 4.6), -90.0, 0.8],
		],
		"torch_color": Color(0.75, 0.95, 0.7),
	}
	return d


# --- Laboratoire des Inventeurs (sciences de Jules) ---------------------------------------------

static func tour_experiences() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "tour_experiences"
	d.boss_intro = "Bzzzt ! Je suis le Professeur Court-Circuit ! J'ai fait fondre la glace à l'envers, inversé les fils et volé l'énergie de toutes les piles. Ta page des Sciences ? Elle a grillé avec mes fusibles !"
	d.boss_defeat = "Pfffiou… mes circuits fument. Tiens, reprends ta page : tes expériences marchent bien mieux que les miennes."
	d.page_text = "Sur la page des Sciences, tout se remet à fonctionner : l'eau gèle et bout au bon moment, les lampes s'allument, les vitesses se calculent et la Terre tourne de nouveau autour du Soleil."
	d.map_piece = "building_tower_A_green"
	d.page = "la page des Sciences"
	d.threshold = "Au Laboratoire des Inventeurs, la Tour des Expériences crépite d'étincelles. On y faisait fondre, bouillir, briller et rouler toutes sortes de choses. Mais le Professeur Court-Circuit a tout déréglé : les glaçons bouillent et les lampes refusent de s'allumer. Rapporte la page des Sciences et remets les expériences en ordre."
	d.title = "La Tour des Expériences"
	d.subject = "sciences"
	d.chapter_codes = ["6e.sciences.matiere", "6e.sciences.mouvement_energie"]
	d.chapter_title = "La matière, le mouvement, l'énergie, l'électricité et la lumière"
	d.intro = "Des étincelles jaillissent de partout ! Grimpe jusqu'au Professeur Court-Circuit."
	d.enigma_generator = "6e.sciences.course"
	d.enigma_title = "La Course des Inventions"
	d.enigma_intro = "Le Professeur a truqué trois courses d'engins. Calcule leurs vitesses et range-les du plus lent au plus rapide."
	d.enigma_xp = 45
	d.chest_xp = 120
	d.outro = "Les étincelles s'éteignent doucement : chaque expérience a retrouvé ses règles."
	d.rooms = [
		{"kind": "entree", "title": "Le Hall des Éprouvettes"},
		{"kind": "combat", "title": "La Salle des Glaçons", "enemies": [
			_enemy("GreenBlob", "Gelée qui ne fond pas", 60, 1, 30, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "L'Atelier des Circuits", "enemies": [
			_enemy("Goleling", "Golem à piles", 75, 2, 35, Vector2(8, 5)),
			_enemy("Armabee", "Guêpe électrique", 75, 2, 35, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Piste d'Essai"},
		{"kind": "combat", "title": "L'Observatoire du Soleil", "enemies": [
			_enemy("GolelingEvolved", "Golem des engrenages", 110, 3, 50, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "Le Grenier à Fusibles", "enemies": [
			_enemy("BlueDemon", "Le Professeur Court-Circuit", 210, 4, 155, Vector2(11, 6), 1.1),
		]},
	]
	d.decor = {
		"floor": "floor_tile_large",
		"floor_accent": "floor_wood_large",
		"walls": ["wall_shelves", "wall_window_open"],
		"banners": ["banner_patternC_white", "banner_patternB_green"],
		"props": [
			["table_long_decorated_A", Vector3(2.4, 0, 1.4), 0.0, 1.0],
			["shelf_small_candles", Vector3(1.4, 0, 4.0), 90.0, 0.6],
			["barrel_large", Vector3(13.6, 0, 1.4), 0.0, 0.8],
			["crates_stacked", Vector3(14.6, 0, 4.4), -20.0, 0.9],
		],
		"torch_color": Color(0.7, 0.95, 1.0),
	}
	return d


static func maison_naturaliste() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "maison_naturaliste"
	d.boss_intro = "Halte ! Je suis le Pétrificateur ! Tout ce qui vit, je le change en caillou : les fleurs, les abeilles, les grenouilles… Et j'ai mélangé tous les fossiles du monde. Bientôt, plus rien ne poussera !"
	d.boss_defeat = "Non… mes cailloux se remettent à respirer ! Les graines germent, les abeilles bourdonnent. Je déteste quand ça repousse."
	d.page_text = "La page du Vivant reprend des couleurs : les cellules, les familles d'êtres vivants, les fossiles bien rangés dans le temps, les fleurs pollinisées et les chaînes alimentaires de la forêt."
	d.map_piece = "building_home_B_yellow"
	d.page = "la page du Vivant"
	d.threshold = "Un peu plus loin, la Maison du Naturaliste déborde de plantes, de bocaux et de fossiles. Le Pétrificateur y est entré : il change en pierre tout ce qui vit et mélange les époques. Rapporte la page du Vivant pour que la maison reverdisse."
	d.title = "La Maison du Naturaliste"
	d.subject = "sciences"
	d.chapter_codes = ["6e.sciences.vivant", "6e.sciences.nutrition", "6e.sciences.terre"]
	d.chapter_title = "Le vivant, l'alimentation, la Terre et les écosystèmes"
	d.intro = "Les plantes deviennent des cailloux ! Traverse la maison jusqu'au Pétrificateur."
	d.enigma_generator = "6e.sciences.frise_vivant"
	d.enigma_title = "La Frise du Vivant"
	d.enigma_intro = "Le Pétrificateur a mélangé les fossiles de trois vitrines. Remets l'histoire de la vie dans l'ordre, du plus ancien au plus récent."
	d.enigma_xp = 45
	d.chest_xp = 120
	d.outro = "La Maison du Naturaliste reverdit : les bocaux bourdonnent et les fossiles sont rangés."
	d.rooms = [
		{"kind": "entree", "title": "Le Vestibule aux Bocaux"},
		{"kind": "combat", "title": "La Serre", "enemies": [
			_enemy("Mushnub", "Champignon trop poli", 60, 1, 30, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "La Mare", "enemies": [
			_enemy("Cactoro", "Cactus pétrifié", 75, 2, 35, Vector2(8, 5)),
			_enemy("Armabee", "Abeille de pierre", 75, 2, 35, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Galerie des Fossiles"},
		{"kind": "combat", "title": "Le Cabinet des Squelettes", "enemies": [
			_enemy("Dragon", "Dragon fossile", 110, 3, 50, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "Le Grenier aux Herbiers", "enemies": [
			_enemy("Yeti", "Le Pétrificateur", 210, 4, 155, Vector2(11, 6), 1.3),
		]},
	]
	d.decor = {
		"floor": "floor_wood_large",
		"floor_accent": "floor_dirt_large",
		"walls": ["wall_shelves", "wall_arched"],
		"banners": ["banner_patternB_green", "banner_patternB_yellow"],
		"props": [
			["shelf_large", Vector3(1.4, 0, 4.0), 90.0, 0.9],
			["trunk_large_A", Vector3(2.6, 0, 1.4), 0.0, 0.8],
			["candle_triple", Vector3(13.2, 0, 1.0), 0.0, 0.3],
			["table_medium_decorated_A", Vector3(12.0, 0, 1.6), 0.0, 0.9],
		],
		"torch_color": Color(0.75, 1.0, 0.7),
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


# --- Bibliothèque des Langues (anglais de Tom) ---------------------------------------------------

static func bibliotheque_engloutie() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "bibliotheque_engloutie"
	d.boss_intro = "Passé, présent, futur… je les mélange tous ! Ici, hier sera demain et demain était hier. Ta page de Grammaire ? Elle dort au fond de l'eau, Archiviste. Tu vas l'y rejoindre."
	d.boss_defeat = "Non… les temps se remettent en ligne : “I was, I am, I will be.” Malvrek m'avait promis un monde sans règles…"
	d.page_text = "La page de la Grammaire anglaise sèche à la lumière : prétérit, present perfect, modaux et relatives retrouvent leur place. La Bibliothèque respire de nouveau."
	d.map_piece = "building_church_blue"
	d.page = "la page de la Grammaire anglaise"
	d.threshold = "Sous la Bibliothèque des Langues, la marée a envahi les salles d'archives. Les grammaires y flottent page contre page, et les temps se mélangent : hier devient demain. Sir Tense, un Effaceur qui ne supporte aucune règle, a volé la page de la Grammaire anglaise. Descends la reprendre."
	d.title = "La Bibliothèque engloutie"
	d.subject = "anglais"
	d.chapter_codes = ["2nde.anglais.verbe", "2nde.anglais.modalite", "2nde.anglais.phrase", "2nde.anglais.nom"]
	d.chapter_title = "Temps, modaux, construction de la phrase et groupe nominal en anglais"
	d.intro = "L'eau monte dans les archives : les verbes y ont perdu leurs temps. Trouve Sir Tense avant que tout soit noyé."
	d.enigma_generator = "2nde.anglais.phrases"
	d.enigma_title = "Les Phrases en miettes"
	d.enigma_intro = "Trois phrases flottent en morceaux à la surface. Lis leur traduction, puis remets les mots anglais dans l'ordre."
	d.enigma_xp = 50
	d.chest_xp = 130
	d.outro = "L'eau se retire des archives. Les grammaires anglaises reprennent leur place sur les étagères."
	d.rooms = [
		{"kind": "entree", "title": "Le Quai des Archives"},
		{"kind": "combat", "title": "La Salle du Prétérit", "enemies": [
			_enemy("Ghost", "Écho du passé", 80, 2, 40, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "La Galerie des Modaux", "enemies": [
			_enemy("Skeleton_Rogue", "Pilleur de modaux", 90, 3, 45, Vector2(8, 5)),
			_enemy("GreenBlob", "Flaque d'encre", 85, 2, 45, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Salle des Miettes"},
		{"kind": "combat", "title": "Le Couloir des Relatives", "enemies": [
			_enemy("Yeti", "Gardien des relatives", 130, 4, 60, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "La Salle du Temps noyé", "enemies": [
			_enemy("Skeleton_Warrior", "Sir Tense", 240, 5, 170, Vector2(11, 6), 1.5),
		]},
	]
	d.decor = {
		"floor": "floor_wood_large_dark",
		"floor_accent": "floor_tile_large_rocks",
		"walls": ["wall_shelves", "wall_arched"],
		"banners": ["banner_patternC_blue", "banner_patternA_blue"],
		"props": [
			["shelf_large", Vector3(1.4, 0, 4.0), 90.0, 0.9],
			["table_long_decorated_A", Vector3(2.4, 0, 1.4), 0.0, 1.0],
			["candle_triple", Vector3(13.2, 0, 1.0), 0.0, 0.3],
			["barrel_small_stack", Vector3(14.6, 0, 4.6), -90.0, 0.8],
			["shelf_small_candles", Vector3(14.4, 0, 1.0), 0.0, 0.6],
		],
		"torch_color": Color(0.6, 0.82, 1.0),
	}
	return d


static func port_couronnes() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "port_couronnes"
	d.boss_intro = "Indépendances, couronnes, empires… À quoi bon s'en souvenir ? J'efface les dates, Archiviste, et les peuples oublient d'où ils viennent. Ta page sera la prochaine."
	d.boss_defeat = "Les dates… reviennent. 1947, 1957, 1994… Je ne peux pas effacer ce que tant de gens racontent encore."
	d.page_text = "La page des Mondes anglophones se déplie comme une carte : Commonwealth, indépendances, mots de la famille et de la mémoire. Les navires reprennent la mer."
	d.map_piece = "building_castle_red"
	d.page = "la page des Mondes anglophones"
	d.threshold = "Au pied de la Bibliothèque, le Port des Couronnes accueillait les navires de tout le Commonwealth : Inde, Canada, Ghana, Australie, Jamaïque… Chaque bateau apportait ses récits. Lady Oblivion, l'Effaceuse aux voiles grises, a déchiré la chronique du port. Rends aux mondes anglophones leur mémoire."
	d.title = "Le Port des Couronnes"
	d.subject = "anglais"
	d.chapter_codes = ["2nde.anglais.lexique", "2nde.anglais.culture"]
	d.chapter_title = "Le lexique des axes culturels et le Commonwealth"
	d.intro = "Une brume grise couvre les quais : les noms, les dates et les mots s'effacent. Suis la piste de Lady Oblivion."
	d.enigma_generator = "2nde.anglais.frise"
	d.enigma_title = "La Chronique déchirée"
	d.enigma_intro = "La chronique du port est en lambeaux. Remets les événements dans l'ordre, du plus ancien au plus récent, pour la recoudre."
	d.enigma_xp = 50
	d.chest_xp = 130
	d.outro = "La brume se lève sur le port. Les navires du Commonwealth repartent, chargés de leurs histoires."
	d.rooms = [
		{"kind": "entree", "title": "Le Quai des Navires"},
		{"kind": "combat", "title": "L'Entrepôt des Mots", "enemies": [
			_enemy("GhostSkull", "Spectre des quais", 90, 3, 45, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "Le Marché aux Épices", "enemies": [
			_enemy("Cactoro", "Cactus des tropiques", 95, 3, 45, Vector2(8, 5)),
			_enemy("Armabee", "Guêpe des docks", 95, 3, 45, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Capitainerie"},
		{"kind": "combat", "title": "La Salle du Trône vide", "enemies": [
			_enemy("Orc", "Garde de la Couronne", 140, 4, 65, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "Le Phare d'Oblivion", "enemies": [
			_enemy("Ghost", "Lady Oblivion", 250, 5, 180, Vector2(11, 6), 1.5),
		]},
	]
	d.decor = {
		"floor": "floor_wood_large",
		"floor_accent": "floor_tile_large_rocks",
		"walls": ["wall_window_open", "wall"],
		"banners": ["banner_patternA_red", "banner_shield_red"],
		"props": [
			["barrel_large", Vector3(1.4, 0, 4.4), 0.0, 0.8],
			["crates_stacked", Vector3(2.6, 0, 1.4), 20.0, 0.9],
			["keg_decorated", Vector3(13.4, 0, 1.4), 0.0, 0.8],
			["barrel_large_decorated", Vector3(14.6, 0, 4.6), -90.0, 0.8],
			["chest_gold", Vector3(12.0, 0, 1.2), 0.0, 0.8],
		],
		"torch_color": Color(1.0, 0.72, 0.5),
	}
	return d


# --- Portes du Temps (histoire-géographie de Tom) ------------------------------------------------

static func porte_empires() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "porte_empires"
	d.boss_intro = "Je suis le Grand Censeur. Ce qui n'est pas autorisé n'a jamais existé : ni Luther, ni Galilée, ni le Bill of Rights. J'ai rayé leurs noms des registres. Tu ne liras rien que je n'aie approuvé."
	d.boss_defeat = "Mes registres… les noms reviennent, un à un. On n'efface pas une idée imprimée à mille exemplaires. Malvrek l'apprendra à ses dépens."
	d.page_text = "La page de l'Histoire moderne se remet en ordre : Athènes et Rome, Venise et les croisades, 1492, la Renaissance et les réformes, l'État royal, les Lumières. Chaque siècle retrouve sa place."
	d.map_piece = "building_castle_blue"
	d.page = "la page de l'Histoire moderne"
	d.threshold = "Une porte de pierre, plus haute que les autres, ouvre sur vingt siècles d'histoire : la Méditerranée antique, l'Atlantique de 1492, les cours royales, les salons des Lumières. Le Grand Censeur y raye les noms et brûle les registres. Rapporte la page de l'Histoire moderne avant que tout soit effacé."
	d.title = "La Porte des Empires"
	d.subject = "histoire_geo"
	d.chapter_codes = ["2nde.histoire_geo.reperes", "2nde.histoire_geo.mediterranee", "2nde.histoire_geo.monde_xvie", "2nde.histoire_geo.etat_moderne", "2nde.histoire_geo.societes"]
	d.chapter_title = "De la Méditerranée antique aux Lumières"
	d.intro = "Les registres brûlent au fond des couloirs. Traverse les siècles jusqu'au Grand Censeur."
	d.enigma_generator = "2nde.histoire_geo.frise"
	d.enigma_title = "La Frise des Siècles"
	d.enigma_intro = "Trois frises ont été brouillées par le Censeur. Rends à chaque événement sa place, du plus ancien au plus récent."
	d.enigma_xp = 50
	d.chest_xp = 130
	d.outro = "Les registres se referment, intacts. Les siècles se suivent de nouveau dans le bon ordre."
	d.rooms = [
		{"kind": "entree", "title": "Le Portique"},
		{"kind": "combat", "title": "L'Agora", "enemies": [
			_enemy("Skeleton_Warrior", "Hoplite d'os", 85, 2, 40, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "Le Quai de Séville", "enemies": [
			_enemy("Skeleton_Rogue", "Conquistador d'os", 90, 3, 45, Vector2(8, 5)),
			_enemy("GhostSkull", "Spectre des galions", 85, 2, 45, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Salle des Registres"},
		{"kind": "combat", "title": "La Galerie des Glaces", "enemies": [
			_enemy("GolelingEvolved", "Golem de cour", 130, 4, 60, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "Le Cabinet du Censeur", "enemies": [
			_enemy("Demon", "Le Grand Censeur", 240, 5, 170, Vector2(11, 6), 1.2),
		]},
	]
	d.decor = {
		"floor": "floor_tile_large",
		"floor_accent": "floor_wood_large_dark",
		"walls": ["wall_shelves", "wall_arched"],
		"banners": ["banner_patternC_blue", "banner_patternA_blue"],
		"props": [
			["column", Vector3(1.4, 0, 4.0), 0.0, 0.6],
			["shelf_large", Vector3(2.4, 0, 1.4), 0.0, 0.9],
			["candle_triple", Vector3(13.2, 0, 1.0), 0.0, 0.3],
			["table_long_decorated_A", Vector3(14.4, 0, 4.4), 90.0, 0.9],
		],
		"torch_color": Color(0.7, 0.8, 1.0),
	}
	return d


static func porte_transitions() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "porte_transitions"
	d.boss_intro = "Je suis l'Arpenteur Aveugle. Je mesure le monde sans le voir : un désert vaut une métropole, un pays riche un pays pauvre. Tes cartes, je les ai effacées. Dis-moi donc où tu vas."
	d.boss_defeat = "Mes instruments… se règlent à nouveau. Les écarts, les flux, les risques réapparaissent sur la carte. Elle n'était pas si simple, finalement."
	d.page_text = "La page de la Géographie du monde se redessine : risques et ressources, populations et inégalités, migrations et tourisme, l'Afrique australe en mutation. Le monde en transition retrouve ses contrastes."
	d.map_piece = "building_market_yellow"
	d.page = "la page de la Géographie du monde"
	d.threshold = "La porte suivante ne s'ouvre pas sur le passé, mais sur le monde d'aujourd'hui : des littoraux menacés, des villes qui grandissent, des routes de migrants, des parcs de safari. L'Arpenteur Aveugle a effacé les écarts et les flux de toutes les cartes. Rapporte la page de la Géographie du monde."
	d.title = "La Porte des Transitions"
	d.subject = "histoire_geo"
	d.chapter_codes = ["2nde.histoire_geo.environnements", "2nde.histoire_geo.developpement", "2nde.histoire_geo.mobilites", "2nde.histoire_geo.afrique_australe"]
	d.chapter_title = "Environnements, développement, mobilités, Afrique australe"
	d.intro = "Les cartes sont vierges, les boussoles affolées. Traverse ce monde en transition jusqu'à l'Arpenteur."
	d.enigma_generator = "2nde.histoire_geo.idh"
	d.enigma_title = "L'Échelle du développement"
	d.enigma_intro = "Trois échelles ont été renversées. Classe chaque groupe de pays de l'IDH le plus élevé au plus faible."
	d.enigma_xp = 50
	d.chest_xp = 130
	d.outro = "Sur chaque carte, les contrastes du monde réapparaissent. La porte se referme sans bruit."
	d.rooms = [
		{"kind": "entree", "title": "Le Seuil du Monde"},
		{"kind": "combat", "title": "Le Delta inondé", "enemies": [
			_enemy("GreenBlob", "Gelée des crues", 85, 2, 40, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "La Mégapole", "enemies": [
			_enemy("Goleling", "Golem de béton", 95, 3, 45, Vector2(8, 5)),
			_enemy("Armabee", "Guêpe des embouteillages", 90, 3, 45, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Salle des Échelles"},
		{"kind": "combat", "title": "La Savane du Kalahari", "enemies": [
			_enemy("Cactoro", "Cactus du Kalahari", 130, 4, 60, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "L'Observatoire", "enemies": [
			_enemy("Yeti", "L'Arpenteur Aveugle", 240, 5, 170, Vector2(11, 6), 1.3),
		]},
	]
	d.decor = {
		"floor": "floor_dirt_large",
		"floor_accent": "floor_tile_large_rocks",
		"walls": ["wall_window_open", "wall"],
		"banners": ["banner_patternB_yellow", "banner_patternB_green"],
		"props": [
			["barrel_large", Vector3(1.6, 0, 4.0), 0.0, 0.8],
			["crates_stacked", Vector3(2.6, 0, 1.4), -15.0, 0.9],
			["table_medium_decorated_A", Vector3(12.0, 0, 1.6), 0.0, 0.9],
			["trunk_large_A", Vector3(14.6, 0, 4.6), -90.0, 0.8],
		],
		"torch_color": Color(1.0, 0.85, 0.55),
	}
	return d


# --- Laboratoire des Inventeurs (physique-chimie de Tom) ---------------------------------------

static func alambic_elements() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "alambic_elements"
	d.boss_intro = "Je suis le Dissolveur. Tout se dissout dans mon creuset : les atomes perdent leurs électrons, les équations leurs coefficients, les noyaux leurs neutrons. Ta page de la Matière ? Une flaque, rien de plus."
	d.boss_defeat = "Mon creuset… refroidit. Les éléments se reforment, chacun à sa place dans le tableau. Rien ne se perd, rien ne se crée : même pas ma défaite."
	d.page_text = "La page de la Matière se recompose : corps purs et solutions, atomes et noyaux, ions et molécules, équations bien ajustées. Chaque élément a retrouvé sa case."
	d.map_piece = "building_tower_A_blue"
	d.page = "la page de la Matière"
	d.threshold = "Au Laboratoire des Inventeurs, une tour de verre bleu bouillonne jour et nuit : l'Alambic des Éléments. On y pesait, dissolvait et transformait la matière avec soin. Le Dissolveur a tout fait fondre dans son creuset. Rapporte la page de la Matière avant qu'il ne reste plus qu'une flaque."
	d.title = "L'Alambic des Éléments"
	d.subject = "physique_chimie"
	d.chapter_codes = ["2nde.physique_chimie.matiere", "2nde.physique_chimie.atome", "2nde.physique_chimie.transformations"]
	d.chapter_title = "La matière, l'atome et les transformations"
	d.intro = "Des vapeurs colorées montent des fioles. Grimpe jusqu'au creuset du Dissolveur."
	d.enigma_generator = "2nde.physique_chimie.echelles"
	d.enigma_title = "Les Échelles du monde"
	d.enigma_intro = "Le Dissolveur a brouillé trois étagères de spécimens. Range chaque série du plus petit au plus grand, du noyau d'atome aux galaxies."
	d.enigma_xp = 50
	d.chest_xp = 130
	d.outro = "Les fioles se referment, étiquetées. La matière a retrouvé ses règles."
	d.rooms = [
		{"kind": "entree", "title": "Le Vestibule des Fioles"},
		{"kind": "combat", "title": "La Salle des Mélanges", "enemies": [
			_enemy("GreenBlob", "Gelée de soluté", 85, 2, 40, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "Le Cabinet des Atomes", "enemies": [
			_enemy("Ghost", "Électron égaré", 85, 2, 45, Vector2(8, 5)),
			_enemy("Mushnub", "Spore isotope", 90, 3, 45, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Salle des Échelles"},
		{"kind": "combat", "title": "La Distillerie", "enemies": [
			_enemy("GolelingEvolved", "Golem de cristal", 130, 4, 60, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "Le Creuset", "enemies": [
			_enemy("GreenBlob", "Le Dissolveur", 240, 5, 170, Vector2(11, 6), 1.8),
		]},
	]
	d.decor = {
		"floor": "floor_tile_large",
		"floor_accent": "floor_wood_large_dark",
		"walls": ["wall_shelves", "wall_arched"],
		"banners": ["banner_patternA_blue", "banner_patternC_white"],
		"props": [
			["table_long_decorated_A", Vector3(2.4, 0, 1.4), 0.0, 1.0],
			["shelf_small_candles", Vector3(1.4, 0, 4.0), 90.0, 0.6],
			["candle_triple", Vector3(13.2, 0, 1.0), 0.0, 0.3],
			["barrel_large", Vector3(14.4, 0, 4.4), 0.0, 0.8],
		],
		"torch_color": Color(0.6, 0.85, 1.0),
	}
	return d


static func laboratoire_foudroye() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "laboratoire_foudroye"
	d.boss_intro = "Je suis le Brouilleur. J'ai mis du bruit dans tes signaux, du flou dans tes lentilles et du désordre dans tes forces. Ici, plus rien n'avance droit, plus rien ne sonne juste. Écoute bien… si tu peux."
	d.boss_defeat = "Le silence… puis un son pur. Mes parasites s'éteignent un à un. Tes ondes et tes forces obéissent de nouveau aux lois. Je n'aurais jamais dû défier un Archiviste qui calcule."
	d.page_text = "La page des Ondes et des Forces se rallume : mouvements et vitesses, forces et inertie, sons et lumière, circuits et capteurs. Le laboratoire bourdonne de nouveau, juste et précis."
	d.map_piece = "building_destroyed"
	d.page = "la page des Ondes et des Forces"
	d.threshold = "Plus loin, le Laboratoire foudroyé fume encore. Ici, on étudiait les mouvements, les forces, le son, la lumière et l'électricité. Le Brouilleur l'a frappé d'un éclair : les instruments mentent, les diapasons sonnent faux. Rapporte la page des Ondes et des Forces."
	d.title = "Le Laboratoire foudroyé"
	d.subject = "physique_chimie"
	d.chapter_codes = ["2nde.physique_chimie.mouvement", "2nde.physique_chimie.interactions", "2nde.physique_chimie.son", "2nde.physique_chimie.lumiere", "2nde.physique_chimie.circuits"]
	d.chapter_title = "Mouvements, forces, son, lumière et circuits"
	d.intro = "Des étincelles courent sur les murs, un bourdonnement emplit l'air. Monte jusqu'au tableau électrique du Brouilleur."
	d.enigma_generator = "2nde.physique_chimie.sons"
	d.enigma_title = "La Salle des Diapasons"
	d.enigma_intro = "Le Brouilleur a mélangé trois séries de diapasons. Calcule leurs fréquences et range chaque série du plus grave au plus aigu."
	d.enigma_xp = 50
	d.chest_xp = 130
	d.outro = "Le bourdonnement s'apaise. Chaque instrument du laboratoire mesure de nouveau juste."
	d.rooms = [
		{"kind": "entree", "title": "Le Hall foudroyé"},
		{"kind": "combat", "title": "La Piste des Chronophotographies", "enemies": [
			_enemy("Armabee", "Guêpe-chrono", 85, 2, 40, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "La Salle des Forces", "enemies": [
			_enemy("Goleling", "Golem d'inertie", 95, 3, 45, Vector2(8, 5)),
			_enemy("Cactoro", "Cactus à ressort", 90, 3, 45, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Salle des Diapasons"},
		{"kind": "combat", "title": "La Chambre noire", "enemies": [
			_enemy("GhostSkull", "Spectre des rayons", 130, 4, 60, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "Le Tableau électrique", "enemies": [
			_enemy("Skeleton_Mage", "Le Brouilleur", 240, 5, 170, Vector2(11, 6), 1.45),
		]},
	]
	d.decor = {
		"floor": "floor_dirt_large",
		"floor_accent": "floor_tile_large_rocks",
		"walls": ["wall_window_open", "wall"],
		"banners": ["banner_patternB_yellow", "banner_patternA_blue"],
		"props": [
			["crates_stacked", Vector3(2.6, 0, 1.4), -15.0, 0.9],
			["table_medium_decorated_A", Vector3(1.6, 0, 4.0), 90.0, 0.9],
			["trunk_large_A", Vector3(13.6, 0, 1.4), 0.0, 0.8],
			["barrel_large", Vector3(14.6, 0, 4.6), 0.0, 0.8],
		],
		"torch_color": Color(0.85, 0.9, 1.0),
	}
	return d


# --- Carrefour des Messagers (SNT de Tom) ---------------------------------------------------------

static func pont_paquets() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "pont_paquets"
	d.boss_intro = "Je suis le Crieur Menteur ! Je mélange les paquets, j'envoie les messages au mauvais destinataire et je répands des rumeurs plus vite que la vérité. Ta page des Messages ? Je l'ai partagée… à l'envers."
	d.boss_defeat = "Mes rumeurs… plus personne ne les relaie. Chaque paquet retrouve son adresse, chaque page son lien. La vérité arrive toujours, même par un chemin plus long."
	d.page_text = "La page des Messages se recompose : paquets et routeurs, adresses et noms de domaine, pages et liens, réseaux d'amis et tables de données. Chaque message arrive enfin à bon port."
	d.map_piece = "building_bridge_A"
	d.page = "la page des Messages"
	d.threshold = "Sur la côte sud, au Carrefour des Messagers, un pont relie les relais où passent tous les messages du royaume. Le Crieur Menteur s'y est installé : les paquets s'égarent, les liens mènent nulle part, les rumeurs courent. Rapporte la page des Messages et remets le réseau en ordre."
	d.title = "Le Pont des Paquets"
	d.subject = "snt"
	d.chapter_codes = ["2nde.snt.internet", "2nde.snt.web", "2nde.snt.reseaux_sociaux", "2nde.snt.donnees"]
	d.chapter_title = "Internet, le Web, les réseaux sociaux et les données"
	d.intro = "Des messages perdus volent dans les couloirs. Remonte jusqu'à la tour du Crieur Menteur."
	d.enigma_generator = "2nde.snt.requete"
	d.enigma_title = "Les Étapes du message"
	d.enigma_intro = "Le Crieur Menteur a mélangé trois parcours de messages. Remets chaque étape à sa place, de la première à la dernière."
	d.enigma_xp = 50
	d.chest_xp = 130
	d.outro = "Les relais se rallument un à un : chaque message suit de nouveau son chemin."
	d.rooms = [
		{"kind": "entree", "title": "Le Relais du Pont"},
		{"kind": "combat", "title": "La Salle des Routeurs", "enemies": [
			_enemy("Armabee", "Paquet égaré", 85, 2, 40, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "La Galerie des Liens", "enemies": [
			_enemy("Ghost", "Lien brisé", 85, 2, 45, Vector2(8, 5)),
			_enemy("Mushnub", "Rumeur rampante", 90, 3, 45, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Salle des Étapes"},
		{"kind": "combat", "title": "Les Archives des Données", "enemies": [
			_enemy("GolelingEvolved", "Golem des tables", 130, 4, 60, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "La Tour du Crieur", "enemies": [
			_enemy("Orc", "Le Crieur Menteur", 240, 5, 170, Vector2(11, 6), 1.4),
		]},
	]
	d.decor = {
		"floor": "floor_wood_large",
		"floor_accent": "floor_tile_large",
		"walls": ["wall_window_open", "wall_shelves"],
		"banners": ["banner_patternA_blue", "banner_patternB_yellow"],
		"props": [
			["crates_stacked", Vector3(2.6, 0, 1.4), -15.0, 0.9],
			["table_long_decorated_A", Vector3(1.6, 0, 4.2), 90.0, 0.9],
			["barrel_large", Vector3(13.6, 0, 1.4), 0.0, 0.8],
			["candle_triple", Vector3(14.6, 0, 4.4), 0.0, 0.3],
		],
		"torch_color": Color(1.0, 0.85, 0.6),
	}
	return d


static func atelier_automates() -> DungeonDef:
	var d := DungeonDef.new()
	d.code = "atelier_automates"
	d.boss_intro = "Je suis le Détraqueur. J'ai embrouillé les cartes, faussé les capteurs, mélangé les pixels et glissé des erreurs dans chaque programme. Tes automates tournent en rond. Et toi, sauras-tu retrouver ton chemin ?"
	d.boss_defeat = "Mes rouages… se remettent à tourner rond. Les cartes indiquent le bon chemin, les capteurs mesurent juste, les programmes s'exécutent sans erreur. Bien calculé, Archiviste."
	d.page_text = "La page des Automates se rallume : satellites et cartes, itinéraires, pixels et couleurs, capteurs et actionneurs, programmes bien écrits. Les machines de l'atelier obéissent de nouveau."
	d.map_piece = "building_home_B_yellow"
	d.page = "la page des Automates"
	d.threshold = "Un peu plus loin sur la côte, l'Atelier des Automates cliquette jour et nuit : on y dessine les cartes, on y développe les images et on y programme des machines. Le Détraqueur a tout déréglé. Rapporte la page des Automates."
	d.title = "L'Atelier des Automates"
	d.subject = "snt"
	d.chapter_codes = ["2nde.snt.localisation", "2nde.snt.photo", "2nde.snt.objets", "2nde.snt.programmation"]
	d.chapter_title = "Cartes, photos, objets connectés et programmation"
	d.intro = "Les automates s'agitent sans but. Traverse l'atelier jusqu'à l'établi du Détraqueur."
	d.enigma_generator = "2nde.snt.destinations"
	d.enigma_title = "Les Panneaux de l'Atelier"
	d.enigma_intro = "Le Détraqueur a mélangé les panneaux de trois carrefours. Calcule les plus courts chemins et range les villes de la plus proche à la plus lointaine."
	d.enigma_xp = 50
	d.chest_xp = 130
	d.outro = "Le cliquetis s'apaise : chaque automate a retrouvé son programme."
	d.rooms = [
		{"kind": "entree", "title": "L'Établi d'entrée"},
		{"kind": "combat", "title": "La Salle des Cartes", "enemies": [
			_enemy("Goleling", "Golem boussole", 85, 2, 40, Vector2(11, 7)),
		]},
		{"kind": "combat", "title": "Le Laboratoire photo", "enemies": [
			_enemy("GhostSkull", "Spectre pixelisé", 90, 3, 45, Vector2(8, 5)),
			_enemy("Cactoro", "Cactus à capteurs", 90, 3, 45, Vector2(10.5, 14)),
		]},
		{"kind": "enigme", "title": "La Salle des Panneaux"},
		{"kind": "combat", "title": "L'Atelier des Programmes", "enemies": [
			_enemy("MushnubEvolved", "Champignon en boucle", 130, 4, 60, Vector2(11, 7)),
		]},
		{"kind": "boss", "title": "L'Établi du Détraqueur", "enemies": [
			_enemy("GolelingEvolved", "Le Détraqueur", 240, 5, 170, Vector2(11, 6), 1.45),
		]},
	]
	d.decor = {
		"floor": "floor_wood_large_dark",
		"floor_accent": "floor_tile_large",
		"walls": ["wall_shelves", "wall"],
		"banners": ["banner_patternC_white", "banner_patternB_green"],
		"props": [
			["table_medium_decorated_A", Vector3(2.4, 0, 1.4), 0.0, 0.9],
			["shelf_small_candles", Vector3(1.4, 0, 4.0), 90.0, 0.6],
			["trunk_large_A", Vector3(13.6, 0, 1.4), 0.0, 0.8],
			["crates_stacked", Vector3(14.6, 0, 4.4), -20.0, 0.9],
		],
		"torch_color": Color(1.0, 0.9, 0.7),
	}
	return d


static func _enemy(model: String, name_text: String, hp: int, tier: int, xp: int, at: Vector2, scale := 1.0) -> Dictionary:
	return {"model": model, "name": name_text, "hp": hp, "tier": tier, "xp": xp, "at": at, "scale": scale}
