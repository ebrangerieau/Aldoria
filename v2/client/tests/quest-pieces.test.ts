import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { insideLevel, piecesOf, planLevel } from '../src/core/quest/pieces'
import { DOOR_Z, Floor, ROOM_D, ROOM_W } from '../src/core/quest/layout'
import { DUNGEONS } from '../src/core/world/places'

const models = fileURLToPath(new URL('../public/ressources/models/kaykit/dungeon/', import.meta.url))
const FRACTIONS = DUNGEONS.find((d) => d.code === 'tour_fractions')!

describe('plan de construction d’un lieu', () => {
  const plan = planLevel(FRACTIONS)

  it('pose 20 dalles de sol par salle, six salles', () => {
    const floors = plan.pieces.filter((p) => p.name.startsWith('floor_'))
    expect(floors).toHaveLength(6 * 20)
    expect(new Set(floors.map((p) => p.name))).toEqual(new Set(['floor_tile_large', 'floor_tile_large_rocks']))
  })

  it('met une porte entre chaque salle (cinq), au milieu du mur de séparation', () => {
    const doors = plan.pieces.filter((p) => p.door !== undefined)
    expect(doors.map((d) => d.door)).toEqual([1, 2, 3, 4, 5])
    for (const d of doors) {
      expect(d.name).toBe('wall_doorway')
      expect(d.x).toBe(d.door! * ROOM_W)
      expect(d.z).toBe(DOOR_Z + 0) // 20 − (2 + 2 × 4) = 10
    }
  })

  it('ferme le mur du fond, le mur ouest et le mur est de la dernière salle ; le côté ouvert reste libre', () => {
    const walls = plan.pieces.filter((p) => p.name.startsWith('wall'))
    const back = walls.filter((p) => Math.abs(p.z - (ROOM_D - 0)) < 1e-9)
    expect(back).toHaveLength(6 * 4) // 4 pièces de 4 m par salle de 16 m
    expect(walls.filter((p) => p.x === 6 * ROOM_W)).toHaveLength(5) // mur est de la dernière salle
    expect(walls.some((p) => p.z < 0.5)).toBe(false) // rien le long du côté ouvert, où se tient la caméra
  })

  it('reste dans les murs, utilise un décor propre au lieu, et ne bouche aucune porte', () => {
    expect(plan.pieces.every((p) => insideLevel(p.x, p.z, 6))).toBe(true)
    expect(plan.pieces.some((p) => p.name === 'floor_tile_large')).toBe(true)
    const floor = new Floor(6)
    for (let i = 0; i < 5; i += 1) floor.openDoor(i)
    const blocking = plan.obstacles.filter((o) => Math.abs(o.z - DOOR_Z) < o.r + 0.9 && Math.abs(o.x / ROOM_W - Math.round(o.x / ROOM_W)) < (o.r + 1.2) / ROOM_W)
    expect(blocking).toEqual([])
    expect(floor.walkable(ROOM_W, DOOR_Z)).toBe(true)
  })

  it('met en miroir le décor des salles impaires (les objets passent de l’est à l’ouest)', () => {
    const barrels = plan.obstacles.filter((o) => o.r === 0.8)
    expect(barrels.length).toBeGreaterThan(1)
    const xs = barrels.map((o) => o.x - Math.floor(o.x / ROOM_W) * ROOM_W)
    expect(new Set(xs.map((x) => Math.round(x))).size).toBeGreaterThan(1)
  })

  it('place deux torches par salle', () => {
    expect(plan.torches).toHaveLength(12)
    expect(plan.torches.filter((t) => t.room === 3)).toHaveLength(2)
  })
})

describe('les 30 lieux', () => {
  it('chacun a un plan dont toutes les pièces sont livrées', () => {
    expect(DUNGEONS).toHaveLength(30)
    for (const def of DUNGEONS) {
      const plan = planLevel(def)
      expect(plan.pieces.length, def.code).toBeGreaterThan(150)
      for (const name of piecesOf(plan)) expect(existsSync(`${models}${name}.glb`), `${def.code} : pièce absente ${name}`).toBe(true)
      expect(plan.pieces.every((p) => insideLevel(p.x, p.z, def.rooms.length)), def.code).toBe(true)
    }
  })
})
