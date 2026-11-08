/**
 * Personnages animés KayKit (héros, habitants) et Quaternius (renard). Un .glb KayKit contient
 * toutes les armes et les 76 animations du pack : on cache les pièces non choisies (comme
 * Wardrobe.dress de la v1) et on passe d'une animation à l'autre en fondu.
 */
import {
  type AnimationGroup,
  type AbstractMesh,
  type AssetContainer,
  LoadAssetContainerAsync,
  type Scene,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import type { SaveData } from '../core/save'
import { boundsOf, loadContainer, MODELS } from './assets'

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
  // Combat : attaque, mort, réveil de l'ennemi, provocation, sommeil (squelettes), parade.
  | 'attack' | 'death' | 'awake' | 'taunt' | 'sleep' | 'block'

const KAYKIT_ANIMS: Record<Pose, string> = {
  idle: 'Idle',
  walk: 'Walking_A',
  run: 'Running_A',
  interact: 'Interact',
  cheer: 'Cheer',
  spell: 'Spellcast_Shoot',
  hit: 'Hit_A',
  attack: '1H_Melee_Attack_Chop',
  death: 'Death_A',
  awake: 'Skeletons_Awaken_Standing',
  taunt: 'Taunt',
  sleep: 'Skeleton_Inactive_Standing_Pose',
  block: 'Block_Hit',
}

/** Squelettes KayKit (ennemis) : même squelette que le héros, d'où les mêmes animations ; seuls l'attaque, le sommeil et le réveil changent. */
function skeletonAnims(model: string): Record<Pose, string> {
  const minion = model === 'Skeleton_Minion' // les sbires dorment couchés
  return {
    ...KAYKIT_ANIMS,
    idle: 'Idle_Combat',
    attack: model === 'Skeleton_Mage' ? 'Spellcast_Shoot' : model === 'Skeleton_Rogue' ? '1H_Melee_Attack_Stab' : '1H_Melee_Attack_Chop',
    sleep: minion ? 'Skeletons_Inactive_Floor_Pose' : 'Skeleton_Inactive_Standing_Pose',
    awake: minion ? 'Skeletons_Awaken_Floor' : 'Skeletons_Awaken_Standing',
  }
}

/** Monstres Quaternius : leurs animations portent d'autres noms (sans le préfixe « CharacterArmature| »), souvent une seule
 * pour plusieurs gestes. Pour chaque geste, la première animation que le modèle possède (repris de la v1 : MONSTER_ANIMS). */
const MONSTER_POSES: Record<'idle' | 'hit' | 'death' | 'attack' | 'awake' | 'taunt', string[]> = {
  idle: ['Idle', 'Flying_Idle', 'Dragon_Flying'],
  hit: ['HitReact', 'HitRecieve', 'Dragon_Hit'],
  death: ['Death', 'Dragon_Death'],
  attack: ['Punch', 'Bite_Front', 'Headbutt', 'Weapon', 'Dragon_Attack', 'Dragon_Attack2'],
  awake: ['Jump', 'Yes', 'Flying_Idle', 'Dragon_Flying'],
  taunt: ['Dance', 'Wave', 'Yes', 'Dragon_Attack2'],
}

function monsterAnims(available: Set<string>): Record<Pose, string> {
  const pick = (candidates: string[]) => candidates.find((n) => available.has(n)) ?? candidates[0]!
  const idle = pick(MONSTER_POSES.idle)
  const hit = pick(MONSTER_POSES.hit)
  const attack = pick(MONSTER_POSES.attack)
  const taunt = pick(MONSTER_POSES.taunt)
  return {
    idle, walk: idle, run: idle, sleep: idle, interact: taunt, cheer: taunt, spell: attack, block: hit,
    hit, attack, taunt, death: pick(MONSTER_POSES.death), awake: pick(MONSTER_POSES.awake),
  }
}

const FOX_ANIMS: Record<Pose, string> = {
  idle: 'Idle',
  walk: 'Walk',
  run: 'Gallop',
  interact: 'Eating',
  cheer: 'Gallop_Jump',
  spell: 'Idle_2',
  hit: 'Idle_HitReact_Left',
  attack: 'Idle_2',
  death: 'Idle_HitReact_Right',
  awake: 'Gallop_Jump',
  taunt: 'Idle_2',
  sleep: 'Idle',
  block: 'Idle_HitReact_Left',
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

  /**
   * Animation jouée une fois (geste, joie, coup), puis retour à l'animation en boucle `then` (null : le personnage garde
   * sa dernière image, comme à sa mort). Rend une promesse tenue à la fin du geste (tout de suite si le modèle ne l'a pas).
   */
  playOnce(pose: Pose, then: Pose | null = 'idle', speed = 1): Promise<void> {
    const group = this.anims.get(this.names[pose])
    if (!group) return Promise.resolve()
    this.current?.stop()
    this.current = null
    this.once = group
    group.start(false, speed)
    return new Promise((resolve) => {
      group.onAnimationGroupEndObservable.addOnce(() => {
        this.once = null
        if (then) this.play(then)
        resolve()
      })
    })
  }

  /** Durée d'un geste en secondes (0 si le modèle ne l'a pas) : pour caler la mise en scène. */
  duration(pose: Pose, speed = 1): number {
    const group = this.anims.get(this.names[pose])
    return group ? (group.to - group.from) / 60 / speed : 0
  }

  /** Coupe l'animation en cours (le geste joué une fois comme la boucle) et reprend `then`. */
  reset(then: Pose = 'idle'): void {
    this.once?.stop()
    this.once = null
    this.current?.stop()
    this.current = null
    this.play(then)
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
  names: Record<Pose, string> | ((available: Set<string>) => Record<Pose, string>),
  unique = false,
  fixedScale = 0,
): Promise<Character> {
  // Un modèle « unique » (renard, monstre) garde les nœuds de son fichier, armature comprise : un conteneur à lui, jamais partagé.
  const container = unique ? await loadOwnContainer(scene, path) : await loadContainer(scene, path)
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
  const poses = typeof names === 'function' ? names(new Set(anims.keys())) : names
  const character = new Character(root, meshes, anims, poses)
  character.play('idle')
  return character
}

/** Conteneur chargé pour un seul usage (pas de cache) : deux gelées dans un même lieu ont chacune leur armature. */
function loadOwnContainer(scene: Scene, path: string): Promise<AssetContainer> {
  return LoadAssetContainerAsync(`${MODELS}/${path}`, scene, { pluginOptions: { gltf: { alwaysComputeSkeletonRootNode: true } } })
}

/** Pose un personnage animé sur le sol : sommet le plus bas, squelette appliqué, ramené au pied de
 * `root`. Pour les modèles dont la boîte englobante au repos ne dit rien (renard Quaternius) ;
 * à appeler après une première image, quand les os sont calculés. */
export function settleOnGround(character: Character): void {
  const inner = character.root.getChildren()[0] as TransformNode | undefined
  if (!inner) return
  const base = character.root.getAbsolutePosition().y
  const { lowest } = skinnedHeights(character)
  if (Number.isFinite(lowest)) inner.position.y += base - lowest
}

/** Point le plus bas et le plus haut du personnage dans le monde, squelette appliqué (après une première image). */
export function skinnedHeights(character: Character): { lowest: number; highest: number } {
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

/** Squelette ennemi KayKit (même rig que le héros) ramené à `height` mètres, à son sommeil. */
export async function loadSkeleton(scene: Scene, model: string, name: string, height: number): Promise<Character> {
  const skeleton = await loadCharacter(scene, `kaykit/characters/${model}.glb`, name, height, skeletonAnims(model))
  skeleton.play('sleep')
  return skeleton
}

/** Monstre Quaternius à l'échelle `scale` (mesurée une fois : content/monde/monstres.json) ; à poser sur le sol après une première image. */
export function loadMonster(scene: Scene, model: string, name: string, scale: number): Promise<Character> {
  return loadCharacter(scene, `quaternius/monsters/${model}.glb`, name, 0, monsterAnims, true, scale)
}

/** Renard de Jules (monde lumineux). Son armature est à l'échelle 100 : le modèle mesure
 * 5,2 unités de long ; 0,21 en fait un renard d'un peu plus d'un mètre. */
export function loadFox(scene: Scene): Promise<Character> {
  return loadCharacter(scene, 'quaternius/Fox.glb', 'renard', 0, FOX_ANIMS, true, 0.21)
}
