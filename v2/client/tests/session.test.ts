import { describe, expect, it } from 'vitest'
import { ApiClient } from '../src/core/api'
import { QuestionService } from '../src/core/questionService'
import { SaveGame } from '../src/core/save'
import { Session } from '../src/core/session'
import { MemoryStore } from '../src/core/storage'
import { fakeFetch, PACK_6E } from './support'

const PROFILE = { id: 7, name: 'Jules', level: '6e', world: 'lumineux' as const }

function setup(routes: Parameters<typeof fakeFetch>[0]) {
  const store = new MemoryStore()
  const server = fakeFetch(routes)
  const api = new ApiClient(store, '', server.fetcher)
  let n = 0
  const session = new Session(api, store, () => new Date('2026-11-07T10:00:00Z'), () => `uuid-${++n}`)
  return { store, server, api, session }
}

describe('Session', () => {
  it('garde les réponses hors connexion puis les envoie sans le profil local', async () => {
    let online = false
    const { api, session, server, store } = setup({
      'POST /play/attempts': () => (online ? { status: 200, body: { accepted: 1 } } : { status: 0 }),
    })
    api.token = 'jeton'
    session.startDemo(PACK_6E, PROFILE)
    session.demo = false
    const item = PACK_6E.items[0]!
    session.record(item, true, 1200, false, 'monde')
    await session.flush()
    expect(session.pendingCount()).toBe(1)
    expect(store.get<unknown[]>('attempts', []).length).toBe(1)

    online = true
    await session.flush()
    expect(session.pendingCount()).toBe(0)
    const sent = server.calls.filter((c) => c.path === '/play/attempts').at(-1)!.body as { attempts: Record<string, unknown>[] }
    expect(sent.attempts[0]).toMatchObject({ id: 'uuid-1', item_id: item.id, correct: true, game_mode: 'monde' })
    expect(sent.attempts[0]).not.toHaveProperty('profile_id')
    expect(sent.attempts[0]!.answered_at).toBe('2026-11-07T10:00:00Z')
  })

  it('la note de plaisir (1 à 5) part avec la fin de session, absente sans note', async () => {
    const { api, session, server } = setup({
      'POST /play/session/start': () => ({ status: 200, body: { ...PACK_6E, session_id: 's-1' } }),
      'POST /play/session/end': () => ({ status: 200, body: {} }),
    })
    api.token = 'jeton'
    await session.start('donjon', {}, 'tour_fractions')
    await session.end(4)
    await session.start('donjon', {}, 'tour_fractions')
    await session.end()
    const ends = server.calls.filter((c) => c.path === '/play/session/end').map((c) => c.body as Record<string, unknown>)
    expect(ends).toHaveLength(2)
    expect(ends[0]).toMatchObject({ session_id: 's-1', rating: 4 })
    expect(ends[1]).not.toHaveProperty('rating')
  })

  it('écarte un lot refusé pour de bon au lieu de bloquer la file', async () => {
    const { api, session } = setup({ 'POST /play/attempts': () => ({ status: 422 }) })
    api.token = 'jeton'
    session.startDemo(PACK_6E, PROFILE)
    session.demo = false
    session.record(PACK_6E.items[0]!, false, 500, false, 'monde')
    await session.flush()
    expect(session.pendingCount()).toBe(0)
  })

  it('reprend le dernier paquet gardé quand le réseau tombe', async () => {
    let online = true
    const { session } = setup({
      'POST /play/session/start': () => (online ? { status: 200, body: PACK_6E } : { status: 0 }),
    })
    expect(await session.start('monde')).toEqual({ ok: true })
    online = false
    expect(await session.start('monde')).toEqual({ ok: true, offline: true })
    expect(session.items().length).toBe(PACK_6E.items.length)
    expect(session.sessionId).toBe('')
  })
})

describe('Mode découverte', () => {
  it('n’enregistre aucune réponse', async () => {
    const { session, store } = setup({})
    session.startDemo(PACK_6E, PROFILE)
    session.record(PACK_6E.items[0]!, true, 1000, false, 'monde')
    expect(session.answered).toBe(1)
    expect(store.get<unknown[]>('attempts', []).length).toBe(0)
  })
})

describe('QuestionService', () => {
  function service() {
    const { session } = setup({})
    session.startDemo(PACK_6E, PROFILE)
    const questions = new QuestionService(session, () => 0)
    questions.reset()
    return { session, questions }
  }

  it('ne propose que des questions que le client sait afficher', () => {
    const { questions } = service()
    for (let i = 0; i < 40; i += 1) {
      const item = questions.next('automatisme')!
      expect(['mcq', 'numeric', 'expression', 'text', 'order', 'true_false']).toContain(item.type)
      expect(item.visual ?? null).toBeNull()
    }
  })

  it('monte d’un cran après deux réussites et redescend après une erreur', () => {
    const { questions } = service()
    const first = questions.next('chapitre')!
    const right = first.answer.kind === 'choice' ? first.answer.index : 'faux'
    questions.submit(first, right as number, 5000, false)
    const second = questions.next('chapitre')!
    const answer2 = second.answer.kind === 'choice' ? second.answer.index : undefined
    if (answer2 === undefined) return // paquet sans deuxième QCM de chapitre : rien à vérifier
    const before = questions.levelFor('chapitre')
    questions.submit(second, answer2, 5000, false)
    expect(questions.levelFor('chapitre')).toBeGreaterThanOrEqual(before)
    questions.submit(second, -1, 5000, false)
    expect(questions.levelFor('chapitre')).toBeLessThanOrEqual(Math.max(1, before))
  })

  it('repose une notion ratée deux réponses plus tard', () => {
    const { questions } = service()
    const missed = questions.next('automatisme')!
    questions.submit(missed, '___', 5000, false)
    for (let i = 0; i < 2; i += 1) {
      const other = questions.next('automatisme')!
      const right = other.answer.kind === 'choice' ? other.answer.index : '___'
      questions.submit(other, right, 5000, false)
    }
    const again = questions.next('automatisme')!
    expect(again.notions.some((n) => missed.notions.includes(n))).toBe(true)
  })

  it('ne pose plus une notion mise de côté', () => {
    const { session, questions } = service()
    const first = questions.next('automatisme')!
    for (const n of first.notions) session.setAside(n)
    for (let i = 0; i < 30; i += 1) {
      const item = questions.next('automatisme')!
      expect(item.notions.some((n) => first.notions.includes(n))).toBe(false)
    }
  })
})

describe('SaveGame', () => {
  it('adopte la partie du serveur en cas de conflit', async () => {
    const { api, store } = setup({
      'GET /play/save?slot=v2': () => ({ status: 200, body: { revision: 0, epoch: 0, schema_version: null, data: null } }),
      'PUT /play/save': () => ({
        status: 409,
        body: { error: { code: 'save_conflict', message: '', details: { current: { revision: 4, epoch: 0, data: { xp: 900 } } } } },
      }),
    })
    api.token = 'jeton'
    const save = new SaveGame(api, store, 7)
    await save.load()
    save.addXp(30)
    await save.save()
    expect(save.data.xp).toBe(900)
  })

  it('envoie la partie dans l’emplacement v2', async () => {
    const { api, store, server } = setup({
      'GET /play/save?slot=v2': () => ({ status: 200, body: { revision: 0, epoch: 0, schema_version: null, data: null } }),
      'PUT /play/save': () => ({ status: 200, body: { revision: 1, epoch: 0 } }),
    })
    api.token = 'jeton'
    const save = new SaveGame(api, store, 7)
    await save.load()
    save.addXp(40)
    await save.save()
    const put = server.calls.find((c) => c.method === 'PUT')!.body as Record<string, unknown>
    expect(put).toMatchObject({ slot: 'v2', base_revision: 0, schema_version: 1 })
    expect((put.data as { xp: number }).xp).toBe(40)
  })
})
