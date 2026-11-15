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
 *
 * Jamais deux fois la même question dans un parcours (un lieu, l'île, un défi : de `reset` à `reset`). « La même » veut dire
 * le même contenu, pas seulement le même identifiant : deux items tirés avec des graines différentes peuvent poser le même
 * énoncé (`questionSignature`). Quand le rôle demandé n'a plus de question inédite, on en prend une de l'autre rôle
 * (automatisme ↔ chapitre) ; ce n'est que paquet entièrement posé qu'on reprend la plus ancienne (`repeats` le compte, les
 * tests le surveillent sur de vrais paquets). Entre deux parcours de la même séance, on préfère aussi le contenu pas encore vu.
 */
import { check } from './answers'
import type { Item, Role, UserInput } from './items'

export const RETRY_AFTER = 2
/** Contenus vus pendant la séance (de la page) que l'on garde pour préférer l'inédit d'un parcours à l'autre. */
export const SEEN_LIMIT = 500
export const RUSH_WINDOW = 3
export const RUSH_RATIO = 0.25
export const RUSH_PENALTY_QUESTIONS = 5

/** Types de question que le client v2 sait afficher (ui/widgets/Widgets.tsx). */
export const SUPPORTED_TYPES = new Set(['mcq', 'numeric', 'expression', 'text', 'order', 'true_false', 'vector', 'number_line', 'sign_table'])

/**
 * Visuels que le client v2 sait dessiner (ui/widgets/Visuals.tsx). Une question dont le visuel est
 * absent d'ici n'est jamais posée : sans lui, l'énoncé serait souvent incompréhensible (robot,
 * carte, graphique). À agrandir en même temps que les composants. Restent pont, rapporteur et repere_tir :
 * leurs générateurs (`combat=False`) ne servent qu'au pont des fractions et au stand de tir de la Citadelle,
 * jamais dans un lieu ; les 30 lieux sont jouables avec ce qui est dessiné.
 */
export const SUPPORTED_VISUALS = new Set(['balance', 'number_line', 'grid', 'sign_table', 'map', 'robot', 'graph', 'table'])

export function isPlayable(item: Item): boolean {
  if (!SUPPORTED_TYPES.has(item.type)) return false
  const kind = item.visual?.kind
  return !item.visual || (typeof kind === 'string' && SUPPORTED_VISUALS.has(kind))
}

/**
 * Ce qui fait « la même question » pour l'enfant : le type, l'énoncé, le visuel, le texte lu (exercice d'écoute), les propositions (dans le désordre) et la
 * bonne réponse (le texte de la bonne proposition, pas son rang : un QCM mélangé autrement reste le même QCM). Ni
 * l'identifiant, ni la graine, ni l'indice, ni l'explication.
 */
export function questionSignature(item: Item): string {
  const choices = item.choices ? [...item.choices].sort() : null
  const answer = item.answer.kind === 'choice' ? (item.choices?.[item.answer.index] ?? item.answer.index) : item.answer
  return JSON.stringify([item.type, item.prompt, item.latex ?? null, item.visual ?? null, item.listen?.text ?? null, choices, answer])
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
  /**
   * Questions posées dans ce parcours : contenu (`questionSignature`) → rang. Par le contenu et non l'identifiant : un jumeau
   * tiré avec une autre graine compte comme posé. La plus ancienne se reprend la première, en dernier recours.
   */
  private asked = new Map<string, number>()
  private turn = 0
  private lastAsked = ''
  /** Contenus vus pendant la séance, tous parcours confondus : on les évite tant qu'il reste de l'inédit. */
  private seen = new Set<string>()
  /** Combien de fois ce parcours a dû reposer une question parce que le paquet entier était posé (0 attendu). */
  repeats = 0
  private retry: { notion: string; dueIn: number }[] = []
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
    this.asked.clear()
    this.turn = 0
    this.lastAsked = ''
    this.repeats = 0
    this.retry = []
    this.rushStreak = 0
    this.penaltyLeft = 0
    this.answered = 0
    this.correctCount = 0
  }

  levelFor(role: Role): number {
    return role === 'enigme' ? 1 : this.level[role]
  }

  /**
   * Prochain item pour un rôle (n'importe lequel si `role` est absent) ; `level` impose la difficulté visée (boss).
   * Rôle « enigme » : dans l'ordre du paquet, et null quand elles sont toutes posées (l'appelant prend alors une question du
   * chapitre : une énigme ne se repose jamais). Autres rôles : toujours une question **pas encore posée dans ce parcours**,
   * d'abord du rôle demandé, puis de l'autre rôle ; null seulement si le paquet est vide.
   */
  next(role?: Role, level = 0): Item | null {
    const items = this.source.items()
    const ofRole = this.playable(items.filter((it) => !role || it.role === role))
    if (ofRole.length === 0 && role === 'automatisme') {
      // Matière sans automatismes : une question du chapitre, un cran plus facile.
      return this.next('chapitre', level > 0 ? level : Math.max(1, this.levelFor('chapitre') - 1))
    }
    let pool = this.fresh(ofRole)
    if (role === 'enigme') return pool.length > 0 ? this.take(pool[0]!) : null
    // Son rôle n'a plus de question inédite (qui ne fait que frapper vide les automatismes en vingt coups) : l'autre rôle en a,
    // à la difficulté la plus proche (un cran plus facile quand ce sont des questions du chapitre au lieu d'automatismes).
    const other: Adaptive | null = role === 'automatisme' ? 'chapitre' : role === 'chapitre' ? 'automatisme' : null
    const lent = other ? this.playable(items.filter((it) => it.role === other)) : []
    let target = level > 0 ? level : role ? this.levelFor(role) : 1
    if (pool.length === 0 && other) {
      pool = this.fresh(lent)
      if (pool.length > 0 && level === 0) target = other === 'chapitre' ? Math.max(1, this.levelFor('chapitre') - 1) : this.levelFor('automatisme')
    }
    if (pool.length === 0) return this.repeat([...ofRole, ...lent], target)
    for (const entry of this.retry) {
      if (entry.dueIn > 0) continue
      // Une notion ratée revient sous une question inédite. Sans elle, l'entrée attend : mieux vaut ne pas la reposer que
      // reposer une question déjà vue (elle s'efface avec le parcours).
      const again = pool.filter((it) => it.notions.includes(entry.notion))
      if (again.length > 0) {
        this.retry.splice(this.retry.indexOf(entry), 1)
        return this.take(this.closest(again, target))
      }
    }
    return this.take(this.closest(pool, target))
  }

  /**
   * Prochaine question d'une quête du village (core/village.ts), portée de la v1 : `enquete` = les énigmes du générateur, dans l'ordre du paquet (trois
   * questions sur un même document), null quand elles sont toutes posées ; `revision` = les notions à revoir (catégorie « revision ») ; `veille` = les
   * questions des `chapters` donnés. Sans candidate (ou quand elles sont toutes posées), révision et veille prennent une question inédite de n'importe quel chapitre. Jamais deux fois la même dans le
   * parcours (une quête est un parcours : `reset` à son début).
   */
  nextQuestItem(quest: 'revision' | 'veille' | 'enquete', generator = '', chapters: string[] = []): Item | null {
    const items = this.source.items()
    const matching = (it: Item): boolean => {
      if (quest === 'enquete') return it.role === 'enigme' && (it.generator ?? '') === generator
      if (quest === 'revision') return it.category === 'revision'
      const chapter = (it.notions[0] ?? '').replace(/\.[^.]*$/, '')
      return it.category === 'chapitre' && chapters.includes(chapter)
    }
    let candidates = this.playable(items.filter(matching))
    if (candidates.length === 0 && quest !== 'enquete') candidates = this.playable(items.filter((it) => it.category === 'chapitre'))
    let pool = this.fresh(candidates)
    if (quest === 'enquete') return pool.length > 0 ? this.take(pool[0]!) : null
    // Les candidates sont toutes posées : une question inédite d'un autre chapitre vaut mieux que reposer la plus ancienne.
    if (pool.length === 0) pool = this.fresh(this.playable(items.filter((it) => it.category === 'chapitre')))
    if (pool.length === 0) return this.repeat(candidates, this.levelFor('chapitre'))
    return this.take(this.closest(pool, this.levelFor('chapitre')))
  }

  /** Les questions que ce parcours n'a pas posées (même contenu compris), de préférence celles que la séance n'a pas vues. */
  private fresh(items: Item[]): Item[] {
    const unasked = items.filter((it) => !this.asked.has(questionSignature(it)))
    const unseen = unasked.filter((it) => !this.seen.has(questionSignature(it)))
    return unseen.length > 0 ? unseen : unasked
  }

  /**
   * Dernier recours, paquet entièrement posé : la question posée il y a le plus longtemps (jamais celle qu'on vient de
   * poser, sauf s'il n'y en a qu'une). Compté dans `repeats` : un lieu n'en arrive pas là (test sur les vrais paquets).
   */
  private repeat(items: Item[], target: number): Item | null {
    if (items.length === 0) return null
    const others = items.filter((it) => questionSignature(it) !== this.lastAsked)
    const choices = others.length > 0 ? others : items
    const rank = (it: Item): number => this.asked.get(questionSignature(it)) ?? -1
    const oldest = Math.min(...choices.map(rank))
    this.repeats += 1
    return this.take(this.closest(choices.filter((it) => rank(it) === oldest), target))
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
      for (const notion of item.notions) this.retry.push({ notion, dueIn: RETRY_AFTER })
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
    const signature = questionSignature(item)
    this.turn += 1
    this.asked.set(signature, this.turn)
    this.lastAsked = signature
    this.seen.delete(signature) // se range en queue : la plus ancienne sort quand la liste déborde
    this.seen.add(signature)
    if (this.seen.size > SEEN_LIMIT) this.seen.delete(this.seen.values().next().value as string)
    return item
  }

  private closest(pool: Item[], level: number): Item {
    const gap = Math.min(...pool.map((it) => Math.abs(it.difficulty - level)))
    const candidates = pool.filter((it) => Math.abs(it.difficulty - level) === gap)
    return candidates[Math.floor(this.random() * candidates.length)]!
  }
}
