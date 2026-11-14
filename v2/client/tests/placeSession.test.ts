import { describe, expect, it } from 'vitest'
import type { Services } from '../src/app/services'
import { demoPackFor, startPlaceSession } from '../src/app/placeSession'
import type { Pack } from '../src/core/items'
import { DUNGEONS } from '../src/core/world/places'
import pack6e from './fixtures/pack_6e.json'

const pack = pack6e as unknown as Pack
const tower = DUNGEONS.find((d) => d.code === 'tour_fractions')!

/** De faux services : ce qui compte est la suite des appels à la session et au choix des questions. */
function fake(start: (mode: string) => { ok: boolean } = () => ({ ok: true }), online = true) {
  const calls: string[] = []
  const session = {
    pack: pack as Pack | null,
    profile: { accommodations: {} },
    start: async (mode: string, params: unknown, key?: string) => {
      calls.push(`start ${mode} ${JSON.stringify(params)} ${key ?? ''}`.trim())
      return start(mode)
    },
    end: async (rating?: number) => {
      calls.push(rating ? `end ${rating}` : 'end')
    },
  }
  const questions = { reset: (easy: boolean) => calls.push(`reset ${easy}`) }
  const api = { online }
  return { services: { session, questions, api } as unknown as Services, calls, session }
}

describe('Session d’un lieu', () => {
  it('ferme « monde », ouvre une session « donjon » avec les chapitres et l’énigme du lieu, puis recommence les questions', async () => {
    const { services, calls } = fake()
    const opened = await startPlaceSession(services, tower, false)
    expect(opened).not.toBeNull()
    expect(calls).toEqual([
      'end',
      `start donjon ${JSON.stringify({ focus_chapters: ['6e.maths.fractions'], enigma: { generator: '6e.prealgebre.balance', count: 6 } })} tour_fractions`,
      'reset false',
    ])
  })

  it('à la sortie, ferme la session du lieu et reprend celle de l’île', async () => {
    const { services, calls } = fake()
    const opened = await startPlaceSession(services, tower, false)
    calls.length = 0
    await opened!.end()
    expect(calls).toEqual(['end', 'start monde undefined', 'reset false'])
  })

  it('la note de plaisir part avec la fin de la session du lieu, et seulement elle', async () => {
    const { services, calls } = fake()
    const opened = await startPlaceSession(services, tower, false)
    calls.length = 0
    await opened!.end(4)
    expect(calls).toEqual(['end 4', 'start monde undefined', 'reset false'])
  })

  it('rend null si le serveur refuse la session, et rouvre celle de l’île : on n’entre pas dans le lieu', async () => {
    const { services, calls } = fake((mode) => ({ ok: mode !== 'donjon' }))
    expect(await startPlaceSession(services, tower, false)).toBeNull()
    expect(calls.map((c) => c.split(' ').slice(0, 2).join(' '))).toEqual(['end', 'start donjon', 'start monde', 'reset false'])
  })

  it('hors connexion, un lieu jamais visité s’ouvre avec le paquet de l’île restreint à sa matière', async () => {
    const { services, session } = fake((mode) => ({ ok: mode === 'monde' }), false)
    const opened = await startPlaceSession(services, tower, false)
    expect(opened).not.toBeNull()
    expect(session.pack!.items.length).toBeLessThan(pack.items.length)
    for (const item of session.pack!.items) expect(item.notions.some((n) => n.startsWith('6e.maths.'))).toBe(true)
  })

  it('en ligne, ne se rabat jamais sur le paquet de l’île : un refus du serveur reste un refus', async () => {
    const { services, session } = fake((mode) => ({ ok: mode !== 'donjon' }), true)
    expect(await startPlaceSession(services, tower, false)).toBeNull()
    expect(session.pack).toBe(pack)
  })

  it('reste jouable à la sortie même si la session de l’île ne se rouvre pas', async () => {
    const { services, calls } = fake((mode) => ({ ok: mode !== 'monde' }))
    const opened = await startPlaceSession(services, tower, false)
    await expect(opened!.end()).resolves.toBeUndefined()
    expect(calls.at(-1)).toBe('reset false')
  })

  it('en mode découverte (sans serveur), restreint le paquet de test à la matière du lieu, puis le rend', async () => {
    const { services, session, calls } = fake()
    const opened = await startPlaceSession(services, tower, true)
    expect(opened).not.toBeNull()
    expect(calls.some((c) => c.startsWith('start'))).toBe(false)
    const inside = session.pack!
    expect(inside.items.length).toBeGreaterThan(0)
    expect(inside.items.length).toBeLessThan(pack.items.length)
    for (const item of inside.items) expect(item.notions.some((n) => n.startsWith('6e.maths.'))).toBe(true)
    await opened!.end()
    expect(session.pack).toBe(pack)
  })
})

describe('Paquet de test d’un lieu', () => {
  it('ne garde que la matière du lieu', () => {
    const maths = demoPackFor(pack, { level: '6e', subject: 'maths' })
    expect(maths.items.length).toBeGreaterThan(0)
    expect(maths.items.every((i) => i.notions.some((n) => n.startsWith('6e.maths.')))).toBe(true)
  })

  it('garde tout le paquet quand la matière n’y a aucune question', () => {
    expect(demoPackFor(pack, { level: '6e', subject: 'matiere-inconnue' }).items).toHaveLength(pack.items.length)
  })

  it('ne touche pas au reste du paquet (formules, niveaux de départ)', () => {
    const restricted = demoPackFor(pack, { level: '6e', subject: 'maths' })
    expect(restricted.formulas).toBe(pack.formulas)
    expect(restricted.start_levels).toBe(pack.start_levels)
  })
})
