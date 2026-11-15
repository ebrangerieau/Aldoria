import { describe, expect, it } from 'vitest'
import ile from '@content/monde/ile.json'
import { placesFor, REGIONS } from '../src/core/world/places'
import { BASE_LIGHT, fogDensityFactor, fogNote, lightText, regionLights } from '../src/core/world/regionLight'
import { type IslandLayout, Terrain } from '../src/core/world/terrain'

const terrain = new Terrain(ile as unknown as IslandLayout)
const sixth = placesFor('6e', terrain)
const second = placesFor('2nde', terrain)
const doneOf = (places: typeof sixth, region: string, count: number) => Object.fromEntries(places.filter((p) => p.dungeon.region === region).slice(0, count).map((p) => [p.dungeon.code, 1]))

describe('Régions qui s’éclairent', () => {
  it('une région que la classe n’a pas au programme reste sous le brouillard, avec son texte ; les autres s’éveillent', () => {
    const lights = regionLights(sixth, {})
    expect(Object.keys(lights).sort()).toEqual(Object.keys(REGIONS).sort())
    // En 6e, la Vallée du Vivant (SVT) et le Carrefour des Messagers (SNT) n'ont pas de lieu : brouillard.
    for (const code of ['svt', 'snt']) expect(lights[code], code).toMatchObject({ state: 'brume', light: 0, total: 0 })
    for (const code of ['maths', 'francais', 'anglais', 'sciences', 'histoire_geo', 'emc']) {
      expect(lights[code]!.state, code).toBe('endormie')
      expect(lights[code]!.light, code).toBe(BASE_LIGHT)
      expect(lights[code]!.total, code).toBeGreaterThan(0)
    }
    expect(fogNote('svt', lights)).toBe(REGIONS.svt!.fog)
    expect(fogNote('maths', lights)).toBe('')
    expect(fogNote(null, lights)).toBe('')
    expect(fogNote('citadelle', lights)).toBe('')
  })

  it('en 2nde, aucune région n’est sous le brouillard : tout le programme est là', () => {
    const lights = regionLights(second, {})
    expect(Object.values(lights).filter((l) => l.state === 'brume')).toEqual([])
    expect(Object.values(lights).every((l) => l.total >= 1)).toBe(true)
  })

  it('chaque page rapportée ajoute de la lumière, jusqu’à une région éclairée ; une page rapportée deux fois ne compte qu’une fois', () => {
    const total = sixth.filter((p) => p.dungeon.region === 'maths').length
    expect(total).toBeGreaterThanOrEqual(2)
    let previous = regionLights(sixth, {}).maths!.light
    for (let n = 1; n <= total; n += 1) {
      const lights = regionLights(sixth, doneOf(sixth, 'maths', n))
      const maths = lights.maths!
      expect(maths.done).toBe(n)
      expect(maths.light, `${n} page(s)`).toBeGreaterThan(previous)
      expect(maths.state).toBe(n === total ? 'eclairee' : 'eveillee')
      previous = maths.light
    }
    expect(previous).toBe(1)
    const code = sixth.find((p) => p.dungeon.region === 'maths')!.dungeon.code
    expect(regionLights(sixth, { [code]: 5 }).maths!.done).toBe(1)
    // Les pages d'une région n'éclairent pas les autres.
    expect(regionLights(sixth, doneOf(sixth, 'maths', total)).francais!.state).toBe('endormie')
    // Un lieu terminé que la classe n'a pas (autre classe) ne compte pas.
    expect(regionLights(sixth, { 'lieu-inconnu': 3 }).maths!.done).toBe(0)
  })

  it('la brume locale épaissit l’air d’autant moins que la région est éclairée', () => {
    expect(fogDensityFactor(1)).toBe(1)
    expect(fogDensityFactor(0)).toBeGreaterThan(fogDensityFactor(BASE_LIGHT))
    expect(fogDensityFactor(BASE_LIGHT)).toBeGreaterThan(fogDensityFactor(0.8))
    expect(fogDensityFactor(2)).toBe(1)
    expect(fogDensityFactor(-3)).toBe(fogDensityFactor(0))
    expect(fogDensityFactor(0)).toBeLessThan(3) // jamais assez dense pour cacher le chemin
  })

  it('dit l’état de la région en mots (lecteurs d’écran, mini-carte)', () => {
    const lights = regionLights(sixth, doneOf(sixth, 'maths', 1))
    expect(lightText(lights.svt!)).toBe('sous le brouillard')
    expect(lightText(lights.maths!)).toBe('1 page sur 3 rapportée')
    expect(lightText(regionLights(sixth, doneOf(sixth, 'maths', 2)).maths!)).toBe('2 pages sur 3 rapportées')
    expect(lightText(regionLights(sixth, doneOf(sixth, 'maths', 3)).maths!)).toBe('éclairée (3 pages rapportées)')
    expect(lightText(regionLights(sixth, doneOf(sixth, 'anglais', 1)).anglais!)).toBe('éclairée (1 page rapportée)')
  })
})
