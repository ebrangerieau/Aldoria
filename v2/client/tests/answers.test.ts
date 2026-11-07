import { describe, expect, it } from 'vitest'
import vectors from '@content/test-vectors/answers.json'
import { check, normalizeText, parseRational } from '../src/core/answers'
import type { Answer, UserInput } from '../src/core/items'

// Les mêmes vecteurs sont rejoués par l'API (api/tests/test_answers.py) : le jeu et le
// serveur doivent rendre le même verdict sur chaque saisie.
interface Case {
  note: string
  answer: Answer
  input: UserInput
  expected: boolean
}

describe('vecteurs partagés avec l’API', () => {
  const cases = (vectors as { cases: Case[] }).cases
  it('contient des cas', () => {
    expect(cases.length).toBeGreaterThan(40)
  })
  it.each(cases.map((c) => [c.note, c] as const))('%s', (_note, c) => {
    expect(check(c.answer, c.input)).toBe(c.expected)
  })
})

describe('parseRational', () => {
  it('réduit les fractions et garde la saisie', () => {
    expect(parseRational('6/8')).toEqual({ num: 3, den: 4, typedNum: 6, typedDen: 8 })
    expect(parseRational('-0,75')).toEqual({ num: -3, den: 4, typedNum: null, typedDen: null })
  })
  it('refuse les saisies illisibles', () => {
    expect(parseRational('1,5/2')).toBeNull()
    expect(parseRational('3/0')).toBeNull()
    expect(parseRational('trois')).toBeNull()
  })
})

describe('normalizeText', () => {
  it('ignore la casse, les espaces et le point final', () => {
    expect(normalizeText('  Le   CHAT  dort. ')).toBe('le chat dort')
  })
  it('retire les accents si demandé', () => {
    expect(normalizeText('Été', false)).toBe('ete')
    expect(normalizeText('cœur', false)).toBe('coeur')
  })
})
