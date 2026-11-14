/**
 * Intérieur d'un lieu de quête : six salles en enfilade, d'ouest en est, reliées par une porte au
 * milieu de chaque mur de séparation (disposition de la v1, game/core/world/dungeon_level.gd).
 * Géométrie pure, sans moteur : zone praticable, portes, points de repère. Le héros marche avec
 * `step` (core/world/movement.ts) sur un `Ground` qui rend « hors sol » en dehors des salles :
 * les murs se contournent en glissant, sans code de collision de plus.
 *
 * Repère : salle i de x = 16·i à 16·(i+1), z de 0 (côté ouvert, où est la caméra) à 20 (mur du
 * fond). La v1 comptait z vers le sud (mur du fond en z = 0) : `toWorld` retourne les positions du
 * JSON pour que l'est reste à droite de l'écran.
 */
import type { Ground } from '../world/movement'

export const ROOM_W = 16
export const ROOM_D = 20
/** Milieu du mur de séparation (3e dalle de 4 m) : la porte y est ouverte. */
export const DOOR_Z = 10
export const DOOR_HALF = 1.1
/** Distance minimale du centre du héros à un mur (le corps ne traverse pas le décor). */
export const WALL_MARGIN = 0.8
/** Le sol sous les murs et hors des salles : assez profond pour que `step` le refuse. */
export const VOID_HEIGHT = -10

/** Positions du JSON (v1) vers le repère du monde : x inchangé, z retourné. */
export const toWorld = (v1x: number, v1z: number): { x: number; z: number } => ({ x: v1x, z: ROOM_D - v1z })
/** Orientation (degrés) du repère de la v1 vers celle du monde (miroir en z : le sens s'inverse). */
export const yawToWorld = (v1Degrees: number): number => (-v1Degrees * Math.PI) / 180

export const roomOrigin = (i: number): { x: number; z: number } => ({ x: i * ROOM_W, z: 0 })

/** Salle sous un point (ramenée aux salles qui existent). */
export const roomAt = (x: number, count: number): number => Math.max(0, Math.min(count - 1, Math.floor(x / ROOM_W)))

/** Point d'arrivée dans une salle, juste après la porte ouest. */
export const entryPoint = (i: number): { x: number; z: number } => ({ x: i * ROOM_W + 2.5, z: DOOR_Z })

/** Départ du lieu : au fond de la première salle, face à l'est. */
export const START_POINT = toWorld(3, 10)

/** Piédestaux de l'énigme, dans la salle-énigme (repère de la v1 : (4, 6), (8, 5), (12, 6)). */
export const PEDESTALS: readonly { x: number; z: number }[] = [toWorld(4, 6), toWorld(8, 5), toWorld(12, 6)]
/** Le coffre apparaît dans la salle de l'Effaceur. */
export const CHEST_AT = toWorld(12.5, 10)

/** Zone praticable : l'intérieur des salles (hors marge des murs) et les portes ouvertes. */
export class Floor implements Ground {
  private readonly open: boolean[]

  constructor(readonly roomCount: number) {
    // Porte i : entre la salle i et la salle i + 1.
    this.open = Array<boolean>(Math.max(0, roomCount - 1)).fill(false)
  }

  isDoorOpen(i: number): boolean {
    return i < 0 || i >= this.open.length ? false : this.open[i]!
  }

  openDoor(i: number): void {
    if (i >= 0 && i < this.open.length) this.open[i] = true
  }

  /** Le sol est plat : 0 là où l'on peut marcher, VOID_HEIGHT sinon. */
  heightAt(x: number, z: number): number {
    return this.walkable(x, z) ? 0 : VOID_HEIGHT
  }

  walkable(x: number, z: number): boolean {
    if (z < WALL_MARGIN || z > ROOM_D - WALL_MARGIN) return false
    const total = this.roomCount * ROOM_W
    if (x < WALL_MARGIN || x > total - WALL_MARGIN) return false
    const local = x - Math.floor(x / ROOM_W) * ROOM_W
    const nearWall = local < WALL_MARGIN || local > ROOM_W - WALL_MARGIN
    if (!nearWall) return true
    // Contre un mur de séparation : seulement par la porte, si elle est ouverte.
    const door = Math.round(x / ROOM_W) - 1
    return this.isDoorOpen(door) && Math.abs(z - DOOR_Z) <= DOOR_HALF - 0.3
  }

  /** Chemin d'un point vers une salle plus loin : par les portes, tout droit sinon (clic sur le sol). */
  doorsBetween(fromX: number, toX: number): number[] {
    const a = roomAt(fromX, this.roomCount)
    const b = roomAt(toX, this.roomCount)
    const out: number[] = []
    for (let i = Math.min(a, b); i < Math.max(a, b); i += 1) out.push(i)
    return out
  }
}
