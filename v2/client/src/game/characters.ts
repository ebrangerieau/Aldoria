/**
 * Personnages animés KayKit (héros, habitants) et Quaternius (renard). Un .glb KayKit contient
 * toutes les armes et les 76 animations du pack : on cache les pièces non choisies (comme
 * Wardrobe.dress de la v1) et on passe d'une animation à l'autre en fondu.
 */
import {
  type AnimationGroup,
  type AbstractMesh,
  type Scene,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import type { SaveData } from '../core/save'
import { boundsOf, loadContainer } from './assets'

/** Pièces d'équipement de chaque silhouette (noms des nœuds glTF, repris de la v1). */
export const PARTS: Record<string, { main: string[]; off: string[]; head: string; cape: string }> = {
  Knight: {
    main: ['1H_Sword', '2H_Sword'],
    off: ['Round_Shield', 'Badge_Shield', 'Rectangle_Shield', 'Spike_Shield', '1H_Sword_Offhand'],
    head: 'Knight_Helmet',
    cape: 'Knight_Cape',
  },
  Barbarian: { main: ['1H_Axe', '2H_Axe', 'Mug'], off: ['Barbarian_Round_Shield', '1H_Axe_Offhand'], head: 'Barbarian_Hat', cape: 'Barbarian_Cape' },
  Mage: { main: ['1H_Wand', '2H_Staff'], off: ['Spellbook', 'Spellbook_open'], head: 'Mage_Hat', cape: 'Mage_Cape' },
  Rogue: { main: ['Knife', '1H_Crossbow', '2H_Crossbow'], off: ['Knife_Offhand', 'Throwable'], head: '', cape: 'Rogue_Cape' },
  Rogue_Hooded: { main: ['Knife', '1H_Crossbow', '2H_Crossbow'], off: ['Knife_Offhand', 'Throwable'], head: '', cape: 'Rogue_Cape' },
}

export type Pose = 'idle' | 'walk' | 'run' | 'interact' | 'cheer' | 'spell' | 'hit'

const KAYKIT_ANIMS: Record<Pose, string> = {
  idle: 'Idle',
  walk: 'Walking_A',
  run: 'Running_A',
  interact: 'Interact',
  cheer: 'Cheer',
  spell: 'Spellcast_Shoot',
  hit: 'Hit_A',
}

const FOX_ANIMS: Record<Pose, string> = {
  idle: 'Idle',
  walk: 'Walk',
  run: 'Gallop',
  interact: 'Eating',
  cheer: 'Gallop_Jump',
  spell: 'Idle_2',
  hit: 'Idle_HitReact_Left',
}

export class Character {
  private current: AnimationGroup | null = null
  private once: AnimationGroup | null = null

  constructor(
    readonly root: TransformNode,
    readonly meshes: AbstractMesh[],
    private readonly anims: Map<string, AnimationGroup>,
    private readonly names: Record<Pose, string>,
  ) {}

  /** Animation en boucle (sauf pendant une animation jouée une fois). */
  play(pose: Pose): void {
    if (this.once) return
    const group = this.anims.get(this.names[pose])
    if (!group || group === this.current) return
    this.current?.stop()
    group.start(true, 1)
    this.current = group
  }

  /** Animation jouée une fois (geste, joie), puis retour à l'animation en boucle. */
  playOnce(pose: Pose, then: Pose = 'idle'): void {
    const group = this.anims.get(this.names[pose])
    if (!group) return
    this.current?.stop()
    this.current = null
    this.once = group
    group.start(false, 1)
    group.onAnimationGroupEndObservable.addOnce(() => {
      this.once = null
      this.play(then)
    })
  }

  set yaw(value: number) {
    this.root.rotation.y = value
  }

  get yaw(): number {
    return this.root.rotation.y
  }
}

/** Charge un personnage, ramené à `height` mètres, pieds à l'origine de `root`.
 * `unique` : le modèle n'existe qu'une fois dans la scène (renard) ; on prend les nœuds du
 * fichier eux-mêmes au lieu d'une copie. Les modèles Quaternius ont une armature tournée de
 * -90° et mise à l'échelle 100 (export depuis Blender) que la copie ne garde pas. */
async function loadCharacter(
  scene: Scene,
  path: string,
  name: string,
  height: number,
  names: Record<Pose, string>,
  unique = false,
  fixedScale = 0,
): Promise<Character> {
  const container = await loadContainer(scene, path)
  let inner: TransformNode
  let groups: AnimationGroup[]
  if (unique) {
    container.addAllToScene()
    inner = container.rootNodes[0] as TransformNode
    groups = container.animationGroups
    for (const node of [...container.meshes, ...container.transformNodes]) node.name = `${name}-${node.name}`
    for (const group of groups) group.name = `${name}-${group.name}`
  } else {
    const entries = container.instantiateModelsToScene((n) => `${name}-${n}`, false, { doNotInstantiate: true })
    inner = entries.rootNodes[0] as TransformNode
    groups = entries.animationGroups
  }
  const root = new TransformNode(name, scene)
  inner.parent = root
  for (const group of groups) group.stop()
  const meshes = inner.getChildMeshes(false)
  // Taille prise sur le corps seul : une grande arme dépasserait de la tête.
  const body = meshes.filter((m) => /Body|Head|Leg|Arm/.test(m.name))
  if (fixedScale > 0) {
    // Taille connue : la boîte d'un maillage animé n'est pas fiable avant le premier rendu.
    inner.scaling.scaleInPlace(fixedScale)
  } else {
    const { min, max } = boundsOf(body.length > 0 ? body : meshes)
    const scale = height / Math.max(0.01, max.y - min.y)
    inner.scaling.scaleInPlace(scale)
    inner.position = new Vector3(0, -min.y * scale, 0)
  }
  for (const m of meshes) {
    m.isPickable = false
    m.receiveShadows = true
    // Maillage animé : sa boîte englobante ne suit pas l'animation, on ne le coupe jamais.
    m.alwaysSelectAsActiveMesh = true
    // Sans carte d'environnement, un matériau PBR métallique paraît noir : on le rend mat.
    const material = m.material as { metallic?: number | null; roughness?: number | null } | null
    if (material && typeof material.metallic === 'number') {
      material.metallic = Math.min(material.metallic, 0.05)
      material.roughness = Math.max(material.roughness ?? 1, 0.8)
    }
  }
  const anims = new Map<string, AnimationGroup>()
  for (const group of groups) {
    // Les noms clonés reçoivent le préfixe ; Quaternius préfixe aussi « CharacterArmature| ».
    const base = group.name.replace(`${name}-`, '').split('|').pop() ?? group.name
    anims.set(base, group)
  }
  const character = new Character(root, meshes, anims, names)
  character.play('idle')
  return character
}

/** Cache les pièces d'équipement non choisies (une arme par main, couvre-chef, cape). */
export function dress(character: Character, model: string, look: { main: string; off: string; head?: boolean; cape?: boolean }): void {
  const parts = PARTS[model]
  if (!parts) return
  const hidden = new Set([...parts.main, ...parts.off].filter((p) => p !== look.main && p !== look.off))
  if (look.head === false && parts.head) hidden.add(parts.head)
  if (look.cape === false && parts.cape) hidden.add(parts.cape)
  for (const mesh of character.meshes) {
    const node = mesh.name.replace(/^.*?-/, '').replace(/_primitive\d+$/, '')
    if (hidden.has(node)) mesh.setEnabled(false)
  }
}

export async function loadHero(scene: Scene, look: SaveData['look']): Promise<Character> {
  const model = look.model in PARTS ? look.model : 'Knight'
  const hero = await loadCharacter(scene, `kaykit/characters/${model}.glb`, 'heros', 1.75, KAYKIT_ANIMS)
  dress(hero, model, { main: look.main, off: look.off })
  return hero
}

export async function loadNpc(scene: Scene, model: string, name: string, main: string, off: string): Promise<Character> {
  const npc = await loadCharacter(scene, `kaykit/characters/${model}.glb`, name, 1.8, KAYKIT_ANIMS)
  dress(npc, model, { main, off })
  return npc
}

/** Renard de Jules (monde lumineux). Son armature est à l'échelle 100 : le modèle mesure
 * 5,2 unités de long ; 0,21 en fait un renard d'un peu plus d'un mètre. */
export function loadFox(scene: Scene): Promise<Character> {
  return loadCharacter(scene, 'quaternius/Fox.glb', 'renard', 0, FOX_ANIMS, true, 0.21)
}
