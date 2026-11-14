import { describe, expect, it } from 'vitest'
import { SaveGame, EMPTY_SAVE } from '../src/core/save'
import { ApiClient } from '../src/core/api'
import { MemoryStore } from '../src/core/storage'
import { fakeFetch } from './support'

function game(server: { revision?: number; data?: unknown } = {}) {
  const { fetcher, calls } = fakeFetch({
    'GET /play/save?slot=v2': () => ({ status: 200, body: { revision: server.revision ?? 0, epoch: 1, schema_version: 1, data: server.data ?? null } }),
    'PUT /play/save': () => ({ status: 200, body: { revision: 1, epoch: 1, schema_version: 1, data: null } }),
  })
  const store = new MemoryStore()
  const api = new ApiClient(store, '', fetcher)
  api.token = 't'
  return { save: new SaveGame(api, store, 7), calls }
}

describe('SaveGame, progression des lieux et sac', () => {
  it('compte les lieux terminés et ne marque une étape d’histoire qu’une fois', () => {
    const { save } = game()
    save.completePlace('tour_fractions')
    save.completePlace('tour_fractions')
    save.markStory('page-tour_fractions')
    save.markStory('page-tour_fractions')
    expect(save.data.places).toEqual({ tour_fractions: 2 })
    expect(save.data.story).toEqual(['page-tour_fractions'])
  })

  it('range les objets gagnés (5 au plus) et refuse d’en utiliser un qu’on n’a pas', () => {
    const { save } = game()
    save.giveItems(['potion', 'potion', 'bouclier'])
    expect(save.data.items).toEqual({ potion: 2, bouclier: 1 })
    expect(save.useItem('potion')).toBe(true)
    expect(save.useItem('plume')).toBe(false)
    expect(save.data.items.potion).toBe(1)
    save.giveItems(Array(9).fill('plume'))
    expect(save.data.items.plume).toBe(5)
  })

  it('une partie enregistrée avant l’ajout du sac se charge avec un sac vide', async () => {
    const { save } = game({ revision: 3, data: { xp: 120, places: { tour_fractions: 1 } } })
    await save.load()
    expect(save.data.xp).toBe(120)
    expect(save.data.items).toEqual({})
    expect(EMPTY_SAVE.items).toEqual({})
  })
})
