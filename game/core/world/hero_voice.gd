class_name HeroVoice
extends RefCounted
## Le héros parle en passant de salle en salle (souhait des enfants) : un encouragement,
## un indice sur la salle suivante (combat, énigme, boss) et le chemin qui reste.
## Les phrases se combinent (début × indice × progression) et les dernières dites ne
## reviennent pas : `MEMORY` phrases récentes gardées sur l'appareil, d'une partie à l'autre.
## Ton du monde : enjoué dans le monde lumineux, sobre dans le Brouillard.

const HISTORY_FILE := "user://hero_voice.json"
const MEMORY := 24

const LINES := {
	"lumineux": {
		"start": [
			"C'est parti pour l'aventure !", "Allez, courage !", "Je suis prêt. Enfin… presque !",
			"Cette fois, je vais tout réussir.", "Respire… et en avant !", "Bon, par où commencer ?",
			"Mes leçons sont dans ma tête, mon épée dans ma main !",
		],
		"cleared": [
			"Et une salle de plus !", "On avance bien !", "Ça, c'est fait !", "Pas mal du tout !",
			"Je me sens plus fort à chaque pas.", "Les Archives seraient fières de moi.",
			"Hop, la porte est ouverte !", "Mes leçons me servent vraiment.", "Je progresse, je le sens.",
			"Allez, on continue !", "Rien ne m'arrête aujourd'hui.", "Je n'ai même pas tremblé !",
			"Encore un mystère résolu.", "Quelle équipe on fait !", "Youpi, la voie est libre !",
		],
		"combat": [
			"J'entends des os qui craquent derrière la porte.", "Je vois une ombre bouger plus loin.",
			"Quelqu'un garde la salle suivante. Il n'a pas l'air commode.",
			"Il y a du bruit plus loin : un combat se prépare.", "Garde un sort sous le coude : on va se battre.",
			"Un ennemi rôde. Mes meilleures réponses vont servir !",
		],
		"enigme": [
			"Plus loin, une énigme. Ici, personne ne me presse.",
			"La prochaine salle cache un mystère à résoudre.",
			"Pas d'ennemi devant, mais un casse-tête !", "Une énigme m'attend. Je peux demander un indice.",
			"On dirait une salle à énigme. Je vais bien réfléchir.",
		],
		"boss": [
			"Derrière cette porte, c'est le boss. Je connais tout ça !",
			"Dernière salle. Je respire un grand coup.",
			"Le chef des lieux m'attend. Pas de panique : une question à la fois.",
			"C'est le grand combat. Je suis prêt !", "Le boss est tout proche. Je vais lui montrer ce que je sais.",
		],
		"left": ["Encore %d salles avant le boss.", "Il reste %d salles à traverser.", "Plus que %d salles jusqu'au bout !"],
	},
	"brouillard": {
		"start": [
			"Bon. Allons-y.", "Le Brouillard ne m'impressionne pas.", "Concentration.",
			"Une salle après l'autre.", "Je connais la méthode. Avançons.",
		],
		"cleared": [
			"Une de moins.", "Le Brouillard recule.", "Propre.", "Ça avance.", "Méthodique. Efficace.",
			"Archive suivante.", "Je garde le rythme.", "Rien d'insurmontable.", "Proprement réglé.",
			"La lumière revient, peu à peu.",
		],
		"combat": [
			"Des pas derrière la porte. Il va falloir se battre.", "Une silhouette dans le Brouillard. Combat en vue.",
			"Ça bouge plus loin. Prépare tes arcanes.", "Quelqu'un garde la salle suivante.",
		],
		"enigme": [
			"Une énigme plus loin. Aucun chrono : je prends mon temps.", "Salle suivante : un mécanisme à comprendre.",
			"Pas d'ennemi devant. Un problème à résoudre.", "Un sceau plus loin. Réfléchir avant d'agir.",
		],
		"boss": [
			"Dernière porte. Le maître des lieux m'attend.", "Le boss est là. Une question à la fois.",
			"Fin du parcours. Tout ce que je sais va servir.", "Le cœur du donjon. Calme et précision.",
		],
		"left": ["Encore %d salles.", "%d salles avant le cœur du donjon.", "Il en reste %d."],
	},
}

static var _recent: Array = []
static var _loaded := false


## Ce que dit le héros en abordant la salle `next` (index dans `rooms`) ; `start` : au départ
## du donjon plutôt qu'après une salle franchie. Vide s'il n'y a plus de salle.
static func before_room(world: String, rooms: Array, next: int, start := false) -> String:
	if next < 0 or next >= rooms.size():
		return ""
	var bank: Dictionary = LINES.get(world, LINES["lumineux"])
	var kind := str(rooms[next].get("kind", "combat"))
	var parts := [pick(bank["start"] if start else bank["cleared"])]
	if bank.has(kind):
		parts.append(pick(bank[kind]))
	var boss := -1
	for i in rooms.size():
		if str(rooms[i].get("kind", "")) == "boss":
			boss = i
	var left := boss - next
	if kind != "boss" and left > 1:
		parts.append(pick(bank["left"]) % left)
	return " ".join(parts)


## Une phrase de la liste, jamais parmi les dernières dites (si la liste le permet).
static func pick(options: Array) -> String:
	_load()
	var fresh := options.filter(func(o: String) -> bool: return not o in _recent)
	var chosen: String = (fresh if not fresh.is_empty() else options).pick_random()
	_recent.append(chosen)
	while _recent.size() > MEMORY:
		_recent.pop_front()
	_save()
	return chosen


static func _load() -> void:
	if _loaded:
		return
	_loaded = true
	if FileAccess.file_exists(HISTORY_FILE):
		var stored: Variant = JSON.parse_string(FileAccess.get_file_as_string(HISTORY_FILE))
		if stored is Array:
			_recent = stored


static func _save() -> void:
	var file := FileAccess.open(HISTORY_FILE, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(_recent))
