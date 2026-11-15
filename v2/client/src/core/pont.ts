/**
 * Le Pont des fractions (Jules, 6e ; porté de la v1 : core/world/chasm_bridge.gd, scenes/pont) : un ravin dont la largeur est une fraction de perche, des planches de
 * longueurs fractionnaires à poser bout à bout. Le pont tient si leur somme vaut **exactement** le ravin (fractions exactes, jamais de flottants) ; trop court ou
 * trop long, il s'effondre et l'enfant corrige. Pur et testé sans moteur ; l'écran est ui/PontBridge.tsx, la série de six ravins et l'XP sont dans core/lice.ts.
 *
 * Le générateur `6e.fractions.pont` fournit `visual = { kind: 'pont', gap: '4/3', planks: [{ length: '1/2', count: 4 }, …] }` et garantit une solution dans la réserve.
 */
export interface Frac {
  /** Numérateur. */
  n: number
  /** Dénominateur, toujours > 0. */
  d: number
}

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))

/** Fraction réduite (le dénominateur reste positif ; 0 s'écrit 0/1). */
export function reduce(f: Frac): Frac {
  if (f.n === 0) return { n: 0, d: 1 }
  const sign = f.d < 0 ? -1 : 1
  const g = gcd(f.n, f.d) || 1
  return { n: (sign * f.n) / g, d: (sign * f.d) / g }
}

/** « 3/8 », « 1 », « 4/3 » (espaces tolérés) ; un texte illisible vaut 0. */
export function parseFrac(text: string): Frac {
  const [top = '', bottom = ''] = text.trim().split('/')
  const n = Number.parseInt(top, 10)
  const d = bottom === '' ? 1 : Number.parseInt(bottom, 10)
  if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) return { n: 0, d: 1 }
  return reduce({ n, d })
}

export const addFrac = (a: Frac, b: Frac): Frac => reduce({ n: a.n * b.d + b.n * a.d, d: a.d * b.d })

/** Somme d'une liste de longueurs écrites. */
export const totalOf = (lengths: readonly string[]): Frac => lengths.reduce((sum, length) => addFrac(sum, parseFrac(length)), { n: 0, d: 1 })

/** Signe de a − b. */
export const compareFrac = (a: Frac, b: Frac): -1 | 0 | 1 => Math.sign(a.n * b.d - b.n * a.d) as -1 | 0 | 1

export const writeFrac = (f: Frac): string => (f.d === 1 ? String(f.n) : `${f.n}/${f.d}`)

export const fracValue = (f: Frac): number => f.n / f.d

export interface Plank {
  /** Longueur en perches, écrite comme dans le paquet (« 3/8 »). */
  length: string
  /** Combien de planches de cette longueur la réserve en contient. */
  count: number
}

export interface PontSpec {
  gap: Frac
  stock: Plank[]
}

/** Le ravin et la réserve d'une question, relus avec prudence (une réserve abîmée ne casse rien : elle est vide). */
export function pontFrom(visual: Record<string, unknown> | null | undefined): PontSpec {
  const raw = Array.isArray(visual?.planks) ? (visual!.planks as unknown[]) : []
  const stock: Plank[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const plank = entry as { length?: unknown; count?: unknown }
    const length = typeof plank.length === 'string' ? plank.length : ''
    const count = Math.trunc(Number(plank.count))
    if (length !== '' && parseFrac(length).n > 0 && Number.isFinite(count) && count > 0) stock.push({ length, count })
  }
  return { gap: parseFrac(String(visual?.gap ?? '1')), stock }
}

/** Ce que donne le pont : il tient (`juste`), il manque de la longueur (`court`) ou la dernière planche déborde de l'autre rive (`long`). */
export type Outcome = 'juste' | 'court' | 'long'

export function outcomeOf(lengths: readonly string[], gap: Frac): Outcome {
  const order = compareFrac(totalOf(lengths), gap)
  return order === 0 ? 'juste' : order < 0 ? 'court' : 'long'
}

/** Combien de planches de chaque sorte restent après ce choix (même ordre que la réserve). */
export function remaining(stock: readonly Plank[], chosen: readonly string[]): number[] {
  return stock.map((plank) => plank.count - chosen.filter((length) => length === plank.length).length)
}

/** Une façon de couvrir `target` avec la réserve ([] s'il n'y en a pas) : les captures, les tests et le crochet du parcours navigateur. */
export function solve(stock: readonly Plank[], target: Frac, from = 0): string[] {
  if (target.n === 0) return []
  for (let i = from; i < stock.length; i += 1) {
    const plank = stock[i]!
    if (plank.count <= 0) continue
    const rest = addFrac(target, { n: -parseFrac(plank.length).n, d: parseFrac(plank.length).d })
    if (rest.n < 0) continue
    const left = stock.map((p, k) => (k === i ? { ...p, count: p.count - 1 } : p))
    const tail = solve(left, rest, i)
    if (rest.n === 0 || tail.length > 0) return [plank.length, ...tail]
  }
  return []
}

/** Une couleur par dénominateur, comme des réglettes (v1) ; avec le nom de la fraction écrit sur chaque planche : jamais la couleur seule. */
const COLORS: Record<number, string> = {
  1: '#a8703f', 2: '#e09f3e', 3: '#6a994e', 4: '#4d96c9', 5: '#9d6bc2', 6: '#d1495b', 8: '#f7a1c4', 10: '#2a9d8f',
}

export const colorFor = (length: string): string => COLORS[parseFrac(length).d] ?? '#8d6e63'

/** Ce que montre le pont raté, sans donner la réponse : la somme posée et le sens de l'erreur (texte de la v1). */
export function adviceFor(lengths: readonly string[], gap: Frac, outcome: Outcome): string {
  const sum = writeFrac(totalOf(lengths))
  const built = lengths.length > 1 ? `Tes planches : ${lengths.join(' + ')} = ${sum}.` : `Ta planche mesure ${sum}.`
  const wide = writeFrac(gap)
  if (outcome === 'court') return `${built} Trop court : le ravin mesure ${wide}. Ajoute une planche ou prends-en une plus longue.`
  return `${built} Trop long : la dernière planche bute sur l'autre rive (le ravin mesure ${wide}). Retire une planche ou prends-en une plus courte.`
}
