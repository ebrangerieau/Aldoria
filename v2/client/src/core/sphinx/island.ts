/**
 * Île du Sphinx (idée de Jules ; jeux de logique, aucune question de leçon) : passages pour la barque et paliers des
 * énigmes de blocs. Porté de la v1 (core/progression/sphinx_island.gd et SaveManager.sphinx).
 *
 * Une activité où l'enfant enregistre au moins `PASS_ANSWERS` réponses (lieu, défi du jour, village, arène) rapporte un
 * passage, `MAX_PASSES` au plus en réserve ; une traversée en coûte un et propose `VISIT_PUZZLES` énigmes. Trois énigmes
 * résolues sans l'aide du Sphinx font monter d'un palier. Pur : l'état (`SphinxState`) est rendu à chaque fois, jamais
 * modifié sur place ; la partie (core/save.ts) le range.
 */
import niveaux from '@content/monde/sphinx_niveaux.json'

export const PASS_ANSWERS = 6
export const MAX_PASSES = 3
export const VISIT_PUZZLES = 3
export const TIER_UP = 3
export const TITLE = "L'Île du Sphinx"
/** Seuil sur la carte (Maître Ysaline présente l'île). */
export const THRESHOLD =
  "Au large, sur une île de sable, un vieux Sphinx garde un temple plein d'énigmes de pierre. Là-bas, pas de leçon à réviser : il faut réfléchir, essayer, se tromper et recommencer. La barque t'y conduit si tu as un passage."
export const HOW_TO_EARN = `Un passage par activité où tu réponds à au moins ${PASS_ANSWERS} questions : lieu, défi du jour, village ou arène.`

export interface SphinxLevel {
  rows: string[]
  /** Poussées de la solution la plus courte. */
  pushes: number
  /** Marche en minuscules, poussées en majuscules (l r u d). */
  solution: string
}

const TIERS: readonly (readonly SphinxLevel[])[] = niveaux.tiers

export function tierCount(): number {
  return TIERS.length
}

/** Palier de départ : la seconde commence un cran plus haut que la 6e. */
export function startTier(level: string): number {
  return level === '6e' || level === '5e' ? 1 : 2
}

/** Niveau `index` du palier `tier` (1 à tierCount) ; l'indice tourne quand le palier est épuisé. */
export function levelAt(tier: number, index: number): SphinxLevel {
  const levels = TIERS[Math.min(Math.max(Math.trunc(tier), 1), TIERS.length) - 1]!
  return levels[((Math.trunc(index) % levels.length) + levels.length) % levels.length]!
}

export function passesText(passes: number): string {
  if (passes <= 0) return 'Aucun passage'
  return `${passes} passage${passes > 1 ? 's' : ''}`
}

/** Une activité de ce mode et de ce nombre de réponses rapporte-t-elle un passage ? (l'île elle-même n'en rapporte pas) */
export function earnsPassage(mode: string, answered: number): boolean {
  return mode !== 'sphinx' && answered >= PASS_ANSWERS
}

/**
 * L'aide du Sphinx : il remet la salle comme au départ et rejoue le début de la solution, un tiers de plus à chaque
 * appel (au troisième, toute la solution). `hints` : nombre d'aides demandées, celle-ci comprise.
 */
export function helpSteps(solution: string, hints: number): string {
  const total = [...solution].filter((c) => c !== c.toLowerCase()).length
  const target = Math.ceil((total * Math.min(Math.max(hints, 0), 3)) / 3)
  let shown = ''
  let count = 0
  for (const c of solution) {
    if (count >= target) break
    shown += c
    if (c !== c.toLowerCase()) count += 1
  }
  return shown
}

export interface SphinxState {
  /** Passages en réserve. */
  passes: number
  tier: number
  /** Énigmes de suite résolues sans aide, dans le palier. */
  streak: number
  solved: number
  /** Prochaine énigme à proposer, par palier. */
  next: Record<string, number>
  /** Passages gagnés depuis la dernière annonce sur la carte. */
  news: number
}

export function initialSphinx(level: string): SphinxState {
  return { passes: 0, tier: startTier(level), streak: 0, solved: 0, next: {}, news: 0 }
}

const whole = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.trunc(v))) : fallback

/** État relu de la partie : champs manquants ou absurdes remplacés (une partie plus ancienne n'a pas tout). */
export function normalizeSphinx(raw: unknown, level: string): SphinxState {
  const base = initialSphinx(level)
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return base
  const r = raw as Record<string, unknown>
  const next: Record<string, number> = {}
  if (typeof r.next === 'object' && r.next !== null && !Array.isArray(r.next)) {
    for (const [tier, index] of Object.entries(r.next)) {
      if (/^\d+$/.test(tier) && typeof index === 'number' && Number.isFinite(index) && index >= 0) next[tier] = Math.trunc(index)
    }
  }
  return {
    passes: whole(r.passes, 0, MAX_PASSES, base.passes),
    tier: whole(r.tier, 1, tierCount(), base.tier),
    streak: whole(r.streak, 0, Number.MAX_SAFE_INTEGER, base.streak),
    solved: whole(r.solved, 0, Number.MAX_SAFE_INTEGER, base.solved),
    next,
    news: whole(r.news, 0, MAX_PASSES, base.news),
  }
}

/** Activité assez remplie : un passage de plus, sauf réserve pleine. */
export function earnPassage(s: SphinxState): { state: SphinxState; gained: boolean } {
  if (s.passes >= MAX_PASSES) return { state: s, gained: false }
  return { state: { ...s, passes: s.passes + 1, news: s.news + 1 }, gained: true }
}

/** Départ de la barque ; refusé sans passage. */
export function spendPassage(s: SphinxState): { state: SphinxState; ok: boolean } {
  if (s.passes <= 0) return { state: s, ok: false }
  return { state: { ...s, passes: s.passes - 1 }, ok: true }
}

/** Passages gagnés depuis la dernière annonce (la carte les annonce une fois). */
export function takePassageNews(s: SphinxState): { state: SphinxState; news: number } {
  if (s.news <= 0) return { state: s, news: 0 }
  return { state: { ...s, news: 0 }, news: s.news }
}

/** Prochaine énigme du palier atteint ; l'indice avance à chaque énigme proposée. */
export function nextPuzzle(s: SphinxState): { state: SphinxState; tier: number; index: number } {
  const tier = Math.min(Math.max(s.tier, 1), tierCount())
  const index = s.next[String(tier)] ?? 0
  return { state: { ...s, next: { ...s.next, [String(tier)]: index + 1 } }, tier, index }
}

/** Énigme résolue ; sans l'aide du Sphinx, elle compte pour monter d'un palier. `up` : on vient de monter. */
export function recordSolved(s: SphinxState, helped: boolean): { state: SphinxState; up: boolean } {
  const solved = s.solved + 1
  if (helped) return { state: { ...s, solved }, up: false }
  const streak = s.streak + 1
  if (streak >= TIER_UP && s.tier < tierCount()) return { state: { ...s, solved, streak: 0, tier: s.tier + 1 }, up: true }
  return { state: { ...s, solved, streak }, up: false }
}
