import { describe, expect, it } from 'vitest'
import niveaux from '@content/monde/sphinx_niveaux.json'
import { SphinxBoard } from '../src/core/sphinx/board'
import {
  boxStates, CAMERA_BETA, cellAt, cellCenter, frame, freeWindow, glide, PALETTES, project, SLIDE_LIMIT, templePlan, TILE, WORLD_DIRS, yawOf,
} from '../src/core/sphinx/stage'

const levels: { rows: string[] }[] = niveaux.tiers.flat()
const biggest = levels.reduce((a, b) => (b.rows.length * Math.max(...b.rows.map((r) => r.length)) > a.rows.length * Math.max(...a.rows.map((r) => r.length)) ? b : a))

describe('Le temple du Sphinx en 3D : le plan', () => {
  it('chaque case a un centre, et le clic le retrouve', () => {
    const board = SphinxBoard.fromRows(biggest.rows)
    for (let y = 0; y < board.height; y += 1) {
      for (let x = 0; x < board.width; x += 1) {
        const c = cellCenter(board.height, { x, y })
        expect(cellAt(board.height, c)).toEqual({ x, y })
        // Un point à l'intérieur de la dalle donne la même case.
        expect(cellAt(board.height, { x: c.x + TILE * 0.45, z: c.z - TILE * 0.45 })).toEqual({ x, y })
      }
    }
  })

  it('l’orientation : « haut » éloigne de la caméra du sud, « droite » va vers la droite de l’écran', () => {
    const board = SphinxBoard.fromRows(biggest.rows)
    const here = { x: 4, y: 4 }
    const base = cellCenter(board.height, here)
    const up = cellCenter(board.height, { x: here.x, y: here.y - 1 })
    const right = cellCenter(board.height, { x: here.x + 1, y: here.y })
    expect(up.z).toBeGreaterThan(base.z) // vers le nord (+z), loin de la caméra
    expect(up.x).toBe(base.x)
    expect(right.x).toBeGreaterThan(base.x)
    expect(right.z).toBe(base.z)
    // Les directions du monde suivent celles du plateau.
    expect(WORLD_DIRS.u).toEqual({ x: 0, z: 1 })
    expect(WORLD_DIRS.d).toEqual({ x: 0, z: -1 })
    expect(WORLD_DIRS.r).toEqual({ x: 1, z: 0 })
    expect(WORLD_DIRS.l).toEqual({ x: -1, z: 0 })
    // À l'écran : la caméra cadrée sur la salle voit « haut » monter et « droite » aller à droite.
    const plan = templePlan(board)
    const shot = frame(plan, 16 / 9, freeWindow(1280, 330))
    const a = project(shot, 16 / 9, { x: base.x, y: 0, z: base.z })
    const upScreen = project(shot, 16 / 9, { x: up.x, y: 0, z: up.z })
    const rightScreen = project(shot, 16 / 9, { x: right.x, y: 0, z: right.z })
    expect(upScreen.y).toBeGreaterThan(a.y)
    expect(rightScreen.x).toBeGreaterThan(a.x)
    expect(Math.abs(upScreen.x - a.x)).toBeLessThan(0.02)
  })

  it('le héros regarde dans le sens où il marche', () => {
    expect(yawOf('u')).toBeCloseTo(0)
    expect(yawOf('r')).toBeCloseTo(Math.PI / 2)
    expect(yawOf('l')).toBeCloseTo(-Math.PI / 2)
    expect(Math.abs(yawOf('d'))).toBeCloseTo(Math.PI)
  })

  it('le plan reprend les dalles, les dalles gravées et les murs qui touchent le temple', () => {
    const board = SphinxBoard.fromRows(['~~#####', '#  .@ #', '# $   #', '#######'])
    const plan = templePlan(board)
    expect(plan.floor).toHaveLength(board.width * board.height - board.walls.length - board.sand.length)
    expect(plan.goals).toEqual([{ x: 3, y: 1 }])
    // Les murs du sable (~~) ne sont pas dessinés : ils ne touchent aucune dalle.
    expect(plan.walls.some((w) => w.cell.x === 0 && w.cell.y === 0)).toBe(false)
    expect(plan.walls.some((w) => w.cell.x === 2 && w.cell.y === 0)).toBe(true)
    expect(plan.min).toEqual({ x: 0, y: 0 })
    expect(plan.max).toEqual({ x: 6, y: 3 })
  })

  it('un mur qui a une dalle derrière lui est bas (la caméra du sud ne perd pas un bloc derrière lui)', () => {
    const board = SphinxBoard.fromRows(['#####', '# $ #', '#.#.#', '# @ #', '#####'])
    const plan = templePlan(board)
    const at = (x: number, y: number) => plan.walls.find((w) => w.cell.x === x && w.cell.y === y)!
    expect(at(0, 0).low).toBe(false) // le mur du fond : rien derrière
    expect(at(2, 2).low).toBe(true) // un pilier : la dalle (2, 1) est derrière lui
    expect(at(2, 4).low).toBe(true) // le mur du bas, devant la dalle (2, 3)
    expect(at(0, 2).low).toBe(false) // un mur du côté : la case derrière est un mur
  })

  it('l’état de chaque bloc : posé, coincé ou libre', () => {
    const goals = [{ x: 1, y: 1 }]
    expect(boxStates([{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }], goals, 1)).toEqual(['pose', 'coince', 'libre'])
    expect(boxStates([{ x: 1, y: 1 }], goals, 0)).toEqual(['pose']) // un bloc posé n'est jamais « coincé »
    expect(boxStates([], goals, -1)).toEqual([])
  })
})

describe('Le temple du Sphinx en 3D : la caméra', () => {
  const sizes: [number, number][] = [[1280, 330], [1280, 0], [1920, 380], [1024, 300]]

  it('toute la salle tient dans la fenêtre libre, pour les 180 niveaux et plusieurs tailles d’écran', () => {
    for (const [width, inset] of sizes) {
      const aspect = width / ((width * 9) / 16)
      const window = freeWindow(width, inset)
      for (const level of levels) {
        const plan = templePlan(SphinxBoard.fromRows(level.rows))
        const shot = frame(plan, aspect, window)
        // Les dalles et le pied des murs aux quatre coins de la salle.
        const south = cellCenter(plan.height, { x: 0, y: plan.max.y }).z - TILE / 2
        const north = cellCenter(plan.height, { x: 0, y: plan.min.y }).z + TILE / 2
        for (const x of [plan.min.x * TILE - TILE / 2, plan.max.x * TILE + TILE / 2]) {
          for (const z of [south, north]) {
            const p = project(shot, aspect, { x, y: 0, z })
            expect(p.depth).toBeGreaterThan(0)
            expect(p.x).toBeGreaterThanOrEqual(window.xMin - 1e-6)
            expect(p.x).toBeLessThanOrEqual(window.xMax + 1e-6)
            expect(p.y).toBeGreaterThanOrEqual(window.yMin - 1e-6)
            expect(p.y).toBeLessThanOrEqual(window.yMax + 1e-6)
          }
        }
        expect(shot.beta).toBe(CAMERA_BETA)
      }
    }
  })

  it('une petite salle est cadrée de plus près qu’une grande', () => {
    const small = frame(templePlan(SphinxBoard.fromRows(levels[0]!.rows)), 16 / 9, freeWindow(1280, 330))
    const big = frame(templePlan(SphinxBoard.fromRows(biggest.rows)), 16 / 9, freeWindow(1280, 330))
    expect(small.radius).toBeLessThan(big.radius)
  })

  it('un panneau plus large (texte agrandi) éloigne la caméra, sans la sortir de la fenêtre', () => {
    const plan = templePlan(SphinxBoard.fromRows(biggest.rows))
    const narrow = frame(plan, 16 / 9, freeWindow(1280, 280))
    const wide = frame(plan, 16 / 9, freeWindow(1280, 560))
    expect(wide.radius).toBeGreaterThan(narrow.radius)
  })

  it('la salle est décalée vers la gauche quand le panneau est à droite', () => {
    const plan = templePlan(SphinxBoard.fromRows(biggest.rows))
    const centered = frame(plan, 16 / 9, freeWindow(1280, 0))
    const shifted = frame(plan, 16 / 9, freeWindow(1280, 420))
    // Le point visé est à droite du centre de la salle : la salle apparaît à gauche.
    expect(shifted.target.x).toBeGreaterThan(centered.target.x)
  })
})

describe('Le temple du Sphinx en 3D : le mouvement et les couleurs', () => {
  it('un mouvement se rapproche du but sans le dépasser, et il est presque fini en 110 ms (le pas suivant d’une marche)', () => {
    let at = 0
    const goal = TILE
    for (let frame = 0; frame < 7; frame += 1) {
      const next = glide(at, goal, 0.016)
      expect(next).toBeGreaterThanOrEqual(at)
      expect(next).toBeLessThanOrEqual(goal)
      at = next
    }
    expect(goal - at).toBeLessThan(0.03 * TILE)
  })

  it('un saut de plus d’une dalle et demie, ou le mode calme, arrive d’un coup', () => {
    expect(glide(0, TILE * (SLIDE_LIMIT + 0.2), 0.016)).toBe(TILE * (SLIDE_LIMIT + 0.2))
    expect(glide(0, TILE, 0.016, true)).toBe(TILE)
    expect(glide(0, TILE, 0.016)).toBeGreaterThan(0)
    expect(glide(0, TILE, 0.016)).toBeLessThan(TILE)
  })

  it('chaque monde a toutes ses couleurs, en hexadécimal', () => {
    for (const world of ['lumineux', 'brouillard'] as const) {
      for (const [name, value] of Object.entries(PALETTES[world])) {
        if (typeof value === 'string') expect(value, `${world}.${name}`).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })
})
