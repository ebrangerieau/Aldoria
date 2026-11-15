/**
 * Le stand de tir de la Lice (portée de la v1 : core/world/protractor_range.gd, core/world/line_range.gd, scenes/tir) : six tirs calculés, sans réflexe ni chrono. Jules (6e)
 * mesure un angle sur un rapporteur géant peint au sol ; Tom (2nde) donne le coefficient directeur de la droite de son arbalète. Le tir part **exactement** dans la direction
 * choisie : on voit où il va et on corrige soi-même. Pur et testé sans moteur ; les écrans sont dans ui/TirRange.tsx, la série et l'XP dans core/lice.ts.
 *
 * Générateurs : `6e.angles.tir` (`visual = { kind: 'rapporteur', angle, reference: 'droite' | 'gauche', minor, labels, double_scale, distance }`) et `2nde.droites.tir`
 * (`visual = { kind: 'repere_tir', start: [0, b], target: [x, y], width, height }`).
 */
import { type Frac, reduce, writeFrac } from './pont'

type Visual = Record<string, unknown> | null | undefined

const int = (value: unknown, fallback: number): number => {
  const n = Math.trunc(Number(value))
  return Number.isFinite(n) ? n : fallback
}
const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

// --- Le rapporteur géant (6e) ---------------------------------------------------------------------------------------------------------------------------

export interface ProtractorSpec {
  /** Angle de la cible, mesuré depuis la ligne de départ (degrés). */
  angle: number
  /** Ligne de départ à gauche (graduation qui part de la gauche, avec alors les deux graduations d'un vrai rapporteur) ou à droite. */
  referenceLeft: boolean
  /** Pas des petites graduations, et des nombres écrits (degrés). */
  minor: number
  labels: number
  doubleScale: boolean
  /** Distance de la cible au centre (mètres). */
  distance: number
}

export function protractorFrom(visual: Visual): ProtractorSpec {
  const minor = clamp(int(visual?.minor, 10), 1, 90)
  return {
    angle: clamp(int(visual?.angle, 45), 0, 180),
    referenceLeft: visual?.reference === 'gauche',
    minor,
    labels: clamp(int(visual?.labels, 30), minor, 180),
    doubleScale: visual?.double_scale === true,
    distance: Number(visual?.distance) > 0 ? Number(visual?.distance) : 5.5,
  }
}

/** Direction (au sol, vue d'en haut : x vers la droite, y vers le haut) d'un angle compté depuis la ligne de départ. */
export function directionOf(measured: number, referenceLeft: boolean): { x: number; y: number } {
  const theta = ((referenceLeft ? 180 - measured : measured) * Math.PI) / 180
  return { x: Math.cos(theta), y: Math.sin(theta) }
}

export interface Tick {
  /** Graduation, comptée depuis la droite (0 à 180). */
  k: number
  /** Trait long, avec son nombre écrit. */
  long: boolean
}

export function ticksOf(spec: Pick<ProtractorSpec, 'minor' | 'labels'>): Tick[] {
  const ticks: Tick[] = []
  for (let k = 0; k <= 180; k += spec.minor) ticks.push({ k, long: k % spec.labels === 0 })
  return ticks
}

/** Le tir touche si l'angle visé est celui de la cible : exactement. */
export const hitsAngle = (shot: number, spec: Pick<ProtractorSpec, 'angle'>): boolean => shot === spec.angle

/** Ce que montre le tir raté, et dans quel sens corriger (textes de la v1) ; la graduation lue à l'envers a son conseil. */
export function angleAdvice(shot: number, spec: Pick<ProtractorSpec, 'angle' | 'referenceLeft'>): string {
  if (spec.referenceLeft && shot === 180 - spec.angle) {
    return `Ta flèche est partie à ${shot}° de l'autre côté : tu as lu la graduation qui part de la droite. Pars du 0 de la ligne de départ, à gauche.`
  }
  if (shot < spec.angle) return `Ta flèche est partie à ${shot}° : la cible est plus loin de la ligne de départ. Essaie un angle plus grand.`
  return `Ta flèche est partie à ${shot}° : la cible est plus près de la ligne de départ. Essaie un angle plus petit.`
}

/** « − » et « + » de l'angle : un pas de petite graduation, de 0 à 180. */
export const stepAngle = (value: number, direction: -1 | 1, minor: number): number => clamp(value + direction * minor, 0, 180)

// --- Le repère de l'arbalète (2nde) ---------------------------------------------------------------------------------------------------------------------

export interface LineSpec {
  start: { x: number; y: number }
  target: { x: number; y: number }
  width: number
  height: number
}

const pair = (value: unknown, fallback: [number, number]): { x: number; y: number } => {
  const a = Array.isArray(value) ? value : []
  return { x: int(a[0], fallback[0]), y: int(a[1], fallback[1]) }
}

export function lineFrom(visual: Visual): LineSpec {
  return {
    start: pair(visual?.start, [0, 0]),
    target: pair(visual?.target, [5, 5]),
    width: Math.max(1, int(visual?.width, 10)),
    height: Math.max(1, int(visual?.height, 8)),
  }
}

/** Le coefficient directeur choisi, tel qu'enregistré : « 2 », « -3/4 » (le dénominateur 1 ne s'écrit pas). */
export const slopeText = (numerator: number, denominator: number): string => (denominator === 1 ? String(numerator) : `${numerator}/${denominator}`)

/** Vrai si la droite de coefficient numérateur/dénominateur passe par la cible (arithmétique entière : jamais de flottant). */
export const lineHits = (numerator: number, denominator: number, spec: Pick<LineSpec, 'start' | 'target'>): boolean =>
  denominator !== 0 && numerator * spec.target.x === (spec.target.y - spec.start.y) * denominator

/** Hauteur du carreau à l'abscisse `x`, en fraction réduite. */
export const heightAt = (numerator: number, denominator: number, b: number, x: number): Frac => reduce({ n: numerator * x + b * denominator, d: denominator })

/** Ce que montre le tir raté : où passe le carreau à l'abscisse de la cible, et dans quel sens corriger (texte de la v1). */
export function lineAdvice(numerator: number, denominator: number, spec: Pick<LineSpec, 'start' | 'target'>): string {
  const y = heightAt(numerator, denominator, spec.start.y, spec.target.x)
  const high = y.n > spec.target.y * y.d
  return `À x = ${spec.target.x}, ton carreau passe à y = ${writeFrac(y)} : trop ${high ? 'haut' : 'bas'} (la cible est à y = ${spec.target.y}). Essaie un coefficient plus ${high ? 'petit' : 'grand'}.`
}

/** Où le carreau s'arrête : la cible s'il la touche, sinon le bord du repère (la trace sort du cadre). */
export function shotEnd(numerator: number, denominator: number, spec: LineSpec): { x: number; y: number } {
  const a = denominator === 0 ? 0 : numerator / denominator
  let endX = spec.width
  if (a > 0) endX = Math.min(endX, (spec.height - spec.start.y) / a)
  else if (a < 0) endX = Math.min(endX, -spec.start.y / a)
  if (lineHits(numerator, denominator, spec)) endX = spec.target.x
  return { x: endX, y: spec.start.y + a * endX }
}

export const NUMERATOR_RANGE = [-12, 12] as const
export const DENOMINATOR_RANGE = [1, 6] as const

export const stepNumerator = (value: number, direction: -1 | 1): number => clamp(value + direction, NUMERATOR_RANGE[0], NUMERATOR_RANGE[1])
export const stepDenominator = (value: number, direction: -1 | 1): number => clamp(value + direction, DENOMINATOR_RANGE[0], DENOMINATOR_RANGE[1])

/** Quel stand une question demande : le rapporteur (angle) ou la droite de l'arbalète (coefficient directeur) ; null si ce n'est pas une cible. */
export function rangeOf(visual: Visual): 'angle' | 'droite' | null {
  return visual?.kind === 'rapporteur' ? 'angle' : visual?.kind === 'repere_tir' ? 'droite' : null
}
