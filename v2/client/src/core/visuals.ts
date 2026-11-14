/**
 * Logique des visuels de questions (la v1 les dessinait dans game/ui/question_widgets) : balance,
 * droite graduée, repère quadrillé, tableau de signes, carte à l'échelle, robot sur une grille, courbe. Pure : les composants SVG (ui/widgets) ne
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

// --- Carte à l'échelle (Atelier des Balances) -----------------------------------------------------

export interface MapSpec {
  cols: number
  rows: number
  /** Lieux, en coordonnées de quadrillage (intersections : 0 à cols, 0 à rows). */
  points: { label: string; at: [number, number] }[]
  /** Route en plusieurs tronçons ; vide : un trait droit entre les deux lieux. */
  path: [number, number][]
  /** Barre d'échelle de `cells` carreaux (0 : pas de barre, l'échelle est numérique) et son texte. */
  scale: { cells: number; text: string }
}

const pairOf = (v: unknown): [number, number] => {
  const a = Array.isArray(v) ? v : []
  return [Number(a[0]) || 0, Number(a[1]) || 0]
}

export function mapFrom(visual: Visual): MapSpec {
  const points = Array.isArray(visual.points) ? (visual.points as Visual[]) : []
  const scale = (visual.scale ?? {}) as Visual
  return {
    cols: Math.max(1, Math.trunc(Number(visual.cols ?? 12)) || 12),
    rows: Math.max(1, Math.trunc(Number(visual.rows ?? 8)) || 8),
    points: points.map((p) => ({ label: String(p.label ?? ''), at: pairOf(p.at) })),
    path: Array.isArray(visual.path) ? visual.path.map(pairOf) : [],
    scale: { cells: Math.max(0, Math.trunc(Number(scale.cells ?? 0)) || 0), text: String(scale.text ?? '') },
  }
}

/** Position en pixels d'un point du quadrillage (y vers le bas, comme à l'écran). */
export const mapPixel = (at: readonly [number, number], cell: number, margin: number): [number, number] => [margin + at[0] * cell, margin + at[1] * cell]

/** Tracé de la route : celui des tronçons, sinon le trait droit entre les deux lieux. */
export function mapRoute(spec: MapSpec): [number, number][] {
  if (spec.path.length >= 2) return spec.path
  return spec.points.length >= 2 ? [spec.points[0]!.at, spec.points[spec.points.length - 1]!.at] : []
}

// --- Robot sur une grille (algorithmique) ---------------------------------------------------------

export type Heading = 'N' | 'E' | 'S' | 'O'

const HEADINGS: Record<Heading, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], O: [-1, 0] }
export const HEADING_NAMES: Record<Heading, string> = { N: 'vers le haut', E: 'vers la droite', S: 'vers le bas', O: 'vers la gauche' }

export interface RobotSpec {
  size: number
  start: [number, number]
  facing: Heading
  /** Cases proposées, repérées par une lettre (les propositions de la question). */
  marks: { letter: string; at: [number, number] }[]
}

export function robotFrom(visual: Visual): RobotSpec {
  const marks = (visual.marks ?? {}) as Visual
  const facing = String(visual.facing ?? 'N')
  return {
    size: Math.max(2, Math.trunc(Number(visual.size ?? 6)) || 6),
    start: pairOf(visual.start),
    facing: facing in HEADINGS ? (facing as Heading) : 'N',
    marks: Object.keys(marks)
      .sort()
      .map((letter) => ({ letter, at: pairOf(marks[letter]) })),
  }
}

/** Centre d'une case (colonne, ligne) dans une grille de cases de `cell` pixels. */
export const cellCenter = (at: readonly [number, number], cell: number): [number, number] => [(at[0] + 0.5) * cell, (at[1] + 0.5) * cell]

/** Triangle qui montre la direction du robot : pointe vers `heading`, centré sur `center`. */
export function arrowPoints(center: readonly [number, number], heading: Heading, radius: number): [number, number][] {
  const [dx, dy] = HEADINGS[heading]
  const [px, py] = [-dy, dx]
  const [cx, cy] = center
  return [
    [cx + dx * radius, cy + dy * radius],
    [cx - dx * radius * 0.6 + px * radius * 0.8, cy - dy * radius * 0.6 + py * radius * 0.8],
    [cx - dx * radius * 0.6 - px * radius * 0.8, cy - dy * radius * 0.6 - py * radius * 0.8],
  ]
}

// --- Courbe (lecture graphique) -------------------------------------------------------------------

export interface GraphSpec {
  xmin: number
  xmax: number
  ymin: number
  ymax: number
  /** Sommets de la courbe, reliés par des segments. */
  points: [number, number][]
}

export function graphFrom(visual: Visual): GraphSpec {
  const xmin = Math.trunc(Number(visual.xmin ?? -5)) || -5
  const ymin = Math.trunc(Number(visual.ymin ?? -5)) || -5
  const xmax = Math.trunc(Number(visual.xmax ?? 5)) || 5
  const ymax = Math.trunc(Number(visual.ymax ?? 5)) || 5
  return {
    xmin,
    xmax: Math.max(xmax, xmin + 1),
    ymin,
    ymax: Math.max(ymax, ymin + 1),
    points: Array.isArray(visual.points) ? visual.points.map(pairOf) : [],
  }
}

/** Position en pixels d'un point du repère, dans un cadre `width` × `height` entouré de `margin` (y vers le haut en maths). */
export function graphPixel(spec: GraphSpec, at: readonly [number, number], width: number, height: number, margin: number): [number, number] {
  const w = width - 2 * margin
  const h = height - 2 * margin
  return [margin + ((at[0] - spec.xmin) * w) / (spec.xmax - spec.xmin), margin + ((spec.ymax - at[1]) * h) / (spec.ymax - spec.ymin)]
}

/** Graduations entières d'un axe. */
export const graphTicks = (min: number, max: number): number[] => Array.from({ length: max - min + 1 }, (_, i) => min + i)

/** Écriture d'un nombre avec le vrai signe moins (lecture à voix haute : « moins »). */
export const signed = (n: number): string => (n < 0 ? `−${-n}` : String(n))
