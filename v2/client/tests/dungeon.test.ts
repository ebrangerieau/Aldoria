import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CLIMB_RISE, DEFAULT_DECOR, DOOR_DEPTH, Dungeon, type DungeonDecor, headingOf, ROOM_D, ROOM_W, STAIR_HALF, STAIR_RUN, TILES_X, TILES_Z,
  VOID_HEIGHT,
} from '../src/core/world/dungeon'
import { HERO_RADIUS, MAX_CLIMB, RUN_SPEED, step } from '../src/core/world/movement'
import { Obstacles } from '../src/core/world/obstacles'
import { DUNGEONS } from '../src/core/world/places'

const tower = new Dungeon(6)
const MODELS = fileURLToPath(new URL('../public/ressources/models/kaykit/dungeon/', import.meta.url))

/** Le héros court dans une direction pendant `seconds` ; rend où il s'arrête. */
function run(dungeon: Dungeon, from: { x: number; z: number }, dir: { x: number; z: number }, seconds: number, obstacles: Obstacles | null = null) {
  let p = { x: from.x, z: from.z, y: dungeon.heightAt(from.x, from.z) }
  for (let t = 0; t < seconds; t += 1 / 60) p = step(p, dir, RUN_SPEED, 1 / 60, dungeon, obstacles)
  return p
}

describe('Repères du donjon', () => {
  it('aligne six salles de 16 m, chacune 4 m plus haut', () => {
    expect(tower.length).toBe(6 * ROOM_W)
    expect(tower.roomOrigin(0)).toEqual({ x: 0, y: 0, z: 0 })
    expect(tower.roomOrigin(3)).toEqual({ x: 48, y: 12, z: 0 })
    expect(tower.roomAt(-5)).toBe(0)
    expect(tower.roomAt(17)).toBe(1)
    expect(tower.roomAt(10_000)).toBe(5)
  })

  it('arrive juste après la porte ouest, au milieu de la profondeur', () => {
    const entry = tower.entryPoint(2)
    expect(entry).toEqual({ x: 34.5, y: 2 * CLIMB_RISE, z: -DOOR_DEPTH })
    expect(tower.heightAt(entry.x, entry.z)).toBe(2 * CLIMB_RISE)
  })

  it('étiquette les étages pour l’affichage', () => {
    expect(tower.floorLabel(0)).toBe('Étage 1 / 6')
    expect(tower.floorLabel(5)).toBe('Étage 6 / 6')
  })

  it('traduit les orientations de la v1 en caps (0 nord, sens des aiguilles d’une montre)', () => {
    expect(headingOf(0)).toBe(180) // mur nord : sa face regarde le sud, vers la salle
    expect(headingOf(90)).toBe(90) // mur ouest : face à l'est
    expect(headingOf(-90)).toBe(270) // mur est : face à l'ouest
    expect(headingOf(180)).toBe(0)
  })

  it('place les points de la v1 : z vers le nord, salles impaires en miroir pour le décor', () => {
    expect(tower.point(0, 11, 7)).toEqual({ x: 11, z: -7 })
    expect(tower.point(2, 11, 7)).toEqual({ x: 43, z: -7 })
    expect(tower.point(1, 3, 5, true)).toEqual({ x: 29, z: -5 })
    expect(tower.point(1, 3, 5)).toEqual({ x: 19, z: -5 })
  })
})

describe('Sol et escaliers', () => {
  it('est plat dans une salle, rampe dans l’escalier et raccorde la salle suivante sans saut', () => {
    expect(tower.heightAt(5, -5)).toBe(0)
    expect(tower.heightAt(ROOM_W - STAIR_RUN, -DOOR_DEPTH)).toBe(0)
    expect(tower.heightAt(ROOM_W - STAIR_RUN / 2, -DOOR_DEPTH)).toBeCloseTo(CLIMB_RISE / 2, 5)
    // Au sommet de l'escalier (mur de séparation) puis dans la salle suivante : la même hauteur.
    expect(tower.heightAt(ROOM_W - 0.01, -DOOR_DEPTH)).toBeCloseTo(CLIMB_RISE, 1)
    expect(tower.heightAt(ROOM_W + 0.01, -DOOR_DEPTH)).toBe(CLIMB_RISE)
  })

  it('refuse le vide : hors du donjon, contre les murs et au bord sud', () => {
    for (const [x, z] of [[-3, -10], [tower.length + 3, -10], [8, 2], [8, -ROOM_D - 1], [0.3, -10], [8, -0.3], [8, -ROOM_D + 0.2]] as const) {
      expect(tower.heightAt(x, z), `${x}, ${z}`).toBe(VOID_HEIGHT)
    }
  })

  it('ferme le mur de séparation, sauf à la porte', () => {
    expect(tower.heightAt(ROOM_W, -3)).toBe(VOID_HEIGHT)
    expect(tower.heightAt(ROOM_W, -DOOR_DEPTH - 3)).toBe(VOID_HEIGHT)
    expect(tower.heightAt(ROOM_W, -DOOR_DEPTH)).toBeGreaterThan(VOID_HEIGHT)
  })

  it('le héros monte de salle en salle d’un trait, par l’escalier et la porte, du rez-de-chaussée au sommet', () => {
    let p = { x: tower.entryPoint(0).x, z: tower.entryPoint(0).z, y: 0 }
    const obstacles = new Obstacles()
    for (const c of tower.obstacles()) obstacles.add(c)
    for (let t = 0; t < 40 && p.x < tower.length - 3; t += 1 / 60) p = step(p, { x: 1, z: 0 }, RUN_SPEED, 1 / 60, tower, obstacles)
    expect(p.x).toBeGreaterThan(tower.length - 4)
    expect(p.y).toBe(5 * CLIMB_RISE)
  })

  it('le héros redescend de la même façon', () => {
    const top = tower.entryPoint(5)
    const end = run(tower, top, { x: -1, z: 0 }, 40)
    expect(end.x).toBeLessThan(3)
    expect(end.y).toBe(0)
  })

  it('s’arrête devant un mur de séparation loin de la porte', () => {
    const end = run(tower, { x: 5, z: -3 }, { x: 1, z: 0 }, 4)
    expect(end.x).toBeLessThan(ROOM_W)
    expect(end.x).toBeGreaterThan(ROOM_W - 1.5)
    expect(end.y).toBe(0)
  })

  it('ne grimpe pas sur l’escalier par le flanc', () => {
    // À mi-hauteur de la rampe (x = 14 : 2 m), le flanc est une falaise : le héros s'arrête à son pied, au sol.
    const end = run(tower, { x: 14, z: -(DOOR_DEPTH + STAIR_HALF + 2) }, { x: 0, z: 1 }, 3)
    expect(end.y).toBe(0)
    expect(-end.z).toBeGreaterThanOrEqual(DOOR_DEPTH + STAIR_HALF)
  })

  it('une marche de l’escalier ne dépasse jamais la montée permise', () => {
    let worst = 0
    for (let x = ROOM_W - STAIR_RUN; x < ROOM_W; x += 0.05) {
      worst = Math.max(worst, (tower.heightAt(x + 0.05, -DOOR_DEPTH) - tower.heightAt(x, -DOOR_DEPTH)) / 0.05)
    }
    expect(worst).toBeLessThanOrEqual(MAX_CLIMB)
  })
})

describe('Pièces du décor', () => {
  const pieces = tower.pieces()
  const inRoom = (i: number) => pieces.filter((p) => p.room === i)

  it('pose 20 dalles par salle, sans deux au même endroit', () => {
    for (let i = 0; i < 6; i += 1) {
      const floors = inRoom(i).filter((p) => p.role === 'sol')
      expect(floors).toHaveLength(TILES_X * TILES_Z)
      expect(new Set(floors.map((p) => `${p.x},${p.z}`)).size).toBe(floors.length)
    }
  })

  it('met une porte dans le mur ouest de chaque salle (celle de la première est la sortie), un escalier par étage et aucun au dernier', () => {
    expect(pieces.filter((p) => p.role === 'porte')).toHaveLength(6)
    const stairs = pieces.filter((p) => p.role === 'escalier')
    expect(stairs.map((p) => p.room)).toEqual([0, 1, 2, 3, 4])
    for (const s of stairs) {
      expect(s.scaleY).toBe(1)
      expect(s.z).toBe(-DOOR_DEPTH)
      expect(s.heading).toBe(270)
    }
  })

  it('porte les murs vers l’intérieur de la salle : nord vers le sud, ouest vers l’est', () => {
    const north = inRoom(0).filter((p) => p.role === 'mur' && p.z === 0)
    expect(north).toHaveLength(4)
    expect(north.every((p) => p.heading === 180)).toBe(true)
    const west = inRoom(0).filter((p) => (p.role === 'mur' || p.role === 'porte') && p.x === 0)
    expect(west).toHaveLength(5)
    expect(west.every((p) => p.heading === 90)).toBe(true)
  })

  it('monte chaque salle de 4 m et pose les fondations sous le bord sud', () => {
    for (let i = 0; i < 6; i += 1) {
      for (const p of inRoom(i).filter((q) => q.role === 'sol')) expect(p.y).toBe(i * CLIMB_RISE)
      const foundations = inRoom(i).filter((p) => p.role === 'fondation')
      expect(foundations).toHaveLength(4)
      expect(foundations.every((p) => p.y === i * CLIMB_RISE - 4 && p.z === -ROOM_D)).toBe(true)
    }
  })

  it('met les objets des salles impaires en miroir est-ouest', () => {
    const barrel = (i: number) => inRoom(i).find((p) => p.model === 'barrel_large')!
    expect(barrel(0).x).toBe(1.4)
    expect(barrel(1).x).toBe(ROOM_W + ROOM_W - 1.4)
  })

  it('met deux torches par salle', () => {
    expect(tower.torches()).toHaveLength(12)
    expect(tower.torches().filter((t) => t.room === 3)).toHaveLength(2)
    expect(tower.torchColor()).toEqual(DEFAULT_DECOR.torch_color)
  })

  it('tous les modèles utilisés existent dans les ressources, pour les 30 lieux', () => {
    const models = new Set<string>()
    for (const dungeon of DUNGEONS) {
      const built = new Dungeon(dungeon.rooms.length, CLIMB_RISE, (dungeon as unknown as { v1_decor: DungeonDecor }).v1_decor)
      for (const p of built.pieces()) models.add(p.model)
    }
    expect(models.size).toBeGreaterThan(20)
    for (const model of models) expect(existsSync(`${MODELS}${model}.glb`), model).toBe(true)
  })

  it('laisse libre le couloir de la porte et de l’escalier, dans les 30 lieux', () => {
    for (const dungeon of DUNGEONS) {
      const built = new Dungeon(dungeon.rooms.length, CLIMB_RISE, (dungeon as unknown as { v1_decor: DungeonDecor }).v1_decor)
      for (const c of built.obstacles()) {
        expect(Math.abs(-c.z - DOOR_DEPTH) - c.r, `${dungeon.code} obstacle ${c.x},${c.z}`).toBeGreaterThan(STAIR_HALF - 0.6 - HERO_RADIUS)
        expect(built.heightAt(c.x, c.z), `${dungeon.code} obstacle hors du sol`).toBeGreaterThan(VOID_HEIGHT)
      }
    }
  })

  it('un héros traverse chacun des 30 lieux du bas en haut', () => {
    for (const dungeon of DUNGEONS) {
      const built = new Dungeon(dungeon.rooms.length, CLIMB_RISE, (dungeon as unknown as { v1_decor: DungeonDecor }).v1_decor)
      const obstacles = new Obstacles()
      for (const c of built.obstacles()) obstacles.add(c)
      const start = built.entryPoint(0)
      let p = { x: start.x, z: start.z, y: 0 }
      for (let t = 0; t < 40 && p.x < built.length - 3; t += 1 / 60) p = step(p, { x: 1, z: 0 }, RUN_SPEED, 1 / 60, built, obstacles)
      expect(p.y, dungeon.code).toBe((dungeon.rooms.length - 1) * CLIMB_RISE)
    }
  })
})
