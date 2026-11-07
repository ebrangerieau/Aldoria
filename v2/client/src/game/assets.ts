/**
 * Chargement des modèles glTF repris de la v1 (KayKit, Quaternius : CC0), servis sans
 * empreinte depuis /ressources/models/. Un modèle se charge une fois (AssetContainer) puis
 * se copie : en instances pour les bâtiments, en « thin instances » (un seul appel de
 * dessin pour des centaines d'arbres) pour la végétation.
 */
import '@babylonjs/loaders/glTF'
import {
  type AbstractMesh,
  type AssetContainer,
  LoadAssetContainerAsync,
  Matrix,
  Mesh,
  Quaternion,
  type Scene,
  TransformNode,
  Vector3,
} from '@babylonjs/core'

export const MODELS = '/ressources/models'

const containers = new Map<string, Promise<AssetContainer>>()

export function loadContainer(scene: Scene, path: string): Promise<AssetContainer> {
  let promise = containers.get(path)
  if (!promise) {
    promise = LoadAssetContainerAsync(`${MODELS}/${path}`, scene)
    containers.set(path, promise)
  }
  return promise
}

/** Boîte englobante d'un ensemble de maillages (coordonnées du monde). */
export function boundsOf(meshes: AbstractMesh[]): { min: Vector3; max: Vector3 } {
  const min = new Vector3(Infinity, Infinity, Infinity)
  const max = new Vector3(-Infinity, -Infinity, -Infinity)
  for (const m of meshes) {
    if (m.getTotalVertices() === 0) continue
    m.computeWorldMatrix(true)
    const box = m.getBoundingInfo().boundingBox
    min.minimizeInPlace(box.minimumWorld)
    max.maximizeInPlace(box.maximumWorld)
  }
  return { min, max }
}

/** Un modèle fusionné en un seul maillage, base posée à y = 0, centré en x et z, prêt à
 * recevoir des thin instances. `height` : hauteur visée en mètres. */
export async function mergedModel(scene: Scene, path: string, height: number): Promise<{ mesh: Mesh; radius: number }> {
  const container = await loadContainer(scene, path)
  const entries = container.instantiateModelsToScene((name) => `${name}-fusion`, false, { doNotInstantiate: true })
  const root = entries.rootNodes[0] as TransformNode
  const meshes = root.getChildMeshes(false).filter((m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0)
  const merged = Mesh.MergeMeshes(meshes, true, true, undefined, false, true)
  root.dispose()
  if (!merged) throw new Error(`Modèle vide : ${path}`)
  merged.name = path
  const { min, max } = boundsOf([merged])
  const scale = height / Math.max(0.01, max.y - min.y)
  const center = min.add(max).scale(0.5)
  merged.bakeTransformIntoVertices(Matrix.Translation(-center.x, -min.y, -center.z).multiply(Matrix.Scaling(scale, scale, scale)))
  merged.refreshBoundingInfo()
  merged.isPickable = false
  const radius = (Math.max(max.x - min.x, max.z - min.z) * scale) / 2
  return { mesh: merged, radius }
}

/** Copie d'un modèle (instances partageant la géométrie), base à y = 0 et à la hauteur
 * voulue, posée en (x, y, z) et tournée de `yaw` radians. */
export async function placeModel(
  scene: Scene,
  path: string,
  height: number,
  at: Vector3,
  yaw: number,
  name: string,
): Promise<{ root: TransformNode; meshes: AbstractMesh[]; radius: number }> {
  const container = await loadContainer(scene, path)
  const entries = container.instantiateModelsToScene(() => name, false)
  const inner = entries.rootNodes[0] as TransformNode
  const root = new TransformNode(name, scene)
  inner.parent = root
  const meshes = inner.getChildMeshes(false)
  const { min, max } = boundsOf(meshes)
  const scale = height / Math.max(0.01, max.y - min.y)
  root.scaling.setAll(scale)
  root.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), yaw)
  // La rotation se fait autour de l'origine du modèle : on la recentre.
  const offset = new Vector3(((min.x + max.x) / 2) * scale, 0, ((min.z + max.z) / 2) * scale)
  const rotated = offset.applyRotationQuaternion(root.rotationQuaternion)
  root.position.set(at.x - rotated.x, at.y - min.y * scale, at.z - rotated.z)
  for (const m of meshes) {
    m.receiveShadows = true
    m.isPickable = false
  }
  const radius = (Math.max(max.x - min.x, max.z - min.z) * scale) / 2
  return { root, meshes, radius }
}
