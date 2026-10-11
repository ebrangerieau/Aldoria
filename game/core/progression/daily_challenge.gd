class_name DailyChallenge
extends RefCounted
## Défi quotidien (IMPLEMENTATION_PLAN, phase 3) : 10 automatismes d'affilée, une fois
## par jour. Série de jours consécutifs, coffre de la semaine à partir de 5 défis.
##
## Sans pression (PRD : aucun FOMO) : pas de compte à rebours à l'écran (les enfants
## l'ont vécu comme un chrono, retour du 2026-10-11), seulement le temps final et le
## record personnel. Une série cassée d'un seul jour se répare : le lendemain, après
## le défi du jour, un défi de rattrapage compte pour la veille.
##
## Les jours sont des dates locales « AAAA-MM-JJ » (celles de l'appareil).

const QUESTIONS := 10
const WEEKLY_GOAL := 5
const WEEKLY_CHEST_XP := 200
const COMPLETION_XP := 40
const KEPT_DAYS := 21


static func today() -> String:
	return Time.get_date_string_from_system()


static func shift_day(day: String, offset: int) -> String:
	var unix := Time.get_unix_time_from_datetime_string(day + "T12:00:00")
	return Time.get_date_string_from_unix_time(unix + offset * 86400)


## Lundi de la semaine du jour donné (clé du coffre hebdomadaire).
static func week_start(day: String) -> String:
	var unix := Time.get_unix_time_from_datetime_string(day + "T12:00:00")
	var weekday: int = Time.get_date_dict_from_unix_time(unix)["weekday"]  # 0 = dimanche
	return shift_day(day, -((weekday + 6) % 7))


## Jours consécutifs jusqu'à aujourd'hui (ou jusqu'à hier si le défi du jour reste à faire).
static func streak(days: Array, day: String) -> int:
	var cursor := day if days.has(day) else shift_day(day, -1)
	var count := 0
	while days.has(cursor):
		count += 1
		cursor = shift_day(cursor, -1)
	return count


## Rattrapage possible : défi du jour fait, hier manqué, avant-hier fait.
static func can_catch_up(days: Array, day: String) -> bool:
	return days.has(day) and not days.has(shift_day(day, -1)) and days.has(shift_day(day, -2))


## Défis faits dans la semaine du jour donné.
static func week_count(days: Array, day: String) -> int:
	var monday := week_start(day)
	var count := 0
	for offset in 7:
		if days.has(shift_day(monday, offset)):
			count += 1
	return count


## Jour que compterait un défi lancé maintenant : aujourd'hui, ou hier en rattrapage,
## ou "" (déjà fait : simple entraînement).
static func counted_day(days: Array, day: String) -> String:
	if not days.has(day):
		return day
	if can_catch_up(days, day):
		return shift_day(day, -1)
	return ""


static func format_duration(ms: int) -> String:
	var seconds := roundi(ms / 1000.0)
	if seconds < 60:
		return "%d s" % seconds
	return "%d min %02d s" % [seconds / 60, seconds % 60]
