/**
 * La géométrie de la balance géante (v1 : core/world/balance_rig.gd), la part qui se calcule sans moteur : dimensions, où se posent les boîtes et les billes sur un
 * plateau, où pendent les plateaux selon l'inclinaison du fléau, et le mouvement du fléau. game/balanceRig.ts dessine ce que ce fichier calcule.
 *
 * Repère de la balance : x vers la droite de l'écran (la caméra est au sud), y vers le haut, z vers le fond ; l'origine est au pied de la colonne.
 */
import type { Heavier } from './balanceEnigma'
import { BALANCE_DISTANCE, BALANCE_REARM_MARGIN, BALANCE_TOUCH } from './world/dungeon'

export const ARM = 2.4 // demi-longueur du fléau
export const PIVOT_H = 2.3 // hauteur du pivot
export const HANG = 1.0 // longueur des chaînes sous le fléau
export const PLATE_R = 1.15
export const MAX_TILT = 12 // degrés
export const BOX = 0.42
export const MARBLE_R = 0.1
/** Largeur occupée au sol : de l'extrémité d'un plateau à l'autre. */
export const SPAN = 2 * (ARM + PLATE_R)

export interface Spot {
  x: number
  y: number
  z: number
}

/** Le fléau penche du côté le plus lourd : à gauche, son extrémité gauche descend (rotation positive autour de z). */
export function tiltFor(heavier: Heavier): number {
  return -heavier * MAX_TILT
}

/** Où pend le centre de chaque plateau, et le milieu de sa chaîne, quand le fléau est incliné de `degrees` ; les plateaux restent horizontaux. */
export function platePositions(degrees: number): { left: Spot; right: Spot; leftChain: Spot; rightChain: Spot } {
  const angle = (degrees * Math.PI) / 180
  const end = (side: number): Spot => ({ x: side * ARM * Math.cos(angle), y: PIVOT_H + side * ARM * Math.sin(angle), z: 0 })
  const hang = (p: Spot, by: number): Spot => ({ x: p.x, y: p.y - by, z: p.z })
  const l = end(-1)
  const r = end(1)
  return { left: hang(l, HANG), right: hang(r, HANG), leftChain: hang(l, HANG / 2), rightChain: hang(r, HANG / 2) }
}

/** Les boîtes au fond du plateau, quatre par rangée, centrées (position sur le plateau, y : le dessus du plateau est à 0,05). */
export function boxSpots(count: number): Spot[] {
  const spots: Spot[] = []
  for (let n = 0; n < count; n += 1) {
    const row = Math.floor(n / 4)
    const inRow = Math.min(4, count - row * 4)
    const col = n % 4
    spots.push({ x: (col - (inRow - 1) / 2) * (BOX + 0.06), y: 0.05 + BOX / 2, z: -0.55 + row * (BOX + 0.06) })
  }
  return spots
}

/** Les billes en couches : devant les boîtes, ou sur tout le plateau s'il n'y a pas de boîte. */
export function marbleSpots(count: number, withBoxes: boolean): Spot[] {
  const step = MARBLE_R * 2.05
  const zFrom = withBoxes ? 0.25 : -0.85
  const zTo = 0.95
  const cells: { x: number; z: number }[] = []
  for (let z = zFrom; z <= zTo + 0.001; z += step) {
    for (let x = -0.95; x <= 0.95 + 0.001; x += step) {
      if (Math.hypot(x, z) <= PLATE_R - MARBLE_R) cells.push({ x, z })
    }
  }
  const spots: Spot[] = []
  for (let layer = 0; spots.length < count && cells.length > 0; layer += 1) {
    for (const cell of cells) {
      if (spots.length >= count) break
      spots.push({ x: cell.x, y: 0.05 + MARBLE_R + layer * step * 0.9, z: cell.z })
    }
  }
  return spots
}

/** « 1 boîte + 4 billes », « vide » : l'étiquette au-dessus d'un plateau. */
export function plateLabel(side: { boxes: number; units: number }, box: readonly [string, string], unit: readonly [string, string]): string {
  const part = (n: number, [one, many]: readonly [string, string]) => `${n} ${n === 1 ? one : many}`
  const parts = [side.boxes > 0 ? part(side.boxes, box) : '', side.units > 0 ? part(side.units, unit) : ''].filter(Boolean)
  return parts.length > 0 ? parts.join(' + ') : 'vide'
}

/** Durée du mouvement du fléau, en secondes : un rebond avant de se poser, ou une glissade douce en mode calme. */
export const TILT_SECONDS = 0.9
export const TILT_SECONDS_CALM = 0.6

/** Sortie « ressort » : dépasse un peu le but puis s'y pose (t de 0 à 1 ; 0 au départ, 1 à l'arrivée). */
export function elasticOut(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const c = (2 * Math.PI) / 3
  return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c) + 1
}

/** Le même en douceur (sinus) pour le mode calme : jamais de rebond. */
export function sineInOut(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : -(Math.cos(Math.PI * t) - 1) / 2
}

/** L'inclinaison à l'instant `t` (secondes depuis le début) d'un mouvement de `from` vers `goal`. */
export function tiltAt(from: number, goal: number, t: number, calm: boolean): number {
  const seconds = calm ? TILT_SECONDS_CALM : TILT_SECONDS
  const k = Math.min(1, Math.max(0, t / seconds))
  return from + (goal - from) * (calm ? sineInOut(k) : elasticOut(k))
}

/** Les trois obstacles ronds de la balance (le plateau gauche, la colonne, le plateau droit) autour de son pied. */
export function footprints(base: { x: number; z: number }): { x: number; z: number; r: number }[] {
  return [-ARM, 0, ARM].map((dx) => ({ x: base.x + dx, z: base.z, r: dx === 0 ? 0.9 : PLATE_R }))
}

/**
 * Le héros est-il assez près de la balance pour que l'énigme commence ? À moins de `BALANCE_DISTANCE` de son pied (comme la v1), ou contre un plateau ou la colonne :
 * de face, il passe sous les 3,4 m, mais de côté (à l'ouest) les plateaux l'arrêtent à plus de 4 m du pied. `extra` élargit les deux seuils : s'éloigner de `BALANCE_REARM_MARGIN`
 * de plus après avoir renoncé, sinon la balance se relancerait dès qu'elle se réarme.
 */
export function isNear(hero: { x: number; z: number }, base: { x: number; z: number }, extra = 0): boolean {
  if (Math.hypot(hero.x - base.x, hero.z - base.z) < BALANCE_DISTANCE + extra) return true
  return footprints(base).some((f) => Math.hypot(hero.x - f.x, hero.z - f.z) - f.r < BALANCE_TOUCH + extra)
}

/** La balance se réarme quand le héros s'est éloigné d'elle de la marge de réarmement. */
export const isFarEnough = (hero: { x: number; z: number }, base: { x: number; z: number }): boolean => !isNear(hero, base, BALANCE_REARM_MARGIN)
