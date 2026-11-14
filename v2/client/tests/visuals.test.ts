import { describe, expect, it } from 'vitest'
import { check } from '../src/core/answers'
import { isPlayable, SUPPORTED_VISUALS } from '../src/core/questionService'
import type { Item } from '../src/core/items'
import { PACK_6E } from './support'
import pack2nde from './fixtures/pack_2nde.json'
import {
  balanceFrom,
  canRemove,
  gridFrom,
  gridPixel,
  nearestTick,
  nextSign,
  numberLineFrom,
  removeBoth,
  sideText,
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

  it('ne pose jamais une question dont le visuel manque (robot, carte, graphique…) ni un type inconnu', () => {
    for (const kind of ['robot', 'map', 'graph', 'pont', 'rapporteur', 'repere_tir']) expect(isPlayable(item({ visual: { kind } }))).toBe(false)
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
    expect([...SUPPORTED_VISUALS].sort()).toEqual(['balance', 'grid', 'number_line', 'sign_table'])
  })
})
