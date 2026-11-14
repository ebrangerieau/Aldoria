import { describe, expect, it } from 'vitest'
import { check } from '../src/core/answers'
import { isPlayable, SUPPORTED_VISUALS } from '../src/core/questionService'
import type { Item } from '../src/core/items'
import { PACK_6E } from './support'
import pack2nde from './fixtures/pack_2nde.json'
import samples from './fixtures/visual_samples.json'
import {
  arrowPoints,
  balanceFrom,
  canRemove,
  cellCenter,
  graphFrom,
  graphPixel,
  graphTicks,
  gridFrom,
  gridPixel,
  mapFrom,
  mapPixel,
  mapRoute,
  nearestTick,
  nextSign,
  numberLineFrom,
  removeBoth,
  robotFrom,
  sideText,
  signed,
  signColumns,
  signsComplete,
  signTableFrom,
  tickCount,
  tickFraction,
  tickLabel,
  ticksOf,
} from '../src/core/visuals'

const BALANCE = { kind: 'balance', left: { boxes: 1, units: 2 }, right: { boxes: 0, units: 4 }, box: ['sac', 'sacs'], unit: ['pièce', 'pièces'] }

describe('balance', () => {
  it('décrit chaque plateau en français, au singulier ou au pluriel', () => {
    const { state, names } = balanceFrom(BALANCE)
    expect(sideText(state.left, names)).toBe('1 sac et 2 pièces')
    expect(sideText(state.right, names)).toBe('4 pièces')
    expect(sideText({ boxes: 0, units: 0 }, names)).toBe('rien')
    expect(sideText({ boxes: 3, units: 1 }, names)).toBe('3 sacs et 1 pièce')
  })

  it('enlève la même chose des deux côtés, sans jamais descendre sous zéro', () => {
    const { state } = balanceFrom(BALANCE)
    expect(canRemove(state, 'boxes')).toBe(false) // pas de sac à droite
    expect(removeBoth(state, 'boxes')).toBe(state)
    let s = state
    while (canRemove(s, 'units')) s = removeBoth(s, 'units')
    expect(s.left).toEqual({ boxes: 1, units: 0 })
    expect(s.right).toEqual({ boxes: 0, units: 2 }) // un sac pèse 2 pièces : la balance le montre
  })

  it('prend des noms par défaut et ignore les valeurs invalides', () => {
    const { state, names } = balanceFrom({ left: { boxes: -3, units: 'x' } })
    expect(state.left).toEqual({ boxes: 0, units: 0 })
    expect(names.box).toEqual(['boîte', 'boîtes'])
  })
})

describe('droite graduée', () => {
  const line = numberLineFrom({ min: 0, max: 2, subdivisions: 2 })

  it('compte les graduations et aimante sur la plus proche', () => {
    expect(tickCount(line)).toBe(4)
    expect([0, 0.1, 0.13, 0.5, 0.99, 1].map((r) => nearestTick(line, r))).toEqual([0, 0, 1, 2, 4, 4])
    expect(nearestTick(line, -3)).toBe(0)
    expect(nearestTick(line, 9)).toBe(4)
  })

  it('écrit la réponse « k/sub » acceptée par le validateur de l’API', () => {
    const half = { kind: 'fraction' as const, value: '1/2', accept_equivalent: true, require_irreducible: false }
    expect(tickFraction(line, 1)).toBe('1/2')
    expect(check(half, tickFraction(line, 1))).toBe(true)
    expect(check(half, tickFraction(line, 2))).toBe(false)
    const shifted = numberLineFrom({ min: -2, max: 1, subdivisions: 4 })
    expect(tickFraction(shifted, 0)).toBe('-8/4')
    expect(check({ kind: 'fraction', value: '-2', accept_equivalent: true }, tickFraction(shifted, 0))).toBe(true)
  })

  it('retrouve la graduation d’un nombre, ou rien s’il est hors de la droite', () => {
    expect(ticksOf(line, '1/2')).toBe(1)
    expect(ticksOf(line, '1,5')).toBe(3)
    expect(ticksOf(line, '2')).toBe(4)
    expect(ticksOf(line, '5')).toBeNull()
    expect(ticksOf(line, 'abc')).toBeNull()
  })

  it('n’étiquette que les graduations principales', () => {
    expect([0, 1, 2, 3, 4].map((t) => tickLabel(line, t))).toEqual(['0', null, '1', null, '2'])
  })

  it('prend les valeurs par défaut de la v1 (0 à 1, deux graduations)', () => {
    expect(numberLineFrom({})).toEqual({ min: 0, max: 1, sub: 2 })
  })
})

describe('repère quadrillé', () => {
  const grid = gridFrom({
    span: 4,
    points: [
      { name: 'A', at: [-3, -1], role: 'source', hidden: false },
      { name: 'B', at: [-1, 3], role: 'target', hidden: true },
    ],
    path: ['A', 'B'],
  })

  it('garde une graduation de marge et lit les points', () => {
    expect(grid.span).toBe(5)
    expect(grid.points.map((p) => [p.name, p.hidden])).toEqual([['A', false], ['B', true]])
    expect(grid.path).toEqual(['A', 'B'])
  })

  it('place l’origine au centre, y vers le haut', () => {
    expect(gridPixel([0, 0], 5, 250)).toEqual([125, 125])
    expect(gridPixel([5, 5], 5, 250)).toEqual([250, 0])
    expect(gridPixel([-5, -5], 5, 250)).toEqual([0, 250])
  })
})

describe('tableau de signes', () => {
  it('fait tourner une case : vide, +, −, +', () => {
    expect(['', '+', '-', '+'].map((s) => nextSign(s as '' | '+' | '-'))).toEqual(['+', '-', '+', '-'])
  })

  it('écrit les intervalles à partir des racines', () => {
    expect(signColumns(['-2', '3'])).toEqual([']−∞ ; -2[', ']-2 ; 3[', ']3 ; +∞['])
    expect(signTableFrom({ roots: ['2'], rows: ['x − 2'] })).toEqual({ roots: ['2'], rows: ['x − 2'], columns: 2 })
  })

  it('n’autorise la validation que lorsque tout est rempli, et la réponse est celle de l’API', () => {
    expect(signsComplete(['+', ''])).toBe(false)
    expect(signsComplete([])).toBe(false)
    expect(signsComplete(['+', '-'])).toBe(true)
    expect(check({ kind: 'signs', value: ['-', '+'] }, ['-', '+'])).toBe(true)
    expect(check({ kind: 'signs', value: ['-', '+'] }, ['−', '+'])).toBe(true) // le vrai signe moins est accepté
  })
})

describe('questions jouables (registre des types et des visuels)', () => {
  const item = (over: Partial<Item>): Item => ({ id: 'x', type: 'numeric', difficulty: 1, notions: [], role: 'chapitre', prompt: '', answer: { kind: 'number', value: '1' }, hint: '', explanation: '', time_target_ms: 1000, ...over }) as Item

  it('pose une question sans visuel, ou dont le visuel est dessiné', () => {
    expect(isPlayable(item({}))).toBe(true)
    expect(isPlayable(item({ visual: { kind: 'balance' } }))).toBe(true)
    expect(isPlayable(item({ type: 'vector', visual: { kind: 'grid' } }))).toBe(true)
    expect(isPlayable(item({ type: 'sign_table', visual: { kind: 'sign_table' } }))).toBe(true)
  })

  it('ne pose jamais une question dont le visuel manque (pont, rapporteur, repère de tir) ni un type inconnu', () => {
    for (const kind of ['pont', 'rapporteur', 'repere_tir']) expect(isPlayable(item({ visual: { kind } }))).toBe(false)
    expect(isPlayable(item({ visual: {} }))).toBe(false)
    expect(isPlayable(item({ type: 'drag' as never }))).toBe(false)
  })

  it('rend jouables les énigmes des deux premiers lieux : balance (6e) et rayon (vecteurs, 2nde)', () => {
    // Les énigmes d'enquête du village (carte, tableau) viendront avec Clairval : phase 2.
    const of = (items: Item[], generator: string) => items.filter((i) => i.generator === generator)
    const balance = of(PACK_6E.items, '6e.prealgebre.balance')
    const rayon = of((pack2nde as unknown as { items: Item[] }).items, '2nde.vecteurs.rayon')
    expect(balance.length).toBeGreaterThan(0)
    expect(rayon.length).toBeGreaterThan(0)
    expect([...balance, ...rayon].every(isPlayable)).toBe(true)
  })

  it('ne déclare que des visuels que l’interface dessine', () => {
    expect([...SUPPORTED_VISUALS].sort()).toEqual(['balance', 'graph', 'grid', 'map', 'number_line', 'robot', 'sign_table'])
  })
})

// --- Carte, robot, courbe : calculs, puis questions réelles des générateurs ---------------------------

type Sample = Item & { generator: string; meta: Record<string, unknown> }
const SAMPLES = samples as unknown as Sample[]
const of = (generators: string[]) => SAMPLES.filter((s) => generators.includes(s.generator ?? ''))

describe('carte à l’échelle', () => {
  it('lit la carte, avec des valeurs par défaut si le visuel est incomplet', () => {
    const spec = mapFrom({ cols: 12, rows: 8, points: [{ label: 'Moulin', at: [2, 3] }, { label: 'Puits', at: [7, 3] }], scale: { cells: 2, text: '200 m' } })
    expect(spec.points).toEqual([{ label: 'Moulin', at: [2, 3] }, { label: 'Puits', at: [7, 3] }])
    expect(spec.scale).toEqual({ cells: 2, text: '200 m' })
    expect(mapFrom({})).toMatchObject({ cols: 12, rows: 8, points: [], path: [], scale: { cells: 0, text: '' } })
    expect(mapFrom({ scale: { ratio: 50000, text: 'Échelle 1/50 000' } }).scale).toEqual({ cells: 0, text: 'Échelle 1/50 000' })
  })

  it('place les points sur les intersections du quadrillage, et relie les deux lieux sans route', () => {
    expect(mapPixel([2, 3], 40, 20)).toEqual([100, 140])
    const spec = mapFrom({ points: [{ label: 'A', at: [1, 2] }, { label: 'B', at: [5, 2] }] })
    expect(mapRoute(spec)).toEqual([[1, 2], [5, 2]])
    expect(mapRoute(mapFrom({ points: [{ label: 'A', at: [1, 2] }, { label: 'B', at: [5, 6] }], path: [[1, 2], [5, 2], [5, 6]] }))).toHaveLength(3)
    expect(mapRoute(mapFrom({}))).toEqual([])
  })

  it('dessine, pour chaque question réelle, une route dont la longueur est celle que dit la question', () => {
    const maps = of(['6e.proportionnalite.carte'])
    expect(maps).toHaveLength(20)
    for (const s of maps) {
      const spec = mapFrom(s.visual ?? {})
      expect(spec.points).toHaveLength(2)
      const route = mapRoute(spec)
      const cells = route.slice(1).reduce((sum, p, i) => sum + Math.abs(p[0] - route[i]![0]) + Math.abs(p[1] - route[i]![1]), 0)
      expect(cells).toBe(s.meta.cells)
      for (const [x, y] of route) {
        expect(x >= 0 && x <= spec.cols && y >= 0 && y <= spec.rows).toBe(true)
      }
      expect(spec.scale.text).not.toBe('')
      expect(isPlayable(s)).toBe(true)
    }
  })
})

describe('robot sur une grille', () => {
  it('lit la grille, le départ, la direction et les cases proposées dans l’ordre des lettres', () => {
    const spec = robotFrom({ size: 6, start: [1, 4], facing: 'E', marks: { C: [0, 0], A: [3, 3], B: [5, 1] } })
    expect(spec).toEqual({ size: 6, start: [1, 4], facing: 'E', marks: [{ letter: 'A', at: [3, 3] }, { letter: 'B', at: [5, 1] }, { letter: 'C', at: [0, 0] }] })
    expect(robotFrom({ facing: 'Z' }).facing).toBe('N') // direction inconnue : vers le haut
  })

  it('centre une case et dirige la flèche du robot', () => {
    expect(cellCenter([2, 1], 44)).toEqual([110, 66])
    const tip = (h: 'N' | 'E' | 'S' | 'O') => arrowPoints([100, 100], h, 10)[0]
    expect(tip('N')).toEqual([100, 90])
    expect(tip('E')).toEqual([110, 100])
    expect(tip('S')).toEqual([100, 110])
    expect(tip('O')).toEqual([90, 100])
    // Les deux autres sommets sont derrière la pointe, de part et d'autre de l’axe.
    const [, a, b] = arrowPoints([100, 100], 'N', 10)
    expect(a![1]).toBeGreaterThan(100)
    expect(b![1]).toBeGreaterThan(100)
    expect(a![0] + b![0]).toBeCloseTo(200)
  })

  it('montre, pour chaque question réelle, la case d’arrivée sous la bonne lettre', () => {
    const robots = of(['6e.algorithmique.sequences', '6e.algorithmique.boucles'])
    expect(robots).toHaveLength(40)
    for (const s of robots) {
      const spec = robotFrom(s.visual ?? {})
      expect(spec.marks.map((m) => m.letter)).toEqual(s.choices)
      const answer = s.answer as { kind: 'choice'; index: number }
      const right = spec.marks[answer.index]!
      expect(right.at).toEqual(s.meta.end)
      expect(spec.start).toEqual(s.meta.start)
      expect(spec.facing).toBe(s.meta.facing)
      for (const m of spec.marks) expect(m.at.every((c) => c >= 0 && c < spec.size)).toBe(true)
      expect(new Set(spec.marks.map((m) => m.at.join(','))).size).toBe(spec.marks.length) // une lettre par case
      expect(spec.marks.some((m) => m.at.join(',') === spec.start.join(','))).toBe(false) // aucune lettre sur le départ
      expect(isPlayable(s)).toBe(true)
    }
  })
})

describe('courbe (lecture graphique)', () => {
  const SPEC = graphFrom({ xmin: -5, xmax: 5, ymin: -5, ymax: 5, points: [[-5, 2], [0, -1], [5, 4]] })

  it('place les points dans le cadre : y vers le haut, bords aux marges', () => {
    expect(graphPixel(SPEC, [-5, 5], 440, 360, 32)).toEqual([32, 32])
    expect(graphPixel(SPEC, [5, -5], 440, 360, 32)).toEqual([408, 328])
    expect(graphPixel(SPEC, [0, 0], 440, 360, 32)).toEqual([220, 180])
    expect(graphTicks(-2, 2)).toEqual([-2, -1, 0, 1, 2])
  })

  it('écrit le vrai signe moins, et ne casse pas sur un visuel incomplet', () => {
    expect(signed(-3)).toBe('−3')
    expect(signed(4)).toBe('4')
    expect(graphFrom({})).toEqual({ xmin: -5, xmax: 5, ymin: -5, ymax: 5, points: [] })
    expect(graphFrom({ xmin: 3, xmax: 3 }).xmax).toBeGreaterThan(3)
  })

  it('dessine, pour chaque question réelle, une courbe qui passe par la réponse', () => {
    const curves = of(['2nde.automatismes.lecture_graphique'])
    expect(curves).toHaveLength(20)
    const at = (points: [number, number][], x: number): number | null => {
      for (let i = 1; i < points.length; i++) {
        const [x1, y1] = points[i - 1]!
        const [x2, y2] = points[i]!
        if (x >= x1 && x <= x2) return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1)
      }
      return null
    }
    for (const s of curves) {
      const spec = graphFrom(s.visual ?? {})
      expect(spec.points.length).toBeGreaterThanOrEqual(3)
      expect(spec.points.every(([x, y], i) => x >= spec.xmin && x <= spec.xmax && y >= spec.ymin && y <= spec.ymax && (i === 0 || x > spec.points[i - 1]![0]))).toBe(true)
      if (s.difficulty <= 2) expect(at(spec.points, Number(s.meta.x))).toBe(Number(s.meta.y)) // image d’un sommet
      else for (const root of s.meta.solutions as string[]) expect(at(spec.points, Number(eval_(root)))).toBeCloseTo(Number(s.meta.k))
      expect(isPlayable(s)).toBe(true)
    }
  })
})

/** « 3 » ou « 5/2 » (meta.solutions) en nombre. */
function eval_(text: string): number {
  const [n, d] = text.split('/')
  return Number(n) / Number(d ?? 1)
}
