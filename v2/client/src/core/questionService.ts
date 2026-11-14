/**
 * Choix des questions et validation, porté de la v1 (game/autoload/question_service.gd).
 * Le gameplay ne connaît jamais le contenu d'une question : une scène demande un item pour
 * un rôle (« automatisme » = attaque rapide, « chapitre » = sort, « enigme »), l'affiche
 * par QuestionPanel, puis appelle `submit`.
 *
 * Difficulté adaptative : départ au niveau suggéré par le serveur, +1 après 2 réussites
 * d'affilée au même niveau, −1 après une erreur. Une notion ratée revient 2 questions plus
 * tard sous une autre forme. Clic au hasard : 3 erreurs de suite en moins de 25 % du temps
 * cible réduisent les gains des 5 questions suivantes, sans message.
 */
import { check } from './answers'
import type { Item, Role, UserInput } from './items'

export const RETRY_AFTER = 2
export const RUSH_WINDOW = 3
export const RUSH_RATIO = 0.25
export const RUSH_PENALTY_QUESTIONS = 5

/** Types de question que le client v2 sait afficher (ui/widgets/Widgets.tsx). */
export const SUPPORTED_TYPES = new Set(['mcq', 'numeric', 'expression', 'text', 'order', 'true_false', 'vector', 'number_line', 'sign_table'])

/**
 * Visuels que le client v2 sait dessiner (ui/widgets/Visuals.tsx). Une question dont le visuel est
 * absent d'ici n'est jamais posée : sans lui, l'énoncé serait souvent incompréhensible (robot,
 * carte, graphique). À agrandir en même temps que les composants. 24 lieux sur 30 n'en ont pas
 * besoin ; les six lieux de maths demandent les derniers (graph, robot, map, pont, rapporteur,
 * repere_tir).
 */
export const SUPPORTED_VISUALS = new Set(['balance', 'number_line', 'grid', 'sign_table'])

export function isPlayable(item: Item): boolean {
  if (!SUPPORTED_TYPES.has(item.type)) return false
  const kind = item.visual?.kind
  return !item.visual || (typeof kind === 'string' && SUPPORTED_VISUALS.has(kind))
}

export interface SubmitResult {
  correct: boolean
  speedRatio: number
  rewardFactor: number
  explanation: string
}

export interface QuestionSource {
  items(): Item[]
  startLevels(): Partial<Record<'automatisme' | 'chapitre', number>>
  isSetAside(item: Item): boolean
  record(item: Item, correct: boolean, timeMs: number, hintUsed: boolean, gameMode: string): void
}

type Adaptive = 'automatisme' | 'chapitre'

export class QuestionService {
  answered = 0
  correctCount = 0
  private level: Record<Adaptive, number> = { automatisme: 1, chapitre: 1 }
  private streak: Record<Adaptive, number> = { automatisme: 0, chapitre: 0 }
  private used = new Set<string>()
  private retry: { notion: string; dueIn: number; itemId: string }[] = []
  private rushStreak = 0
  private penaltyLeft = 0

  constructor(
    private readonly source: QuestionSource,
    private readonly random: () => number = Math.random,
    private readonly canShow: (item: Item) => boolean = isPlayable,
  ) {}

  /** Nouvelle activité : difficulté de départ du serveur (un cran plus bas si « départ doux »). */
  reset(easyStart = false): void {
    const easier = easyStart ? 1 : 0
    const start = this.source.startLevels()
    this.level = {
      automatisme: Math.max(1, (start.automatisme ?? 1) - easier),
      chapitre: Math.max(1, (start.chapitre ?? 1) - easier),
    }
    this.streak = { automatisme: 0, chapitre: 0 }
    this.used.clear()
    this.retry = []
    this.rushStreak = 0
    this.penaltyLeft = 0
    this.answered = 0
    this.correctCount = 0
  }

  levelFor(role: Role): number {
    return role === 'enigme' ? 1 : this.level[role]
  }

  /** Prochain item pour un rôle (n'importe lequel si `role` est absent) ; `level` impose la
   * difficulté visée (boss). Rôle « enigme » : dans l'ordre du paquet. null si rien. */
  next(role?: Role, level = 0): Item | null {
    const ofRole = this.playable(this.source.items().filter((it) => !role || it.role === role))
    if (ofRole.length === 0 && role === 'automatisme') {
      // Matière sans automatismes : une question du chapitre, un cran plus facile.
      return this.next('chapitre', level > 0 ? level : Math.max(1, this.levelFor('chapitre') - 1))
    }
    let pool = ofRole.filter((it) => !this.used.has(it.id))
    if (pool.length === 0) {
      // Paquet épuisé pour ce rôle : on recommence (les items sont nombreux et variés).
      for (const it of ofRole) this.used.delete(it.id)
      pool = ofRole
    }
    if (pool.length === 0) return null
    if (role === 'enigme') return this.take(pool[0]!)
    const target = level > 0 ? level : role ? this.levelFor(role) : 1
    for (const entry of this.retry) {
      if (entry.dueIn > 0) continue
      let again = pool.filter((it) => it.notions.includes(entry.notion))
      if (again.length === 0) {
        // Plus de question inédite sur cette notion : une autre déjà posée, jamais la ratée.
        again = ofRole.filter((it) => it.notions.includes(entry.notion) && it.id !== entry.itemId)
      }
      if (again.length > 0) {
        this.retry.splice(this.retry.indexOf(entry), 1)
        return this.take(this.closest(again, target))
      }
    }
    return this.take(this.closest(pool, target))
  }

  /** Valide la réponse, ajuste la difficulté et enregistre la tentative. */
  submit(item: Item, input: UserInput, timeMs: number, hintUsed: boolean, gameMode = 'monde'): SubmitResult {
    const correct = check(item.answer, input)
    const speedRatio = timeMs / Math.max(1, item.time_target_ms || 20000)
    this.answered += 1
    for (const entry of this.retry) entry.dueIn -= 1
    const role = item.role
    const adaptive = role === 'automatisme' || role === 'chapitre'
    if (correct) {
      this.correctCount += 1
      if (adaptive) {
        this.streak[role] += 1
        if (this.streak[role] >= 2 && item.difficulty >= this.level[role]) {
          this.level[role] = Math.min(5, this.level[role] + 1)
          this.streak[role] = 0
        }
      }
      this.rushStreak = 0
    } else {
      if (adaptive) {
        this.streak[role] = 0
        this.level[role] = Math.max(1, this.level[role] - 1)
      }
      for (const notion of item.notions) this.retry.push({ notion, dueIn: RETRY_AFTER, itemId: item.id })
      this.rushStreak = speedRatio < RUSH_RATIO ? this.rushStreak + 1 : 0
      if (this.rushStreak >= RUSH_WINDOW) {
        this.penaltyLeft = RUSH_PENALTY_QUESTIONS
        this.rushStreak = 0
      }
    }
    let rewardFactor = 1
    if (this.penaltyLeft > 0) {
      rewardFactor = 0.5
      this.penaltyLeft -= 1
    }
    this.source.record(item, correct, timeMs, hintUsed, gameMode)
    return { correct, speedRatio, rewardFactor, explanation: item.explanation }
  }

  /** Items jouables : affichables, sans les notions mises de côté (sauf s'il ne reste rien). */
  private playable(items: Item[]): Item[] {
    const shown = items.filter(this.canShow)
    const kept = shown.filter((it) => !this.source.isSetAside(it))
    return kept.length > 0 ? kept : shown
  }

  private take(item: Item): Item {
    this.used.add(item.id)
    return item
  }

  private closest(pool: Item[], level: number): Item {
    const gap = Math.min(...pool.map((it) => Math.abs(it.difficulty - level)))
    const candidates = pool.filter((it) => Math.abs(it.difficulty - level) === gap)
    return candidates[Math.floor(this.random() * candidates.length)]!
  }
}
