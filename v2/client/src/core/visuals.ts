/**
 * Logique des visuels de questions (la v1 les dessinait dans game/ui/question_widgets) : balance,
 * droite graduée, repère quadrillé, tableau de signes. Pure : les composants SVG (ui/widgets) ne
 * font que dessiner ce qui est calculé ici. Les formats viennent des générateurs de l'API
 * (`item.visual`, api/app/engine/generators).
 */
import { parseRational } from './answers'

type Visual = Record<string, unknown>

// --- Balance (pré-algèbre : boîtes de masse inconnue et billes sur deux plateaux) ----------------

export interface Side {
  boxes: number
  units: number
}
export interface BalanceState {
  left: Side
  right: Side
}
export interface BalanceNames {
  box: [string, string]
  unit: [string, string]
}

const whole = (v: unknown): number => Math.max(0, Math.floor(Number(v) || 0))
const side = (v: unknown): Side => {
  const s = (v ?? {}) as Visual
  return { boxes: whole(s.boxes), units: whole(s.units) }
}
const pair = (v: unknown, fallback: [string, string]): [string, string] =>
  Array.isArray(v) && v.length === 2 ? [String(v[0]), String(v[1])] : fallback

export function balanceFrom(visual: Visual): { state: BalanceState; names: BalanceNames } {
  return {
    state: { left: side(visual.left), right: side(visual.right) },
    names: { box: pair(visual.box, ['boîte', 'boîtes']), unit: pair(visual.unit, ['bille', 'billes']) },
  }
}

/** Enlever la même chose des deux côtés ne se peut que s'il y en a des deux côtés. */
export function canRemove(state: BalanceState, what: keyof Side): boolean {
  return state.left[what] > 0 && state.right[what] > 0
}

/** La balance reste en équilibre : on retire un élément de chaque plateau. */
export function removeBoth(state: BalanceState, what: keyof Side): BalanceState {
  if (!canRemove(state, what)) return state
  return { left: { ...state.left, [what]: state.left[what] - 1 }, right: { ...state.right, [what]: state.right[what] - 1 } }
}

/** « 1 sac et 2 pièces », « 4 pièces », « rien ». */
export function sideText(s: Side, names: BalanceNames): string {
  const part = (n: number, [one, many]: [string, string]) => `${n} ${n > 1 ? many : one}`
  const parts = [s.boxes > 0 ? part(s.boxes, names.box) : '', s.units > 0 ? part(s.units, names.unit) : ''].filter(Boolean)
  return parts.length > 0 ? parts.join(' et ') : 'rien'
}

// --- Droite graduée --------------------------------------------------------------------------

export interface NumberLineSpec {
  min: number
  max: number
  /** Graduations entre deux entiers. */
  sub: number
}

export function numberLineFrom(visual: Visual): NumberLineSpec {
  return {
    min: Math.trunc(Number(visual.min ?? 0)) || 0,
    max: Math.trunc(Number(visual.max ?? 1)) || 1,
    sub: Math.max(1, Math.trunc(Number(visual.subdivisions ?? 2)) || 2),
  }
}

export const tickCount = (s: NumberLineSpec): number => (s.max - s.min) * s.sub

/** Graduation la plus proche d'une position (0 = bord gauche, 1 = bord droit). */
export function nearestTick(s: NumberLineSpec, ratio: number): number {
  return Math.max(0, Math.min(tickCount(s), Math.round(ratio * tickCount(s))))
}

/** Réponse donnée au serveur : « k/sub », non simplifiée (le validateur accepte les fractions égales). */
export function tickFraction(s: NumberLineSpec, ticks: number): string {
  return `${s.min * s.sub + ticks}/${s.sub}`
}

/** Graduation d'un nombre écrit « 3/4 », « 1,5 » ou « 2 », ou null s'il ne tombe pas sur la droite. */
export function ticksOf(s: NumberLineSpec, text: string): number | null {
  const r = parseRational(text)
  if (!r) return null
  const ticks = Math.round(((r.num / r.den) - s.min) * s.sub)
  return ticks >= 0 && ticks <= tickCount(s) ? ticks : null
}

/** Étiquette d'une graduation : l'entier aux graduations principales, rien entre deux. */
export const tickLabel = (s: NumberLineSpec, t: number): string | null => (t % s.sub === 0 ? String(s.min + t / s.sub) : null)

// --- Repère quadrillé (rayon, miroirs, cristal : vecteurs) --------------------------------------

export interface GridPoint {
  name: string
  at: [number, number]
  role: 'source' | 'mirror' | 'target' | string
  hidden: boolean
}

export function gridFrom(visual: Visual): { span: number; points: GridPoint[]; path: string[] } {
  const raw = Array.isArray(visual.points) ? (visual.points as Visual[]) : []
  return {
    // Une graduation de marge au-delà du plus grand repère.
    span: Math.max(1, Math.trunc(Number(visual.span ?? 6)) || 6) + 1,
    points: raw.map((p) => ({
      name: String(p.name ?? ''),
      at: [Number((p.at as number[] | undefined)?.[0] ?? 0), Number((p.at as number[] | undefined)?.[1] ?? 0)],
      role: String(p.role ?? 'target'),
      hidden: p.hidden === true,
    })),
    path: Array.isArray(visual.path) ? visual.path.map(String) : [],
  }
}

/** Position en pixels (y vers le haut en maths, vers le bas à l'écran) dans un carré `size`. */
export function gridPixel(at: [number, number], span: number, size: number): [number, number] {
  const half = size / 2
  return [half + (at[0] * half) / span, half - (at[1] * half) / span]
}

// --- Tableau de signes (équations, produit ou quotient de facteurs) -----------------------------

export type Sign = '' | '+' | '-'

/** Une case passe de vide à « + », puis « − », puis « + »… */
export const nextSign = (s: Sign): Sign => (s === '' || s === '-' ? '+' : '-')

/** Intervalles du tableau : ]−∞ ; r1[ , ]r1 ; r2[ , … , ]rn ; +∞[ . */
export function signColumns(roots: readonly unknown[]): string[] {
  const out: string[] = []
  for (let c = 0; c <= roots.length; c += 1) {
    const left = c === 0 ? '−∞' : String(roots[c - 1])
    const right = c === roots.length ? '+∞' : String(roots[c])
    out.push(`]${left} ; ${right}[`)
  }
  return out
}

export function signTableFrom(visual: Visual): { roots: string[]; rows: string[]; columns: number } {
  const roots = Array.isArray(visual.roots) ? visual.roots.map(String) : []
  const rows = Array.isArray(visual.rows) ? visual.rows.map(String) : []
  return { roots, rows, columns: roots.length + 1 }
}

export const signsComplete = (signs: readonly Sign[]): boolean => signs.length > 0 && signs.every((s) => s !== '')
