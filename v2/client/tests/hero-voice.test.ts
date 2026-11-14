import { describe, expect, it } from 'vitest'
import heros from '@content/monde/heros.json'
import { HeroVoice } from '../src/core/quest/heroVoice'
import { MemoryStore } from '../src/core/storage'

const ROOMS = ['entree', 'combat', 'combat', 'enigme', 'combat', 'boss'].map((kind) => ({ kind }))
const counter = () => { let i = 0; return () => ((i += 1) * 0.37) % 1 }

describe('HeroVoice', () => {
  it('combine un début, un indice sur la salle suivante et ce qu’il reste avant l’Effaceur', () => {
    const voice = new HeroVoice(null, () => 0)
    const text = voice.beforeRoom('lumineux', ROOMS, 1, true)
    expect(text).toContain(heros.lines.lumineux.start[0]!)
    expect(text).toContain(heros.lines.lumineux.combat[0]!)
    expect(text).toMatch(/\b4\b/) // « Encore 4 étages avant le boss. »
    expect(text).not.toContain('%d')
  })

  it('ne dit rien de ce qui reste quand l’Effaceur est la salle suivante, ni quand il n’y a plus de salle', () => {
    const voice = new HeroVoice(null, () => 0)
    const boss = voice.beforeRoom('lumineux', ROOMS, 5)
    expect(boss).toContain(heros.lines.lumineux.boss[0]!)
    expect(boss).not.toMatch(/étage/)
    expect(voice.beforeRoom('lumineux', ROOMS, 6)).toBe('')
    expect(voice.beforeRoom('lumineux', ROOMS, -1)).toBe('')
  })

  it('a le ton du monde (sobre dans le brouillard) et retombe sur le monde lumineux pour un monde inconnu', () => {
    const fog = new HeroVoice(null, () => 0).beforeRoom('brouillard', ROOMS, 3)
    expect(fog).toContain(heros.lines.brouillard.cleared[0]!)
    expect(fog).toContain(heros.lines.brouillard.enigme[0]!)
    expect(new HeroVoice(null, () => 0).beforeRoom('inconnu', ROOMS, 3)).toContain(heros.lines.lumineux.cleared[0]!)
  })

  it('ne répète pas les dernières phrases dites, d’une partie à l’autre', () => {
    const store = new MemoryStore()
    const options = ['a', 'b', 'c', 'd']
    const first = new HeroVoice(store, counter(), 3)
    const said = [first.pick(options), first.pick(options), first.pick(options)]
    expect(new Set(said).size).toBe(3)
    // Une nouvelle partie relit la mémoire : la 4e phrase est la seule inédite.
    const second = new HeroVoice(store, counter(), 3)
    expect(second.pick(options)).toBe(options.find((o) => !said.includes(o)))
  })

  it('se rabat sur toute la liste quand toutes les phrases ont été dites, et borne la mémoire', () => {
    const store = new MemoryStore()
    const voice = new HeroVoice(store, () => 0, 2)
    for (let i = 0; i < 6; i += 1) voice.pick(['x', 'y'])
    expect(store.get<string[]>('hero_voice', []).length).toBe(2)
    expect(['x', 'y']).toContain(voice.pick(['x', 'y']))
  })
})
