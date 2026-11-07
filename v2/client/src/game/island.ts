/**
 * Maillage du sol et de la mer. Le sol est construit sommet par sommet depuis HeightGrid
 * (mêmes triangles que ceux sur lesquels marche le héros) ; ses couleurs viennent de la région
 * (une teinte par matière), de l'altitude (sable, roche, neige) et de la pente.
 */
import { Color3, Mesh, type Scene, StandardMaterial, VertexData, MeshBuilder } from '@babylonjs/core'
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

export function buildGround(scene: Scene, terrain: Terrain, theme: WorldTheme, subdivisions: number): { mesh: Mesh; grid: HeightGrid } {
  const { layout } = terrain
  const grid = new HeightGrid(layout.taille, subdivisions, (x, z) => terrain.heightAt(x, z))
  const n = subdivisions
  const count = (n + 1) * (n + 1)
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 4)
  const regions = Object.values(layout.regions).map((r) => ({ ...r, rgb: hex(r.couleur) }))
  const gray: RGB = [0.5, 0.52, 0.55]

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
      for (const r of regions) {
        const w = Math.exp(-((x - r.x) ** 2 + (z - r.z) ** 2) / (2 * 70 * 70))
        if (w < 0.01) continue
        acc = [acc[0] + r.rgb[0] * w, acc[1] + r.rgb[1] * w, acc[2] + r.rgb[2] * w]
        total += w
      }
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
  let t = 0
  const pushTriangle = (a: number, b: number, c: number, tint: number) => {
    const r = ((colors[a * 4]! + colors[b * 4]! + colors[c * 4]!) / 3) * tint
    const g = ((colors[a * 4 + 1]! + colors[b * 4 + 1]! + colors[c * 4 + 1]!) / 3) * tint
    const bl = ((colors[a * 4 + 2]! + colors[b * 4 + 2]! + colors[c * 4 + 2]!) / 3) * tint
    for (const [k, v] of [a, b, c].entries()) {
      flatPositions.set([positions[v * 3]!, positions[v * 3 + 1]!, positions[v * 3 + 2]!], (t * 3 + k) * 3)
      flatColors.set([r, g, bl, 1], (t * 3 + k) * 4)
    }
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
  data.applyToMesh(mesh, false)
  const material = new StandardMaterial('sol', scene)
  material.diffuseColor = Color3.White()
  material.specularColor = new Color3(0.04, 0.04, 0.04)
  mesh.material = material
  mesh.useVertexColors = true
  mesh.receiveShadows = true
  mesh.isPickable = true
  mesh.freezeWorldMatrix()
  return { mesh, grid }
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
