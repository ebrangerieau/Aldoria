/**
 * Énigme de blocs du temple du Sphinx (type Sokoban), règles seules ; la 3D viendra dans game/. Porté de la v1
 * (core/puzzles/sphinx_board.gd). Le héros avance d'une dalle ; un bloc devant lui avance aussi si la dalle
 * suivante est libre. On ne tire jamais un bloc. L'énigme est résolue quand chaque dalle gravée porte un bloc.
 * Annuler revient d'un pas ; recommencer remet la salle comme au départ. Niveaux : content/monde/sphinx_niveaux.json.
 *
 * Lignes d'un niveau : « # » mur, espace dalle, « . » dalle gravée, « $ » bloc, « * » bloc sur une dalle gravée,
 * « @ » héros, « + » héros sur une dalle gravée, « ~ » sable (hors du temple).
 */
export interface Cell {
  x: number
  y: number
}

export type Dir = 'l' | 'r' | 'u' | 'd'

export const DIRS: Readonly<Record<Dir, Cell>> = {
  l: { x: -1, y: 0 },
  r: { x: 1, y: 0 },
  u: { x: 0, y: -1 },
  d: { x: 0, y: 1 },
}

const DIR_LIST = Object.keys(DIRS) as Dir[]

const key = (c: Cell): string => `${c.x},${c.y}`
const add = (a: Cell, b: Cell): Cell => ({ x: a.x + b.x, y: a.y + b.y })
const same = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y

export interface StepResult {
  moved: boolean
  /** Indice du bloc poussé (-1 : aucun). */
  box: number
}

export interface UndoResult {
  undone: boolean
  dir: Dir | null
  box: number
}

export function isDir(c: string): c is Dir {
  return c === 'l' || c === 'r' || c === 'u' || c === 'd'
}

export class SphinxBoard {
  width = 0
  height = 0
  readonly walls: Cell[] = []
  /** Hors du temple. */
  readonly sand: Cell[] = []
  readonly goals: Cell[] = []
  /** Position de chaque bloc ; l'indice ne change jamais (un objet 3D par bloc). */
  boxes: Cell[] = []
  player: Cell = { x: 0, y: 0 }
  moves = 0
  pushes = 0
  private readonly tiles = new Set<string>()
  private startBoxes: Cell[] = []
  private startPlayer: Cell = { x: 0, y: 0 }
  private history: { dir: Dir; box: number }[] = []

  static fromRows(rows: readonly string[]): SphinxBoard {
    const board = new SphinxBoard()
    board.height = rows.length
    rows.forEach((line, y) => {
      board.width = Math.max(board.width, line.length)
      for (let x = 0; x < line.length; x++) {
        const cell = { x, y }
        const c = line[x]!
        if (c === '#') {
          board.walls.push(cell)
          continue
        }
        if (c === '~') {
          board.sand.push(cell)
          continue
        }
        board.tiles.add(key(cell))
        if (c === '.' || c === '*' || c === '+') board.goals.push(cell)
        if (c === '$' || c === '*') board.boxes.push(cell)
        if (c === '@' || c === '+') board.player = cell
      }
    })
    board.startBoxes = board.boxes.map((b) => ({ ...b }))
    board.startPlayer = { ...board.player }
    return board
  }

  isSolved(): boolean {
    return this.goals.every((g) => this.boxAt(g) >= 0)
  }

  /** Indice du bloc posé sur cette dalle, -1 sinon. */
  boxAt(cell: Cell): number {
    return this.boxes.findIndex((b) => same(b, cell))
  }

  isTile(cell: Cell): boolean {
    return this.tiles.has(key(cell))
  }

  isFree(cell: Cell): boolean {
    return this.isTile(cell) && this.boxAt(cell) < 0
  }

  /** Un pas dans une direction : le héros avance, et pousse le bloc devant lui si la dalle suivante est libre. */
  step(dir: Dir): StepResult {
    const d = DIRS[dir]
    const to = add(this.player, d)
    if (!this.isTile(to)) return { moved: false, box: -1 }
    const box = this.boxAt(to)
    if (box >= 0) {
      const beyond = add(to, d)
      if (!this.isFree(beyond)) return { moved: false, box: -1 }
      this.boxes[box] = beyond
      this.pushes += 1
    }
    this.player = to
    this.moves += 1
    this.history.push({ dir, box })
    return { moved: true, box }
  }

  /** Revient d'un pas (le bloc poussé recule avec le héros). */
  undo(): UndoResult {
    const last = this.history.pop()
    if (!last) return { undone: false, dir: null, box: -1 }
    const d = DIRS[last.dir]
    if (last.box >= 0) {
      this.boxes[last.box] = { ...this.player }
      this.pushes -= 1
    }
    this.player = { x: this.player.x - d.x, y: this.player.y - d.y }
    this.moves -= 1
    return { undone: true, dir: last.dir, box: last.box }
  }

  canUndo(): boolean {
    return this.history.length > 0
  }

  restart(): void {
    this.boxes = this.startBoxes.map((b) => ({ ...b }))
    this.player = { ...this.startPlayer }
    this.moves = 0
    this.pushes = 0
    this.history = []
  }

  /** Pas à faire pour marcher jusqu'à une dalle sans pousser de bloc (vide : déjà là ou impossible). */
  pathTo(cell: Cell): Dir[] {
    if (same(cell, this.player) || !this.isFree(cell)) return []
    const prev = new Map<string, { from: Cell; dir: Dir }>()
    const seen = new Set([key(this.player)])
    const todo: Cell[] = [this.player]
    while (todo.length > 0) {
      const cur = todo.shift()!
      for (const dir of DIR_LIST) {
        const next = add(cur, DIRS[dir])
        if (seen.has(key(next)) || !this.isFree(next)) continue
        seen.add(key(next))
        prev.set(key(next), { from: cur, dir })
        if (same(next, cell)) {
          const path: Dir[] = []
          let at = next
          while (!same(at, this.player)) {
            const step = prev.get(key(at))!
            path.unshift(step.dir)
            at = step.from
          }
          return path
        }
        todo.push(next)
      }
    }
    return []
  }

  /** Indice d'un bloc hors d'une dalle gravée, coincé dans un coin : il ne bougera plus (annuler ou recommencer). -1 sinon. */
  stuckBox(): number {
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i]!
      if (this.goals.some((g) => same(g, b))) continue
      const left = !this.isTile({ x: b.x - 1, y: b.y })
      const right = !this.isTile({ x: b.x + 1, y: b.y })
      const up = !this.isTile({ x: b.x, y: b.y - 1 })
      const down = !this.isTile({ x: b.x, y: b.y + 1 })
      if ((left || right) && (up || down)) return i
    }
    return -1
  }

  /** Rejoue une suite de pas (lettres l r u d, majuscules ou minuscules) ; faux dès qu'un pas est impossible. */
  play(solution: string): boolean {
    for (const c of solution) {
      const dir = c.toLowerCase()
      if (!isDir(dir) || !this.step(dir).moved) return false
    }
    return true
  }
}
