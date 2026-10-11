class_name Progression
extends RefCounted
## XP et niveau du héros (PRD §6, progression). Le niveau n est atteint à
## 100·n·(n−1) XP : 200, 600, 1 200, 2 000… Chaque niveau donne 10 PV de plus.
##
## Gains : bonne réponse 10 × difficulté ; ennemi vaincu, énigme et coffre selon
## le donjon (DungeonDef).

const MAX_LEVEL := 50
const BASE_HP := 100
const HP_PER_LEVEL := 10


static func xp_for_level(level: int) -> int:
	return 100 * level * (level - 1)


static func level_for_xp(xp: int) -> int:
	var level := 1
	while level < MAX_LEVEL and xp >= xp_for_level(level + 1):
		level += 1
	return level


## Avancement dans le niveau en cours, de 0 à 1 (barre d'XP).
static func level_progress(xp: int) -> float:
	var level := level_for_xp(xp)
	if level >= MAX_LEVEL:
		return 1.0
	var start := xp_for_level(level)
	return float(xp - start) / float(xp_for_level(level + 1) - start)


static func hero_max_hp(level: int) -> int:
	return BASE_HP + HP_PER_LEVEL * (level - 1)


static func answer_xp(difficulty: int) -> int:
	return 10 * difficulty
