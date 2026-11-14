/**
 * Un combat au tour par tour : les règles seulement, portées de la v1 (core/combat/encounter.gd).
 * La mise en scène (animations, textes qui montent, caméra) et l'interface les lisent et ne
 * recalculent rien. Chaque action demande une réponse : le savoir est le pouvoir (PRD §1).
 * - Frappe (automatisme) : rapide, dégâts moyens.
 * - Sort (notion du chapitre) : plus puissant.
 * - Soin : une question du chapitre pour reprendre des PV.
 * - Sac : bouclier (le prochain coup ne touche pas) ou potion (toute la vie), sans question et
 *   sans perdre son tour.
 * Justesse et vitesse modulent la puissance ; juste en moins de la moitié du temps cible = coup
 * critique. Une erreur ouvre une explication et laisse l'ennemi frapper plus fort.
 *
 * Effaceur (boss de synthèse) : chaque bonne réponse brise un des BOSS_HITS sceaux (moins avec des
 * critiques, plus avec des indices : de 7 à 11 questions), et la difficulté monte de question en
 * question (d'un cran sous le niveau du joueur à un cran au-dessus), quelle que soit l'action
 * choisie. Retours des enfants : 10 sceaux et deux crans au-dessus, c'était trop dur.
 *
 * Accessibilité : « sans pénalité de lenteur » (no_speed) remplace la vitesse par la régularité
 * (3e bonne réponse d'affilée sans indice). Aucune question n'est jamais contre la montre : la
 * vitesse ne sert qu'à valoriser, jamais à punir.
 */
import type { Fighter } from './fighter'
import type { ItemId } from '../progression/inventory'
import { answerXp } from '../progression/progression'

export type Action = 'automatisme' | 'chapitre' | 'soin'
export type World = 'lumineux' | 'brouillard'
export type Outcome = 'victory' | 'retreat' | null

export const BASE_POWER: Record<Action, number> = { automatisme: 18, chapitre: 32, soin: 35 }
export const CRIT_RATIO = 0.5
export const CRIT_MULT = 1.6
export const FAST_MULT = 1.2
export const HINT_MULT = 0.7
/** Part des dégâts subis après une bonne réponse. */
export const GUARD_MULT = 0.5
export const BOSS_HITS = 8
export const BOSS_CRIT_MULT = 1.25
export const CORRECT_RUN_FOR_CRIT = 3

/** Ce que l'on sait d'une réponse (QuestionService.submit et QuestionPanel). */
export interface AnswerFacts {
  correct: boolean
  /** Temps mis / temps cible de la question. */
  speedRatio: number
  /** 0,5 sous la pénalité « clic au hasard » (QuestionService), 1 sinon. */
  rewardFactor: number
  difficulty: number
  /** Seul l'indice ordinaire réduit la puissance (ni la plume ni le parchemin). */
  hintPenalized: boolean
}

export type Resolution =
  | { kind: 'miss' }
  | { kind: 'heal'; power: number; healed: number; crit: boolean; xp: number }
  | { kind: 'hit'; power: number; crit: boolean; xp: number; defeated: boolean }

export type EnemyAttack = { kind: 'blocked' } | { kind: 'hit'; damage: number; guarded: boolean }

export type BagEffect = { kind: 'potion'; healed: number } | { kind: 'shield' }

export interface TurnResult {
  action: Action
  resolution: Resolution
  /** Absent quand l'ennemi est tombé avant de pouvoir frapper. */
  enemyAttack: EnemyAttack | null
  outcome: Outcome
}

export interface EncounterOptions {
  hero: Fighter
  enemy: Fighter
  /** Force de l'ennemi : s'ajoute à ses dégâts. */
  tier: number
  boss?: boolean
  world: World
  /** Aménagement « sans pénalité de lenteur ». */
  noSpeed?: boolean
  /** Niveaux de départ du joueur, pour la montée en difficulté de l'Effaceur. */
  baseLevels?: { automatisme: number; chapitre: number }
  random?: () => number
}

export class Encounter {
  readonly hero: Fighter
  readonly enemy: Fighter
  readonly tier: number
  readonly boss: boolean
  /** Questions déjà répondues dans ce combat. */
  questions = 0
  shield = false
  private correctRun = 0
  private readonly world: World
  private readonly noSpeed: boolean
  private readonly base: { automatisme: number; chapitre: number }
  private readonly random: () => number

  constructor(options: EncounterOptions) {
    this.hero = options.hero
    this.enemy = options.enemy
    this.tier = options.tier
    this.boss = options.boss ?? false
    this.world = options.world
    this.noSpeed = options.noSpeed ?? false
    this.base = options.baseLevels ?? { automatisme: 1, chapitre: 1 }
    this.random = options.random ?? Math.random
  }

  /** Rôle de la question d'une action : le soin demande une question du chapitre. */
  static roleOf(action: Action): 'automatisme' | 'chapitre' {
    return action === 'soin' ? 'chapitre' : action
  }

  /** Le bouton « Soin » n'apparaît que si le héros est blessé. */
  get canHeal(): boolean {
    return this.hero.hp < this.hero.maxHp
  }

  get outcome(): Outcome {
    if (!this.enemy.alive) return 'victory'
    if (!this.hero.alive) return 'retreat'
    return null
  }

  /** Difficulté imposée à la prochaine question : celle de l'Effaceur, 0 (= adaptative) sinon. */
  levelFor(role: 'automatisme' | 'chapitre'): number {
    if (!this.boss) return 0
    const base = this.base[role]
    const low = Math.max(1, base - 1)
    const high = Math.min(5, base + 1)
    return low + Math.round((high - low) * Math.min(1, this.questions / (BOSS_HITS - 1)))
  }

  /** Une action complète : la réponse, puis, si l'ennemi tient encore, sa riposte. */
  turn(action: Action, facts: AnswerFacts): TurnResult {
    const resolution = this.resolve(action, facts)
    this.questions += 1
    if (!this.enemy.alive) return { action, resolution, enemyAttack: null, outcome: 'victory' }
    const enemyAttack = this.enemyTurn(facts.correct)
    return { action, resolution, enemyAttack, outcome: this.outcome }
  }

  /** Objets du sac utilisables maintenant (le bouton est grisé sinon). */
  canUse(id: ItemId, have: number): boolean {
    if (have <= 0) return false
    if (id === 'potion') return this.hero.hp < this.hero.maxHp
    if (id === 'bouclier') return !this.shield
    return false
  }

  /** Bouclier ou potion : sans question, sans perdre son tour. L'objet est retiré du sac par l'appelant. */
  useBag(id: ItemId): BagEffect | null {
    if (id === 'potion') return { kind: 'potion', healed: this.hero.heal(this.hero.maxHp) }
    if (id === 'bouclier') {
      this.shield = true
      return { kind: 'shield' }
    }
    return null
  }

  private resolve(action: Action, facts: AnswerFacts): Resolution {
    if (!facts.correct) {
      this.correctRun = 0
      return { kind: 'miss' }
    }
    this.correctRun += 1
    const hint = facts.hintPenalized
    let crit = facts.speedRatio < CRIT_RATIO && !hint
    let mult = crit ? CRIT_MULT : facts.speedRatio < 1 ? FAST_MULT : 1
    if (this.noSpeed) {
      // La vitesse ne compte pas ; le coup critique récompense la régularité.
      crit = this.correctRun >= CORRECT_RUN_FOR_CRIT && !hint
      mult = crit ? CRIT_MULT : 1
      if (crit) this.correctRun = 0
    }
    let base = BASE_POWER[action]
    if (this.boss && action !== 'soin') {
      base = Math.ceil(this.enemy.maxHp / BOSS_HITS)
      mult = crit ? BOSS_CRIT_MULT : 1
    }
    if (hint) mult *= HINT_MULT
    const power = Math.round(base * mult * facts.rewardFactor)
    const xp = answerXp(facts.difficulty)
    if (action === 'soin') return { kind: 'heal', power, healed: this.hero.heal(power), crit, xp }
    this.enemy.damage(power)
    return { kind: 'hit', power, crit, xp, defeated: !this.enemy.alive }
  }

  /** Riposte de l'ennemi. `guarded` : le héros vient de répondre juste (dégâts réduits). */
  enemyTurn(guarded: boolean): EnemyAttack {
    if (this.shield) {
      this.shield = false
      return { kind: 'blocked' }
    }
    const [low, high] = this.world === 'lumineux' ? [6, 10] : [9, 14]
    const base = low + Math.floor(this.random() * (high - low + 1))
    const damage = Math.round((base + this.tier) * (guarded ? GUARD_MULT : 1))
    this.hero.damage(damage)
    return { kind: 'hit', damage, guarded }
  }
}
