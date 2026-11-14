import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clampPitch, gainOf, isSound, soundUrl, SOUNDS, VOLUME_DB } from '../src/core/sfx'
import { SfxPlayer } from '../src/app/sfx'

describe('effets sonores (core/sfx)', () => {
  it('chaque son a son fichier, et chaque fichier de public/ressources/sfx est un son connu', () => {
    const files = readdirSync(fileURLToPath(new URL('../public/ressources/sfx/', import.meta.url))).filter((f) => f.endsWith('.wav'))
    expect(files.map((f) => f.replace('.wav', '')).sort()).toEqual([...SOUNDS].sort())
  })

  it('donne l’adresse d’un son, reconnaît un nom de son', () => {
    expect(soundUrl('correct')).toBe('/ressources/sfx/correct.wav')
    expect(soundUrl('hit', '/x/')).toBe('/x/hit.wav')
    expect(isSound('victory')).toBe(true)
    expect(isSound('explosion')).toBe(false)
  })

  it('convertit les décibels en gain, volume de la v1 : -4 dB', () => {
    expect(gainOf(0)).toBe(1)
    expect(gainOf(-20)).toBeCloseTo(0.1)
    expect(gainOf(VOLUME_DB)).toBeCloseTo(0.631, 3)
  })

  it('borne la hauteur du son', () => {
    expect(clampPitch(1)).toBe(1)
    expect(clampPitch(5)).toBe(2)
    expect(clampPitch(0.1)).toBe(0.5)
    expect(clampPitch(Number.NaN)).toBe(1)
  })
})

describe('lecteur (app/sfx)', () => {
  const started: { rate: number; gain: number }[] = []
  let failFetch = false

  class FakeContext {
    state = 'running'
    destination = {}
    decodeAudioData = async (data: ArrayBuffer) => ({ length: data.byteLength })
    createBufferSource() {
      const source = {
        buffer: null as unknown,
        playbackRate: { value: 1 },
        gainNode: null as { gain: { value: number } } | null,
        connect(node: { gain: { value: number }; connect: (d: unknown) => unknown }) {
          source.gainNode = node
          return node
        },
        start: () => started.push({ rate: source.playbackRate.value, gain: source.gainNode?.gain.value ?? Number.NaN }),
      }
      return source
    }
    createGain() {
      const node = { gain: { value: 1 }, connect: (_destination: unknown) => node }
      return node
    }
    resume = async () => undefined
  }

  beforeEach(() => {
    started.length = 0
    failFetch = false
    vi.stubGlobal('AudioContext', FakeContext)
    vi.stubGlobal('document', { addEventListener: () => undefined, removeEventListener: () => undefined })
    vi.stubGlobal('fetch', async () => {
      if (failFetch) throw new Error('réseau')
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('ne joue rien avant le premier geste (sons non chargés), puis charge les dix sons', async () => {
    const sfx = new SfxPlayer(new URLSearchParams())
    sfx.play('correct')
    expect(sfx.state()).toMatchObject({ enabled: true, loaded: [], played: 0, last: null })
    await sfx.warm()
    expect(sfx.state().loaded).toHaveLength(SOUNDS.length)
    sfx.play('correct')
    sfx.play('wrong', 1.2)
    sfx.play('hit', 9)
    expect(sfx.state()).toMatchObject({ played: 3, last: 'hit' })
    expect(started.map((s) => s.rate)).toEqual([1, 1.2, 2]) // hauteur bornée
    expect(started.every((s) => Math.abs(s.gain - gainOf(VOLUME_DB)) < 1e-9)).toBe(true)
  })

  it('ne charge les sons qu’une fois', async () => {
    const calls = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }))
    vi.stubGlobal('fetch', calls)
    const sfx = new SfxPlayer(new URLSearchParams())
    await Promise.all([sfx.warm(), sfx.warm()])
    await sfx.warm()
    expect(calls).toHaveBeenCalledTimes(SOUNDS.length)
  })

  it('reste silencieux et sans erreur quand le réseau échoue', async () => {
    failFetch = true
    const sfx = new SfxPlayer(new URLSearchParams())
    await expect(sfx.warm()).resolves.toBeUndefined()
    sfx.play('hit')
    expect(sfx.state()).toMatchObject({ loaded: [], played: 0 })
  })

  it('?sons=0 désactive tout, comme un navigateur sans Web Audio', async () => {
    const off = new SfxPlayer(new URLSearchParams('sons=0'))
    await off.warm()
    off.play('click')
    expect(off.state()).toMatchObject({ enabled: false, loaded: [], played: 0 })
    vi.stubGlobal('AudioContext', undefined)
    expect(new SfxPlayer(new URLSearchParams()).enabled).toBe(false)
  })
})
