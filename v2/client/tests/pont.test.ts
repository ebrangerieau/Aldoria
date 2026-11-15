import { describe, expect, it } from 'vitest'
import { check } from '../src/core/answers'
import {
  addFrac, adviceFor, colorFor, compareFrac, fracValue, outcomeOf, parseFrac, pontFrom, remaining, solve, totalOf, writeFrac,
} from '../src/core/pont'
import type { Item } from '../src/core/items'
import samples from './fixtures/visual_samples.json'

const PONTS = (samples as unknown as (Item & { generator: string })[]).filter((s) => s.generator === '6e.fractions.pont')

describe('Fractions exactes', () => {
  it('lit « 3/8 », « 1 », « 4/3 » et réduit ; un texte illisible vaut 0', () => {
    expect(parseFrac('3/8')).toEqual({ n: 3, d: 8 })
    expect(parseFrac('2/4')).toEqual({ n: 1, d: 2 })
    expect(parseFrac(' 4 / 3 ')).toEqual({ n: 4, d: 3 })
    expect(parseFrac('2')).toEqual({ n: 2, d: 1 })
    for (const bad of ['', 'a', '1/0', '/', '1/b']) expect(parseFrac(bad)).toEqual({ n: 0, d: 1 })
  })

  it('additionne, compare et écrit sans jamais passer par un flottant', () => {
    expect(addFrac(parseFrac('1/3'), parseFrac('1/6'))).toEqual({ n: 1, d: 2 })
    expect(totalOf(['1/3', '1/3', '1/3'])).toEqual({ n: 1, d: 1 })
    expect(totalOf([])).toEqual({ n: 0, d: 1 })
    // 0,1 + 0,2 n'est pas 0,3 en flottants : ici, si.
    expect(compareFrac(totalOf(['1/10', '1/5']), parseFrac('3/10'))).toBe(0)
    expect(compareFrac(parseFrac('1/3'), parseFrac('1/2'))).toBe(-1)
    expect(compareFrac(parseFrac('5/3'), parseFrac('3/2'))).toBe(1)
    expect(writeFrac(parseFrac('6/4'))).toBe('3/2')
    expect(writeFrac(parseFrac('4/2'))).toBe('2')
    expect(fracValue(parseFrac('3/4'))).toBe(0.75)
  })
})

describe('Le pont', () => {
  const spec = pontFrom({ kind: 'pont', gap: '4/3', planks: [{ length: '1/2', count: 4 }, { length: '1/3', count: 3 }, { length: '1/6', count: 2 }] })

  it('le pont tient s’il couvre exactement le ravin, sinon il est trop court ou trop long', () => {
    expect(outcomeOf(['1/2', '1/2', '1/3'], spec.gap)).toBe('juste')
    expect(outcomeOf(['1/3', '1/3', '1/3', '1/3'], spec.gap)).toBe('juste')
    expect(outcomeOf(['1/2', '1/2'], spec.gap)).toBe('court')
    expect(outcomeOf([], spec.gap)).toBe('court')
    expect(outcomeOf(['1/2', '1/2', '1/2'], spec.gap)).toBe('long')
  })

  it('un ravin d’un cheveu trop long n’est pas juste (4/3 + 1/6 déborde)', () => {
    expect(outcomeOf(['1/2', '1/2', '1/3', '1/6'], spec.gap)).toBe('long')
  })

  it('compte ce qui reste de chaque sorte de planche', () => {
    expect(remaining(spec.stock, [])).toEqual([4, 3, 2])
    expect(remaining(spec.stock, ['1/2', '1/3', '1/2'])).toEqual([2, 2, 2])
    expect(remaining(spec.stock, ['1/6', '1/6'])).toEqual([4, 3, 0])
  })

  it('trouve une solution dans la réserve, ou aucune', () => {
    const found = solve(spec.stock, spec.gap)
    expect(outcomeOf(found, spec.gap)).toBe('juste')
    expect(remaining(spec.stock, found).every((n) => n >= 0)).toBe(true)
    expect(solve([{ length: '1/2', count: 1 }], parseFrac('1'))).toEqual([])
    expect(solve(spec.stock, { n: 0, d: 1 })).toEqual([])
  })

  it('une couleur par dénominateur, une teinte par défaut pour un autre', () => {
    expect(colorFor('1/2')).toBe(colorFor('3/2'))
    expect(colorFor('1/2')).not.toBe(colorFor('1/3'))
    expect(colorFor('1/7')).toMatch(/^#/)
  })

  it('le conseil dit la somme posée et le sens de l’erreur, sans donner la réponse', () => {
    const short = adviceFor(['1/2', '1/2'], spec.gap, 'court')
    expect(short).toContain('Tes planches : 1/2 + 1/2 = 1.')
    expect(short).toContain('Trop court')
    expect(short).toContain('4/3')
    const long = adviceFor(['3/2'], spec.gap, 'long')
    expect(long).toContain('Ta planche mesure 3/2.')
    expect(long).toContain('Trop long')
    expect(`${short} ${long}`).not.toMatch(/\+ 1\/3 =/) // aucune planche à poser n'est proposée
  })

  it('une réserve abîmée ne casse rien', () => {
    expect(pontFrom(null)).toEqual({ gap: { n: 1, d: 1 }, stock: [] })
    expect(pontFrom({ gap: '1/2', planks: [{ length: 'x', count: 2 }, { length: '1/4', count: 0 }, { length: '1/4', count: 'a' }, null, { length: '1/4', count: 2 }] as unknown[] }).stock)
      .toEqual([{ length: '1/4', count: 2 }])
  })
})

describe('Les vrais ravins du générateur 6e.fractions.pont', () => {
  it('il y en a de toutes les difficultés', () => {
    expect(PONTS.length).toBeGreaterThanOrEqual(20)
    expect(new Set(PONTS.map((p) => p.difficulty))).toEqual(new Set([1, 2, 3, 4, 5]))
  })

  it('la réserve contient toujours une solution, qui respecte les stocks, et la bonne réponse est la largeur du ravin', () => {
    for (const item of PONTS) {
      const spec = pontFrom(item.visual)
      expect(spec.stock.length, item.id).toBeGreaterThan(0)
      const found = solve(spec.stock, spec.gap)
      expect(found.length, `pas de solution : ${item.id}`).toBeGreaterThan(0)
      expect(outcomeOf(found, spec.gap)).toBe('juste')
      expect(remaining(spec.stock, found).every((n) => n >= 0)).toBe(true)
      // La réponse enregistrée est la somme posée : une somme juste est la bonne réponse du générateur (toute somme égale à la largeur est acceptée).
      expect(check(item.answer, writeFrac(totalOf(found)))).toBe(true)
      expect(spec.gap).toEqual(parseFrac(String((item.answer as { value: string }).value)))
    }
  })

  it('une somme qui n’est pas la largeur est une mauvaise réponse', () => {
    for (const item of PONTS) {
      const spec = pontFrom(item.visual)
      const wrong = writeFrac(addFrac(spec.gap, { n: 1, d: 12 }))
      expect(check(item.answer, wrong), item.id).toBe(false)
    }
  })

  it('l’énoncé nomme la largeur du ravin que le visuel dessine', () => {
    for (const item of PONTS) expect(item.prompt).toContain(writeFrac(pontFrom(item.visual).gap))
  })
})
