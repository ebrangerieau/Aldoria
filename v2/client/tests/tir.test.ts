import { describe, expect, it } from 'vitest'
import { check } from '../src/core/answers'
import type { Item } from '../src/core/items'
import {
  angleAdvice, directionOf, heightAt, hitsAngle, lineAdvice, lineFrom, lineHits, protractorFrom, rangeOf, shotEnd, slopeText, stepAngle, stepDenominator,
  stepNumerator, ticksOf,
} from '../src/core/tir'
import samples from './fixtures/visual_samples.json'

type Sample = Item & { generator: string }
const ALL = samples as unknown as Sample[]
const ANGLES = ALL.filter((s) => s.generator === '6e.angles.tir')
const LINES = ALL.filter((s) => s.generator === '2nde.droites.tir')

describe('Le rapporteur géant', () => {
  it('lit le visuel avec des valeurs par défaut, et ne dépasse jamais 0 à 180 degrés', () => {
    expect(protractorFrom({ kind: 'rapporteur', angle: 150, reference: 'droite', minor: 10, labels: 30, double_scale: false, distance: 5.5 })).toEqual({
      angle: 150, referenceLeft: false, minor: 10, labels: 30, doubleScale: false, distance: 5.5,
    })
    expect(protractorFrom({ reference: 'gauche', double_scale: true }).referenceLeft).toBe(true)
    expect(protractorFrom(null)).toMatchObject({ angle: 45, minor: 10, labels: 30, distance: 5.5, referenceLeft: false })
    expect(protractorFrom({ angle: 999, minor: 0, labels: 5 })).toMatchObject({ angle: 180, minor: 1, labels: 5 })
    expect(protractorFrom({ angle: -5, distance: -2 })).toMatchObject({ angle: 0, distance: 5.5 })
  })

  it('la direction d’un angle est comptée depuis la ligne de départ : à droite vers la gauche, ou l’inverse', () => {
    const near = (a: { x: number; y: number }, x: number, y: number) => {
      expect(a.x).toBeCloseTo(x)
      expect(a.y).toBeCloseTo(y)
    }
    near(directionOf(0, false), 1, 0)
    near(directionOf(90, false), 0, 1)
    near(directionOf(180, false), -1, 0)
    near(directionOf(0, true), -1, 0)
    near(directionOf(90, true), 0, 1)
    near(directionOf(180, true), 1, 0)
    // La même valeur lue des deux côtés est le miroir l'une de l'autre.
    const right = directionOf(30, false)
    const left = directionOf(30, true)
    expect(left.x).toBeCloseTo(-right.x)
    expect(left.y).toBeCloseTo(right.y)
  })

  it('les graduations : un trait par petit pas, des traits longs (avec leur nombre) aux multiples de l’écart des nombres', () => {
    const ticks = ticksOf({ minor: 10, labels: 30 })
    expect(ticks).toHaveLength(19)
    expect(ticks.filter((t) => t.long).map((t) => t.k)).toEqual([0, 30, 60, 90, 120, 150, 180])
    expect(ticksOf({ minor: 5, labels: 10 }).filter((t) => t.long)).toHaveLength(19)
    expect(ticksOf({ minor: 5, labels: 10 })).toHaveLength(37)
  })

  it('le « − » et le « + » avancent d’un petit pas, de 0 à 180', () => {
    expect(stepAngle(0, 1, 10)).toBe(10)
    expect(stepAngle(0, -1, 10)).toBe(0)
    expect(stepAngle(180, 1, 5)).toBe(180)
    expect(stepAngle(170, 1, 10)).toBe(180)
    expect(stepAngle(45, -1, 5)).toBe(40)
  })

  it('un tir touche si l’angle est exactement celui de la cible ; le conseil dit le sens de la correction', () => {
    const spec = { angle: 50, referenceLeft: false }
    expect(hitsAngle(50, spec)).toBe(true)
    expect(hitsAngle(49, spec)).toBe(false)
    expect(angleAdvice(30, spec)).toContain('Essaie un angle plus grand')
    expect(angleAdvice(80, spec)).toContain('Essaie un angle plus petit')
    // Graduation lue du mauvais côté (ligne de départ à gauche) : son propre conseil, jamais la réponse.
    const left = { angle: 50, referenceLeft: true }
    expect(angleAdvice(130, left)).toContain('de l\'autre côté')
    expect(angleAdvice(130, left)).not.toContain('50')
    expect(angleAdvice(130, spec)).toContain('plus petit') // du bon côté d'une ligne de départ à droite, c'est une simple erreur
  })

  it('les vrais tirs du générateur : la bonne réponse est l’angle de la cible, une graduation lue à l’envers est fausse', () => {
    expect(ANGLES.length).toBeGreaterThanOrEqual(20)
    expect(new Set(ANGLES.map((a) => a.difficulty))).toEqual(new Set([1, 2, 3, 4, 5]))
    for (const item of ANGLES) {
      const spec = protractorFrom(item.visual)
      expect(rangeOf(item.visual)).toBe('angle')
      expect(check(item.answer, String(spec.angle)), item.id).toBe(true)
      expect(hitsAngle(spec.angle, spec)).toBe(true)
      if (spec.angle !== 90) expect(check(item.answer, String(180 - spec.angle)), item.id).toBe(false)
      expect(spec.angle % spec.minor, `la cible tombe sur une graduation : ${item.id}`).toBe(0)
      expect(ticksOf(spec).some((t) => t.k === spec.angle)).toBe(true)
    }
    // Une ligne de départ à gauche s'accompagne des deux graduations d'un vrai rapporteur (v1) : sans elles, l'enfant ne pourrait pas lire.
    for (const item of ANGLES) {
      const spec = protractorFrom(item.visual)
      if (spec.referenceLeft) expect(spec.doubleScale, item.id).toBe(true)
    }
  })
})

describe('Le repère de l’arbalète', () => {
  const spec = lineFrom({ kind: 'repere_tir', start: [0, 7], target: [4, 6], width: 10, height: 8 })

  it('lit le visuel, avec des valeurs par défaut', () => {
    expect(spec).toEqual({ start: { x: 0, y: 7 }, target: { x: 4, y: 6 }, width: 10, height: 8 })
    expect(lineFrom(null)).toEqual({ start: { x: 0, y: 0 }, target: { x: 5, y: 5 }, width: 10, height: 8 })
    expect(lineFrom({ start: 'x', target: [3] })).toMatchObject({ start: { x: 0, y: 0 }, target: { x: 3, y: 5 } })
  })

  it('le coefficient s’écrit « 2 » ou « -3/4 » ; une droite touche la cible quand elle passe par elle, en arithmétique entière', () => {
    expect(slopeText(2, 1)).toBe('2')
    expect(slopeText(-1, 4)).toBe('-1/4')
    expect(slopeText(0, 3)).toBe('0/3')
    expect(lineHits(-1, 4, spec)).toBe(true)
    expect(lineHits(-2, 8, spec)).toBe(true) // une fraction équivalente est la même droite
    expect(lineHits(-1, 3, spec)).toBe(false)
    expect(lineHits(1, 0, spec)).toBe(false) // jamais de division par zéro
  })

  it('la hauteur du carreau à l’abscisse de la cible est une fraction réduite ; le conseil dit trop haut ou trop bas', () => {
    expect(heightAt(-1, 4, 7, 4)).toEqual({ n: 6, d: 1 })
    expect(heightAt(1, 2, 7, 3)).toEqual({ n: 17, d: 2 })
    expect(lineAdvice(-1, 3, spec)).toContain('y = 17/3') // passe sous la cible (5,67 au lieu de 6)
    expect(lineAdvice(-1, 3, spec)).toContain('trop bas')
    expect(lineAdvice(-1, 3, spec)).toContain('Essaie un coefficient plus grand')
    expect(lineAdvice(-1, 6, spec)).toContain('y = 19/3') // passe au-dessus (6,33)
    expect(lineAdvice(-1, 6, spec)).toContain('trop haut')
    expect(lineAdvice(-1, 6, spec)).toContain('plus petit')
    expect(lineAdvice(0, 1, spec)).toContain('y = 7')
    expect(lineAdvice(-1, 3, spec)).not.toContain('-1/4') // la bonne réponse n'est jamais donnée
  })

  it('la trace s’arrête sur la cible si elle la touche, sinon au bord du repère', () => {
    expect(shotEnd(-1, 4, spec)).toEqual({ x: 4, y: 6 })
    const up = shotEnd(2, 1, spec) // monte jusqu'au haut du repère
    expect(up.y).toBeCloseTo(8)
    expect(up.x).toBeCloseTo(0.5)
    const down = shotEnd(-3, 1, spec) // descend jusqu'à l'axe des abscisses
    expect(down.y).toBeCloseTo(0)
    const flat = shotEnd(0, 1, spec)
    expect(flat).toEqual({ x: 10, y: 7 })
    expect(shotEnd(1, 0, spec).x).toBe(10) // dénominateur nul : jamais d'infini
  })

  it('les petits pas du numérateur (−12 à 12) et du dénominateur (1 à 6)', () => {
    expect(stepNumerator(12, 1)).toBe(12)
    expect(stepNumerator(-12, -1)).toBe(-12)
    expect(stepNumerator(1, -1)).toBe(0)
    expect(stepDenominator(1, -1)).toBe(1)
    expect(stepDenominator(6, 1)).toBe(6)
    expect(stepDenominator(3, 1)).toBe(4)
  })

  it('les vrais tirs du générateur : la bonne droite touche la cible, une autre non, et l’on sait toujours viser avec les pas permis', () => {
    expect(LINES.length).toBeGreaterThanOrEqual(20)
    expect(new Set(LINES.map((l) => l.difficulty))).toEqual(new Set([1, 2, 3, 4, 5]))
    for (const item of LINES) {
      const s = lineFrom(item.visual)
      expect(rangeOf(item.visual)).toBe('droite')
      expect(s.start.x, `l'arbalète est sur l'axe des ordonnées : ${item.id}`).toBe(0)
      // Les pas permis atteignent la bonne droite : un coefficient n/d avec n dans [-12, 12] et d dans [1, 6] qui passe par la cible.
      const reachable: [number, number][] = []
      for (let d = 1; d <= 6; d += 1) for (let n = -12; n <= 12; n += 1) if (lineHits(n, d, s)) reachable.push([n, d])
      expect(reachable.length, `aucune droite atteignable : ${item.id}`).toBeGreaterThan(0)
      for (const [n, d] of reachable) expect(check(item.answer, slopeText(n, d)), `${item.id} : ${n}/${d}`).toBe(true)
      // Une droite fausse n'est jamais acceptée par la validation du client.
      for (let d = 1; d <= 6; d += 1) for (let n = -12; n <= 12; n += 1) if (!lineHits(n, d, s)) expect(check(item.answer, slopeText(n, d)), `${item.id} : ${n}/${d}`).toBe(false)
    }
  })
})
