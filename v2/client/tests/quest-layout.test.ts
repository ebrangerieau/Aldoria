import { describe, expect, it } from 'vitest'
import {
  CHEST_AT, DOOR_Z, entryPoint, Floor, PEDESTALS, ROOM_D, ROOM_W, roomAt, route, START_POINT, toWorld, VOID_HEIGHT, WALL_MARGIN, yawToWorld,
} from '../src/core/quest/layout'
import { HERO_RADIUS, step } from '../src/core/world/movement'

describe('repère de l’intérieur', () => {
  it('retourne z de la v1 (mur du fond) et garde x : l’est reste à droite', () => {
    expect(toWorld(11, 7)).toEqual({ x: 11, z: 13 })
    expect(toWorld(0, 0)).toEqual({ x: 0, z: ROOM_D })
    // Le mur du fond regarde vers l'intérieur (−z) ; le mur ouest vers l'est ; le mur est vers l'ouest.
    const facing = (deg: number) => [Math.sin(yawToWorld(deg)), Math.cos(yawToWorld(deg))].map((v) => Math.round(v) + 0)
    expect(facing(0)).toEqual([0, -1])
    expect(facing(90)).toEqual([1, 0])
    expect(facing(-90)).toEqual([-1, 0])
  })

  it('trouve la salle d’un point, ramenée aux salles qui existent', () => {
    expect([0, 15.9, 16, 40, 95.9, 96, 500].map((x) => roomAt(x, 6))).toEqual([0, 0, 1, 2, 5, 5, 5])
    expect(roomAt(-3, 6)).toBe(0)
  })

  it('place l’arrivée de chaque salle juste après la porte ouest, au milieu du mur', () => {
    expect(entryPoint(0)).toEqual({ x: 2.5, z: DOOR_Z })
    expect(entryPoint(3)).toEqual({ x: 50.5, z: DOOR_Z })
  })

  it('met le départ, les piédestaux et le coffre dans la salle, loin des murs', () => {
    for (const p of [START_POINT, ...PEDESTALS, CHEST_AT]) {
      expect(p.x).toBeGreaterThan(WALL_MARGIN + 1)
      expect(p.x).toBeLessThan(ROOM_W - WALL_MARGIN - 1)
      expect(p.z).toBeGreaterThan(WALL_MARGIN + 1)
      expect(p.z).toBeLessThan(ROOM_D - WALL_MARGIN - 1)
    }
    expect(new Set(PEDESTALS.map((p) => p.x)).size).toBe(3)
  })
})

describe('zone praticable', () => {
  it('refuse les murs et le vide, accepte l’intérieur des salles', () => {
    const floor = new Floor(6)
    expect(floor.heightAt(8, 10)).toBe(0)
    expect(floor.heightAt(8, 0.2)).toBe(VOID_HEIGHT) // côté ouvert : au bord du sol
    expect(floor.heightAt(8, ROOM_D - 0.2)).toBe(VOID_HEIGHT) // mur du fond
    expect(floor.heightAt(0.3, 10)).toBe(VOID_HEIGHT) // mur ouest de la première salle
    expect(floor.heightAt(6 * ROOM_W - 0.3, 10)).toBe(VOID_HEIGHT) // mur est de la dernière
    expect(floor.heightAt(-5, 10)).toBe(VOID_HEIGHT)
  })

  it('ne laisse passer d’une salle à l’autre que par la porte, une fois ouverte', () => {
    const floor = new Floor(6)
    const wall = ROOM_W
    expect(floor.walkable(wall, DOOR_Z)).toBe(false) // porte fermée
    floor.openDoor(0)
    expect(floor.walkable(wall, DOOR_Z)).toBe(true)
    expect(floor.walkable(wall - 0.5, DOOR_Z)).toBe(true)
    expect(floor.walkable(wall + 0.5, DOOR_Z)).toBe(true)
    expect(floor.walkable(wall, DOOR_Z + 2)).toBe(false) // le mur à côté de la porte
    expect(floor.walkable(2 * ROOM_W, DOOR_Z)).toBe(false) // la porte suivante reste fermée
    expect(floor.isDoorOpen(0)).toBe(true)
    expect(floor.isDoorOpen(1)).toBe(false)
    floor.openDoor(99) // sans effet
    expect(floor.isDoorOpen(99)).toBe(false)
  })

  it('le héros longe un mur en glissant, ne le traverse jamais, et franchit une porte ouverte', () => {
    const floor = new Floor(6)
    let p = { x: 10, z: 18 }
    // Vers le mur du fond, en biais : il glisse vers l'est sans entrer dans le mur.
    for (let i = 0; i < 60; i += 1) {
      const s = step(p, { x: 1, z: 1 }, 6.5, 1 / 30, floor, null)
      p = { x: s.x, z: s.z }
    }
    expect(p.z).toBeLessThanOrEqual(ROOM_D - WALL_MARGIN + 1e-6)
    expect(p.x).toBeGreaterThan(10)
    // Contre la porte fermée : il s'arrête devant.
    p = { x: 12, z: DOOR_Z }
    for (let i = 0; i < 90; i += 1) {
      const s = step(p, { x: 1, z: 0 }, 6.5, 1 / 30, floor, null)
      p = { x: s.x, z: s.z }
    }
    expect(p.x).toBeLessThan(ROOM_W)
    floor.openDoor(0)
    for (let i = 0; i < 90; i += 1) {
      const s = step(p, { x: 1, z: 0 }, 6.5, 1 / 30, floor, null)
      p = { x: s.x, z: s.z }
    }
    expect(p.x).toBeGreaterThan(ROOM_W + 2)
    expect(HERO_RADIUS).toBeLessThan(WALL_MARGIN) // le corps ne mord pas sur le mur
  })

  it('liste les portes à franchir entre deux points', () => {
    const floor = new Floor(6)
    expect(floor.doorsBetween(5, 40)).toEqual([0, 1])
    expect(floor.doorsBetween(40, 5)).toEqual([0, 1])
    expect(floor.doorsBetween(5, 6)).toEqual([])
  })
})

describe('trajet d’un clic sur le sol', () => {
  it('va tout droit dans la même salle, en restant dans les murs', () => {
    const floor = new Floor(6)
    expect(route(floor, { x: 3, z: 5 }, { x: 9, z: 12 })).toEqual([{ x: 9, z: 12 }])
    const clamped = route(floor, { x: 3, z: 5 }, { x: -20, z: 99 })
    expect(clamped).toEqual([{ x: WALL_MARGIN + 0.2, z: ROOM_D - WALL_MARGIN - 0.2 }])
  })

  it('passe par le milieu de chaque porte ouverte, vers l’est comme vers l’ouest', () => {
    const floor = new Floor(6)
    floor.openDoor(0)
    floor.openDoor(1)
    const east = route(floor, { x: 5, z: 3 }, { x: 40, z: 15 })
    expect(east).toEqual([
      { x: ROOM_W - 1.2, z: DOOR_Z }, { x: ROOM_W + 1.2, z: DOOR_Z },
      { x: 2 * ROOM_W - 1.2, z: DOOR_Z }, { x: 2 * ROOM_W + 1.2, z: DOOR_Z },
      { x: 40, z: 15 },
    ])
    const west = route(floor, { x: 40, z: 15 }, { x: 5, z: 3 })
    expect(west[0]).toEqual({ x: 2 * ROOM_W + 1.2, z: DOOR_Z })
    expect(west.at(-1)).toEqual({ x: 5, z: 3 })
  })

  it('s’arrête devant la première porte fermée', () => {
    const floor = new Floor(6)
    floor.openDoor(0)
    const path = route(floor, { x: 5, z: 3 }, { x: 70, z: 10 })
    expect(path.at(-1)).toEqual({ x: 2 * ROOM_W - 1.2, z: DOOR_Z })
    expect(path).toHaveLength(3)
  })
})
