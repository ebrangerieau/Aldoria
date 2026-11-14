/**
 * Construction de l'intérieur d'un lieu : exécute le plan de core/quest/pieces.ts avec les pièces KayKit.
 * Toute la géométrie fixe passe en « thin instances » (un appel de dessin par sorte de pièce, pour les six
 * salles), avec un seul matériau, comme la v1 fusionnait la sienne pour tenir sur la tablette. Seules les
 * portes sont des modèles à part : leur battant pivote quand la salle est franchie.
 */
import {
  Color3,
  Matrix,
  Mesh,
  Quaternion,
  type Scene,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import { type LevelPlan, type Piece } from '../../core/quest/pieces'
import { loadContainer, MODELS } from '../assets'

const DUNGEON = 'kaykit/dungeon'
/** Ouverture d'un battant (radians) : il s'écarte vers la salle suivante. */
const DOOR_OPEN_ANGLE = 1.75
const DOOR_SECONDS = 0.8

export interface Door {
  /** Porte entre la salle `index - 1` et la salle `index`. */
  index: number
  root: TransformNode
  leaf: TransformNode | null
  base: Quaternion | null
  /** Avancement de l'ouverture, de 0 (fermée) à 1. */
  progress: number
  opening: boolean
}

export interface BuiltLevel {
  material: StandardMaterial
  /** Une pièce fusionnée par sorte, portant toutes ses instances. */
  sources: Mesh[]
  doors: Map<number, Door>
  /** Ouvre la porte de ce numéro (entre la salle `index - 1` et la salle `index`). */
  openDoor(index: number, animate: boolean): void
  update(dt: number): void
  dispose(): void
}

/** Matériau commun de tout le donjon : l'atlas de couleurs KayKit. */
function dungeonMaterial(scene: Scene): StandardMaterial {
  const material = new StandardMaterial('donjon', scene)
  const texture = new Texture(`${MODELS}/${DUNGEON}/dungeon_texture.png`, scene, false, false)
  material.diffuseTexture = texture
  material.specularColor = Color3.Black()
  return material
}

/** Une pièce fusionnée en un seul maillage, à l'origine du modèle (sa géométrie dans le repère de Babylon.js). */
async function pieceSource(scene: Scene, name: string, material: StandardMaterial): Promise<Mesh | null> {
  const container = await loadContainer(scene, `${DUNGEON}/${name}.glb`)
  const entries = container.instantiateModelsToScene((n) => `${name}-${n}`, false, { doNotInstantiate: true })
  const root = entries.rootNodes[0] as TransformNode
  const meshes = root.getChildMeshes(false).filter((m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0)
  const merged = meshes.length > 0 ? Mesh.MergeMeshes(meshes, true, true, undefined, false, false) : null
  root.dispose()
  if (!merged) return null
  merged.name = `piece-${name}`
  merged.material = material
  merged.isPickable = false
  merged.receiveShadows = true
  // Les instances s'étendent sur toute l'enfilade : la boîte du modèle seul ne dit rien de ce qui est visible.
  merged.alwaysSelectAsActiveMesh = true
  return merged
}

const matrixOf = (p: Piece): Matrix => Matrix.Compose(Vector3.One(), Quaternion.RotationAxis(Vector3.Up(), p.yaw), new Vector3(p.x, p.y, p.z))

async function buildDoor(scene: Scene, piece: Piece, material: StandardMaterial): Promise<Door> {
  const container = await loadContainer(scene, `${DUNGEON}/${piece.name}.glb`)
  const entries = container.instantiateModelsToScene((n) => `porte${piece.door}-${n}`, false)
  const root = new TransformNode(`porte-${piece.door}`, scene)
  const inner = entries.rootNodes[0] as TransformNode
  inner.parent = root
  root.position.set(piece.x, piece.y, piece.z)
  root.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), piece.yaw)
  for (const m of inner.getChildMeshes(false)) {
    m.material = material
    m.isPickable = false
    m.receiveShadows = true
  }
  const leaf = (inner.getDescendants(false).find((n) => /wall_doorway_door/.test(n.name)) as TransformNode | undefined) ?? null
  let base: Quaternion | null = null
  if (leaf) {
    base = leaf.rotationQuaternion?.clone() ?? Quaternion.FromEulerVector(leaf.rotation)
    leaf.rotationQuaternion = base.clone()
  }
  return { index: piece.door!, root, leaf, base, progress: 0, opening: false }
}

export async function buildLevel(scene: Scene, plan: LevelPlan, onProgress?: (label: string) => void): Promise<BuiltLevel> {
  const material = dungeonMaterial(scene)
  const names = [...new Set(plan.pieces.filter((p) => p.door === undefined).map((p) => p.name))].sort()
  const sources: Mesh[] = []
  const doors = new Map<number, Door>()
  const tick = (label: string) => onProgress?.(label)

  tick('Les salles')
  for (const name of names) {
    const mesh = await pieceSource(scene, name, material)
    if (!mesh) continue
    const matrices = plan.pieces.filter((p) => p.name === name && p.door === undefined).map(matrixOf)
    mesh.thinInstanceAdd(matrices)
    sources.push(mesh)
  }
  tick('Les portes')
  for (const piece of plan.pieces.filter((p) => p.door !== undefined)) doors.set(piece.door!, await buildDoor(scene, piece, material))

  const apply = (door: Door) => {
    if (door.leaf && door.base) {
      const angle = door.progress * DOOR_OPEN_ANGLE
      door.leaf.rotationQuaternion = door.base.multiply(Quaternion.RotationAxis(Vector3.Up(), -angle))
    }
  }
  return {
    material,
    sources,
    doors,
    openDoor(index, animate) {
      const door = doors.get(index)
      if (!door) return
      door.opening = true
      if (!animate) {
        door.progress = 1
        apply(door)
      }
    },
    update(dt) {
      for (const door of doors.values()) {
        if (!door.opening || door.progress >= 1) continue
        door.progress = Math.min(1, door.progress + dt / DOOR_SECONDS)
        apply(door)
      }
    },
    dispose() {
      for (const mesh of sources) mesh.dispose(false, false)
      for (const door of doors.values()) door.root.dispose(false, false)
      material.dispose(true, true)
    },
  }
}

