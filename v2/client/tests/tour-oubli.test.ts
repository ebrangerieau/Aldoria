import { describe, expect, it } from 'vitest'
import ile from '@content/monde/ile.json'
import lignes from '@content/voix/lignes.json'
import { placesFor } from '../src/core/world/places'
import { type IslandLayout, SEA_LEVEL, SECRET_DOOR, secretDoor, Terrain } from '../src/core/world/terrain'
import { cellKey, reachableOnFoot } from './walk'

const layout = ile as unknown as IslandLayout
const terrain = new Terrain(layout)

describe('La Tour de l’Oubli : fermée, au nord, Maître Ysaline en dit la raison', () => {
  const tower = layout.secrets.tour_oubli!

  it('une seule tour secrète, au nord de l’île', () => {
    expect(Object.keys(layout.secrets)).toEqual(['tour_oubli'])
    expect(tower.z).toBeGreaterThan(layout.citadelle.z)
  })

  it('son seuil est à 8 m de la tour, du côté du départ, sur le replat, à pied, loin des autres lieux', () => {
    const door = secretDoor(layout, tower)
    expect(Math.hypot(door.x - tower.x, door.z - tower.z)).toBeCloseTo(SECRET_DOOR)
    // Du côté du départ : plus près du départ que la tour.
    expect(Math.hypot(door.x - layout.depart.x, door.z - layout.depart.z)).toBeLessThan(Math.hypot(tower.x - layout.depart.x, tower.z - layout.depart.z))
    expect(terrain.heightAt(door.x, door.z)).toBeGreaterThan(SEA_LEVEL + 2)
    expect(terrain.slopeAt(door.x, door.z)).toBeLessThan(0.12)
    expect(Math.abs(terrain.heightAt(door.x, door.z) - terrain.heightAt(tower.x, tower.z))).toBeLessThan(1.5) // sur le replat de la tour
    expect(reachableOnFoot(layout, terrain).has(cellKey(door.x, door.z))).toBe(true)
    for (const other of [layout.citadelle, layout.village, layout.depart, layout.pierre_eveil, layout.pierre_jour, layout.ysaline, ...placesFor('6e', terrain), ...placesFor('2nde', terrain)]) {
      expect(Math.hypot(other.x - door.x, other.z - door.z)).toBeGreaterThan(8)
    }
  })

  it('le texte de Maître Ysaline est dans les lignes enregistrées, avec sa voix : il parle de pages à reprendre et de savoir appris', () => {
    const line = lignes.find((l) => l.id === 'secret-tour_oubli')!
    expect(line.voix).toBe('ysaline')
    expect(line.texte).toContain("Tour de l'Oubli")
    expect(line.texte).toContain('Malvrek')
    expect(line.texte).toMatch(/pages/)
    expect(line.texte).toMatch(/appris/)
  })
})
