import { describe, expect, it } from 'vitest'
import { equivalent, evaluate, isProduct, parse } from '../src/core/mathExpr'

describe('mathExpr', () => {
  it('lit la multiplication implicite et les symboles du clavier', () => {
    const node = parse('2x(x+1)')
    expect('op' in node && evaluate(node, 3)).toBe(24)
    expect(equivalent('x²−9', '(x-3)(x+3)')).toBe(true)
    expect(equivalent('√(x²)', 'x')).toBe(false) // faux pour x < 0
  })
  it('reconnaît une forme factorisée', () => {
    expect(isProduct('-2x(x+1)')).toBe(true)
    expect(isProduct('(x+1)²')).toBe(true)
    expect(isProduct('(x²-9)')).toBe(false)
  })
  it('signale les erreurs de saisie', () => {
    expect(parse('2x+')).toEqual({ error: 'expression incomplète' })
    // Comme la v1 : la parenthèse manquante en fin de saisie est une expression incomplète.
    expect(parse('(x+1')).toEqual({ error: 'expression incomplète' })
    expect(parse('2 # 3')).toEqual({ error: 'caractère inattendu : #' })
  })
  it('refuse une autre variable que celle attendue', () => {
    expect(equivalent('2y', '2x')).toBe(false)
  })
})
