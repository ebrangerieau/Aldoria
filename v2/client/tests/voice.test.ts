import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ApiClient } from '../src/core/api'
import { RecordedVoices } from '../src/core/recordedVoices'
import { MemoryStore } from '../src/core/storage'
import { Voice } from '../src/core/voice'

/** Un faux lecteur audio : il note les sons demandés et « joue » jusqu'au bout tout de suite. */
const asked: string[] = []
class FakeAudio {
  onplaying: (() => void) | null = null
  onended: (() => void) | null = null
  onpause: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(readonly url: string) {
    asked.push(url)
  }
  play(): Promise<void> {
    queueMicrotask(() => {
      this.onplaying?.()
      this.onended?.()
    })
    return Promise.resolve()
  }
  pause(): void {
    this.onpause?.()
  }
}

/** Deux textes enregistrés, « a » et « b » ; l'empreinte (stub) répète le texte 64 fois. */
function voice(): Voice {
  const manifest = {
    ['a'.repeat(64)]: { id: 'a', voix: 'ysaline', fichier: 'a.mp3' },
    ['b'.repeat(64)]: { id: 'b', voix: 'ysaline', fichier: 'b.mp3' },
  }
  const recordings = new RecordedVoices(async () => manifest, '/voix/', async (text) => text.repeat(64))
  return new Voice(new ApiClient(new MemoryStore()), recordings)
}

const globals = globalThis as unknown as Record<string, unknown>
let before: Record<string, unknown>

beforeEach(() => {
  asked.length = 0
  before = { window: globals.window, Audio: globals.Audio }
  globals.window = {} // sans speechSynthesis : seules les voix enregistrées jouent
  globals.Audio = FakeAudio
})

afterEach(() => {
  globals.window = before.window
  globals.Audio = before.Audio
})

describe('Voice : arrêter sa propre lecture, jamais celle d’un autre', () => {
  it('un stop() aveugle, juste après say(), annule la lecture avant même que le son soit demandé', async () => {
    const v = voice()
    const reading = v.say(['a'])
    v.stop() // le nettoyage d'un panneau qui se ferme, arrivé après coup
    await reading
    expect(asked).toEqual([]) // aucune demande de son : c'est le silence constaté en production
  })

  it('stopIf(jeton) ne coupe pas une lecture plus récente : la voix d’un dialogue qui s’ouvre est lue', async () => {
    const v = voice()
    void v.say(['a']) // la lecture du panneau de question
    const panel = v.token
    const dialog = v.say(['b']) // le dialogue qui s'ouvre : sa voix
    v.stopIf(panel) // le nettoyage du panneau, arrivé après coup : sans effet
    await dialog
    expect(asked).toEqual(['/voix/b.mp3'])
  })

  it('stopIf(jeton) arrête bien la lecture qu’on a lancée soi-même', async () => {
    const v = voice()
    const reading = v.say(['a'])
    v.stopIf(v.token)
    await reading
    expect(asked).toEqual([])
    expect(v.isSpeaking).toBe(false)
  })

  it('le jeton change à chaque lecture et à chaque arrêt', () => {
    const v = voice()
    const start = v.token
    void v.say(['a'])
    expect(v.token).toBe(start + 1)
    v.stop()
    expect(v.token).toBe(start + 2)
  })

  it('sans que personne ait parlé, stopIf ne fait rien d’autre qu’arrêter', async () => {
    const v = voice()
    v.stopIf(v.token)
    await v.say(['a'])
    expect(asked).toEqual(['/voix/a.mp3'])
  })
})
