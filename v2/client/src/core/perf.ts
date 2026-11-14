/**
 * Banc de mesure du rendu (`?mesure`) : un tour fixe de l'île, les mêmes vues pour chaque moteur
 * (WebGL 2, WebGPU), chaque profil et chaque PC, et un résumé à recopier dans docs/perf-log.md.
 * Logique pure : le monde 3D fournit les durées d'image, ce module les résume.
 */
import type { IslandLayout } from './world/terrain'

/** Une image : durée depuis la précédente, temps du processeur (scene.render), temps de la carte
 * graphique quand le navigateur le donne. En millisecondes. */
export interface FrameSample {
  frameMs: number
  cpuMs: number
  gpuMs?: number
}

export interface PerfSummary {
  frames: number
  /** Images par seconde, d'après la durée médiane d'une image. */
  fps: number
  frameP50: number
  frameP95: number
  /** Part des images de plus de 33 ms (sous 30 images par seconde) : les saccades. */
  slowShare: number
  cpuP50: number
  gpuP50: number | null
}

export const SLOW_FRAME_MS = 1000 / 30

/** Sous ce nombre d'images, une médiane et un 95e centile ne disent rien (rendu logiciel, tour trop court). */
export const MIN_FRAMES = 60

export function isReliable(summary: PerfSummary): boolean {
  return summary.frames >= MIN_FRAMES
}

/** Centile au rang le plus proche (p de 0 à 100), sur une copie triée. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))]!
}

export function summarize(samples: readonly FrameSample[]): PerfSummary {
  const frames = samples.map((s) => s.frameMs)
  const gpu = samples.flatMap((s) => (s.gpuMs !== undefined && s.gpuMs > 0 ? [s.gpuMs] : []))
  const frameP50 = percentile(frames, 50)
  return {
    frames: samples.length,
    fps: frameP50 > 0 ? 1000 / frameP50 : 0,
    frameP50,
    frameP95: percentile(frames, 95),
    slowShare: samples.length ? frames.filter((f) => f > SLOW_FRAME_MS).length / samples.length : 0,
    cpuP50: percentile(samples.map((s) => s.cpuMs), 50),
    // Moins d'une image sur deux mesurée : la mesure de la carte graphique n'est pas fiable.
    gpuP50: gpu.length * 2 >= samples.length && gpu.length > 0 ? percentile(gpu, 50) : null,
  }
}

// --- Le tour de l'île ---------------------------------------------------------------------

/** Un arrêt du tour : où se tient le héros et ce qu'il regarde. */
export interface TourStop {
  name: string
  x: number
  z: number
  faceX: number
  faceZ: number
}

/** Recul devant le cœur d'une région : la pierre de savoir y est posée. */
export const TOUR_STEP_BACK = 12

/**
 * Arrêts tirés de la disposition de l'île (aucune position écrite ici) : le départ face à la
 * Citadelle, le village, puis chaque région, vue depuis un peu avant son cœur, côté Citadelle.
 */
export function tourStops(layout: IslandLayout): TourStop[] {
  const c = layout.citadelle
  const stops: TourStop[] = [
    { name: 'depart', x: layout.depart.x, z: layout.depart.z, faceX: c.x, faceZ: c.z },
    { name: 'village', x: layout.village.x, z: layout.village.z, faceX: c.x, faceZ: c.z },
  ]
  for (const [code, r] of Object.entries(layout.regions)) {
    const dx = c.x - r.x
    const dz = c.z - r.z
    const d = Math.hypot(dx, dz) || 1
    stops.push({ name: code, x: r.x + (dx / d) * TOUR_STEP_BACK, z: r.z + (dz / d) * TOUR_STEP_BACK, faceX: r.x, faceZ: r.z })
  }
  return stops
}

/** Où en est le tour au temps t (secondes) : arrêt en cours et part de son tour de caméra (0 à 1). */
export function tourAt(stops: readonly TourStop[], seconds: number, t: number): { index: number; turn: number; done: boolean } {
  if (stops.length === 0 || t >= seconds) return { index: Math.max(0, stops.length - 1), turn: 1, done: true }
  const per = seconds / stops.length
  const index = Math.min(stops.length - 1, Math.floor(Math.max(0, t) / per))
  return { index, turn: (Math.max(0, t) - index * per) / per, done: false }
}

// --- Le compte rendu --------------------------------------------------------------------

/** Navigateur lisible (« Edge 142 », « Chrome 153 », « Firefox 145 ») d'après l'agent utilisateur. */
export function browserLabel(ua: string): string {
  const tests: [RegExp, string][] = [
    [/Edg\/(\d+)/, 'Edge'],
    [/OPR\/(\d+)/, 'Opera'],
    [/Firefox\/(\d+)/, 'Firefox'],
    [/Chrome\/(\d+)/, 'Chrome'],
    [/Version\/(\d+).*Safari/, 'Safari'],
  ]
  for (const [re, name] of tests) {
    const m = re.exec(ua)
    if (m) return `${name} ${m[1]}`
  }
  return 'navigateur inconnu'
}

export interface PerfReport {
  date: string
  browser: string
  /** Carte graphique telle que le navigateur la nomme (souvent approximatif, parfois masqué). */
  gpu: string
  engine: string
  quality: string
  width: number
  height: number
  seconds: number
  summary: PerfSummary
  drawCalls: number
  triangles: number
  /** Temps entre l'ouverture de la page et l'île prête. */
  loadMs: number
  /** Mémoire JavaScript utilisée (Chrome et Edge seulement). */
  heapMb: number | null
}

const num = (v: number, digits = 1): string => v.toFixed(digits).replace('.', ',')

/** Ligne du tableau « Banc de mesure » de docs/perf-log.md (mêmes colonnes, même ordre). */
export function perfLogRow(r: PerfReport): string {
  const s = r.summary
  const cells = [
    r.date,
    r.gpu || 'carte inconnue',
    r.browser,
    r.engine,
    r.quality,
    `${r.width} × ${r.height}`,
    num(s.fps, 0),
    `${num(s.frameP95)} ms`,
    `${num(s.slowShare * 100, 0)} %`,
    `${num(s.cpuP50)} ms`,
    s.gpuP50 === null ? 'n. d.' : `${num(s.gpuP50)} ms`,
    String(r.drawCalls),
    `${num(r.triangles / 1e6, 2)} M`,
    `${num(r.loadMs / 1000)} s`,
    r.heapMb === null ? 'n. d.' : `${Math.round(r.heapMb)} Mo`,
  ]
  return `| ${cells.join(' | ')} |`
}
