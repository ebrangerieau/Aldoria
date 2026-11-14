/**
 * Défi quotidien (Pierre du Jour) : 10 automatismes d'affilée, une fois par jour. Série de jours
 * consécutifs, coffre de la semaine à partir de 5 défis. Porté de la v1 (core/progression/
 * daily_challenge.gd et SaveManager.record_daily).
 *
 * Sans pression (PRD : aucun FOMO) : pas de compte à rebours à l'écran (les enfants l'ont vécu comme un
 * chrono, retour du 11 octobre), seulement le temps final et le record personnel. Une série cassée d'un
 * seul jour se répare : le lendemain, après le défi du jour, un défi de rattrapage compte pour la veille.
 *
 * Les jours sont des dates locales « AAAA-MM-JJ » (celles de l'appareil). Pur : l'état (`DailyState`) est
 * rendu à chaque fois, jamais modifié sur place ; la partie (core/save.ts) le range.
 */
export const QUESTIONS = 10
export const WEEKLY_GOAL = 5
export const WEEKLY_CHEST_XP = 200
export const COMPLETION_XP = 40
/** Jours gardés dans la partie. */
export const KEPT_DAYS = 21
const KEPT_CHESTS = 8

export interface DailyState {
  /** Jours où le défi a été fait (triés). */
  days: string[]
  /** Record : plus de bonnes réponses, puis plus rapide. */
  best: { correct: number; ms: number }
  best_streak: number
  /** Lundis des semaines dont le coffre a été ouvert. */
  chests: string[]
}

export const EMPTY_DAILY: DailyState = { days: [], best: { correct: 0, ms: 0 }, best_streak: 0, chests: [] }

/** Date locale de l'appareil, « AAAA-MM-JJ ». */
export function today(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const noon = (day: string): Date => new Date(`${day}T12:00:00Z`)

/** Jour décalé de `offset` jours (midi UTC : pas d'effet des changements d'heure). */
export function shiftDay(day: string, offset: number): string {
  return new Date(noon(day).getTime() + offset * 86_400_000).toISOString().slice(0, 10)
}

/** Lundi de la semaine du jour donné (clé du coffre hebdomadaire). */
export function weekStart(day: string): string {
  const weekday = noon(day).getUTCDay() // 0 = dimanche
  return shiftDay(day, -((weekday + 6) % 7))
}

/** Jours consécutifs jusqu'à aujourd'hui (ou jusqu'à hier si le défi du jour reste à faire). */
export function streak(days: readonly string[], day: string): number {
  let cursor = days.includes(day) ? day : shiftDay(day, -1)
  let count = 0
  while (days.includes(cursor)) {
    count += 1
    cursor = shiftDay(cursor, -1)
  }
  return count
}

/** Rattrapage possible : défi du jour fait, hier manqué, avant-hier fait. */
export function canCatchUp(days: readonly string[], day: string): boolean {
  return days.includes(day) && !days.includes(shiftDay(day, -1)) && days.includes(shiftDay(day, -2))
}

/** Défis faits dans la semaine du jour donné. */
export function weekCount(days: readonly string[], day: string): number {
  const monday = weekStart(day)
  let count = 0
  for (let offset = 0; offset < 7; offset += 1) if (days.includes(shiftDay(monday, offset))) count += 1
  return count
}

/** Jour que compterait un défi lancé maintenant : aujourd'hui, ou hier en rattrapage, ou « » (déjà fait : simple entraînement). */
export function countedDay(days: readonly string[], day: string): string {
  if (!days.includes(day)) return day
  return canCatchUp(days, day) ? shiftDay(day, -1) : ''
}

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds} s`
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`
}

/**
 * Défi terminé. `day` : jour compté (aujourd'hui, hier en rattrapage, ou « » pour un simple entraînement) ;
 * le record compte dans tous les cas.
 */
export function recordDaily(state: DailyState, day: string, correct: number, timeMs: number, now: string): DailyState {
  let days = [...state.days]
  if (day !== '' && !days.includes(day)) {
    days.push(day)
    days.sort()
    days = days.slice(-KEPT_DAYS)
  }
  const better = correct > state.best.correct || (correct === state.best.correct && timeMs < state.best.ms)
  return {
    days,
    best: better ? { correct, ms: timeMs } : state.best,
    best_streak: Math.max(state.best_streak, streak(days, now)),
    chests: state.chests,
  }
}

export function weeklyChestReady(state: DailyState, now: string): boolean {
  return weekCount(state.days, now) >= WEEKLY_GOAL && !state.chests.includes(weekStart(now))
}

/** Ouvre le coffre de la semaine (une fois) : l'état suivant et l'XP gagnée (0 s'il n'est pas prêt). */
export function openWeeklyChest(state: DailyState, now: string): { state: DailyState; xp: number } {
  if (!weeklyChestReady(state, now)) return { state, xp: 0 }
  return { state: { ...state, chests: [...state.chests, weekStart(now)].slice(-KEPT_CHESTS) }, xp: WEEKLY_CHEST_XP }
}

/** État d'une partie ancienne ou incomplète : les champs manquants reprennent leur valeur par défaut. */
export function normalizeDaily(raw: unknown): DailyState {
  const given = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<DailyState>
  return {
    days: Array.isArray(given.days) ? given.days.filter((d): d is string => typeof d === 'string').sort() : [],
    best: { correct: Number(given.best?.correct) || 0, ms: Number(given.best?.ms) || 0 },
    best_streak: Number(given.best_streak) || 0,
    chests: Array.isArray(given.chests) ? given.chests.filter((d): d is string => typeof d === 'string') : [],
  }
}
