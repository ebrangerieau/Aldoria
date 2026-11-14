/**
 * Règles d'un combat au tour par tour, portées de la v1 (game/core/combat/encounter.gd) sans
 * la mise en scène : aucune animation, aucun son, aucun panneau. L'interface pose la question
 * (QuestionService), puis appelle `answer` avec le verdict et reçoit ce qui s'est passé, dans
 * l'ordre, pour le raconter (coup, soin, riposte). Rien ici ne connaît le contenu d'une question.
 *
 * Chaque action demande une réponse : le savoir est le pouvoir.
 * - Frappe (automatisme) : rapide, dégâts moyens.
 * - Sort (notion du chapitre) : plus puissant.
 * - Soin : une question du chapitre pour reprendre des PV.
 * - Sac : bouclier (le prochain coup ne touche pas) ou potion d'urgence (toute la vie), sans
 *   question et sans perdre son tour (le compte des objets est tenu par l'appelant).
 * Justesse et vitesse modulent la puissance ; réponse juste en moins de la moitié du temps cible =
 * coup critique. Une erreur ouvre une explication et laisse l'ennemi frapper plus fort.
 *
 * Boss de synthèse : chaque bonne réponse brise un des BOSS_HITS sceaux (moins avec des critiques,
 * plus avec des indices : de 7 à 12 questions pour les Effaceurs de 200 à 260 PV), et la difficulté monte de question en question
 * (d'un cran sous le niveau du joueur à un cran au-dessus), quelle que soit l'action choisie.
 * Retours des enfants : 10 sceaux et deux crans au-dessus, c'était trop dur.
 *
 * Fin du combat : « victory » ou « retreat » (héros à 0 PV : l'appelant le replie, sans rien lui
 * faire perdre). La fin du temps de jeu fixé par le parent se vérifie avant chaque tour, par l'appelant.
 */
import { answerXp } from '../progression'

export type Action = 'automatisme' | 'chapitre' | 'soin'
export type QuestionRole = 'automatisme' | 'chapitre'
export type Outcome = 'victory' | 'retreat'
export type World = 'lumineux' | 'brouillard'

export const BASE_POWER: Record<Action, number> = { automatisme: 18, chapitre: 32, soin: 35 }
export const CRIT_RATIO = 0.5
export const CRIT_MULT = 1.6
export const FAST_MULT = 1.2
export const HINT_MULT = 0.7
/** Dégâts subis après une bonne réponse. */
export const GUARD_MULT = 0.5
export const BOSS_HITS = 8
/** Au mieux 7 questions. */
export const BOSS_CRIT_MULT = 1.25
/** Sans pénalité de lenteur : coup critique à la troisième bonne réponse d'affilée. */
export const STREAK_FOR_CRIT = 3
/** Dégâts de base de la riposte (avant la force de l'ennemi), inclusifs. */
export const FOE_DAMAGE: Record<World, [number, number]> = { lumineux: [6, 10], brouillard: [9, 14] }

/**
 * Sceaux encore intacts d'un Effaceur : chacun représente `BOSS_HITS` fois moins de PV que le maximum. Dérivés des PV, jamais
 * comptés à part : ils ne peuvent donc pas s'écarter des dégâts réellement infligés (critique, indice, récompense réduite).
 */
export function sealsLeft(hp: number, maxHp: number): number {
  if (hp <= 0 || maxHp <= 0) return 0
  return Math.ceil(hp / Math.ceil(maxHp / BOSS_HITS))
}

/** Un combattant : points de vie bornés entre 0 et le maximum. */
export class Combatant {
  hp: number
  maxHp: number

  constructor(
    readonly name: string,
    maxHp: number,
    hp = maxHp,
  ) {
    this.maxHp = maxHp
    this.hp = hp
  }

  /** Nouveau niveau : plus de PV au maximum, et le héros reprend toute sa vie. */
  raiseMax(maxHp: number): void {
    this.maxHp = maxHp
    this.hp = maxHp
  }

  get alive(): boolean {
    return this.hp > 0
  }

  damage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount)
  }

  /** Rend les PV réellement repris. */
  heal(amount: number): number {
    const before = this.hp
    this.hp = Math.min(this.maxHp, this.hp + amount)
    return this.hp - before
  }
}

/** Le verdict d'une question, tel que QuestionService.submit le rend, plus l'indice et la difficulté de l'item. */
export interface Answer {
  correct: boolean
  /** Temps de réponse rapporté au temps cible de la question. */
  speedRatio: number
  /** 1, ou 0,5 après des clics au hasard (QuestionService). */
  rewardFactor: number
  /** Seul l'indice ordinaire compte (ni la plume ni le parchemin : voir QuestionPanel). */
  hintUsed: boolean
  difficulty: number
}

export type CombatEvent =
  | { kind: 'xp'; amount: number }
  | { kind: 'hero_strike'; action: 'automatisme' | 'chapitre'; power: number; crit: boolean }
  | { kind: 'hero_heal'; healed: number }
  | { kind: 'hero_stumble' }
  | { kind: 'foe_down' }
  | { kind: 'foe_attack'; damage: number; blocked: boolean }
  | { kind: 'hero_down' }
  | { kind: 'potion'; healed: number }
  | { kind: 'shield_up' }

/** Réglages qui valent pour tout le lieu (un `Encounter` sert à tous les combats d'un donjon ou de l'arène). */
export interface EncounterSettings {
  world: World
  /** Aménagement « sans pénalité de lenteur » (Accessibility « no_speed ») : la vitesse ne compte pas. */
  noSpeed?: boolean
  random?: () => number
}

/** Un combat contre un ennemi. */
export interface Engagement {
  /** Force de l'ennemi : s'ajoute à ses dégâts. */
  tier: number
  /** XP gagnée en le battant. */
  rewardXp: number
  boss?: boolean
  /** Niveaux de départ des rôles (QuestionService.levelFor), pour la difficulté du boss. */
  baseLevels?: Partial<Record<QuestionRole, number>>
}

export interface Turn {
  events: CombatEvent[]
  outcome: Outcome | null
}

/**
 * Un `Encounter` par donjon (ou par arène), comme dans la v1 : `engage` ouvre chaque combat et ne
 * remet à zéro que ce qui est propre à lui (questions posées, difficulté du boss). Le bouclier levé
 * (un objet dépensé) et la série de bonnes réponses du critique « sans vitesse » passent d'un
 * ennemi au suivant.
 */
export class Encounter {
  /** Questions posées dans le combat en cours. */
  questions = 0
  private correctRun = 0
  private shield = false
  private current: { foe: Combatant; engagement: Engagement } | null = null
  private readonly random: () => number
  private readonly noSpeed: boolean

  constructor(
    readonly hero: Combatant,
    private readonly settings: EncounterSettings,
  ) {
    this.random = settings.random ?? Math.random
    this.noSpeed = settings.noSpeed ?? false
  }

  /** Ouvre un combat contre `foe`. */
  engage(foe: Combatant, engagement: Engagement): void {
    this.current = { foe, engagement }
    this.questions = 0
  }

  /** L'ennemi du combat en cours. */
  get foe(): Combatant {
    return this.fightNow().foe
  }

  get isBoss(): boolean {
    return this.fightNow().engagement.boss ?? false
  }

  private fightNow(): { foe: Combatant; engagement: Engagement } {
    if (!this.current) throw new Error('Aucun combat ouvert : appeler engage() avant.')
    return this.current
  }

  get shieldUp(): boolean {
    return this.shield
  }

  /** Le soin n'est proposé qu'à un héros blessé. */
  get canHeal(): boolean {
    return this.hero.hp < this.hero.maxHp
  }

  /** Rôle de la question posée pour une action : le soin interroge le chapitre. */
  roleOf(action: Action): QuestionRole {
    return action === 'soin' ? 'chapitre' : action
  }

  /** Difficulté imposée à la question (boss : de un cran sous le niveau du joueur à un cran au-dessus) ; 0 : celle de QuestionService. */
  questionLevel(role: QuestionRole): number {
    const { engagement } = this.fightNow()
    if (!engagement.boss) return 0
    const base = engagement.baseLevels?.[role] ?? 1
    const low = Math.max(1, base - 1)
    const high = Math.min(5, base + 1)
    return low + Math.round((high - low) * Math.min(1, this.questions / (BOSS_HITS - 1)))
  }

  /** Une question a reçu sa réponse : ce qu'elle fait au combat, puis la riposte, dans l'ordre. */
  answer(action: Action, answer: Answer): Turn {
    const { foe, engagement } = this.fightNow()
    const events: CombatEvent[] = []
    this.questions += 1
    if (answer.correct) this.succeed(action, answer, events)
    else {
      this.correctRun = 0
      events.push({ kind: 'hero_stumble' })
    }
    if (!foe.alive) {
      events.push({ kind: 'foe_down' }, { kind: 'xp', amount: engagement.rewardXp })
      return { events, outcome: 'victory' }
    }
    events.push(this.riposte(answer.correct))
    if (!this.hero.alive) {
      events.push({ kind: 'hero_down' })
      return { events, outcome: 'retreat' }
    }
    return { events, outcome: null }
  }

  /** Sac, potion d'urgence : toute la vie, sans question ni tour perdu. */
  usePotion(): CombatEvent {
    return { kind: 'potion', healed: this.hero.heal(this.hero.maxHp) }
  }

  /** Sac, bouclier : le prochain coup de l'ennemi ne touche pas. */
  useShield(): CombatEvent {
    this.shield = true
    return { kind: 'shield_up' }
  }

  private succeed(action: Action, answer: Answer, events: CombatEvent[]): void {
    this.correctRun += 1
    let crit = answer.speedRatio < CRIT_RATIO && !answer.hintUsed
    let mult = crit ? CRIT_MULT : answer.speedRatio < 1 ? FAST_MULT : 1
    if (this.noSpeed) {
      // La vitesse ne compte pas ; le coup critique récompense la régularité.
      crit = this.correctRun >= STREAK_FOR_CRIT && !answer.hintUsed
      mult = crit ? CRIT_MULT : 1
      if (crit) this.correctRun = 0
    }
    const { foe, engagement } = this.fightNow()
    let base = BASE_POWER[action]
    if (engagement.boss && action !== 'soin') {
      base = Math.ceil(foe.maxHp / BOSS_HITS)
      mult = crit ? BOSS_CRIT_MULT : 1
    }
    if (answer.hintUsed) mult *= HINT_MULT
    const power = Math.round(base * mult * answer.rewardFactor)
    events.push({ kind: 'xp', amount: answerXp(answer.difficulty) })
    if (action === 'soin') {
      events.push({ kind: 'hero_heal', healed: this.hero.heal(power) })
      return
    }
    foe.damage(power)
    events.push({ kind: 'hero_strike', action, power, crit })
  }

  private riposte(guarded: boolean): CombatEvent {
    if (this.shield) {
      this.shield = false
      return { kind: 'foe_attack', damage: 0, blocked: true }
    }
    const [low, high] = FOE_DAMAGE[this.settings.world]
    const base = low + Math.floor(this.random() * (high - low + 1))
    const damage = Math.round((base + this.fightNow().engagement.tier) * (guarded ? GUARD_MULT : 1))
    this.hero.damage(damage)
    return { kind: 'foe_attack', damage, blocked: false }
  }
}
