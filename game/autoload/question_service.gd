extends Node
## Choix des questions et validation (TRD §2.3 : le gameplay ne connaît jamais le
## contenu d'une question). Une scène demande un item pour un rôle
## (« automatisme » = Frappe, « chapitre » = Sort), l'affiche, puis appelle `submit`.
##
## Difficulté adaptative : départ au niveau suggéré par le serveur (maîtrise et
## taux de réussite récent), puis +1 après 2 réussites d'affilée au même niveau,
## −1 après une erreur.
## Une notion ratée revient 2 questions plus tard sous une autre forme (PRD §6).
## Clic au hasard (TRD §5.4) : 3 erreurs de suite en moins de 25 % du temps cible
## réduisent les gains des 5 questions suivantes, sans message.

const RETRY_AFTER := 2
const RUSH_WINDOW := 3
const RUSH_RATIO := 0.25
const RUSH_PENALTY_QUESTIONS := 5

var _level := {"automatisme": 1, "chapitre": 1}
var _streak := {"automatisme": 0, "chapitre": 0}
var _used: Dictionary = {}
var _retry: Array = []  # [{notion, due_in}]
var _rush_streak := 0
var _penalty_left := 0
var answered := 0
var correct_count := 0
var _last_input := {}  # dernière réponse donnée : {id, text} (signalement d'une erreur)


func reset() -> void:
	# Aménagement « départ plus doux » : un cran sous le niveau proposé par le serveur.
	var easier := 1 if Accessibility.on("easy_start") else 0
	_level = {
		"automatisme": maxi(1, int(Session.start_levels.get("automatisme", 1)) - easier),
		"chapitre": maxi(1, int(Session.start_levels.get("chapitre", 1)) - easier),
	}
	_streak = {"automatisme": 0, "chapitre": 0}
	_used.clear()
	_retry.clear()
	_rush_streak = 0
	_penalty_left = 0
	answered = 0
	correct_count = 0


func level_for(role: String) -> int:
	return _level.get(role, 1)


## Prochain item pour un rôle (ou n'importe lequel si `role` est vide).
## `level` impose la difficulté visée (montée en puissance du boss) au lieu du
## niveau adaptatif. Rôle « enigme » : items de l'énigme du donjon, dans l'ordre
## du paquet (difficulté croissante).
func next_item(role := "", level := 0) -> Dictionary:
	var all_of_role: Array = Session.items.filter(func(it: Dictionary) -> bool:
		return role == "" or it["role"] == role)
	if all_of_role.is_empty() and role == "automatisme":
		# Matière sans automatismes (donjon d'anglais) : la frappe rapide prend une question
		# du chapitre, un cran plus facile.
		return next_item("chapitre", level if level > 0 else maxi(1, level_for("chapitre") - 1))
	var pool: Array = all_of_role.filter(func(it: Dictionary) -> bool: return not _used.has(it["id"]))
	if pool.is_empty():
		# Paquet épuisé pour ce rôle : on recommence (les items sont nombreux et variés).
		for it in all_of_role:
			_used.erase(it["id"])
		pool = all_of_role
	if pool.is_empty():
		return {}
	if role == "enigme":
		return _take(pool[0])
	# Une notion ratée revient, sous une autre forme, quand son tour arrive.
	for entry in _retry:
		if entry.due_in <= 0:
			var again := pool.filter(func(it: Dictionary) -> bool: return entry.notion in it["notions"])
			if again.is_empty():
				# Plus de question inédite sur cette notion dans le paquet : une autre déjà
				# posée fait l'affaire, jamais celle qui vient d'être ratée.
				again = all_of_role.filter(func(it: Dictionary) -> bool:
					return entry.notion in it["notions"] and it["id"] != entry.item_id)
			if not again.is_empty():
				_retry.erase(entry)
				return _take(_closest(again, level if level > 0 else level_for(role)))
	if level <= 0:
		level = level_for(role) if role != "" else 1
	return _take(_closest(pool, level))


## Quêtes du village (VillageDef) : `enquete` = items d'énigme du générateur, dans
## l'ordre du paquet (trois questions sur un même document) ; `revision` = notions à
## revoir (catégorie « revision »), sinon chapitre ; `veille` = questions des chapitres
## donnés, sinon chapitre. Paquet épuisé : on recommence.
func next_quest_item(quest: String, generator := "", chapters: Array = []) -> Dictionary:
	var matching: Callable
	match quest:
		"enquete":
			matching = func(it: Dictionary) -> bool:
				return it["role"] == "enigme" and it.get("generator", "") == generator
		"revision":
			matching = func(it: Dictionary) -> bool: return it.get("category", "") == "revision"
		_:
			matching = func(it: Dictionary) -> bool:
				var chapter: String = str(it["notions"][0]).rsplit(".", true, 1)[0]
				return it.get("category", "") == "chapitre" and chapter in chapters
	var candidates: Array = Session.items.filter(matching)
	if candidates.is_empty() and quest != "enquete":
		candidates = Session.items.filter(func(it: Dictionary) -> bool:
			return it.get("category", "") == "chapitre")
	if candidates.is_empty():
		return {}
	var pool: Array = candidates.filter(func(it: Dictionary) -> bool: return not _used.has(it["id"]))
	if pool.is_empty():
		for it in candidates:
			_used.erase(it["id"])
		pool = candidates
	if quest == "enquete":
		return _take(pool[0])
	return _take(_closest(pool, level_for("chapitre")))


## Valide la réponse, ajuste la difficulté et enregistre la tentative.
## Renvoie {correct, speed_ratio (temps / temps cible), reward_factor, explanation}.
func submit(item: Dictionary, user_input: Variant, time_ms: int, hint_used: bool, game_mode := "combat") -> Dictionary:
	var correct := AnswerChecker.check(item["answer"], user_input)
	_last_input = {
		"id": item.get("id", ""),
		"text": JSON.stringify(user_input) if user_input is Dictionary or user_input is Array else str(user_input),
	}
	var role: String = item["role"]
	var target := maxf(1.0, float(item.get("time_target_ms", 20000)))
	var speed_ratio := time_ms / target
	answered += 1
	for entry in _retry:
		entry.due_in -= 1

	var adaptive := _level.has(role)  # les énigmes ont leur propre progression
	if correct:
		correct_count += 1
		if adaptive:
			_streak[role] += 1
			if _streak[role] >= 2 and int(item["difficulty"]) >= _level[role]:
				_level[role] = mini(5, _level[role] + 1)
				_streak[role] = 0
		_rush_streak = 0
	else:
		if adaptive:
			_streak[role] = 0
			_level[role] = maxi(1, _level[role] - 1)
		for notion in item["notions"]:
			_retry.append({"notion": notion, "due_in": RETRY_AFTER, "item_id": item["id"]})
		_rush_streak = _rush_streak + 1 if speed_ratio < RUSH_RATIO else 0
		if _rush_streak >= RUSH_WINDOW:
			_penalty_left = RUSH_PENALTY_QUESTIONS
			_rush_streak = 0

	var reward_factor := 1.0
	if _penalty_left > 0:
		reward_factor = 0.5
		_penalty_left -= 1

	Session.record_attempt(item, correct, time_ms, hint_used, game_mode)
	return {
		"correct": correct,
		"speed_ratio": speed_ratio,
		"reward_factor": reward_factor,
		"explanation": item.get("explanation", ""),
	}


## Réponse que l'enfant vient de donner à cette question ("" sinon).
func last_input_for(item: Dictionary) -> String:
	return str(_last_input.get("text", "")) if _last_input.get("id", null) == item.get("id", "") else ""


func _take(item: Dictionary) -> Dictionary:
	_used[item["id"]] = true
	return item


func _closest(pool: Array, level: int) -> Dictionary:
	var best_gap := 99
	for it in pool:
		best_gap = mini(best_gap, absi(int(it["difficulty"]) - level))
	var candidates := pool.filter(func(it: Dictionary) -> bool:
		return absi(int(it["difficulty"]) - level) == best_gap)
	return candidates.pick_random()
