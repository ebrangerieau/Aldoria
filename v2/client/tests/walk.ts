import { MAX_CLIMB, MAX_WATER_DEPTH } from '../src/core/world/movement'
import { type IslandLayout, SEA_LEVEL, type Terrain } from '../src/core/world/terrain'

/** Le pas de la grille d'exploration, en mètres. */
export const CELL = 2

/** La clé d'un point (x, z en mètres, multiples de CELL) dans l'ensemble rendu par `reachableOnFoot`. */
export const cellKey = (x: number, z: number): string => `${Math.round(x / CELL)},${Math.round(z / CELL)}`

/**
 * Les cases de 2 m atteignables à pied depuis le point de départ, avec la règle de pente et d'eau du déplacement réel (movement.ts :
 * montée limitée, jamais plus de MAX_WATER_DEPTH d'eau). Ignore les obstacles (arbres, bâtiments) : un test de position s'en garde ailleurs.
 */
export function reachableOnFoot(layout: IslandLayout, terrain: Terrain): Set<string> {
  const start: [number, number] = [Math.round(layout.depart.x / CELL), Math.round(layout.depart.z / CELL)]
  const seen = new Set<string>([`${start[0]},${start[1]}`])
  const queue: [number, number][] = [start]
  while (queue.length > 0) {
    const [i, j] = queue.pop()!
    const h0 = terrain.heightAt(i * CELL, j * CELL)
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const ni = i + di
      const nj = j + dj
      if (Math.abs(ni * CELL) > 300 || Math.abs(nj * CELL) > 300 || seen.has(`${ni},${nj}`)) continue
      const h = terrain.heightAt(ni * CELL, nj * CELL)
      if (h < SEA_LEVEL - MAX_WATER_DEPTH || (h - h0) / (Math.hypot(di, dj) * CELL) > MAX_CLIMB) continue
      seen.add(`${ni},${nj}`)
      queue.push([ni, nj])
    }
  }
  return seen
}
