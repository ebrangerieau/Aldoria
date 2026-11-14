/**
 * Déroulé d'un défi du jour (Pierre du Jour), repris de la scène de la v1 (scenes/daily/daily.gd) : dix automatismes d'affilée,
 * sans compte à rebours ; bilan avec bonnes réponses, temps de réponse cumulé (explications exclues), record, série de jours et
 * coffre de la semaine. Pur : l'écran (ui/DailyChallenge.tsx) pose les questions et appelle `answer`, puis `finish`.
 * Règles de série, de rattrapage et de coffre : core/dailyChallenge.ts. Un défi interrompu ne compte pas.
 */
import {
  COMPLETION_XP, formatDuration, openWeeklyChest, QUESTIONS, recordDaily, streak, weekCount, weeklyChestReady, WEEKLY_CHEST_XP,
  WEEKLY_GOAL, type DailyState,
} from './dailyChallenge'
import { draw, foundText, give, type Owned } from './inventory'

/** Mode de jeu des réponses du défi (suivi côté serveur). */
export const GAME_MODE = 'defi'

/** Le défi lancé maintenant rattrape-t-il hier ? (`day` : jour compté par ce défi ; « » : simple entraînement) */
export const isCatchUp = (day: string, today: string): boolean => day !== '' && day !== today

export const titleFor = (day: string, today: string): string => (isCatchUp(day, today) ? 'Défi de rattrapage' : 'Défi du jour')

export function introText(day: string, today: string, noSpeed: boolean): string {
  let body = noSpeed
    ? "Dix questions d'automatismes, à ton rythme. Prends tout ton temps : seules les bonnes réponses comptent."
    : "Dix questions d'automatismes, à ton rythme : pas de chrono à l'écran. À la fin, ton temps est comparé à ton record."
  if (day === '') body += "\nTu as déjà relevé le défi aujourd'hui : celui-ci est pour t'entraîner."
  else if (isCatchUp(day, today)) body += '\nTu as manqué hier : ce défi le rattrape, et ta série continue !'
  return body
}

/** « , en 2 min 14 s » ; rien avec l'aménagement « sans pénalité de lenteur ». */
export const timeText = (ms: number, noSpeed: boolean): string => (noSpeed ? '' : `, en ${formatDuration(ms)}`)

export interface DailyReport {
  title: string
  lines: string[]
  /** L'état du défi après ce bilan ; le coffre de la semaine est prêt à ouvrir si `chestReady`. */
  state: DailyState
  /** XP gagnée par le défi (bonnes réponses et bonus de fin). */
  xp: number
  chestReady: boolean
}

const plural = (n: number): string => (n > 1 ? 's' : '')

export class DailyRun {
  /** Réponses données, juste ou faux, dans l'ordre. */
  readonly results: boolean[] = []
  private time = 0
  private gained = 0

  constructor(
    /** Jour compté par ce défi : aujourd'hui, hier (rattrapage) ou « » (entraînement). */
    readonly day: string,
    readonly today: string,
  ) {}

  get correct(): number {
    return this.results.filter(Boolean).length
  }

  get timeMs(): number {
    return this.time
  }

  get complete(): boolean {
    return this.results.length >= QUESTIONS
  }

  /** Une question répondue : `timeMs` est le temps de réponse (sans la lecture de l'explication), `xp` ce qu'elle rapporte si elle est juste. */
  answer(correct: boolean, timeMs: number, xp: number): void {
    if (this.complete) return
    this.results.push(correct)
    this.time += Math.max(0, Math.round(timeMs))
    if (correct) this.gained += Math.max(0, Math.round(xp))
  }

  /** Bilan du défi ; null s'il n'est pas allé au bout (interrompu : rien n'est compté, ni série, ni record, ni XP). */
  finish(state: DailyState, noSpeed: boolean): DailyReport | null {
    if (!this.complete) return null
    const before = state.best
    const xp = this.gained + (this.day !== '' ? COMPLETION_XP : 0)
    const next = recordDaily(state, this.day, this.correct, this.time, this.today)
    const lines = [`${this.correct} bonnes réponses sur ${QUESTIONS}${timeText(this.time, noSpeed)}.`]
    const record = this.correct > before.correct || (this.correct === before.correct && this.time < before.ms)
    if (before.correct === 0 && before.ms === 0) lines.push("Premier défi : c'est ton record à battre !")
    else if (record) lines.push(`Nouveau record ! (avant : ${before.correct} sur ${QUESTIONS}${timeText(before.ms, noSpeed)})`)
    else lines.push(`Ton record : ${before.correct} sur ${QUESTIONS}${timeText(before.ms, noSpeed)}.`)
    const days = streak(next.days, this.today)
    lines.push(`Série : ${days} jour${plural(days)} d'affilée.`)
    lines.push(`Coffre de la semaine : ${Math.min(weekCount(next.days, this.today), WEEKLY_GOAL)} / ${WEEKLY_GOAL} défis.`)
    lines.push(`+${xp} XP`)
    return { title: this.correct >= 7 ? 'Défi réussi !' : 'Défi terminé !', lines, state: next, xp, chestReady: weeklyChestReady(next, this.today) }
  }
}

export interface ChestReport {
  title: string
  lines: string[]
  state: DailyState
  owned: Owned
  xp: number
}

/** Ouverture du coffre de la semaine : XP et deux objets du sac (une seule fois par semaine ; sans effet s'il n'est pas prêt). */
export function openChest(state: DailyState, owned: Owned, today: string, random: () => number = Math.random): ChestReport {
  const opened = openWeeklyChest(state, today)
  if (opened.xp === 0) return { title: 'Coffre de la semaine', lines: [], state, owned, xp: 0 }
  const found = draw(owned, 2, random)
  const lines = [`Cinq défis cette semaine : le coffre s'ouvre !`, `+${WEEKLY_CHEST_XP} XP`]
  if (found.length > 0) lines.push(foundText(found))
  return { title: 'Coffre de la semaine', lines, state: opened.state, owned: give(owned, found), xp: opened.xp }
}

/** Les dix pastilles du haut de l'écran : juste, faux, ou pas encore répondue. */
export const pips = (results: readonly boolean[]): ('juste' | 'faux' | 'attente')[] =>
  Array.from({ length: QUESTIONS }, (_, i) => (i >= results.length ? 'attente' : results[i] ? 'juste' : 'faux'))

