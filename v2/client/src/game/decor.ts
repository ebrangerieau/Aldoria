/**
 * Décor de l'île : forêts et rochers semés selon la région (thin instances), la Citadelle,
 * le village, les tours des lieux de quête, l'île du Sphinx et quelques nuages. Chaque
 * élément solide inscrit son cercle dans Obstacles (le héros le contourne).
 */
import {
  Color3,
  Matrix,
  type Mesh,
  MeshBuilder,
  Quaternion,
  type Scene,
  type ShadowGenerator,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'
import type { HeightGrid } from '../core/world/heightGrid'
import { Obstacles } from '../core/world/obstacles'
import type { Place } from '../core/world/places'
import { fbm, type Relief, type Terrain, valueNoise } from '../core/world/terrain'
import { mergedModel, placeModel } from './assets'
import type { Quality } from './quality'
import type { WorldName } from './theme'

const HEX = 'kaykit/hexagon'

/** Part du sol couverte d'arbres selon le relief de la région. */
const FOREST: Record<Relief | 'aucune', number> = {
  foret: 0.8, vallee: 0.55, montagne: 0.35, collines: 0.3, plateau: 0.25, falaises: 0.28, cote: 0.12, plaine: 0.1, aucune: 0.2,
}

const TREES = [
  { path: `${HEX}/trees_A_large.gltf`, height: 9 },
  { path: `${HEX}/trees_B_large.gltf`, height: 8 },
  { path: `${HEX}/trees_A_medium.gltf`, height: 6 },
  { path: `${HEX}/trees_B_small.gltf`, height: 4 },
]

export interface Decor {
  obstacles: Obstacles
  /** Maillages à faire porter une ombre. */
  casters: Mesh[]
}

export async function buildDecor(
  scene: Scene,
  terrain: Terrain,
  grid: HeightGrid,
  places: Place[],
  world: WorldName,
  quality: Quality,
  shadows: ShadowGenerator,
  onProgress: (label: string) => void,
): Promise<Decor> {
  const obstacles = new Obstacles()
  const casters: Mesh[] = []
  const { layout } = terrain
  const at = (x: number, z: number) => new Vector3(x, grid.heightAt(x, z), z)
  const solid = async (path: string, height: number, x: number, z: number, yaw: number, name: string, shrink = 0.8) => {
    const placed = await placeModel(scene, path, height, at(x, z), yaw, name)
    for (const m of placed.meshes) shadows.addShadowCaster(m, false)
    obstacles.add({ x, z, r: placed.radius * shrink })
    return placed
  }
  const towardStart = (x: number, z: number) => Math.atan2(layout.depart.x - x, layout.depart.z - z)

  onProgress('La Citadelle des Archives')
  const castle = world === 'lumineux' ? 'building_castle_blue' : 'building_castle_red'
  await solid(`${HEX}/${castle}.gltf`, 24, layout.citadelle.x, layout.citadelle.z, Math.PI, 'citadelle', 0.62)

  onProgress('Les lieux de quête')
  for (const place of places) {
    const piece = place.dungeon.v1_map_piece || 'building_tower_A_blue'
    await solid(`${HEX}/${piece}.gltf`, 13, place.x, place.z, towardStart(place.x, place.z), `lieu-${place.dungeon.code}`, 0.7)
  }
  for (const [code, secret] of Object.entries(layout.secrets)) {
    await solid(`${HEX}/building_tower_B_red.gltf`, 22, secret.x, secret.z, 0, `secret-${code}`, 0.7)
  }

  onProgress('Le village')
  const houses = ['building_home_A_yellow', 'building_home_B_yellow', 'building_market_yellow', 'building_blacksmith_blue', 'building_windmill_yellow', 'building_home_A_yellow']
  for (let k = 0; k < houses.length; k += 1) {
    const angle = (k / houses.length) * Math.PI * 2 + 0.4
    const x = layout.village.x + Math.cos(angle) * 15
    const z = layout.village.z + Math.sin(angle) * 15
    await solid(`${HEX}/${houses[k]}.gltf`, k === 4 ? 14 : 8, x, z, Math.atan2(layout.village.x - x, layout.village.z - z), `village-${k}`, 0.7)
  }
  await solid(`${HEX}/building_well_yellow.gltf`, 4, layout.village.x, layout.village.z, 0, 'puits', 0.8)

  onProgress("L'île du Sphinx")
  buildPyramids(scene, terrain, grid, obstacles, shadows)
  await solid(`${HEX}/building_destroyed.gltf`, 7, layout.sphinx.x, layout.sphinx.z, -Math.PI / 2, 'temple', 0.7)

  onProgress('Les forêts')
  const kept = quality.vegetation
  const trees = await Promise.all(TREES.map((t) => mergedModel(scene, t.path, t.height)))
  const rock = await mergedModel(scene, `${HEX}/rock_single_A.gltf`, 1.6)
  const matrices: Matrix[][] = TREES.map(() => [])
  const rocks: Matrix[] = []
  const clearings = [
    { x: layout.depart.x, z: layout.depart.z, r: 14 },
    { x: layout.ysaline.x, z: layout.ysaline.z, r: 8 },
    { x: layout.pierre_eveil.x, z: layout.pierre_eveil.z, r: 6 },
    ...terrain.pads.map((p) => ({ x: p.x, z: p.z, r: p.radius + 7 })),
  ]
  const STEP = 6.5
  const half = layout.taille / 2
  for (let gz = -half; gz < half; gz += STEP) {
    for (let gx = -half; gx < half; gx += STEP) {
      const jx = gx + (valueNoise(gx * 0.37, gz * 0.37, 41) - 0.5) * STEP * 1.6
      const jz = gz + (valueNoise(gx * 0.37 + 9, gz * 0.37 + 9, 43) - 0.5) * STEP * 1.6
      const h = grid.heightAt(jx, jz)
      if (h < 2.6 || h > 36) continue
      if (terrain.slopeAt(jx, jz) > 0.55) continue
      if (clearings.some((c) => Math.hypot(jx - c.x, jz - c.z) < c.r)) continue
      const region = terrain.regionAt(jx, jz)
      if (region === 'sphinx') continue // désert : ni arbres ni rochers autour du temple
      const relief = (region && layout.regions[region]?.relief) || 'aucune'
      const density = (FOREST[relief as Relief | 'aucune'] ?? 0.2) * kept
      // Des bosquets plutôt qu'un semis régulier : le bruit regroupe les arbres.
      const clump = fbm(jx / 40, jz / 40, 77, 3)
      const chance = valueNoise(jx * 1.7, jz * 1.7, 59)
      const yaw = valueNoise(jx, jz, 61) * Math.PI * 2
      if (chance < density * (0.4 + clump * 1.2)) {
        const kind = Math.floor(valueNoise(jx * 2.3, jz * 2.3, 67) * TREES.length) % TREES.length
        const s = 0.8 + valueNoise(jx * 3.1, jz * 3.1, 71) * 0.45
        if (obstacles.overlaps(jx, jz, 1.5)) continue
        matrices[kind]!.push(Matrix.Compose(new Vector3(s, s, s), Quaternion.RotationAxis(Vector3.Up(), yaw), new Vector3(jx, h - 0.15, jz)))
        obstacles.add({ x: jx, z: jz, r: trees[kind]!.radius * s * 0.35 })
      } else if (chance > 0.985 - 0.02 * kept) {
        const s = 0.7 + valueNoise(jx * 5.3, jz * 5.3, 73) * 1.2
        rocks.push(Matrix.Compose(new Vector3(s, s, s), Quaternion.RotationAxis(Vector3.Up(), yaw), new Vector3(jx, h - 0.2, jz)))
        obstacles.add({ x: jx, z: jz, r: rock.radius * s * 0.8 })
      }
    }
  }
  trees.forEach(({ mesh }, k) => {
    const list = matrices[k]!
    if (list.length === 0) {
      mesh.setEnabled(false)
      return
    }
    mesh.thinInstanceAdd(list)
    mesh.receiveShadows = true
    shadows.addShadowCaster(mesh, false)
    casters.push(mesh)
  })
  if (rocks.length > 0) {
    rock.mesh.thinInstanceAdd(rocks)
    rock.mesh.receiveShadows = true
    shadows.addShadowCaster(rock.mesh, false)
  } else {
    rock.mesh.setEnabled(false)
  }

  onProgress('Les nuages')
  const cloud = await mergedModel(scene, `${HEX}/cloud_big.gltf`, 9)
  const cloudMatrices: Matrix[] = []
  for (let k = 0; k < 18; k += 1) {
    const angle = valueNoise(k * 3.3, 1, 81) * Math.PI * 2
    const dist = 60 + valueNoise(k * 1.7, 2, 83) * 260
    const s = 1.5 + valueNoise(k, 3, 85) * 2.5
    cloudMatrices.push(Matrix.Compose(new Vector3(s * 1.6, s, s * 1.6), Quaternion.RotationAxis(Vector3.Up(), angle), new Vector3(Math.cos(angle) * dist, 95 + k * 2, Math.sin(angle) * dist)))
  }
  cloud.mesh.thinInstanceAdd(cloudMatrices)
  return { obstacles, casters }
}

/** Pyramides de l'île du Sphinx : de simples cônes à quatre faces, couleur de sable. */
function buildPyramids(scene: Scene, terrain: Terrain, grid: HeightGrid, obstacles: Obstacles, shadows: ShadowGenerator): void {
  const { sphinx } = terrain.layout
  const material = new StandardMaterial('pierre-sable', scene)
  material.diffuseColor = Color3.FromHexString('#b8955a')
  material.specularColor = Color3.Black()
  const spots = [
    { dx: -22, dz: 16, size: 22 },
    { dx: 18, dz: 24, size: 15 },
    { dx: -4, dz: -26, size: 11 },
  ]
  for (const [k, spot] of spots.entries()) {
    const x = sphinx.x + spot.dx
    const z = sphinx.z + spot.dz
    const pyramid = MeshBuilder.CreateCylinder(`pyramide-${k}`, { diameterTop: 0, diameterBottom: spot.size * 1.41, height: spot.size * 0.72, tessellation: 4 }, scene)
    pyramid.rotation.y = Math.PI / 4
    pyramid.position.set(x, grid.heightAt(x, z) + spot.size * 0.36 - 0.6, z)
    pyramid.material = material
    pyramid.receiveShadows = true
    shadows.addShadowCaster(pyramid, false)
    obstacles.add({ x, z, r: spot.size * 0.55 })
  }
}

/** Repère lumineux d'un lieu ou d'une pierre : anneau au sol et colonne de lumière. */
export function beacon(scene: Scene, name: string, position: Vector3, color: string, open: boolean): Mesh {
  const ring = MeshBuilder.CreateTorus(`${name}-anneau`, { diameter: 3.2, thickness: 0.16, tessellation: 48 }, scene)
  ring.position = position.add(new Vector3(0, 0.15, 0))
  const material = new StandardMaterial(`${name}-lueur`, scene)
  const c = Color3.FromHexString(color)
  material.emissiveColor = open ? c : c.scale(0.25)
  material.diffuseColor = Color3.Black()
  material.disableLighting = true
  ring.material = material
  ring.isPickable = false
  return ring
}
