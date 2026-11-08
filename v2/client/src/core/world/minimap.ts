/**
 * Mini-carte de l'île : cadre des terres, projection du monde (x vers l'est, z vers le nord) sur
 * une image au nord en haut, repères à y poser et couleurs du relief vu d'en haut. Aucune
 * dépendance au moteur 3D ni au DOM : l'interface (ui/Minimap.tsx) dessine ce que ce module
 * calcule, à partir des hauteurs du sol affiché et des repères que le monde a posés.
 */
import villages from '@content/monde/villages.json'
import { regionTitle } from './places'
import { type IslandLayout, type Point, SEA_LEVEL, smoothstep } from './terrain'

const VILLAGES = (villages as unknown as { villages: { title: string; level: string }[] }).villages

export interface MapBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** Image de la carte : cadre du monde, taille en pixels, pixels par mètre. */
export interface MapFrame {
  bounds: MapBounds
  width: number
  height: number
  scale: number
}

/** Mer gardée autour des terres, en mètres. */
export const MAP_MARGIN = 16

/**
 * Cadre qui contient toutes les terres (île principale et île du Sphinx), plus une marge de mer.
 * Les terres sont cherchées sur une grille de `step` mètres, dans le carré de côté `extent`.
 */
export function landBounds(heightAt: (x: number, z: number) => number, extent: number, step = 4): MapBounds {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (let z = -extent / 2; z <= extent / 2; z += step) {
    for (let x = -extent / 2; x <= extent / 2; x += step) {
      if (heightAt(x, z) <= SEA_LEVEL) continue
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minZ = Math.min(minZ, z)
      maxZ = Math.max(maxZ, z)
    }
  }
  if (minX > maxX) return { minX: -extent / 2, maxX: extent / 2, minZ: -extent / 2, maxZ: extent / 2 }
  const pad = MAP_MARGIN + step
  const half = extent / 2
  return {
    minX: Math.max(-half, minX - pad),
    maxX: Math.min(half, maxX + pad),
    minZ: Math.max(-half, minZ - pad),
    maxZ: Math.min(half, maxZ + pad),
  }
}

/** Image de `width` pixels de large ; la hauteur suit les proportions du cadre. */
export function mapFrame(bounds: MapBounds, width: number): MapFrame {
  const scale = width / (bounds.maxX - bounds.minX)
  return { bounds, width, height: Math.round((bounds.maxZ - bounds.minZ) * scale), scale }
}

/** Position sur l'image (u vers la droite = est, v vers le bas = sud). */
export function toMap(frame: MapFrame, x: number, z: number): { u: number; v: number } {
  return { u: (x - frame.bounds.minX) * frame.scale, v: (frame.bounds.maxZ - z) * frame.scale }
}

/** Point du monde au centre du pixel (i, j) de l'image. */
export function fromMap(frame: MapFrame, i: number, j: number): Point {
  return { x: frame.bounds.minX + (i + 0.5) / frame.scale, z: frame.bounds.maxZ - (j + 0.5) / frame.scale }
}

/**
 * Cap en degrés, dans le sens des aiguilles d'une montre depuis le nord (0 = nord, 90 = est),
 * pour une direction (dx, dz) du monde : l'angle dont tourner une flèche dessinée vers le haut.
 */
export function heading(dx: number, dz: number): number {
  const deg = (Math.atan2(dx, dz) * 180) / Math.PI
  return (deg + 360) % 360
}

// --- Repères ------------------------------------------------------------------------------

export type MarkerKind = 'citadelle' | 'village' | 'sphinx' | 'lieu' | 'pierre'
export type MarkerState = 'repere' | 'ouvert' | 'ferme' | 'termine' | 'endormie' | 'eveillee'

export interface MapMarker extends Point {
  id: string
  kind: MarkerKind
  state: MarkerState
  label: string
}

/** Ce que le monde a posé dans l'île (lieux, pierres, personnages) et leur état. */
export interface MarkerSource extends Point {
  id: string
  kind: string
  label: string
  open?: boolean
}

/**
 * Repères de la carte : la Citadelle, le village et l'île du Sphinx, puis les seuils des lieux et
 * les pierres tels que le monde les a posés (mêmes positions, même état). Les lieux secrets (la
 * Tour de l'Oubli) n'y sont pas : la carte ne les révèle pas.
 */
export function mapMarkers(layout: IslandLayout, level: string, sources: MarkerSource[], done: Record<string, number>): MapMarker[] {
  const village = VILLAGES.find((v) => v.level === level)?.title ?? 'Le village'
  const out: MapMarker[] = [
    { id: 'citadelle', kind: 'citadelle', state: 'repere', label: regionTitle('citadelle'), x: layout.citadelle.x, z: layout.citadelle.z },
    { id: 'village', kind: 'village', state: 'repere', label: village, x: layout.village.x, z: layout.village.z },
    { id: 'sphinx', kind: 'sphinx', state: 'repere', label: regionTitle('sphinx'), x: layout.sphinx.x, z: layout.sphinx.z },
  ]
  for (const s of sources) {
    if (s.kind === 'lieu') {
      const state: MarkerState = (done[s.id] ?? 0) > 0 ? 'termine' : s.open ? 'ouvert' : 'ferme'
      out.push({ id: s.id, kind: 'lieu', state, label: s.label, x: s.x, z: s.z })
    } else if (s.kind === 'pierre') {
      out.push({ id: s.id, kind: 'pierre', state: s.open ? 'endormie' : 'eveillee', label: s.label, x: s.x, z: s.z })
    }
  }
  return out
}

// --- Relief vu d'en haut ------------------------------------------------------------------

type RGB = [number, number, number]

export interface ReliefPalette {
  water: string
  /** Teinte de chaque région, à son centre (comme le sol de l'île). */
  regions: { x: number; z: number; couleur: string }[]
  /** Mélange vers le gris (monde Brouillard). */
  desaturate: number
}

export function hexColor(value: string): RGB {
  const v = value.replace('#', '')
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

const GRASS: RGB = hexColor('#8cb369')
const SAND: RGB = hexColor('#e2d29c')
const ROCK: RGB = hexColor('#8b847a')
const SNOW: RGB = hexColor('#f2f5f7')
const DEEP: RGB = hexColor('#123a56')
const GRAY: RGB = [128, 132, 140]
/** Lumière rasante venue du nord-ouest, comme sur les cartes en relief. */
const LIGHT = (() => {
  const v = [-0.55, 0.75, 0.55]
  const n = Math.hypot(v[0]!, v[1]!, v[2]!)
  return v.map((c) => c / n) as [number, number, number]
})()

/**
 * Pixels RGBA de la carte : la mer (plus sombre au large), les plages, la teinte des régions, la
 * roche des pentes et la neige des sommets, éclairés du nord-ouest pour que le relief se lise.
 */
export function paintRelief(frame: MapFrame, heightAt: (x: number, z: number) => number, palette: ReliefPalette): Uint8ClampedArray<ArrayBuffer> {
  const { width, height } = frame
  const pixels = new Uint8ClampedArray(width * height * 4)
  const water = hexColor(palette.water)
  const shallow = mix(water, [255, 255, 255], 0.25)
  const regions = palette.regions.map((r) => ({ x: r.x, z: r.z, rgb: hexColor(r.couleur) }))
  const e = Math.max(1.5, 1 / frame.scale) // pas des différences finies, en mètres
  for (let j = 0; j < height; j += 1) {
    for (let i = 0; i < width; i += 1) {
      const { x, z } = fromMap(frame, i, j)
      const h = heightAt(x, z)
      let color: RGB
      if (h <= SEA_LEVEL) {
        color = mix(shallow, mix(water, DEEP, 0.35), smoothstep(SEA_LEVEL, SEA_LEVEL - 7, h))
      } else {
        let total = 0.35
        let acc: RGB = [GRASS[0] * 0.35, GRASS[1] * 0.35, GRASS[2] * 0.35]
        for (const r of regions) {
          const w = Math.exp(-((x - r.x) ** 2 + (z - r.z) ** 2) / (2 * 70 * 70))
          if (w < 0.01) continue
          acc = [acc[0] + r.rgb[0] * w, acc[1] + r.rgb[1] * w, acc[2] + r.rgb[2] * w]
          total += w
        }
        color = [acc[0] / total, acc[1] / total, acc[2] / total]
        const dx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e)
        const dz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e)
        const slope = Math.hypot(dx, dz)
        color = mix(color, SAND, smoothstep(2.6, 1.3, h))
        color = mix(color, ROCK, smoothstep(0.55, 0.95, slope))
        color = mix(color, SNOW, smoothstep(40, 48, h) * (1 - smoothstep(0.9, 1.3, slope)))
        // Ombrage : normale (-dx, 1, -dz) face à la lumière, rapporté au sol plat.
        const lit = (-dx * LIGHT[0] + LIGHT[1] - dz * LIGHT[2]) / Math.hypot(dx, 1, dz)
        const shade = Math.min(1.25, Math.max(0.55, lit / LIGHT[1]))
        color = [color[0] * shade, color[1] * shade, color[2] * shade]
      }
      color = mix(color, GRAY, palette.desaturate)
      const k = (j * width + i) * 4
      pixels[k] = color[0]
      pixels[k + 1] = color[1]
      pixels[k + 2] = color[2]
      pixels[k + 3] = 255
    }
  }
  return pixels
}
