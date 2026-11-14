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
import { isMonster, MONSTER_HEIGHTS, MONSTER_YAW, modelPath } from '../core/combat/monsters'
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

export type Pose =
  | 'idle' | 'walk' | 'run' | 'interact' | 'cheer' | 'spell' | 'hit'
  // Combat (intérieur des lieux)
  | 'attack' | 'block' | 'death' | 'taunt' | 'item' | 'sleep' | 'awaken' | 'combat'

/** Noms d'animation possibles pour chaque pose, du préféré au repli (le premier qui existe est joué). */
type PoseNames = Record<Pose, string[]>

const KAYKIT_ANIMS: PoseNames = {
  idle: ['Idle'],
  walk: ['Walking_A'],
  run: ['Running_A'],
  interact: ['Interact'],
  cheer: ['Cheer'],
  spell: ['Spellcast_Shoot', 'Spellcast_Raise'],
  hit: ['Hit_A', 'Hit_B'],
  attack: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '2H_Melee_Attack_Chop', 'Unarmed_Melee_Attack_Punch_A'],
  block: ['Block_Hit', 'Block'],
  death: ['Death_A', 'Death_B'],
  taunt: ['Taunt', 'Cheer'],
  item: ['Use_Item', 'Interact'],
  sleep: ['Skeleton_Inactive_Standing_Pose', 'Idle'],
  awaken: ['Skeletons_Awaken_Standing', 'Spawn_Ground', 'Cheer'],
  combat: ['Idle_Combat', 'Idle'],
}

/** Squelette « sbire » : couché, il se relève. */
const MINION_ANIMS: PoseNames = { ...KAYKIT_ANIMS, sleep: ['Skeletons_Inactive_Floor_Pose', 'Idle'], awaken: ['Skeletons_Awaken_Floor', 'Spawn_Ground', 'Cheer'] }

/** Monstres Quaternius : noms sans le préfixe « CharacterArmature| » (traduits des noms KayKit, comme dans la v1). */
const MONSTER_IDLE = ['Idle', 'Flying_Idle', 'Dragon_Flying']
const MONSTER_HIT = ['HitReact', 'HitRecieve', 'Dragon_Hit']
const MONSTER_ANIMS: PoseNames = {
  idle: MONSTER_IDLE,
  walk: MONSTER_IDLE,
  run: MONSTER_IDLE,
  interact: ['Yes', 'Wave', ...MONSTER_IDLE],
  cheer: ['Dance', 'Wave', 'Yes', ...MONSTER_IDLE],
  spell: ['Headbutt', 'Punch', 'Bite_Front', 'Dragon_Attack2'],
  hit: MONSTER_HIT,
  attack: ['Punch', 'Bite_Front', 'Headbutt', 'Dragon_Attack', 'Dragon_Attack2'],
  block: MONSTER_HIT,
  death: ['Death', 'Dragon_Death'],
  taunt: ['Dance', 'Wave', 'Yes', 'Dragon_Attack2', ...MONSTER_IDLE],
  item: MONSTER_IDLE,
  sleep: MONSTER_IDLE,
  awaken: ['Jump', 'Yes', 'Flying_Idle', 'Dragon_Flying'],
  combat: MONSTER_IDLE,
}

const FOX_ANIMS: PoseNames = {
  idle: ['Idle'],
  walk: ['Walk'],
  run: ['Gallop'],
  interact: ['Eating'],
  cheer: ['Gallop_Jump'],
  spell: ['Idle_2'],
  hit: ['Idle_HitReact_Left'],
  attack: ['Idle_2'],
  block: ['Idle_HitReact_Left'],
  death: ['Idle'],
  taunt: ['Gallop_Jump'],
  item: ['Eating'],
  sleep: ['Idle'],
  awaken: ['Gallop_Jump'],
  combat: ['Idle'],
}

export class Character {
  private current: AnimationGroup | null = null
  private once: AnimationGroup | null = null

  constructor(
    readonly root: TransformNode,
    readonly meshes: AbstractMesh[],
    private readonly anims: Map<string, AnimationGroup>,
    private readonly names: PoseNames,
    private readonly random: () => number = Math.random,
  ) {}

  /** Animations disponibles pour une pose, dans l'ordre de préférence. */
  private available(pose: Pose): AnimationGroup[] {
    return this.names[pose].flatMap((n) => {
      const g = this.anims.get(n)
      return g ? [g] : []
    })
  }

  /** Vrai si le modèle sait jouer cette pose. */
  can(pose: Pose): boolean {
    return this.available(pose).length > 0
  }

  /** Animation en boucle (sauf pendant une animation jouée une fois). */
  play(pose: Pose): void {
    if (this.once) return
    const group = this.available(pose)[0]
    if (!group || group === this.current) return
    this.current?.stop()
    group.start(true, 1)
    this.current = group
  }

  /**
   * Animation jouée une fois (geste, coup), puis retour à l'animation en boucle `then` (ou, avec
   * `then = null`, le personnage reste dans sa dernière position : mort). Une des animations
   * possibles est tirée au hasard. Rend la main à la fin, ou tout de suite si le modèle ne la connaît pas.
   */
  playOnce(pose: Pose, then: Pose | null = 'idle', speed = 1): Promise<void> {
    const options = this.available(pose)
    const group = options[Math.floor(this.random() * options.length)]
    if (!group) return Promise.resolve()
    this.once?.stop()
    this.current?.stop()
    this.current = null
    this.once = group
    return new Promise((resolve) => {
      group.start(false, speed)
      group.onAnimationGroupEndObservable.addOnce(() => {
        this.once = null
        if (then) this.play(then)
        resolve()
      })
    })
  }

  /** Immobilise l'animation en cours (personnage endormi : première image de la pose). */
  freeze(pose: Pose): void {
    this.play(pose)
    this.current?.pause()
  }

  /** Reprend après `freeze`. */
  thaw(): void {
    this.current?.play(true)
  }

  /** Quart de tour des modèles dessinés de profil (dragon) pour qu'ils fassent face à `yaw`. */
  yawOffset = 0

  set yaw(value: number) {
    this.root.rotation.y = value + this.yawOffset
  }

  get yaw(): number {
    return this.root.rotation.y - this.yawOffset
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
  names: PoseNames,
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

/** Hauteurs (monde) du sommet le plus bas et le plus haut d'un personnage animé, squelette appliqué. */
function skinnedExtent(character: Character): { lowest: number; highest: number } {
  let lowest = Infinity
  let highest = -Infinity
  for (const m of character.meshes) {
    if (m.getTotalVertices() === 0) continue
    const p = m.getPositionData(true, false)
    if (!p) continue
    const w = m.getWorldMatrix().m
    for (let i = 0; i < p.length; i += 3) {
      const y = p[i]! * w[1]! + p[i + 1]! * w[5]! + p[i + 2]! * w[9]! + w[13]!
      lowest = Math.min(lowest, y)
      highest = Math.max(highest, y)
    }
  }
  return { lowest, highest }
}

/** Pose un personnage animé sur le sol : sommet le plus bas, squelette appliqué, ramené au pied de
 * `root`. Pour les modèles dont la boîte englobante au repos ne dit rien (renard Quaternius) ;
 * à appeler après une première image, quand les os sont calculés. */
export function settleOnGround(character: Character): void {
  const inner = character.root.getChildren()[0] as TransformNode | undefined
  if (!inner) return
  const base = character.root.getAbsolutePosition().y
  const { lowest } = skinnedExtent(character)
  if (Number.isFinite(lowest)) inner.position.y += base - lowest
}

/** Ramène un personnage animé à `height` mètres (monstres Quaternius, dont la boîte au repos ne dit rien de la
 * taille réelle), puis le pose sur le sol. À appeler après une première image, comme `settleOnGround`. */
export function fitToHeight(character: Character, height: number): void {
  const inner = character.root.getChildren()[0] as TransformNode | undefined
  if (!inner) return
  const { lowest, highest } = skinnedExtent(character)
  if (!Number.isFinite(lowest) || highest - lowest < 0.01) return
  inner.scaling.scaleInPlace(height / (highest - lowest))
  character.root.computeWorldMatrix(true)
  for (const m of character.meshes) m.computeWorldMatrix(true)
  settleOnGround(character)
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

/** Taille visée d'un ennemi, en mètres : celle de son modèle (monstres) ou celle d'un humain, fois l'échelle du lieu. */
export const enemyHeight = (model: string, scale: number): number => (isMonster(model) ? MONSTER_HEIGHTS[model]! : 1.9) * scale

/**
 * Ennemi d'un lieu : squelette KayKit (mêmes animations que le héros) ou monstre Quaternius. Les
 * monstres sont mis à taille par `fitToHeight` après la première image.
 */
export async function loadEnemy(scene: Scene, model: string, name: string, scale: number): Promise<Character> {
  if (!isMonster(model)) {
    const names = model === 'Skeleton_Minion' ? MINION_ANIMS : KAYKIT_ANIMS
    return loadCharacter(scene, modelPath(model), name, enemyHeight(model, scale), names)
  }
  const monster = await loadCharacter(scene, modelPath(model), name, 0, MONSTER_ANIMS, false, 1)
  monster.yawOffset = ((MONSTER_YAW[model] ?? 0) * Math.PI) / 180
  return monster
}
