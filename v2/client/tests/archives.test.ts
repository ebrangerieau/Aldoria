import { describe, expect, it } from 'vitest'
import { ApiClient } from '../src/core/api'
import { bySubject, countStars, loadArchives, parseProgress, playableNotions, starsText, STATUS_TEXT, summaryText } from '../src/core/archives'
import { MemoryStore } from '../src/core/storage'

const PAYLOAD = {
  chapters: [
    {
      code: '6e.fractions',
      title: 'Les fractions',
      subject: { code: 'maths', label: 'Mathématiques' },
      status: 'en_cours',
      notions: [
        { code: 'a', label: 'Lire une fraction', playable: true, stars: 3, state: 'acquise', mastery: 90, seen: 12, set_aside: null },
        { code: 'b', label: 'Comparer', playable: true, stars: 1, state: 'en cours', mastery: 30, seen: 3, set_aside: null },
        { code: 'c', label: 'Pas encore', playable: false, stars: 0, state: 'à découvrir', mastery: 0, seen: 0, set_aside: null },
      ],
    },
    {
      code: '6e.angles',
      title: 'Les angles',
      subject: { code: 'maths', label: 'Mathématiques' },
      status: 'a_venir',
      notions: [{ code: 'd', label: 'Mesurer', playable: true, stars: 2, state: 'fragile', mastery: 55, seen: 6, set_aside: null }],
    },
    { code: 'fr.accords', title: 'Les accords', subject: { code: 'fr', label: 'Français' }, status: 'controle_bientot', notions: [] },
  ],
}

describe('Archives : lecture de la réponse du serveur', () => {
  it('relit les chapitres, leur matière, leurs notions et leurs étoiles', () => {
    const chapters = parseProgress(PAYLOAD)
    expect(chapters.map((c) => c.title)).toEqual(['Les fractions', 'Les angles', 'Les accords'])
    expect(chapters[0]!.subject).toBe('Mathématiques')
    expect(chapters[0]!.notions[0]).toEqual({ code: 'a', label: 'Lire une fraction', stars: 3, state: 'acquise', playable: true })
    expect(playableNotions(chapters[0]!)).toHaveLength(2) // la notion pas encore jouable n'est pas comptée
  })

  it('ne casse pas sur une réponse vide, ancienne ou abîmée', () => {
    expect(parseProgress(null)).toEqual([])
    expect(parseProgress({})).toEqual([])
    expect(parseProgress({ chapters: 'x' })).toEqual([])
    const odd = parseProgress({ chapters: [null, 3, { title: 'Sans notions' }, { title: 'T', notions: [null, { label: 'N', stars: 9, playable: true }, { label: 'M', stars: -2, playable: true }] }] })
    expect(odd.map((c) => c.title)).toEqual(['Sans notions', 'T'])
    expect(odd[1]!.notions.map((n) => n.stars)).toEqual([3, 0]) // étoiles ramenées entre 0 et 3
  })
})

describe('Archives : résumé et affichage', () => {
  it('compte les notions jouables par étoiles et écrit la phrase de la v1', () => {
    const counts = countStars(parseProgress(PAYLOAD))
    expect(counts).toEqual([0, 1, 1, 1]) // [à découvrir, en cours, fragiles, acquises]
    expect(summaryText(counts)).toBe('1 notion acquise ★★★ · 1 fragile · 1 en cours · 0 à découvrir')
    expect(summaryText([7, 4, 3, 5])).toBe('5 notions acquises ★★★ · 3 fragiles · 4 en cours · 7 à découvrir')
    expect(summaryText([0, 0, 0, 0])).toBe('0 notion acquise ★★★ · 0 fragile · 0 en cours · 0 à découvrir')
  })

  it('écrit les étoiles, le statut du chapitre, et groupe les chapitres par matière', () => {
    expect(starsText(0)).toBe('☆☆☆')
    expect(starsText(2)).toBe('★★☆')
    expect(starsText(3)).toBe('★★★')
    expect(STATUS_TEXT.en_cours).toBe('en classe en ce moment')
    expect(STATUS_TEXT.controle_bientot).toBe('contrôle bientôt !')
    const groups = bySubject(parseProgress(PAYLOAD))
    expect(groups.map((g) => [g.subject, g.chapters.length])).toEqual([['Mathématiques', 2], ['Français', 1]])
  })
})

describe('Archives : chargement, avec le dernier état gardé hors connexion', () => {
  const fetcher = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch
  const broken = (async () => {
    throw new Error('réseau')
  }) as unknown as typeof fetch

  it('lit le serveur et garde la réponse pour plus tard', async () => {
    const store = new MemoryStore()
    const api = new ApiClient(store, '', fetcher(PAYLOAD))
    api.token = 'jeton'
    const view = await loadArchives(api, store, 7)
    expect(view?.cached).toBe(false)
    expect(view?.chapters).toHaveLength(3)
    // Plus de réseau : le dernier état connu de CET enfant s'affiche.
    const offline = new ApiClient(store, '', broken)
    offline.token = 'jeton'
    const again = await loadArchives(offline, store, 7)
    expect(again?.cached).toBe(true)
    expect(again?.chapters).toHaveLength(3)
    expect(await loadArchives(offline, store, 8)).toBeNull() // un autre enfant n'hérite pas de ces étoiles
  })

  it('rend rien (Archives hors de portée) sans réseau ni état gardé, ou sans connexion de l’enfant', async () => {
    const store = new MemoryStore()
    const api = new ApiClient(store, '', broken)
    api.token = 'jeton'
    expect(await loadArchives(api, store, 1)).toBeNull()
    const none = new ApiClient(store, '', fetcher(PAYLOAD)) // découverte : pas de jeton, pas d'appel
    expect(await loadArchives(none, store, 1)).toBeNull()
  })

  it('garde le dernier état quand le serveur répond par une erreur', async () => {
    const store = new MemoryStore()
    const ok = new ApiClient(store, '', fetcher(PAYLOAD))
    ok.token = 'jeton'
    await loadArchives(ok, store, 3)
    const failing = new ApiClient(store, '', fetcher({ error: { code: 'x', message: 'y' } }, 500))
    failing.token = 'jeton'
    expect((await loadArchives(failing, store, 3))?.cached).toBe(true)
  })
})
