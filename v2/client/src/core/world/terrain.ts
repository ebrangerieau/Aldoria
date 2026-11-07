/**
 * Relief de l'île : une fonction pure (aucune dépendance au moteur 3D), donc testée sans
 * navigateur et partagée par le maillage du sol, le placement du décor et le déplacement du
 * héros. Même graine, même île : sur tous les PC, à chaque chargement.
 *
 * Construction : un masque d'île au rivage irrégulier, un léger moutonnement, le relief de
 * chaque région (montagne, collines, vallée…), puis des replats sous les bâtiments
 * (Citadelle, village, lieux de quête) pour qu'ils tiennent sur un sol plat.
 */

export type Relief = 'montagne' | 'plateau' | 'cote' | 'vallee' | 'foret' | 'falaises' | 'collines' | 'plaine'

export interface Point {
  x: number
  z: number
}

export interface RegionLayout extends Point {
  relief: Relief
  couleur: string
  /** Direction (degrés, 0 = est, 90 = nord) où se placent les lieux de la région. */
  angle: number
}

export interface IslandLayout {
  graine: number
  rayon: number
  taille: number
  citadelle: Point & { rayon_plat: number }
  depart: Point & { cap: number }
  pierre_eveil: Point
  ysaline: Point
  village: Point & { rayon_plat: number }
  regions: Record<string, RegionLayout>
  secrets: Record<string, Point>
  sphinx: Point & { rayon: number }
}

export interface Pad extends Point {
  radius: number
  height: number
}

/** Lieux d'une région : jusqu'à trois emplacements, sur un arc à cette distance du centre. */
export const SLOT_DISTANCE = 30
export const SLOTS_PER_REGION = 3
export const SLOT_SPREAD_DEG = 50
export const SEA_LEVEL = 0
/** Distance au centre d'une région en deçà de laquelle on est « dans » la région. */
export const REGION_RADIUS = 66
/** Abords de la Citadelle : au-delà du replat, jusqu'au départ. */
export const CITADEL_MARGIN = 32

// --- Bruit de valeur déterministe ---------------------------------------------------------

function hash(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

const smooth = (t: number): number => t * t * (3 - 2 * t)

export function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = smooth(x - ix)
  const fz = smooth(z - iz)
  const a = hash(ix, iz, seed)
  const b = hash(ix + 1, iz, seed)
  const c = hash(ix, iz + 1, seed)
  const d = hash(ix + 1, iz + 1, seed)
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz
}

/** Somme d'octaves, entre 0 et 1. */
export function fbm(x: number, z: number, seed: number, octaves = 4): number {
  let sum = 0
  let amp = 0.5
  let norm = 0
  let freq = 1
  for (let o = 0; o < octaves; o += 1) {
    sum += amp * valueNoise(x * freq, z * freq, seed + o * 17)
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}

/** Crêtes (montagnes) : 1 sur la ligne de crête, 0 dans les creux. */
function ridge(x: number, z: number, seed: number): number {
  return 1 - Math.abs(fbm(x, z, seed, 4) * 2 - 1)
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return smooth(t)
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

// --- L'île -------------------------------------------------------------------------------

export class Terrain {
  readonly pads: Pad[] = []
  /** Emplacements des lieux de quête, par région, dans l'ordre d'ouverture. */
  readonly slots: Record<string, Point[]> = {}

  constructor(readonly layout: IslandLayout) {
    for (const [code, region] of Object.entries(layout.regions)) {
      this.slots[code] = Array.from({ length: SLOTS_PER_REGION }, (_, k) => {
        const deg = region.angle + (k - (SLOTS_PER_REGION - 1) / 2) * SLOT_SPREAD_DEG
        const rad = (deg * Math.PI) / 180
        return { x: region.x + SLOT_DISTANCE * Math.cos(rad), z: region.z + SLOT_DISTANCE * Math.sin(rad) }
      })
    }
    // Replats : hauteur du sol brut en leur centre, jamais sous 1,5 m (au-dessus de la mer).
    const flat = (p: Point, radius: number): void => {
      this.pads.push({ x: p.x, z: p.z, radius, height: Math.max(1.5, this.rawHeight(p.x, p.z)) })
    }
    flat(layout.citadelle, layout.citadelle.rayon_plat)
    flat(layout.village, layout.village.rayon_plat)
    for (const list of Object.values(this.slots)) for (const slot of list) flat(slot, 9)
    for (const secret of Object.values(layout.secrets)) flat(secret, 12)
    flat(layout.sphinx, 12)
  }

  /** Hauteur du sol en (x, z), replats compris. */
  heightAt(x: number, z: number): number {
    let h = this.rawHeight(x, z)
    for (const pad of this.pads) {
      const d = Math.hypot(x - pad.x, z - pad.z)
      if (d < pad.radius + 12) h = lerp(h, pad.height, smoothstep(pad.radius + 12, pad.radius, d))
    }
    return h
  }

  /** Pente locale (0 = plat, 1 = 45°), par différences finies. */
  slopeAt(x: number, z: number, step = 1.5): number {
    const dx = this.heightAt(x + step, z) - this.heightAt(x - step, z)
    const dz = this.heightAt(x, z + step) - this.heightAt(x, z - step)
    return Math.hypot(dx, dz) / (2 * step)
  }

  /** Région où se trouve ce point : code de matière, « citadelle », « sphinx » ou null. */
  regionAt(x: number, z: number): string | null {
    const { citadelle, sphinx } = this.layout
    if (Math.hypot(x - citadelle.x, z - citadelle.z) < citadelle.rayon_plat + CITADEL_MARGIN) return 'citadelle'
    if (Math.hypot(x - sphinx.x, z - sphinx.z) < sphinx.rayon) return 'sphinx'
    let best: string | null = null
    let bestDistance = REGION_RADIUS
    for (const [code, region] of Object.entries(this.layout.regions)) {
      const d = Math.hypot(x - region.x, z - region.z)
      if (d < bestDistance) {
        best = code
        bestDistance = d
      }
    }
    return best
  }

  /** Sol sans les replats. */
  rawHeight(x: number, z: number): number {
    const { graine: seed, rayon } = this.layout
    const r = Math.hypot(x, z)
    const theta = Math.atan2(z, x)
    // Rivage irrégulier : quelques ondulations et un peu de bruit autour du cercle.
    const wobble =
      0.09 * Math.sin(3 * theta + 1.3) +
      0.05 * Math.sin(7 * theta + 0.4) +
      0.12 * (fbm(Math.cos(theta) * 2 + 10, Math.sin(theta) * 2 + 10, seed) - 0.5)
    const land = smoothstep(1.06, 0.82, r / (rayon * (1 + wobble)))
    let h = lerp(-9, 2.2 + 4.5 * fbm(x / 70, z / 70, seed + 3), land)
    for (const region of Object.values(this.layout.regions)) {
      const d2 = (x - region.x) ** 2 + (z - region.z) ** 2
      const w = Math.exp(-d2 / (2 * 55 * 55)) * land
      if (w < 0.002) continue
      h += w * this.relief(region.relief, x, z, seed)
    }
    // Île du Sphinx, au large à l'est : sable et dunes.
    const sphinx = this.layout.sphinx
    const ds = Math.hypot(x - sphinx.x, z - sphinx.z) / sphinx.rayon
    const sand = smoothstep(1.1, 0.7, ds)
    const dunes = lerp(-9, 1.8 + 2.4 * fbm(x / 18, z / 18, seed + 11), sand)
    return Math.max(h, dunes)
  }

  private relief(kind: Relief, x: number, z: number, seed: number): number {
    switch (kind) {
      case 'montagne':
        return 26 + 30 * ridge(x / 45, z / 45, seed + 5)
      case 'collines':
        return 4 + 9 * fbm(x / 28, z / 28, seed + 6)
      case 'plateau':
        return 7 + 2 * fbm(x / 20, z / 20, seed + 7)
      case 'falaises':
        return 9 + 4 * fbm(x / 25, z / 25, seed + 8)
      case 'foret':
        return 2 + 4 * fbm(x / 22, z / 22, seed + 9)
      case 'vallee':
        return -1.2 + 2 * fbm(x / 30, z / 30, seed + 10)
      case 'cote':
      case 'plaine':
        return 0.5
    }
  }
}
