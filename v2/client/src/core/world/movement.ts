/**
 * Déplacement du héros sur l'île, sans moteur 3D : on calcule la position voulue, puis on
 * refuse l'eau profonde et les pentes trop raides (en glissant le long de l'obstacle quand
 * c'est possible) et on repousse hors des troncs et des murs. Testé dans tests/world.test.ts.
 */
import type { Obstacles } from './obstacles'

export interface Ground {
  heightAt(x: number, z: number): number
}

export const RUN_SPEED = 6.5
export const WALK_SPEED = 2.8
export const HERO_RADIUS = 0.45
/** Au-delà, l'eau est trop profonde : le héros reste au bord (on ne se noie jamais). */
export const MAX_WATER_DEPTH = 0.7
/** Montée maximale par mètre parcouru (environ 50°). */
export const MAX_CLIMB = 1.2
/** Dans l'eau, on avance moins vite. */
export const WADE_FACTOR = 0.55

export interface Step {
  x: number
  z: number
  y: number
  moved: number
}

export function step(
  from: { x: number; z: number },
  dir: { x: number; z: number },
  speed: number,
  dt: number,
  ground: Ground,
  obstacles: Obstacles | null,
): Step {
  const h0 = ground.heightAt(from.x, from.z)
  const len = Math.hypot(dir.x, dir.z)
  if (len < 1e-3 || dt <= 0) return { x: from.x, z: from.z, y: h0, moved: 0 }
  const wading = h0 < 0 ? WADE_FACTOR : 1
  const dist = speed * wading * dt
  const dx = (dir.x / len) * dist
  const dz = (dir.z / len) * dist
  const allowed = (x: number, z: number): boolean => {
    const h = ground.heightAt(x, z)
    if (h < -MAX_WATER_DEPTH) return false
    const run = Math.hypot(x - from.x, z - from.z)
    return run < 1e-6 || (h - h0) / run <= MAX_CLIMB
  }
  // Tout droit, sinon en glissant le long d'un seul axe (bord de l'eau, pied d'une falaise).
  let target: { x: number; z: number } | null = null
  for (const [cx, cz] of [[dx, dz], [dx, 0], [0, dz]] as const) {
    if ((cx !== 0 || cz !== 0) && allowed(from.x + cx, from.z + cz)) {
      target = { x: from.x + cx, z: from.z + cz }
      break
    }
  }
  if (!target) return { x: from.x, z: from.z, y: h0, moved: 0 }
  if (obstacles) {
    const pushed = obstacles.resolve(target.x, target.z, HERO_RADIUS)
    if (allowed(pushed.x, pushed.z)) target = pushed
    else target = { x: from.x, z: from.z }
  }
  return {
    x: target.x,
    z: target.z,
    y: ground.heightAt(target.x, target.z),
    moved: Math.hypot(target.x - from.x, target.z - from.z),
  }
}

/** Plus court écart entre deux angles (radians), dans ]-π, π]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (2 * Math.PI)
  if (d > Math.PI) d -= 2 * Math.PI
  if (d <= -Math.PI) d += 2 * Math.PI
  return d
}
