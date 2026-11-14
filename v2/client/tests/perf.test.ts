import { describe, expect, it } from 'vitest'
import ile from '@content/monde/ile.json'
import {
  browserLabel,
  type FrameSample,
  isReliable,
  MIN_FRAMES,
  percentile,
  perfLogRow,
  summarize,
  TOUR_STEP_BACK,
  tourAt,
  tourStops,
} from '../src/core/perf'
import { type IslandLayout, SEA_LEVEL, Terrain } from '../src/core/world/terrain'

const layout = ile as unknown as IslandLayout

describe('percentile', () => {
  it('prend la valeur au rang le plus proche, sans modifier le tableau', () => {
    const values = [5, 1, 4, 2, 3]
    expect(percentile(values, 50)).toBe(3)
    expect(percentile(values, 95)).toBe(5)
    expect(percentile(values, 0)).toBe(1)
    expect(values).toEqual([5, 1, 4, 2, 3])
    expect(percentile([], 50)).toBe(0)
  })
})

describe('summarize', () => {
  it('résume les durées d’image, les saccades et les temps du processeur', () => {
    const samples: FrameSample[] = [
      ...Array.from({ length: 18 }, () => ({ frameMs: 16.7, cpuMs: 4, gpuMs: 9 })),
      { frameMs: 50, cpuMs: 30, gpuMs: 12 },
      { frameMs: 40, cpuMs: 20, gpuMs: 11 },
    ]
    const s = summarize(samples)
    expect(s.frames).toBe(20)
    expect(s.frameP50).toBeCloseTo(16.7)
    expect(s.fps).toBeCloseTo(59.9, 1)
    expect(s.frameP95).toBe(40)
    expect(s.slowShare).toBeCloseTo(0.1)
    expect(s.cpuP50).toBe(4)
    expect(s.gpuP50).toBe(9)
  })

  it('ne donne pas de temps de carte graphique quand il manque sur la plupart des images', () => {
    const samples: FrameSample[] = [{ frameMs: 16, cpuMs: 3, gpuMs: 8 }, { frameMs: 16, cpuMs: 3 }, { frameMs: 16, cpuMs: 3 }]
    expect(summarize(samples).gpuP50).toBeNull()
    expect(summarize([{ frameMs: 16, cpuMs: 3 }]).gpuP50).toBeNull()
  })
})

describe('fiabilité', () => {
  it('ne se fie pas à un relevé de moins de MIN_FRAMES images', () => {
    const few = Array.from({ length: MIN_FRAMES - 1 }, () => ({ frameMs: 16, cpuMs: 3 }))
    const enough = Array.from({ length: MIN_FRAMES }, () => ({ frameMs: 16, cpuMs: 3 }))
    expect(isReliable(summarize(few))).toBe(false)
    expect(isReliable(summarize(enough))).toBe(true)
  })
})

describe('tour de mesure', () => {
  const stops = tourStops(layout)
  const terrain = new Terrain(layout)

  it('passe par le départ, le village et chaque région', () => {
    expect(stops.map((s) => s.name)).toEqual(['depart', 'village', ...Object.keys(layout.regions)])
  })

  it('reste sur la terre ferme et regarde le cœur de chaque région depuis le côté de la Citadelle', () => {
    for (const s of stops) expect(terrain.heightAt(s.x, s.z)).toBeGreaterThan(SEA_LEVEL + 0.5)
    for (const [code, r] of Object.entries(layout.regions)) {
      const s = stops.find((t) => t.name === code)!
      expect(Math.hypot(s.x - r.x, s.z - r.z)).toBeCloseTo(TOUR_STEP_BACK)
      expect([s.faceX, s.faceZ]).toEqual([r.x, r.z])
      const toCitadel = Math.hypot(layout.citadelle.x - s.x, layout.citadelle.z - s.z)
      expect(toCitadel).toBeLessThan(Math.hypot(layout.citadelle.x - r.x, layout.citadelle.z - r.z))
    }
  })

  it('partage le temps également entre les arrêts', () => {
    const n = stops.length
    expect(tourAt(stops, n * 2, 0)).toEqual({ index: 0, turn: 0, done: false })
    expect(tourAt(stops, n * 2, 3)).toEqual({ index: 1, turn: 0.5, done: false })
    expect(tourAt(stops, n * 2, n * 2 - 0.001).index).toBe(n - 1)
    expect(tourAt(stops, n * 2, n * 2).done).toBe(true)
  })
})

describe('compte rendu', () => {
  it('reconnaît les navigateurs du PC familial', () => {
    const edge = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0'
    const chrome = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36'
    const firefox = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0'
    expect(browserLabel(edge)).toBe('Edge 142')
    expect(browserLabel(chrome)).toBe('Chrome 153')
    expect(browserLabel(firefox)).toBe('Firefox 145')
    expect(browserLabel('robot')).toBe('navigateur inconnu')
  })

  it('écrit une ligne du journal des performances, en notation française', () => {
    const row = perfLogRow({
      date: '2026-11-08', browser: 'Edge 142', gpu: 'Intel UHD 620', engine: 'WebGPU', quality: 'haut',
      width: 1920, height: 1080, seconds: 30, drawCalls: 290, triangles: 1_440_000, loadMs: 4200, heapMb: null,
      summary: { frames: 1800, fps: 59.6, frameP50: 16.8, frameP95: 21.25, slowShare: 0.012, cpuP50: 3.44, gpuP50: null },
    })
    expect(row).toBe('| 2026-11-08 | Intel UHD 620 | Edge 142 | WebGPU | haut | 1920 × 1080 | 60 | 21,3 ms | 1 % | 3,4 ms | n. d. | 290 | 1,44 M | 4,2 s | n. d. |')
  })
})
