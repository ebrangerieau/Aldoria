/**
 * Maillage du sol et de la mer. Le sol est construit sommet par sommet depuis HeightGrid
 * (mêmes triangles que ceux sur lesquels marche le héros) ; ses couleurs viennent de la région
 * (une teinte par matière), de l'altitude (sable, roche, neige) et de la pente.
 */
import { Color3, Mesh, type Scene, StandardMaterial, VertexBuffer, VertexData, MeshBuilder } from '@babylonjs/core'
import { HeightGrid } from '../core/world/heightGrid'
import { fbm, smoothstep, type Terrain } from '../core/world/terrain'
import type { WorldTheme } from './theme'

type RGB = [number, number, number]

const hex = (value: string): RGB => {
  const c = Color3.FromHexString(value)
  return [c.r, c.g, c.b]
}
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

const GRASS = hex('#8cb369')
const SAND = hex('#e2d29c')
const WET_SAND = hex('#b39f72')
const ROCK = hex('#8b847a')
const SNOW = hex('#f2f5f7')
const DESERT = hex('#e8cd8a')
const PAVED = hex('#c9bfa6')

/** Gris bleuté vers lequel une région sans lumière se fane (le sol perd ses couleurs et s'assombrit : le brouillard de la carte de la v1). */
const FADED: RGB = [0.46, 0.5, 0.56]
/** Part maximale de gris dans une région sans aucune lumière, et de l'assombrissement. */
const FADE_MIX = 0.85
const FADE_DARK = 0.28
/** Un sommet au cœur d'une région pèse environ 0,75 dans la moyenne des teintes : on ramène son atténuation à 0..1. */
const FULL_INFLUENCE = 0.75

export interface Ground {
  mesh: Mesh
  grid: HeightGrid
  /** Éclaire ou assombrit chaque région (code de matière → 0 à 1), sans reconstruire le maillage : à rappeler quand une page est rapportée. */
  setLights(lights: Record<string, number>): void
}

export function buildGround(scene: Scene, terrain: Terrain, theme: WorldTheme, subdivisions: number, lights: Record<string, number> = {}): Ground {
  const { layout } = terrain
  const grid = new HeightGrid(layout.taille, subdivisions, (x, z) => terrain.heightAt(x, z))
  const n = subdivisions
  const count = (n + 1) * (n + 1)
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 4)
  const regionCodes = Object.keys(layout.regions)
  const regions = Object.values(layout.regions).map((r) => ({ ...r, rgb: hex(r.couleur) }))
  const gray: RGB = [0.5, 0.52, 0.55]
  // Part de chaque région dans la teinte d'un sommet (la même pondération que la couleur), gardée sur un octet : la lumière d'une région en dépend.
  const influence = new Uint8Array(count * regions.length)

  for (let j = 0; j <= n; j += 1) {
    for (let i = 0; i <= n; i += 1) {
      const v = j * (n + 1) + i
      const x = grid.xOf(i)
      const z = grid.zOf(j)
      const h = grid.at(i, j)
      positions[v * 3] = x
      positions[v * 3 + 1] = h
      positions[v * 3 + 2] = z

      // Teinte de la région (moyenne pondérée par la distance), herbe ailleurs.
      let color: RGB = GRASS
      let total = 0.35
      let acc: RGB = [GRASS[0] * 0.35, GRASS[1] * 0.35, GRASS[2] * 0.35]
      const weights: number[] = []
      for (const r of regions) {
        const w = Math.exp(-((x - r.x) ** 2 + (z - r.z) ** 2) / (2 * 70 * 70))
        weights.push(w)
        if (w < 0.01) continue
        acc = [acc[0] + r.rgb[0] * w, acc[1] + r.rgb[1] * w, acc[2] + r.rgb[2] * w]
        total += w
      }
      for (const [k, w] of weights.entries()) influence[v * regions.length + k] = w < 0.01 ? 0 : Math.round((255 * w) / total)
      color = [acc[0] / total, acc[1] / total, acc[2] / total]
      const slope = Math.hypot(grid.at(i + 1, j) - grid.at(i - 1, j), grid.at(i, j + 1) - grid.at(i, j - 1)) / (2 * grid.cell)
      const ds = Math.hypot(x - layout.sphinx.x, z - layout.sphinx.z)
      if (ds < layout.sphinx.rayon * 1.3) color = mix(color, DESERT, smoothstep(layout.sphinx.rayon * 1.3, layout.sphinx.rayon * 0.8, ds))
      const dc = Math.hypot(x - layout.citadelle.x, z - layout.citadelle.z)
      color = mix(color, PAVED, 0.55 * smoothstep(layout.citadelle.rayon_plat, layout.citadelle.rayon_plat * 0.6, dc))
      color = mix(color, SAND, smoothstep(2.6, 1.3, h))
      color = mix(color, WET_SAND, smoothstep(0.2, -1.5, h))
      color = mix(color, ROCK, smoothstep(0.55, 0.95, slope))
      color = mix(color, SNOW, smoothstep(40, 48, h) * (1 - smoothstep(0.9, 1.3, slope)))
      // Variation douce, pour que l'herbe ne soit pas d'un seul aplat.
      const shade = 0.92 + 0.16 * fbm(x / 9, z / 9, 99, 3)
      color = mix(color, gray, theme.desaturate)
      colors[v * 4] = color[0] * shade * theme.darken
      colors[v * 4 + 1] = color[1] * shade * theme.darken
      colors[v * 4 + 2] = color[2] * shade * theme.darken
      colors[v * 4 + 3] = 1
    }
  }

  // Deux triangles par case, diagonale du sommet (i + 1, j) au sommet (i, j + 1) (HeightGrid).
  // Rendu en facettes (low-poly, comme les modèles KayKit) : chaque triangle a ses propres
  // sommets, sa normale et une seule couleur, la moyenne de ses trois coins.
  const triangles = n * n * 2
  const flatPositions = new Float32Array(triangles * 9)
  const flatColors = new Float32Array(triangles * 12)
  const corners = new Uint32Array(triangles * 3) // les trois sommets de chaque triangle
  const tints = new Float32Array(triangles) // variation propre à chaque facette
  let t = 0
  const pushTriangle = (a: number, b: number, c: number, tint: number) => {
    for (const [k, v] of [a, b, c].entries()) {
      flatPositions.set([positions[v * 3]!, positions[v * 3 + 1]!, positions[v * 3 + 2]!], (t * 3 + k) * 3)
      corners[t * 3 + k] = v
    }
    tints[t] = tint
    t += 1
  }
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const v00 = j * (n + 1) + i
      const v10 = v00 + 1
      const v01 = v00 + (n + 1)
      const v11 = v01 + 1
      // Une légère variation par facette fait ressortir le relief.
      const tint = 0.95 + 0.1 * fbm(i * 0.9, j * 0.9, 123, 2)
      pushTriangle(v10, v11, v01, tint)
      pushTriangle(v00, v10, v01, 2 - tint)
    }
  }

  /** Couleur de chaque sommet selon la lumière des régions, puis moyenne par facette. */
  const paint = (levels: Record<string, number>) => {
    const dim = new Float32Array(count)
    const missing = regionCodes.map((code) => 1 - Math.min(1, Math.max(0, levels[code] ?? 1))) // une région inconnue du dictionnaire reste éclairée
    if (missing.some((m) => m > 0)) {
      for (let v = 0; v < count; v += 1) {
        let d = 0
        for (let k = 0; k < regions.length; k += 1) d += (influence[v * regions.length + k]! / 255) * missing[k]!
        dim[v] = Math.min(1, d / FULL_INFLUENCE)
      }
    }
    const vertex = new Float32Array(count * 3)
    for (let v = 0; v < count; v += 1) {
      const d = dim[v]!
      const fade = Math.min(1, d * FADE_MIX)
      const dark = 1 - FADE_DARK * d
      for (let c = 0; c < 3; c += 1) vertex[v * 3 + c] = (colors[v * 4 + c]! + (FADED[c]! - colors[v * 4 + c]!) * fade) * dark
    }
    for (let k = 0; k < triangles; k += 1) {
      const a = corners[k * 3]!
      const b = corners[k * 3 + 1]!
      const c = corners[k * 3 + 2]!
      for (let corner = 0; corner < 3; corner += 1) {
        for (let ch = 0; ch < 3; ch += 1) flatColors[(k * 3 + corner) * 4 + ch] = ((vertex[a * 3 + ch]! + vertex[b * 3 + ch]! + vertex[c * 3 + ch]!) / 3) * tints[k]!
        flatColors[(k * 3 + corner) * 4 + 3] = 1
      }
    }
  }
  paint(lights)

  const indices = new Uint32Array(triangles * 3)
  for (let k = 0; k < indices.length; k += 1) indices[k] = k
  const normals = new Float32Array(flatPositions.length)
  VertexData.ComputeNormals(flatPositions, indices, normals)
  const data = new VertexData()
  data.positions = flatPositions
  data.indices = indices
  data.normals = normals
  data.colors = flatColors

  const mesh = new Mesh('sol', scene)
  data.applyToMesh(mesh, true) // les couleurs se mettent à jour quand une région s'éclaire
  const material = new StandardMaterial('sol', scene)
  material.diffuseColor = Color3.White()
  material.specularColor = new Color3(0.04, 0.04, 0.04)
  mesh.material = material
  mesh.useVertexColors = true
  mesh.receiveShadows = true
  mesh.isPickable = true
  mesh.freezeWorldMatrix()
  const setLights = (levels: Record<string, number>) => {
    paint(levels)
    mesh.updateVerticesData(VertexBuffer.ColorKind, flatColors)
  }
  return { mesh, grid, setLights }
}

export function buildSea(scene: Scene, terrain: Terrain, theme: WorldTheme): Mesh {
  const sea = MeshBuilder.CreateGround('mer', { width: terrain.layout.taille * 3, height: terrain.layout.taille * 3, subdivisions: 1 }, scene)
  sea.position.y = 0
  const material = new StandardMaterial('mer', scene)
  material.diffuseColor = Color3.FromHexString(theme.waterColor)
  material.specularColor = new Color3(0.9, 0.9, 0.85)
  material.specularPower = 96
  material.alpha = 0.86
  material.backFaceCulling = false
  sea.material = material
  sea.isPickable = false
  sea.receiveShadows = true
  sea.freezeWorldMatrix()
  return sea
}
