import { describe, expect, it } from 'vitest'
import { ApiClient } from '../src/core/api'
import { EMPTY_DAILY, recordDaily } from '../src/core/dailyChallenge'
import { EMPTY_SAVE, normalizeSave, SaveGame } from '../src/core/save'
import { MemoryStore } from '../src/core/storage'

describe('partie relue', () => {
  it('une partie vide ou absente reprend toutes les valeurs par défaut, sans partager les tableaux avec le modèle', () => {
    const fresh = normalizeSave(undefined)
    expect(fresh).toEqual(EMPTY_SAVE)
    fresh.daily.days.push('2026-10-14')
    fresh.items.plume = 1
    expect(EMPTY_SAVE.daily.days).toEqual([])
    expect(EMPTY_SAVE.items).toEqual({})
    expect(normalizeSave(null)).toEqual(EMPTY_SAVE)
  })

  it('une ancienne partie (sans défi du jour ni sac) garde sa progression et reçoit les champs manquants', () => {
    const old = { xp: 120, places: { tour_fractions: 1 }, stones: { 'pierre-eveil': '2026-10-14' }, story: ['prologue'] }
    const save = normalizeSave(old)
    expect(save.xp).toBe(120)
    expect(save.places).toEqual({ tour_fractions: 1 })
    expect(save.story).toEqual(['prologue'])
    expect(save.daily).toEqual(EMPTY_DAILY)
    expect(save.items).toEqual({})
    expect(save.look).toEqual(EMPTY_SAVE.look)
  })

  it('relit le défi du jour et le sac, et corrige ce qui est abîmé', () => {
    const daily = recordDaily(EMPTY_DAILY, '2026-10-14', 8, 40_000, '2026-10-14')
    const save = normalizeSave({ daily, items: { potion: 3 } })
    expect(save.daily).toEqual(daily)
    expect(save.items).toEqual({ potion: 3 })
    const broken = normalizeSave({ daily: { days: [4, '2026-10-02'], best: 'x', chests: null } as never, items: { plume: 50 } })
    expect(broken.daily.days).toEqual(['2026-10-02'])
    expect(broken.daily.best).toEqual({ correct: 0, ms: 0 })
    expect(broken.items).toEqual({ plume: 5 })
  })
})

describe('partie du serveur', () => {
  it('adopte la partie du serveur même ancienne : le défi du jour et le sac existent toujours', async () => {
    const server = { revision: 3, epoch: 1, schema_version: 1, data: { xp: 40, stones: {}, places: {}, story: [] } }
    const fetcher = (async () => new Response(JSON.stringify(server), { status: 200 })) as unknown as typeof fetch
    const store = new MemoryStore()
    const api = new ApiClient(store, '', fetcher)
    const game = new SaveGame(api, store, 5)
    await game.load()
    expect(game.data.xp).toBe(40)
    expect(game.data.daily).toEqual(EMPTY_DAILY)
    expect(game.data.items).toEqual({})
  })
})
