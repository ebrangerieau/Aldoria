import { describe, expect, it } from 'vitest'
import ile from '@content/monde/ile.json'
import { HeightGrid } from '../src/core/world/heightGrid'
import { heading, hexColor, landBounds, mapFrame, mapMarkers, paintRelief, toMap } from '../src/core/world/minimap'
import { type IslandLayout, SEA_LEVEL, Terrain } from '../src/core/world/terrain'

const layout = ile as unknown as IslandLayout
const terrain = new Terrain(layout)
// Même grille que le sol affiché au profil bas : la carte lit ces hauteurs-là.
const grid = new HeightGrid(layout.taille, 160, (x, z) => terrain.heightAt(x, z))
const heightAt = (x: number, z: number) => grid.heightAt(x, z)
const bounds = landBounds(heightAt, layout.taille)
const frame = mapFrame(bounds, 240)

describe('Mini-carte : cadre et projection', () => {
  it('contient toutes les terres, île du Sphinx comprise, avec de la mer autour', () => {
    for (let z = -layout.taille / 2; z <= layout.taille / 2; z += 3) {
      for (let x = -layout.taille / 2; x <= layout.taille / 2; x += 3) {
        if (heightAt(x, z) <= SEA_LEVEL) continue
        expect(x).toBeGreaterThan(bounds.minX)
        expect(x).toBeLessThan(bounds.maxX)
        expect(z).toBeGreaterThan(bounds.minZ)
        expect(z).toBeLessThan(bounds.maxZ)
      }
    }
    expect(bounds.maxX).toBeGreaterThan(layout.sphinx.x + layout.sphinx.rayon * 0.6)
    // Les bords de la carte sont dans la mer.
    for (const [x, z] of [[bounds.minX, 0], [bounds.maxX, layout.sphinx.z], [0, bounds.minZ], [0, bounds.maxZ]] as const) {
      expect(heightAt(x, z)).toBeLessThanOrEqual(SEA_LEVEL)
    }
  })

  it('garde les proportions de l’île', () => {
    expect(frame.width).toBe(240)
    const ratio = (bounds.maxX - bounds.minX) / (bounds.maxZ - bounds.minZ)
    expect(frame.width / frame.height).toBeCloseTo(ratio, 1)
  })

  it('met le nord en haut et l’est à droite', () => {
    const c = toMap(frame, layout.citadelle.x, layout.citadelle.z)
    const north = toMap(frame, layout.citadelle.x, layout.citadelle.z + 50)
    const east = toMap(frame, layout.citadelle.x + 50, layout.citadelle.z)
    expect(north.v).toBeLessThan(c.v)
    expect(north.u).toBeCloseTo(c.u)
    expect(east.u).toBeGreaterThan(c.u)
    expect(east.v).toBeCloseTo(c.v)
    // Les coins du cadre tombent aux coins de l'image.
    expect(toMap(frame, bounds.minX, bounds.maxZ)).toEqual({ u: 0, v: 0 })
    const corner = toMap(frame, bounds.maxX, bounds.minZ)
    expect(corner.u).toBeCloseTo(frame.width)
    expect(corner.v).toBeCloseTo(frame.height, 0)
  })

  it('tourne la flèche dans le sens des aiguilles d’une montre depuis le nord', () => {
    expect(heading(0, 1)).toBeCloseTo(0)
    expect(heading(1, 0)).toBeCloseTo(90)
    expect(heading(0, -1)).toBeCloseTo(180)
    expect(heading(-1, 0)).toBeCloseTo(270)
  })
})

describe('Mini-carte : repères', () => {
  const sources = [
    { id: 'tour-fractions', kind: 'lieu', label: 'La Tour des Fractions', x: 100, z: 90, open: true },
    { id: 'lieu-ferme', kind: 'lieu', label: 'Un lieu fermé', x: 110, z: 120, open: false },
    { id: 'lieu-fait', kind: 'lieu', label: 'Un lieu terminé', x: 130, z: 120, open: true },
    { id: 'pierre-eveil', kind: 'pierre', label: "La Pierre d'éveil", x: 9, z: -22, open: true },
    { id: 'pierre-maths', kind: 'pierre', label: 'La Pierre des Cimes', x: 111, z: 112, open: false },
    { id: 'pierre-jour', kind: 'jour', label: 'La Pierre du Jour', x: 14, z: 8, open: true },
    { id: 'ysaline', kind: 'ysaline', label: 'Maître Ysaline', x: -6, z: -12 },
  ]
  const markers = mapMarkers(layout, '6e', sources, { 'lieu-fait': 1 })
  const byId = (id: string) => markers.find((m) => m.id === id)

  it('pose la Citadelle, le village de la classe et l’île du Sphinx', () => {
    expect(byId('citadelle')).toMatchObject({ kind: 'citadelle', x: layout.citadelle.x, z: layout.citadelle.z })
    expect(byId('village')?.label).toBe('Clairval')
    expect(mapMarkers(layout, '2nde', [], {}).find((m) => m.id === 'village')?.label).toBe('Brumegarde')
    expect(byId('sphinx')).toMatchObject({ x: layout.sphinx.x, z: layout.sphinx.z })
  })

  it('reprend les lieux et les pierres posés par le monde, avec leur état', () => {
    expect(byId('tour-fractions')).toMatchObject({ kind: 'lieu', state: 'ouvert', x: 100, z: 90 })
    expect(byId('lieu-ferme')?.state).toBe('ferme')
    expect(byId('lieu-fait')?.state).toBe('termine')
    expect(byId('pierre-eveil')?.state).toBe('endormie')
    expect(byId('pierre-maths')?.state).toBe('eveillee')
  })

  it('montre la Pierre du Jour à relever, puis relevée', () => {
    expect(byId('pierre-jour')).toMatchObject({ kind: 'jour', state: 'a_faire', label: 'La Pierre du Jour', x: 14, z: 8 })
    const done = mapMarkers(layout, '6e', sources.map((s) => (s.id === 'pierre-jour' ? { ...s, open: false } : s)), {})
    expect(done.find((m) => m.id === 'pierre-jour')?.state).toBe('faite')
  })

  it('ne révèle pas les lieux secrets et laisse les personnages de côté', () => {
    const secret = layout.secrets.tour_oubli!
    expect(markers.some((m) => Math.hypot(m.x - secret.x, m.z - secret.z) < 20)).toBe(false)
    expect(byId('ysaline')).toBeUndefined()
  })
})

describe('Mini-carte : relief', () => {
  const palette = { water: '#2f86ad', regions: Object.values(layout.regions), desaturate: 0 }
  const small = mapFrame(bounds, 120)
  const pixels = paintRelief(small, heightAt, palette)
  const at = (x: number, z: number) => {
    const { u, v } = toMap(small, x, z)
    const k = (Math.floor(v) * small.width + Math.floor(u)) * 4
    return [pixels[k]!, pixels[k + 1]!, pixels[k + 2]!, pixels[k + 3]!]
  }

  it('remplit toute l’image, sans transparence', () => {
    expect(pixels.length).toBe(small.width * small.height * 4)
    for (let k = 3; k < pixels.length; k += 4) expect(pixels[k]).toBe(255)
  })

  it('peint la mer en bleu et les terres en vert', () => {
    const sea = at(bounds.minX + 4, bounds.minZ + 4)
    expect(sea[2]!).toBeGreaterThan(sea[0]!)
    const land = at(layout.regions.francais!.x, layout.regions.francais!.z)
    expect(land[1]!).toBeGreaterThan(land[2]!)
    expect(land[1]!).toBeGreaterThan(land[0]!)
  })

  it('grise les couleurs dans le monde Brouillard', () => {
    const gray = paintRelief(small, heightAt, { ...palette, desaturate: 0.6 })
    const spread = (p: Uint8ClampedArray, k: number) => Math.max(p[k]!, p[k + 1]!, p[k + 2]!) - Math.min(p[k]!, p[k + 1]!, p[k + 2]!)
    const { u, v } = toMap(small, layout.regions.francais!.x, layout.regions.francais!.z)
    const k = (Math.floor(v) * small.width + Math.floor(u)) * 4
    expect(spread(gray, k)).toBeLessThan(spread(pixels, k))
  })

  it('lit les couleurs écrites en hexadécimal', () => {
    expect(hexColor('#2f86ad')).toEqual([0x2f, 0x86, 0xad])
  })
})
