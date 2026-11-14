/**
 * Les reliques : seize sceaux de la Grande Chronique, un par couple d'un élément (flamme, onde, feuille, étoile) et d'un rang (I à IV)
 * (décision D13, contenu : content/monde/reliques.json). Huit se ramassent dans l'île, huit tombent du coffre des premiers lieux
 * terminés. Le lien entre deux reliques, c'est ce qu'elles partagent : le même élément, ou le même rang.
 *
 * Elles servent à la Table des Reliques : un carré de 4 × 4 où chaque rangée et chaque colonne ne doit répéter ni un élément ni
 * un rang. Les reliques que l'enfant possède sont à placer ; les autres sont déjà gravées dans la pierre, donc plus il en a, plus la
 * table est ouverte. La table se fabrique à partir d'un carré complet : elle est soluble par construction. Pur, comme tout `core/` :
 * l'interface range la nouvelle partie par `persist`, la scène 3D ne décide de rien.
 */
import reliques from '@content/monde/reliques.json'
import type { ItemId } from './inventory'
import { findItems } from './quest/enigma'
import type { SaveData } from './save'

export const SIZE = 4
export const CELLS = SIZE * SIZE
/** Il faut au moins deux reliques pour qu'une table ait un sens. */
export const MIN_RELICS = 2
/** Au plus ce nombre de cases à remplir : au-delà, les reliques en trop sont déjà gravées (seize cases ouvertes, c'est trop pour un soir). */
export const MAX_HOLES = 9
/** XP par case à remplir, au premier carré résolu de la journée. */
export const TABLE_XP_PER_HOLE = 8
/** À partir de ce nombre de cases à remplir, le premier carré du jour rapporte aussi un objet du sac. */
export const TABLE_ITEM_FROM = 5

export type ElementId = 'flamme' | 'onde' | 'feuille' | 'etoile'
export type Shape = 'triangle' | 'cercle' | 'losange' | 'etoile'

export interface ElementInfo {
  id: ElementId
  nom: string
  /** « de Flamme », « d'Onde » : pour le nom d'un sceau. */
  de: string
  couleur: string
  /** Chaque élément a sa forme, pas seulement sa couleur : la table se lit sans voir les couleurs. */
  forme: Shape
}

export type RelicSource =
  | { type: 'ile'; region: string; x: number; z: number }
  | { type: 'lieu'; apres: number }

export interface Relic {
  id: string
  element: ElementId
  /** 1 à 4. */
  rank: number
  /** « I » à « IV ». */
  roman: string
  name: string
  source: RelicSource
}

export const ELEMENTS = (reliques as unknown as { elements: ElementInfo[] }).elements
const ROMAN = (reliques as unknown as { rangs: string[] }).rangs

export const RELICS: readonly Relic[] = (
  reliques as unknown as { reliques: { element: ElementId; rang: number; source: RelicSource }[] }
).reliques.map((r) => {
  const element = ELEMENTS.find((e) => e.id === r.element)!
  return {
    id: `${r.element}-${r.rang}`,
    element: r.element,
    rank: r.rang,
    roman: ROMAN[r.rang - 1] ?? String(r.rang),
    name: `Sceau ${element.de} ${ROMAN[r.rang - 1] ?? r.rang}`,
    source: r.source,
  }
})

const BY_ID = new Map(RELICS.map((r) => [r.id, r]))

export const relicOf = (id: string): Relic | null => BY_ID.get(id) ?? null

export const elementOf = (relic: Relic): ElementInfo => ELEMENTS.find((e) => e.id === relic.element)!

/** Les reliques de l'île, avec leur place. */
export const ISLAND_RELICS = RELICS.filter((r): r is Relic & { source: Extract<RelicSource, { type: 'ile' }> } => r.source.type === 'ile')

/** Les reliques relues d'une partie : seulement des sceaux qui existent, une fois chacun, dans l'ordre où on les a trouvés. */
export function normalizeRelics(given: unknown): string[] {
  if (!Array.isArray(given)) return []
  const out: string[] = []
  for (const id of given) if (typeof id === 'string' && BY_ID.has(id) && !out.includes(id)) out.push(id)
  return out
}

/** La partie avec la relique en plus (jamais deux fois), ou la même partie si on l'a déjà. */
export function grantRelic(save: SaveData, id: string): SaveData {
  if (!BY_ID.has(id) || save.relics.includes(id)) return save
  return { ...save, relics: [...save.relics, id] }
}

/**
 * La relique que le coffre d'un lieu rend, quand ce lieu vient d'être terminé pour la première fois (`completed` : combien de lieux
 * sont terminés, celui-ci compris) : la première des reliques de coffre dont c'est le tour et qu'on n'a pas encore. Si une partie
 * ancienne a déjà plus de lieux terminés que de reliques rendues, le rattrapage se fait un coffre après l'autre.
 */
export function chestRelic(owned: readonly string[], completed: number): Relic | null {
  return (
    RELICS.filter((r) => r.source.type === 'lieu' && r.source.apres <= completed && !owned.includes(r.id)).sort(
      (a, b) => (a.source as { apres: number }).apres - (b.source as { apres: number }).apres,
    )[0] ?? null
  )
}

/** Le nombre de lieux terminés d'une partie. */
export const placesDone = (save: Pick<SaveData, 'places'>): number => Object.values(save.places).filter((n) => n > 0).length

// --- La table ---------------------------------------------------------------------------------------------------------------

/** Neuf ou seize cases : l'identifiant de la relique posée, ou null. Rangée par rangée, de haut en bas. */
export type Board = readonly (string | null)[]

export const rowOf = (cell: number): number => Math.floor(cell / SIZE)
export const columnOf = (cell: number): number => cell % SIZE

/** Deux reliques se « répondent » quand elles partagent un élément ou un rang : c'est ce que la table interdit dans une même ligne. */
export function share(a: string, b: string): boolean {
  const first = BY_ID.get(a)
  const second = BY_ID.get(b)
  return !!first && !!second && (first.element === second.element || first.rank === second.rank)
}

/** Les cases en conflit : une relique qui en croise une autre de sa rangée ou de sa colonne par un élément ou un rang commun. */
export function clashes(board: Board): number[] {
  const bad = new Set<number>()
  for (let a = 0; a < CELLS; a += 1) {
    const first = board[a]
    if (!first) continue
    for (let b = a + 1; b < CELLS; b += 1) {
      const second = board[b]
      if (!second || (rowOf(a) !== rowOf(b) && columnOf(a) !== columnOf(b))) continue
      if (share(first, second)) {
        bad.add(a)
        bad.add(b)
      }
    }
  }
  return [...bad].sort((x, y) => x - y)
}

/** La table est résolue : toutes les cases sont remplies et aucune relique n'en croise une autre. */
export const isSolved = (board: Board): boolean => board.length === CELLS && board.every((id) => id !== null) && clashes(board).length === 0

/** Un carré complet connu (construction classique des « seize officiers » d'Euler), pour ne jamais rester sans table. */
const KNOWN_SQUARE: readonly (readonly [ElementId, number])[] = [
  ['flamme', 1], ['onde', 2], ['feuille', 3], ['etoile', 4],
  ['feuille', 4], ['etoile', 3], ['flamme', 2], ['onde', 1],
  ['etoile', 2], ['feuille', 1], ['onde', 4], ['flamme', 3],
  ['onde', 3], ['flamme', 4], ['etoile', 1], ['feuille', 2],
]

export const knownSquare = (): string[] => KNOWN_SQUARE.map(([element, rank]) => `${element}-${rank}`)

/** Un petit générateur déterministe (mulberry32) : même graine, même table, sur tous les PC. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** Un carré complet au hasard : les seize reliques, chacune une fois, sans répétition d'élément ni de rang dans une rangée ou une colonne. */
export function randomSquare(random: () => number): string[] {
  const cells: (string | null)[] = Array.from({ length: CELLS }, () => null)
  const used = new Set<string>()
  let budget = 20000 // l'ordre quatre se résout en quelques centaines d'essais ; la borne n'est qu'un garde-fou
  const search = (cell: number): boolean => {
    if (cell === CELLS) return true
    for (const relic of shuffled(RELICS, random)) {
      if (used.has(relic.id) || budget <= 0) continue
      budget -= 1
      cells[cell] = relic.id
      if (clashes(cells).length === 0) {
        used.add(relic.id)
        if (search(cell + 1)) return true
        used.delete(relic.id)
      }
      cells[cell] = null
    }
    return false
  }
  return search(0) ? (cells as string[]) : knownSquare()
}

export interface Puzzle {
  seed: number
  /** Pour chaque case, la relique gravée dans la pierre, ou null si c'est à l'enfant de la remplir. */
  fixed: Board
  /** Les reliques de l'enfant que cette table lui demande de placer (autant que de cases à remplir). */
  pool: readonly string[]
  /** Un carré complet qui convient : il sert à l'indice. Une autre solution est acceptée aussi. */
  solution: readonly string[]
}

/**
 * Une table pour l'enfant qui possède `owned` : ses reliques (au plus MAX_HOLES) sont à placer, toutes les autres sont gravées à leur
 * place dans un carré complet. null s'il en possède moins de MIN_RELICS.
 */
export function makePuzzle(owned: readonly string[], seed: number, maxHoles = MAX_HOLES): Puzzle | null {
  const mine = normalizeRelics([...owned])
  if (mine.length < MIN_RELICS) return null
  const random = seeded(seed)
  const solution = randomSquare(random)
  const pool = shuffled(mine, random).slice(0, Math.max(MIN_RELICS, maxHoles))
  const fixed = solution.map((id) => (pool.includes(id) ? null : id))
  return { seed, fixed, pool, solution }
}

/** Le tableau de départ : les reliques gravées, les autres cases vides. */
export const startBoard = (puzzle: Puzzle): Board => puzzle.fixed

export const holesOf = (puzzle: Puzzle): number[] => puzzle.fixed.flatMap((id, cell) => (id === null ? [cell] : []))

/** Les reliques à placer qui ne sont pas encore sur la table, dans l'ordre. */
export const tray = (puzzle: Puzzle, board: Board): string[] => puzzle.pool.filter((id) => !board.includes(id))

/**
 * Pose une relique sur une case à remplir (si elle était déjà ailleurs sur la table, elle y est reprise : elle change de place). null si
 * la case est gravée ou si la relique n'est pas de celles de cette table.
 */
export function place(puzzle: Puzzle, board: Board, cell: number, id: string): Board | null {
  if (cell < 0 || cell >= CELLS || puzzle.fixed[cell] !== null || !puzzle.pool.includes(id)) return null
  return board.map((current, index) => (index === cell ? id : current === id && puzzle.fixed[index] === null ? null : current))
}

/** Reprend la relique posée sur une case à remplir ; la même table si la case est gravée ou déjà vide. */
export function lift(puzzle: Puzzle, board: Board, cell: number): Board {
  if (cell < 0 || cell >= CELLS || puzzle.fixed[cell] !== null || board[cell] === null) return board
  return board.map((current, index) => (index === cell ? null : current))
}

/** Un indice : une case à remplir où la relique manque ou n'est pas celle du carré connu, avec la bonne. null si tout est juste. */
export function hint(puzzle: Puzzle, board: Board): { cell: number; id: string } | null {
  const wrong = holesOf(puzzle).filter((cell) => board[cell] !== puzzle.solution[cell])
  const cell = wrong.find((c) => board[c] === null) ?? wrong[0]
  return cell === undefined ? null : { cell, id: puzzle.solution[cell]! }
}

/** La table après un indice (la bonne relique à la bonne case), ou null s'il n'y a plus rien à indiquer. */
export function applyHint(puzzle: Puzzle, board: Board): Board | null {
  const given = hint(puzzle, board)
  return given ? place(puzzle, board, given.cell, given.id) : null
}

// --- La récompense du jour ----------------------------------------------------------------------------------------------------

/** Une graine pour la table d'un jour (`2026-11-14`) : la même toute la journée, une autre demain. */
export function dailySeed(day: string): number {
  let hash = 2166136261
  for (let i = 0; i < day.length; i += 1) hash = Math.imul(hash ^ day.charCodeAt(i), 16777619)
  return hash >>> 0
}

export interface Reward {
  xp: number
  items: number
}

export const tableReward = (puzzle: Puzzle): Reward => ({
  xp: puzzle.pool.length * TABLE_XP_PER_HOLE,
  items: puzzle.pool.length >= TABLE_ITEM_FROM ? 1 : 0,
})

export interface Claim {
  save: SaveData
  xp: number
  found: ItemId[]
}

/**
 * La table résolue : le premier carré du jour rapporte de l'XP et, à partir de TABLE_ITEM_FROM cases, un objet du sac. Les suivants du même
 * jour sont de l'entraînement (null). Rend une nouvelle partie, jamais modifiée sur place.
 */
export function claimTable(save: SaveData, puzzle: Puzzle, day: string, random: () => number = Math.random): Claim | null {
  if (save.table === day) return null
  const reward = tableReward(puzzle)
  const { save: withItems, found } = findItems(save, reward.items, random)
  return { save: { ...withItems, xp: save.xp + reward.xp, table: day }, xp: reward.xp, found }
}
