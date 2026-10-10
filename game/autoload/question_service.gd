extends Node
## Choix des questions et validation (TRD §2.3 : le gameplay ne connaît jamais le
## contenu d'une question). Une scène demande un item pour un rôle
## (« automatisme » = Frappe, « chapitre » = Sort), l'affiche, puis appelle `submit`.
##
## Difficulté adaptative (prototype, avant le moteur Leitner de la phase 2) :
## +1 après 2 réussites d'affilée au même niveau, −1 après une erreur.
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


func reset() -> void:
	_level = {"automatisme": 1, "chapitre": 1}
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
func next_item(role := "") -> Dictionary:
	var pool: Array = Session.items.filter(func(it: Dictionary) -> bool:
		return not _used.has(it["id"]) and (role == "" or it["role"] == role))
	if pool.is_empty():
		_used.clear()  # paquet épuisé : on recommence (les items sont nombreux et variés)
		pool = Session.items.filter(func(it: Dictionary) -> bool: return role == "" or it["role"] == role)
	if pool.is_empty():
		return {}
	# Une notion ratée revient, sous une autre forme, quand son tour arrive.
	for entry in _retry:
		if entry.due_in <= 0:
			var again := pool.filter(func(it: Dictionary) -> bool: return entry.notion in it["notions"])
			if not again.is_empty():
				_retry.erase(entry)
				return _take(_closest(again, level_for(role)))
	return _take(_closest(pool, level_for(role) if role != "" else 1))


## Valide la réponse, ajuste la difficulté et enregistre la tentative.
## Renvoie {correct, speed_ratio (temps / temps cible), reward_factor, explanation}.
func submit(item: Dictionary, user_input: Variant, time_ms: int, hint_used: bool) -> Dictionary:
	var correct := AnswerChecker.check(item["answer"], user_input)
	var role: String = item["role"]
	var target := maxf(1.0, float(item.get("time_target_ms", 20000)))
	var speed_ratio := time_ms / target
	answered += 1
	for entry in _retry:
		entry.due_in -= 1

	if correct:
		correct_count += 1
		_streak[role] += 1
		if _streak[role] >= 2 and int(item["difficulty"]) >= _level[role]:
			_level[role] = mini(5, _level[role] + 1)
			_streak[role] = 0
		_rush_streak = 0
	else:
		_streak[role] = 0
		_level[role] = maxi(1, _level[role] - 1)
		for notion in item["notions"]:
			_retry.append({"notion": notion, "due_in": RETRY_AFTER})
		_rush_streak = _rush_streak + 1 if speed_ratio < RUSH_RATIO else 0
		if _rush_streak >= RUSH_WINDOW:
			_penalty_left = RUSH_PENALTY_QUESTIONS
			_rush_streak = 0

	var reward_factor := 1.0
	if _penalty_left > 0:
		reward_factor = 0.5
		_penalty_left -= 1

	Session.record_attempt(item, correct, time_ms, hint_used)
	return {
		"correct": correct,
		"speed_ratio": speed_ratio,
		"reward_factor": reward_factor,
		"explanation": item.get("explanation", ""),
	}


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
