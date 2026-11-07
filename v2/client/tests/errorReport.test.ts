import { describe, expect, it } from 'vitest'
import { ApiClient } from '../src/core/api'
import { cleanMessage, ErrorReporter, locationOf, MAX_BATCH, MAX_DISTINCT, platformOf } from '../src/core/errorReport'
import { MemoryStore } from '../src/core/storage'
import { fakeFetch } from './support'

function setup(status: number, paired = true) {
  const store = new MemoryStore()
  if (paired) store.set('device', { token: 'appareil' })
  const server = fakeFetch({ 'POST /play/client-errors': () => ({ status, body: { created: 1 } }) })
  const api = new ApiClient(store, '', server.fetcher)
  const reporter = new ErrorReporter(api, 'abc1234', 'Web Windows Chrome')
  return { reporter, server }
}

describe('ErrorReporter', () => {
  it('compte une erreur répétée au lieu de la dupliquer', () => {
    const { reporter } = setup(200)
    reporter.scene = 'ile'
    reporter.add('Shader introuvable', '/assets/babylon.js:1:20')
    reporter.add('Shader introuvable', '/assets/babylon.js:1:20')
    expect(reporter.list()).toEqual([{ message: 'Shader introuvable', location: '/assets/babylon.js:1:20', scene: 'ile', count: 2 }])
  })

  it('envoie avec l’appareil relié, la version et la plateforme, puis vide la file', async () => {
    const { reporter, server } = setup(200)
    reporter.add('Erreur A', 'a.js:1:1')
    await reporter.send()
    const call = server.calls.find((c) => c.path === '/play/client-errors')!
    expect(call.body).toMatchObject({ version: 'abc1234', platform: 'Web Windows Chrome', errors: [{ message: 'Erreur A', count: 1 }] })
    expect(reporter.list()).toEqual([])
  })

  it('n’envoie rien sans appareil relié (mode découverte, tests)', async () => {
    const { reporter, server } = setup(200, false)
    reporter.add('Erreur A')
    await reporter.send()
    expect(server.calls).toEqual([])
    expect(reporter.list().length).toBe(1)
  })

  it('garde les erreurs sans réseau, les écarte si l’API les refuse pour de bon', async () => {
    const offline = setup(0)
    offline.reporter.add('Erreur A')
    await offline.reporter.send()
    expect(offline.reporter.list().length).toBe(1)
    const refused = setup(422)
    refused.reporter.add('Erreur A')
    await refused.reporter.send()
    expect(refused.reporter.list().length).toBe(0)
  })

  it('envoie par lots et s’arrête après trop d’erreurs différentes', async () => {
    const { reporter, server } = setup(200)
    for (let i = 0; i < MAX_DISTINCT + 10; i += 1) reporter.add(`Erreur ${i}`)
    expect(reporter.list().length).toBe(MAX_DISTINCT)
    await reporter.send()
    const sent = server.calls[0]!.body as { errors: unknown[] }
    expect(sent.errors.length).toBe(MAX_BATCH)
    expect(reporter.list().length).toBe(MAX_DISTINCT - MAX_BATCH)
  })

  it('coupe les textes trop longs pour l’API', () => {
    const { reporter } = setup(200)
    reporter.add('x'.repeat(900), 'y'.repeat(400))
    const [error] = reporter.list()
    expect(error!.message.length).toBe(500)
    expect(error!.location.length).toBe(200)
  })
})

describe('outils', () => {
  it('retire l’horodatage du journal de Babylon.js', () => {
    expect(cleanMessage('BJS - [20:41:03]: Unable to compile effect')).toBe('Unable to compile effect')
  })

  it('trouve l’endroit dans une pile d’appels, sans l’adresse du site', () => {
    const stack = 'Error: boom\n    at build (https://aldoria2.bandtrack.fr/assets/GameWorld-x1.js:1:2345)\n    at run (x.js:2:3)'
    expect(locationOf(stack, '', 'https://aldoria2.bandtrack.fr')).toBe('/assets/GameWorld-x1.js:1:2345')
    expect(locationOf(undefined, 'console.error')).toBe('console.error')
  })

  it('décrit le navigateur sans désigner l’appareil', () => {
    const edge = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36 Edg/142.0'
    expect(platformOf(edge)).toBe('Web Windows Edge')
    expect(platformOf('Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0')).toBe('Web Linux Firefox')
  })
})
