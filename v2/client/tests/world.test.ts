import { describe, expect, it } from 'vitest'
import ile from '@content/monde/ile.json'
import { DUNGEONS, isOpen, placesFor } from '../src/core/world/places'
import { type IslandLayout, SEA_LEVEL, Terrain } from '../src/core/world/terrain'

const layout = ile as unknown as IslandLayout
const terrain = new Terrain(layout)

describe('Terrain', () => {
  it('est le même à chaque construction (même graine)', () => {
    const other = new Terrain(layout)
    for (const [x, z] of [[0, 0], [120, 105], [-40, -77], [345, 15]] as const) {
      expect(other.heightAt(x, z)).toBe(terrain.heightAt(x, z))
    }
  })

  it('a une île principale entourée de mer, et l’île du Sphinx au large', () => {
    expect(terrain.heightAt(0, 0)).toBeGreaterThan(SEA_LEVEL + 1)
    expect(terrain.heightAt(layout.sphinx.x, layout.sphinx.z)).toBeGreaterThan(SEA_LEVEL + 1)
    expect(terrain.heightAt(0, 400)).toBeLessThan(SEA_LEVEL - 3)
    // Un bras de mer sépare les deux îles : on n'y va pas à pied.
    expect(terrain.heightAt(290, 15)).toBeLessThan(SEA_LEVEL - 1)
  })

  it('met le départ, la Citadelle et le village sur la terre ferme et à plat', () => {
    for (const p of [layout.depart, layout.citadelle, layout.village, layout.pierre_eveil, layout.ysaline]) {
      expect(terrain.heightAt(p.x, p.z)).toBeGreaterThan(SEA_LEVEL + 1)
    }
    expect(terrain.slopeAt(layout.citadelle.x, layout.citadelle.z)).toBeLessThan(0.05)
    expect(terrain.slopeAt(layout.depart.x, layout.depart.z)).toBeLessThan(0.5)
  })

  it('pose les montagnes dans les Cimes Fractales', () => {
    const maths = layout.regions.maths!
    expect(terrain.rawHeight(maths.x, maths.z)).toBeGreaterThan(20)
  })

  it('reconnaît la région d’un point', () => {
    expect(terrain.regionAt(layout.citadelle.x, layout.citadelle.z)).toBe('citadelle')
    expect(terrain.regionAt(layout.regions.francais!.x, layout.regions.francais!.z)).toBe('francais')
    expect(terrain.regionAt(layout.sphinx.x, layout.sphinx.z)).toBe('sphinx')
  })
})

describe('Lieux de quête', () => {
  it.each(['6e', '2nde'])('posent tous les lieux de %s sur un replat de leur région', (level) => {
    const places = placesFor(level, terrain)
    expect(places.length).toBe(DUNGEONS.filter((d) => d.level === level).length)
    for (const place of places) {
      expect(terrain.heightAt(place.x, place.z), place.dungeon.code).toBeGreaterThan(SEA_LEVEL + 1)
      expect(terrain.slopeAt(place.x, place.z), place.dungeon.code).toBeLessThan(0.1)
    }
  })

  it('ouvrent les lieux d’une région l’un après l’autre', () => {
    const maths = placesFor('6e', terrain).filter((p) => p.dungeon.region === 'maths')
    expect(maths.map((p) => p.dungeon.code)).toEqual(['tour_fractions', 'atelier_balances', 'observatoire_angles'])
    expect(isOpen(maths[0]!, {})).toBe(true)
    expect(isOpen(maths[1]!, {})).toBe(false)
    expect(isOpen(maths[1]!, { tour_fractions: 1 })).toBe(true)
  })

  it('gardent les lieux éloignés les uns des autres', () => {
    for (const level of ['6e', '2nde']) {
      const places = placesFor(level, terrain)
      for (const a of places) {
        for (const b of places) {
          if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(15)
        }
      }
    }
  })
})

describe('Déplacement du héros', () => {
  const flat = { heightAt: () => 2 }
  it('avance à la vitesse demandée', async () => {
    const { step } = await import('../src/core/world/movement')
    const s = step({ x: 0, z: 0 }, { x: 0, z: 1 }, 6, 0.5, flat, null)
    expect(s.z).toBeCloseTo(3)
    expect(s.moved).toBeCloseTo(3)
  })

  it('reste au bord de l’eau profonde, en glissant le long du rivage', async () => {
    const { step } = await import('../src/core/world/movement')
    const shore = { heightAt: (x: number, z: number) => (z > 1 ? -3 : 2 + 0 * x) }
    const blocked = step({ x: 0, z: 0.5 }, { x: 0, z: 1 }, 6, 0.5, shore, null)
    expect(blocked.moved).toBe(0)
    const sliding = step({ x: 0, z: 0.5 }, { x: 1, z: 1 }, 6, 0.5, shore, null)
    expect(sliding.z).toBeCloseTo(0.5)
    expect(sliding.x).toBeGreaterThan(1)
  })

  it('ne grimpe pas une falaise', async () => {
    const { step } = await import('../src/core/world/movement')
    const cliff = { heightAt: (_x: number, z: number) => (z > 1 ? 30 : 2) }
    expect(step({ x: 0, z: 0.8 }, { x: 0, z: 1 }, 6, 0.2, cliff, null).moved).toBe(0)
  })

  it('contourne un tronc au lieu de le traverser', async () => {
    const { step, HERO_RADIUS } = await import('../src/core/world/movement')
    const { Obstacles } = await import('../src/core/world/obstacles')
    const trees = new Obstacles()
    trees.add({ x: 0, z: 2, r: 1 })
    let pos = { x: 0.2, z: 0 }
    for (let i = 0; i < 30; i += 1) pos = step(pos, { x: 0, z: 1 }, 3, 0.05, flat, trees)
    expect(Math.hypot(pos.x, pos.z - 2)).toBeGreaterThanOrEqual(1 + HERO_RADIUS - 1e-6)
  })

  it('suit les triangles du maillage du sol', async () => {
    const { HeightGrid } = await import('../src/core/world/heightGrid')
    const grid = new HeightGrid(860, 215, (x, z) => terrain.heightAt(x, z))
    // Aux sommets de la grille, la hauteur est exactement celle du relief.
    for (const [i, j] of [[100, 100], [107, 120], [150, 90]] as const) {
      expect(grid.heightAt(grid.xOf(i), grid.zOf(j))).toBeCloseTo(terrain.heightAt(grid.xOf(i), grid.zOf(j)), 4)
    }
  })
})
