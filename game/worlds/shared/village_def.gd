class_name VillageDef
extends Resource
## Le village d'un monde (IMPLEMENTATION_PLAN, phase 3) : une halle en deux salles et
## ses habitants. Chacun confie une quête de trois questions par jour :
## - `revision` : notions à revoir (révision espacée, catégorie « revision » du paquet) ;
## - `veille` : chapitre « contrôle bientôt » marqué par le parent, sinon chapitre en cours ;
## - `enquete` : trois questions sur un même document (générateur `generator`).
## Le gameplay ne connaît pas les questions : il transmet `session_params()` au serveur.
##
## Habitant : {code, name, model, room, at: Vector2 (mètres depuis le coin nord-ouest de
## la salle), quest, generator, title (de la quête), ask, thanks}.

const QUEST_SIZE := 3
const QUEST_XP := 50
const ANSWER_XP := 10

@export var code := ""
@export var title := ""
@export var intro := ""
@export var rooms: Array[Dictionary] = []
@export var npcs: Array[Dictionary] = []
@export var decor: Dictionary = {}


## Village d'une classe (ses enquêtes en dépendent) ; null si la classe n'en a pas encore.
static func for_level(level: String) -> VillageDef:
	match level:
		"6e":
			return clairval()
		"2nde":
			return brumegarde()
	return null


## Paramètres de `POST /play/session/start` : les enquêtes, deux quêtes d'avance chacune.
func session_params() -> Dictionary:
	var enigmas: Array = []
	for npc in npcs:
		if npc["quest"] == "enquete":
			enigmas.append({"generator": npc["generator"], "count": QUEST_SIZE * 2})
	return {"enigmas": enigmas}


func room_count() -> int:
	return rooms.size()


## Habitants qui attendent encore de l'aide ce jour-là (affiché au camp).
func pending_quests(day: String) -> int:
	return npcs.filter(func(npc: Dictionary) -> bool: return not SaveManager.quest_done(npc["code"], day)).size()


static func clairval() -> VillageDef:
	var v := VillageDef.new()
	v.code = "clairval"
	v.title = "Clairval"
	v.intro = "Les habitants de Clairval sentent le Brouillard leur grignoter la mémoire. Parle-leur : chacun a besoin d'un coup de main aujourd'hui."
	v.rooms = [{"title": "La Halle de Clairval"}, {"title": "La Rue des Artisans"}]
	v.npcs = [
		{
			"code": "barnabe", "name": "Barnabé le forgeron", "model": "Barbarian", "room": 0, "at": Vector2(6, 6),
			"quest": "revision", "title": "Les souvenirs du forgeron",
			"ask": "Ah, Archiviste ! Le Brouillard m'a embrouillé la tête : j'ai oublié des choses que tu as apprises il y a quelque temps. Tu m'aides à m'en souvenir ?",
			"thanks": "Tout me revient ! Tu as une sacrée mémoire. Tiens, pour ta peine.",
		},
		{
			"code": "melisande", "name": "Mélisande la cartographe", "model": "Rogue", "room": 0, "at": Vector2(11.5, 13),
			"quest": "enquete", "generator": "6e.proportionnalite.carte", "title": "Les cartes de Mélisande",
			"ask": "Mes cartes sont justes, mais j'ai perdu toutes mes notes de distances ! Tu peux les retrouver avec l'échelle ?",
			"thanks": "Parfait, mes voyageurs ne se perdront plus. Merci, Archiviste !",
		},
		{
			"code": "oriel", "name": "Maître Oriel", "model": "Mage", "room": 1, "at": Vector2(9, 7),
			"quest": "veille", "title": "Les leçons de Maître Oriel",
			"ask": "Approche, jeune Archiviste. Entraînons-nous sur ce que tu travailles en classe.",
			"thanks": "Très bien. Ton esprit est clair : le Brouillard ne t'atteindra pas.",
		},
	]
	v.decor = {
		"floor": "floor_wood_large",
		"floor_accent": "floor_wood_large_dark",
		"banners": ["banner_patternB_yellow", "banner_patternB_green"],
		"props": [
			["table_long_decorated_A", Vector3(1.4, 0, 4.2), 90.0, 1.2],
			["barrel_large", Vector3(3.2, 0, 1.4), 0.0, 0.8],
			["coin_stack_large", Vector3(13.0, 0, 1.1), 0.0, 0.5],
			["crates_stacked", Vector3(14.6, 0, 5.2), 90.0, 0.9],
		],
		"torch_color": Color(1.0, 0.78, 0.45),
	}
	return v


static func brumegarde() -> VillageDef:
	var v := VillageDef.new()
	v.code = "brumegarde"
	v.title = "Brumegarde"
	v.intro = "Brumegarde tient bon face au Brouillard, mais ses habitants ont besoin d'un esprit vif. Écoute leurs demandes."
	v.rooms = [{"title": "Le Quartier de la Garde"}, {"title": "La Cour des Archives"}]
	v.npcs = [
		{
			"code": "aldric", "name": "Aldric, sergent de la garde", "model": "Barbarian", "room": 0, "at": Vector2(6, 6),
			"quest": "revision", "title": "La mémoire du sergent",
			"ask": "Le Brouillard ronge mes souvenirs, Archiviste. Rappelle-moi ce que tu as appris ces dernières semaines.",
			"thanks": "Voilà qui est net. La garde te doit une fière chandelle.",
		},
		{
			"code": "vesna", "name": "Vesna l'inspectrice", "model": "Rogue", "room": 0, "at": Vector2(11.5, 13),
			"quest": "enquete", "generator": "2nde.statistiques.enquete", "title": "L'enquête de Vesna",
			"ask": "J'ai fait un relevé auprès des habitants. Aide-moi à l'analyser : effectifs, fréquences, moyenne, médiane…",
			"thanks": "Tes calculs confirment mes soupçons. Beau travail d'enquête.",
		},
		{
			"code": "brann", "name": "Le capitaine Brann", "model": "Knight", "room": 1, "at": Vector2(5, 13),
			"quest": "enquete", "generator": "2nde.probabilites.enquete", "title": "Le registre du capitaine",
			"ask": "Mon registre croise deux informations sur chacun. Dis-moi quelles sont les chances de tomber sur tel ou tel profil.",
			"thanks": "Avec ces probabilités, je saurai où poster mes hommes. Merci.",
		},
		{
			"code": "isaure", "name": "Isaure l'archiviste", "model": "Mage", "room": 1, "at": Vector2(11, 6),
			"quest": "veille", "title": "Les révisions d'Isaure",
			"ask": "Tu sembles préoccupé. Reprenons ensemble le chapitre que tu travailles en ce moment.",
			"thanks": "Tu maîtrises. Garde cette rigueur, elle repousse le Brouillard.",
		},
	]
	v.decor = {
		"banners": ["banner_shield_red", "banner_patternC_white"],
		"walls": ["wall_window_open", "wall_arched"],
		"props": [
			["shelves", Vector3(1.3, 0, 4.2), 90.0, 0.8],
			["barrel_large_decorated", Vector3(1.8, 0, 1.6), 0.0, 0.8],
			["sword_shield", Vector3(3.4, 0, 1.0), 0.0, 0.6],
			["trunk_large_A", Vector3(14.4, 0, 1.6), -15.0, 0.9],
			["shelf_small_candles", Vector3(14.8, 0, 5.0), -90.0, 0.6],
		],
		"torch_color": Color(0.7, 0.82, 1.0),
	}
	return v
