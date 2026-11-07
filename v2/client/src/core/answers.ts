/**
 * Validation locale des réponses (retour instantané). Même verdict que
 * api/app/engine/answers.py, vérifié sur content/test-vectors/answers.json par
 * tests/answers.test.ts : toute divergence fait échouer la CI.
 */
import type { Answer, UserInput } from './items'
import { equivalent, isProduct, normalize } from './mathExpr'

export interface Rational {
  num: number
  den: number
  /** Fraction écrite a/b : numérateur et dénominateur tels que tapés ; null sinon. */
  typedNum: number | null
  typedDen: number | null
}

const RATIONAL = /^([+-]?)(\d+(?:[.,]\d+)?)(?:\/(\d+))?$/

function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b]
  return Math.max(a, 1)
}

/** « -3/4 », « 0,75 », « 2 » → valeur exacte réduite. null si illisible. */
export function parseRational(text: string): Rational | null {
  const m = RATIONAL.exec(normalize(text))
  if (!m) return null
  const sign = m[1]!
  const [intPart, decPart = ''] = m[2]!.replace(',', '.').split('.') as [string, string?]
  const denText = m[3]
  let num = Number.parseInt(intPart + decPart, 10)
  let den = 10 ** decPart.length
  let typedNum: number | null = null
  let typedDen: number | null = null
  if (denText !== undefined) {
    if (decPart.length > 0) return null
    const d = Number.parseInt(denText, 10)
    if (d === 0) return null
    den *= d
    typedNum = num
    typedDen = d
  }
  if (sign === '-') {
    num = -num
    if (typedNum !== null) typedNum = -typedNum
  }
  const g = gcd(Math.abs(num), den)
  return { num: num / g, den: den / g, typedNum, typedDen }
}

/** Lettres accentuées → lettre de base (même table que api/app/engine/answers.py). */
export const ACCENTS: Record<string, string> = {
  à: 'a', á: 'a', â: 'a', ä: 'a', ã: 'a', å: 'a', ç: 'c',
  è: 'e', é: 'e', ê: 'e', ë: 'e', ì: 'i', í: 'i', î: 'i', ï: 'i',
  ñ: 'n', ò: 'o', ó: 'o', ô: 'o', ö: 'o', õ: 'o',
  ù: 'u', ú: 'u', û: 'u', ü: 'u', ý: 'y', ÿ: 'y', œ: 'oe', æ: 'ae',
}

/** Réponse écrite comparable : minuscules, espaces réduits, apostrophe droite, sans point
 * final ; sans accents si `accents` est faux. */
export function normalizeText(text: string, accents = true): string {
  let s = text.replaceAll('’', "'").replaceAll('‘', "'").replaceAll(' ', ' ').toLowerCase()
  const words: string[] = []
  for (const word of s.split(' ')) {
    for (const part of word.split('\t')) if (part !== '') words.push(part)
  }
  s = words.join(' ')
  while (s.length > 0 && '.!?'.includes(s[s.length - 1]!)) s = s.slice(0, -1)
  s = s.trim()
  if (!accents) s = [...s].map((c) => ACCENTS[c] ?? c).join('')
  return s
}

const isWholeNumber = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

function checkNumber(answer: { value: string; tolerance?: number }, text: string): boolean {
  const got = parseRational(text)
  const expected = parseRational(String(answer.value))
  if (!got || !expected) return false
  const diff = Math.abs(got.num / got.den - expected.num / expected.den)
  return diff <= (answer.tolerance ?? 0) + 1e-12
}

function checkFraction(
  answer: { value: string; accept_equivalent?: boolean; require_irreducible?: boolean },
  text: string,
): boolean {
  const got = parseRational(text)
  const expected = parseRational(String(answer.value))
  if (!got || !expected) return false
  if (got.num !== expected.num || got.den !== expected.den) return false
  if (answer.require_irreducible && got.typedDen !== null) {
    if (gcd(Math.abs(got.typedNum!), got.typedDen) !== 1) return false
  }
  if (answer.accept_equivalent === false) {
    return got.typedNum === expected.typedNum && got.typedDen === expected.typedDen
  }
  return true
}

function checkExpression(
  answer: { value: string; variable?: string; form?: 'expanded' | 'factored' | null },
  text: string,
): boolean {
  if (!equivalent(text, String(answer.value), answer.variable ?? 'x')) return false
  if (answer.form === 'expanded') return !normalize(text).includes('(')
  // Un vrai produit (« 3(x+2) », « (x+3)² ») : « (x²−9) » n'est pas une factorisation.
  if (answer.form === 'factored') return normalize(text).includes('(') && isProduct(text)
  return true
}

export function check(answer: Answer, input: UserInput | null | undefined): boolean {
  switch (answer.kind) {
    case 'choice':
      if (typeof input === 'number') return Math.trunc(input) === Math.trunc(answer.index)
      return /^[+-]?\d+$/.test(String(input)) && Number.parseInt(String(input), 10) === answer.index
    case 'number':
      return checkNumber(answer, String(input ?? ''))
    case 'fraction':
      return checkFraction(answer, String(input ?? ''))
    case 'expression':
      return checkExpression(answer, String(input ?? ''))
    case 'vector': {
      if (!Array.isArray(input) || input.length !== 2) return false
      return [0, 1].every((i) => {
        const got = parseRational(String(input[i]))
        const expected = parseRational(String(answer.value[i]))
        return got !== null && expected !== null && got.num === expected.num && got.den === expected.den
      })
    }
    case 'order': {
      if (!Array.isArray(input) || input.length !== answer.value.length) return false
      return answer.value.every((v, i) => isWholeNumber(input[i]) && input[i] === v)
    }
    case 'true_false': {
      if (typeof input !== 'object' || input === null || Array.isArray(input)) return false
      if (typeof input.value !== 'boolean' || !isWholeNumber(input.reason)) return false
      return input.value === answer.value && input.reason === answer.reason
    }
    case 'signs': {
      if (!Array.isArray(input) || input.length !== answer.value.length) return false
      return answer.value.every((v, i) => String(input[i]).trim().replaceAll('−', '-') === String(v))
    }
    case 'text': {
      const accents = answer.accents ?? true
      const got = normalizeText(String(input ?? ''), accents)
      if (got === '') return false
      return answer.value.some((accepted) => normalizeText(String(accepted), accents) === got)
    }
  }
}
