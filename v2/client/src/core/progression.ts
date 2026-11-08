/**
 * XP et niveau du héros, portés de la v1 (game/core/progression/progression.gd). Le niveau n
 * est atteint à 100·n·(n−1) XP : 200, 600, 1 200, 2 000… Chaque niveau donne 10 PV de plus.
 * Gains : bonne réponse 10 × difficulté ; ennemi vaincu, énigme et coffre selon le lieu
 * (content/monde/lieux.json).
 */
export const MAX_LEVEL = 50
export const BASE_HP = 100
export const HP_PER_LEVEL = 10

export function xpForLevel(level: number): number {
  return 100 * level * (level - 1)
}

export function levelForXp(xp: number): number {
  let level = 1
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level += 1
  return level
}

/** Avancement dans le niveau en cours, de 0 à 1 (barre d'XP). */
export function levelProgress(xp: number): number {
  const level = levelForXp(xp)
  if (level >= MAX_LEVEL) return 1
  const start = xpForLevel(level)
  return (xp - start) / (xpForLevel(level + 1) - start)
}

export function heroMaxHp(level: number): number {
  return BASE_HP + HP_PER_LEVEL * (level - 1)
}

export function answerXp(difficulty: number): number {
  return 10 * difficulty
}
