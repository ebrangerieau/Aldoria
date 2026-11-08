import { existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  approach, BASE_DB, CALM_DB, creditLines, DEFAULT_VOLUME, dbToLinear, DUCK_DB, FADE_SECONDS, MusicMixer, nextTrack, TRACKS,
  volumeOf,
} from '../src/core/music'

const on = { on: true, volume: 1, speaking: false, calm: false }
const settle = (mixer: MusicMixer, input: typeof on, seconds = 5) => {
  let level = 0
  for (let t = 0; t < seconds; t += 0.05) level = mixer.step(0.05, input)
  return level
}

describe('Liste des morceaux', () => {
  it('garde le thème de la v1 en premier', () => {
    expect(TRACKS.length).toBeGreaterThanOrEqual(1)
    expect(TRACKS[0]!.file).toBe('theme.mp3')
  })

  it('ne cite que des fichiers MP3 qui existent dans deploy/musique, sans chemin', () => {
    for (const track of TRACKS) {
      expect(track.file).toMatch(/^[\w.-]+\.mp3$/)
      const path = fileURLToPath(new URL(`../../deploy/musique/${track.file}`, import.meta.url))
      expect(existsSync(path), track.file).toBe(true)
      expect(statSync(path).size).toBeGreaterThan(100_000)
    }
  })

  it('a un titre et un outil pour chaque morceau (crédit des Options)', () => {
    for (const track of TRACKS) {
      expect(track.title.trim()).not.toBe('')
      expect(track.tool.trim()).not.toBe('')
    }
    expect(creditLines(TRACKS)).toHaveLength(TRACKS.length)
    expect(creditLines(TRACKS)[0]).toContain('Ritual of the Cursed')
  })

  it('est inscrite dans LICENSES.md', async () => {
    const { readFileSync } = await import('node:fs')
    const licenses = readFileSync(fileURLToPath(new URL('../public/ressources/LICENSES.md', import.meta.url)), 'utf-8')
    for (const track of TRACKS) expect(licenses, track.file).toContain(track.file)
  })
})

describe('Enchaînement', () => {
  it('passe au morceau suivant puis recommence', () => {
    expect(nextTrack(0, 3)).toBe(1)
    expect(nextTrack(2, 3)).toBe(0)
    expect(nextTrack(0, 1)).toBe(0)
    expect(nextTrack(0, 0)).toBe(0)
  })

  it('rapproche une valeur de sa cible sans la dépasser', () => {
    expect(approach(0, 1, 0.25)).toBe(0.25)
    expect(approach(0.9, 1, 0.25)).toBe(1)
    expect(approach(1, 0, 0.25)).toBe(0.75)
    expect(approach(0.1, 0, 0.25)).toBe(0)
  })
})

describe('Volume de l’enfant', () => {
  it('reprend le volume par défaut si rien n’est réglé ou si la valeur est fausse', () => {
    expect(volumeOf(undefined)).toBe(DEFAULT_VOLUME)
    expect(volumeOf('fort')).toBe(DEFAULT_VOLUME)
    expect(volumeOf(Number.NaN)).toBe(DEFAULT_VOLUME)
  })

  it('reste entre 0 et 1', () => {
    expect(volumeOf(0)).toBe(0)
    expect(volumeOf(0.4)).toBe(0.4)
    expect(volumeOf(3)).toBe(1)
    expect(volumeOf(-1)).toBe(0)
  })
})

describe('Mélangeur', () => {
  it('commence en silence et monte en fondu en une seconde et demie', () => {
    const mixer = new MusicMixer()
    expect(mixer.fade).toBe(0)
    const half = mixer.step(FADE_SECONDS / 2, on)
    const full = mixer.step(FADE_SECONDS / 2, on)
    expect(half).toBeGreaterThan(0)
    expect(full).toBeGreaterThan(half)
    expect(mixer.fade).toBe(1)
  })

  it('joue à plein fond à -6 dB, sous les voix et les effets', () => {
    expect(settle(new MusicMixer(), on)).toBeCloseTo(dbToLinear(BASE_DB), 5)
  })

  it('suit le volume de l’enfant', () => {
    const half = settle(new MusicMixer(), { ...on, volume: 0.5 })
    expect(half).toBeCloseTo(dbToLinear(BASE_DB) * 0.5, 5)
    expect(settle(new MusicMixer(), { ...on, volume: 0 })).toBe(0)
  })

  it('se fait plus discrète quand une voix parle, puis revient', () => {
    const mixer = new MusicMixer()
    const normal = settle(mixer, on)
    const ducked = settle(mixer, { ...on, speaking: true }, 2)
    expect(ducked).toBeCloseTo(normal * dbToLinear(DUCK_DB), 5)
    expect(settle(mixer, on, 2)).toBeCloseTo(normal, 5)
  })

  it('baisse en mode calme', () => {
    const calm = settle(new MusicMixer(), { ...on, calm: true })
    expect(calm).toBeCloseTo(dbToLinear(BASE_DB + CALM_DB), 5)
  })

  it('s’éteint en fondu quand elle ne doit plus jouer (coupée, question, sortie de l’île)', () => {
    const mixer = new MusicMixer()
    settle(mixer, on)
    const mid = mixer.step(FADE_SECONDS / 2, { ...on, on: false })
    expect(mid).toBeGreaterThan(0)
    expect(settle(mixer, { ...on, on: false }, 3)).toBe(0)
  })

  it('ne dépasse jamais 1, même avec un volume trop grand', () => {
    expect(settle(new MusicMixer(), { ...on, volume: 9 })).toBeLessThanOrEqual(1)
  })
})
