/**
 * Intérieur d'un lieu de quête : le donjon en enfilade de core/world/dungeon.ts, dressé dans une scène
 * Babylon.js à part (même moteur, même canevas que l'île). L'île est mise en pause pendant qu'on est
 * dedans (GameWorld.enterPlace) et reprend où elle en était au retour.
 *
 * Vue en coupe, comme dans la v1 : la caméra reste au sud, dans un arc devant le héros (la souris
 * l'incline un peu, la molette rapproche) ; le côté sud des salles est ouvert, donc aucun mur ne la
 * masque. Le héros marche sur la hauteur de core/world/dungeon.ts (escaliers compris) ; ses murs sont
 * le « vide » que le déplacement refuse. Les modèles KayKit « dungeon » sont posés à leur taille
 * d'origine (instances, un appel de dessin par modèle et par matériau).
 *
 * Cette étape (1.2) : traverser les six salles et en sortir. Les ennemis, le boss, l'énigme et le
 * coffre arrivent aux étapes suivantes (IMPLEMENTATION_PLAN.md).
 */
import {
  type AbstractEngine,
  type AbstractMesh,
  ArcRotateCamera,
  CascadedShadowGenerator,
  Color3,
  Color4,
  DefaultRenderingPipeline,
  DirectionalLight,
  HemisphericLight,
  ImageProcessingConfiguration,
  Light,
  Matrix,
  MeshBuilder,
  PointLight,
  Quaternion,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import { Combatant, type CombatEvent } from '../core/combat/encounter'
import { Emitter } from '../core/events'
import type { SaveData } from '../core/save'
import { AGGRO_DISTANCE, Dungeon, ENEMY_RADIUS, type Piece } from '../core/world/dungeon'
import { HERO_HEIGHT, isSkeleton, monsterFit } from '../core/world/monsters'
import { angleDelta, RUN_SPEED, step, WALK_SPEED } from '../core/world/movement'
import { Obstacles } from '../core/world/obstacles'
import type { EnemySpec, Place } from '../core/world/places'
import { loadContainer } from './assets'
import { type Character, loadHero, loadMonster, loadSkeleton, settleOnGround } from './characters'
import type { Interactable } from './GameWorld'
import type { Quality } from './quality'
import { INTERIORS, type WorldName } from './theme'

/** Cap (0 nord, sens des aiguilles d'une montre) de la face avant d'un modèle chargé, sans rotation : la face avant (+Z du
 * fichier glTF, celle où monte un escalier, où saille une torche) regarde le nord. Mesuré sur l'escalier et les bannières. */
const FRONT_HEADING = 0
/** Le battant des portes s'ouvre de cet angle autour de sa charnière (radians), vers l'est : dans la salle de la porte, jamais
 * sur l'escalier qui y mène. Signe mesuré sur la boîte du battant (la porte de la salle i doit tenir dans x ≥ 16·i). */
const DOOR_OPEN_ANGLE = -1.75
/** Torches allumées : celles de la salle du héros et de ses voisines. */
const TORCH_REACH = 1
/** Arc de la caméra autour du sud (radians de part et d'autre). */
const ARC = 0.55

export interface Enemy {
  id: string
  room: number
  spec: EnemySpec
  character: Character
  /** Ses points de vie : un combat repris après un repli le retrouve blessé (rien n'est perdu). */
  combatant: Combatant
  defeated: boolean
  /** Désarmé après un repli : il ne se réengage qu'une fois le héros éloigné. */
  armed: boolean
  /** Son obstacle rond : retiré à sa chute, le héros marche sur sa dépouille. */
  obstacle: { x: number; z: number; r: number }
  x: number
  z: number
}

export type FloatTone = 'good' | 'bad' | 'crit' | 'plain'

export type InteriorEvents = {
  focus: Interactable | null
  interact: Interactable
  room: { index: number; label: string }
  /** Le héros a approché un ennemi : l'interface lance le combat (`beginFight`, `present`, `endFight`). */
  fight: Enemy
  /** Nombre flottant (dégâts, soin), en pixels de l'écran. */
  float: { text: string; tone: FloatTone; x: number; y: number }
  /** La porte `index` (entre la salle `index` et la suivante) s'ouvre. */
  door: { index: number }
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms))
const easeOutBack = (t: number): number => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2

export interface InteriorOptions {
  place: Place
  world: WorldName
  look: SaveData['look']
  quality: Quality
  /** Aménagement « mode calme » : pas de flammes qui vacillent. */
  calm: boolean
  onProgress?: (label: string, ratio: number) => void
}

export class InteriorWorld {
  readonly events = new Emitter<InteriorEvents>()
  readonly scene: Scene
  readonly dungeon: Dungeon
  hero!: Character
  camera!: ArcRotateCamera
  private obstacles = new Obstacles()
  private keys = new Set<string>()
  private inputEnabled = true
  private interactables: Interactable[] = []
  private focused: Interactable | null = null
  private room = -1
  private torches: { light: PointLight; room: number }[] = []
  /** Battants de porte : la porte k est dans le mur ouest de la salle k + 1. */
  private leaves = new Map<number, { mesh: AbstractMesh; closed: Quaternion; open: Quaternion }>()
  enemies: Enemy[] = []
  /** L'ennemi du combat en cours : le héros ne marche plus. */
  fighting: Enemy | null = null
  private shadows!: CascadedShadowGenerator
  private focusTarget: Vector3 | null = null
  private radiusGoal: number | null = null
  private savedRadius = 11
  private shake = 0
  private flames: AbstractMesh | null = null
  private flameTime = 0
  private pipeline: DefaultRenderingPipeline | null = null
  private disposers: (() => void)[] = []
  private loop: (() => void) | null = null
  private last = 0

  private constructor(
    private readonly engine: AbstractEngine,
    private readonly canvas: HTMLCanvasElement,
    private readonly options: InteriorOptions,
  ) {
    this.scene = new Scene(engine)
    this.dungeon = new Dungeon(options.place.dungeon.rooms.length, undefined, options.place.dungeon.v1_decor)
  }

  static async create(engine: AbstractEngine, canvas: HTMLCanvasElement, options: InteriorOptions): Promise<InteriorWorld> {
    const interior = new InteriorWorld(engine, canvas, options)
    await interior.build()
    return interior
  }

  private progress(label: string, ratio: number): void {
    this.options.onProgress?.(label, ratio)
  }

  private async build(): Promise<void> {
    const { scene, dungeon } = this
    const { quality, world, place } = this.options
    const theme = INTERIORS[world]
    const background = Color3.FromHexString(theme.background)
    scene.clearColor = new Color4(background.r, background.g, background.b, 1)
    scene.skipPointerMovePicking = true

    const start = dungeon.entryPoint(0)
    this.camera = new ArcRotateCamera('camera-interieur', -Math.PI / 2, 1.05, 11, new Vector3(start.x, start.y + 1.45, start.z), scene)
    this.setupCamera()

    // Lumière : ambiance douce, soleil rasant par le côté sud ouvert (ombres), torches contre le mur nord.
    const hemi = new HemisphericLight('ambiance', new Vector3(0, 1, 0), scene)
    hemi.diffuse = Color3.FromHexString(theme.ambient)
    hemi.groundColor = background.scale(2.5)
    hemi.specular = Color3.Black()
    hemi.intensity = theme.ambientIntensity
    const sun = new DirectionalLight('soleil-interieur', new Vector3(0.35, -0.8, 0.5).normalize(), scene)
    sun.position = new Vector3(-30, 60, -60)
    sun.diffuse = Color3.FromHexString(theme.sunColor)
    sun.specular = Color3.Black()
    sun.intensity = theme.sunIntensity
    const shadows = new CascadedShadowGenerator(quality.shadowMapSize, sun, undefined, this.camera)
    shadows.numCascades = Math.min(2, quality.shadowCascades)
    shadows.shadowMaxZ = 45
    shadows.lambda = 0.7
    shadows.stabilizeCascades = true
    shadows.depthClamp = true
    shadows.usePercentageCloserFiltering = true
    shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM
    shadows.bias = 0.004
    shadows.normalBias = 0.02
    shadows.darkness = 0.3

    this.shadows = shadows
    // Les portes de sortie des salles de combat sont fermées jusqu'à la victoire (l'entrée et l'énigme s'ouvrent d'elles-mêmes).
    dungeon.lockDoors(place.dungeon.rooms.map((r) => r.kind))
    this.progress('Les salles', 0.1)
    await this.buildPieces(shadows)
    this.progress('Les torches', 0.7)
    this.buildTorches()
    for (const c of dungeon.obstacles()) this.obstacles.add(c)

    this.progress('Le héros', 0.8)
    this.hero = await loadHero(scene, this.options.look)
    this.hero.root.position.set(start.x, start.y, start.z)
    this.hero.yaw = Math.PI / 2 // vers l'est : la porte, puis l'escalier
    for (const m of this.hero.meshes) shadows.addShadowCaster(m, false)
    this.progress('Les ennemis', 0.9)
    await this.buildEnemies()

    // La sortie : la porte du mur ouest de la première salle.
    this.interactables.push({ id: 'sortie', kind: 'sortie', label: `Sortir : ${place.dungeon.title}`, x: 1, z: start.z, radius: 1.4 })
    this.setupInput()
    this.setupPipeline()
    // Les matériaux des modèles ne lisent par défaut que quatre lumières : ambiance, soleil et six torches en demandent huit.
    for (const material of scene.materials) {
      if ('maxSimultaneousLights' in material) (material as { maxSimultaneousLights: number }).maxSimultaneousLights = 8
    }
    this.updateRoom(true)
    this.progress("L'intérieur est prêt", 1)
  }

  // --- Décor ------------------------------------------------------------------------------

  private async buildPieces(shadows: CascadedShadowGenerator): Promise<void> {
    const { scene, dungeon } = this
    const pieces = dungeon.pieces()
    const models = [...new Set(pieces.map((p) => p.model))]
    await Promise.all(models.map((m) => loadContainer(scene, `kaykit/dungeon/${m}.glb`)))
    for (const piece of pieces) {
      const placed = await this.place(piece)
      for (const m of placed) {
        m.receiveShadows = true
        m.isPickable = false
        if (piece.role !== 'sol') shadows.addShadowCaster(m, false)
      }
    }
  }

  /** Pose une pièce ; rend ses maillages. Une porte s'ouvre : son battant pivote sur sa charnière. */
  private async place(piece: Piece): Promise<AbstractMesh[]> {
    const container = await loadContainer(this.scene, `kaykit/dungeon/${piece.model}.glb`)
    const entries = container.instantiateModelsToScene((name) => `${piece.role}-${piece.room}-${name}`, false)
    const inner = entries.rootNodes[0] as TransformNode
    const wrap = new TransformNode(`${piece.role}-${piece.room}`, this.scene)
    inner.parent = wrap
    wrap.position.set(piece.x, piece.y, piece.z)
    wrap.rotation.y = ((piece.heading - FRONT_HEADING) * Math.PI) / 180
    if (piece.scaleY !== undefined) wrap.scaling.y = piece.scaleY
    const meshes = inner.getChildMeshes(false)
    let leaf: AbstractMesh | undefined
    if (piece.role === 'porte') {
      leaf = meshes.find((m) => m.name.endsWith('wall_doorway_door'))
      if (leaf) {
        const closed = leaf.rotationQuaternion?.clone() ?? Quaternion.Identity()
        const open = Quaternion.RotationAxis(Vector3.Up(), DOOR_OPEN_ANGLE).multiply(closed)
        // La porte k est dans le mur ouest de la salle k + 1 ; celle de la première salle (la sortie) reste ouverte.
        const door = piece.room - 1
        leaf.rotationQuaternion = door < 0 || this.dungeon.isDoorOpen(door) ? open : closed
        this.leaves.set(door, { mesh: leaf, closed, open })
      }
    }
    wrap.computeWorldMatrix(true)
    for (const m of meshes) {
      m.computeWorldMatrix(true)
      if (m !== leaf) m.freezeWorldMatrix() // le battant pivote : son repère reste libre
    }
    return meshes
  }

  // --- Ennemis ----------------------------------------------------------------------------

  /** Les ennemis des salles de combat (le boss : étape 1.4) : un modèle chacun, endormi à sa place de la v1, tourné vers l'ouest. */
  private async buildEnemies(): Promise<void> {
    const jobs: Promise<void>[] = []
    this.options.place.dungeon.rooms.forEach((room, index) => {
      if (room.kind === 'boss') return
      for (const [k, spec] of (room.enemies ?? []).entries()) jobs.push(this.spawn(index, k, spec))
    })
    await Promise.all(jobs)
    const monsters = this.enemies.filter((e) => !isSkeleton(e.spec.model)).map((e) => e.character)
    // Un monstre Quaternius se pose sur le sol une fois ses os calculés (première image).
    this.scene.onAfterRenderObservable.addOnce(() => monsters.forEach(settleOnGround))
  }

  private async spawn(room: number, k: number, spec: EnemySpec): Promise<void> {
    const at = this.dungeon.enemyPoint(room, spec.v1_at)
    const name = `ennemi-${room}-${k}`
    const stretch = spec.scale ?? 1
    const fit = monsterFit(spec.model)
    const character = fit
      ? await loadMonster(this.scene, spec.model, name, fit.scale * stretch)
      : await loadSkeleton(this.scene, spec.model, name, HERO_HEIGHT * stretch)
    character.root.position.set(at.x, this.dungeon.heightAt(at.x, at.z), at.z)
    character.yaw = -Math.PI / 2 + (fit?.yaw ?? 0) // tourné vers l'ouest, d'où vient le héros
    for (const m of character.meshes) this.shadows.addShadowCaster(m, false)
    const obstacle = { x: at.x, z: at.z, r: ENEMY_RADIUS }
    this.obstacles.add(obstacle)
    this.enemies.push({
      id: name, room, spec, character, combatant: new Combatant(spec.name, spec.hp), defeated: false, armed: true, obstacle, x: at.x, z: at.z,
    })
  }

  /** Les ennemis de la salle encore debout. */
  enemiesLeft(room: number): number {
    return this.enemies.filter((e) => e.room === room && !e.defeated).length
  }

  // --- Portes -----------------------------------------------------------------------------

  /** Ouvre la porte `index` (entre la salle `index` et la suivante) : le passage se libère et le battant pivote. */
  openDoor(index: number, animate = true): void {
    if (this.dungeon.isDoorOpen(index)) return
    this.dungeon.openDoor(index)
    const leaf = this.leaves.get(index)
    if (leaf) {
      if (!animate) leaf.mesh.rotationQuaternion = leaf.open
      else {
        let t = 0
        const observer = this.scene.onBeforeRenderObservable.add(() => {
          t = Math.min(1, t + this.engine.getDeltaTime() / 800)
          leaf.mesh.rotationQuaternion = Quaternion.Slerp(leaf.closed, leaf.open, easeOutBack(t))
          if (t >= 1) this.scene.onBeforeRenderObservable.remove(observer)
        })
      }
    }
    this.events.emit('door', { index })
  }

  // --- Combat : l'interface mène le déroulé, la scène le met en scène -----------------------------

  /** Ce que le héros aborde : l'ennemi de sa salle le plus proche, à moins de AGGRO_DISTANCE, s'il n'est ni vaincu ni désarmé. */
  private nearestFoe(): Enemy | null {
    const p = this.hero.root.position
    let best: Enemy | null = null
    let bestD = AGGRO_DISTANCE
    for (const e of this.enemies) {
      if (e.defeated || e.room !== this.room) continue
      const d = Math.hypot(p.x - e.x, p.z - e.z)
      if (!e.armed) {
        e.armed = d > AGGRO_DISTANCE + 1 // s'éloigner pour réessayer (après un repli)
        continue
      }
      if (d < bestD) {
        best = e
        bestD = d
      }
    }
    return best
  }

  /** Le héros se met en place pendant que l'ennemi se réveille ; la caméra cadre les deux. */
  async beginFight(enemy: Enemy): Promise<void> {
    this.fighting = enemy
    this.setInputEnabled(false)
    this.focused = null
    this.events.emit('focus', null)
    const spot = this.dungeon.fightSpot(enemy.room, enemy)
    const from = this.hero.root.position.clone()
    const to = new Vector3(spot.x, this.dungeon.heightAt(spot.x, spot.z), spot.z)
    this.hero.yaw = Math.atan2(to.x - from.x, to.z - from.z)
    this.hero.play('run')
    const woke = enemy.character.playOnce('awake', 'idle')
    this.savedRadius = this.camera.radius
    this.radiusGoal = 10
    this.focusTarget = to.add(enemy.character.root.position).scale(0.5).add(new Vector3(0, 1.3, 0))
    const duration = 450
    const started = performance.now()
    await new Promise<void>((resolve) => {
      const observer = this.scene.onBeforeRenderObservable.add(() => {
        const k = Math.min(1, (performance.now() - started) / duration)
        this.hero.root.position.copyFrom(Vector3.Lerp(from, to, k))
        if (k >= 1) {
          this.scene.onBeforeRenderObservable.remove(observer)
          resolve()
        }
      })
    })
    this.hero.play('idle')
    this.hero.yaw = Math.PI / 2 // face à l'est : l'ennemi
    enemy.character.yaw = -Math.PI / 2 + (monsterFit(enemy.spec.model)?.yaw ?? 0)
    await Promise.race([woke, wait(1200)]) // un réveil trop long ne retient pas le combat
    enemy.character.play('idle')
    await wait(300)
  }

  /** Raconte ce qui s'est passé, dans l'ordre : coup, soin, riposte, chute. */
  async present(events: CombatEvent[], landed?: (event: CombatEvent) => void): Promise<void> {
    const enemy = this.fighting
    if (!enemy) return
    const foe = enemy.character
    const hero = this.hero
    const above = (c: Character, y: number) => c.root.position.add(new Vector3(0, y, 0))
    for (const e of events) {
      switch (e.kind) {
        case 'xp':
          landed?.(e)
          break
        case 'hero_strike': {
          void hero.playOnce(e.action === 'chapitre' ? 'spell' : 'attack', 'idle', e.crit ? 1 : 1.2)
          await wait(e.action === 'chapitre' ? 450 : 350)
          landed?.(e)
          void foe.playOnce('hit', 'idle')
          this.float(`${e.power}${e.crit ? ' !' : ''}`, e.crit ? 'crit' : 'plain', above(foe, 1.4))
          this.shakeCamera(e.crit ? 0.35 : 0.18)
          await wait(e.crit ? 750 : 550)
          break
        }
        case 'hero_heal':
          void hero.playOnce('cheer', 'idle')
          landed?.(e)
          this.float(`+${e.healed}`, 'good', above(hero, 2.1))
          await wait(700)
          break
        case 'hero_stumble':
          void hero.playOnce('block', 'idle', 0.8)
          await wait(500)
          break
        case 'foe_attack':
          void foe.playOnce('attack', 'idle')
          await wait(450)
          landed?.(e)
          if (e.blocked) this.float('Bloqué !', 'good', above(hero, 2.1))
          else {
            void hero.playOnce('hit', 'idle')
            this.float(`-${e.damage}`, 'bad', above(hero, 2.1))
            this.shakeCamera(0.12)
          }
          await wait(600)
          break
        case 'foe_down':
          landed?.(e)
          void foe.playOnce('death', null)
          await wait(1400)
          break
        case 'hero_down':
          landed?.(e)
          void hero.playOnce('death', null)
          await wait(1500)
          break
        default:
          break
      }
    }
  }

  /** Fin du combat : la victoire laisse l'ennemi à terre ; un repli remet le héros à l'entrée de la salle (l'ennemi garde ses blessures). */
  async endFight(outcome: 'victory' | 'retreat'): Promise<void> {
    const enemy = this.fighting
    if (!enemy) return
    if (outcome === 'victory') {
      enemy.defeated = true
      this.obstacles.remove(enemy.obstacle)
      this.hero.play('idle')
    } else {
      enemy.armed = false
      enemy.character.reset('idle')
      enemy.character.yaw = -Math.PI / 2 + (monsterFit(enemy.spec.model)?.yaw ?? 0)
      this.hero.reset('idle')
      const entry = this.dungeon.entryPoint(enemy.room)
      this.hero.root.position.set(entry.x, entry.y, entry.z)
      this.hero.yaw = Math.PI / 2
      this.camera.target.set(entry.x, entry.y + 1.45, entry.z)
    }
    this.focusTarget = null
    this.radiusGoal = this.savedRadius
    this.fighting = null
    this.room = -1 // la salle est annoncée de nouveau
    this.updateRoom(true)
    this.setInputEnabled(true)
  }

  /** Hors du combat, le héros revient à sa pose (par exemple après sa chute). */
  reviveHero(): void {
    this.hero.reset('idle')
  }

  private float(text: string, tone: FloatTone, at: Vector3): void {
    const p = Vector3.Project(
      at,
      Matrix.Identity(),
      this.scene.getTransformMatrix(),
      this.camera.viewport.toGlobal(this.engine.getRenderWidth(), this.engine.getRenderHeight()),
    )
    const k = this.canvas.clientWidth / this.engine.getRenderWidth()
    this.events.emit('float', { text, tone, x: p.x * k, y: p.y * k })
  }

  private shakeCamera(amount: number): void {
    if (!this.options.calm) this.shake = Math.max(this.shake, amount)
  }

  private buildTorches(): void {
    const color = this.dungeon.decor.torch_color ?? INTERIORS[this.options.world].torchColor
    const torch = Color3.FromArray(color)
    const lit = this.options.quality.name !== 'bas'
    const flame = MeshBuilder.CreateSphere('flamme', { diameter: 0.28, segments: 6 }, this.scene)
    const material = new StandardMaterial('flamme', this.scene)
    material.disableLighting = true
    material.emissiveColor = torch.scale(1.4)
    material.diffuseColor = Color3.Black()
    flame.material = material
    flame.isPickable = false
    const matrices: number[] = []
    for (const t of this.dungeon.torches()) {
      Matrix.Compose(new Vector3(1, 1.7, 1), Quaternion.Identity(), new Vector3(t.x, t.y - 0.3, t.z + 0.2)).copyToArray(matrices, matrices.length)
      if (!lit) continue
      const light = new PointLight(`torche-${t.room}-${t.x}`, new Vector3(t.x, t.y, t.z + 0.2), this.scene)
      light.diffuse = torch
      light.specular = Color3.Black()
      light.intensity = 1.6
      light.range = 11
      light.falloffType = Light.FALLOFF_STANDARD
      light.setEnabled(false)
      this.torches.push({ light, room: t.room })
    }
    flame.thinInstanceSetBuffer('matrix', new Float32Array(matrices), 16)
    flame.alwaysSelectAsActiveMesh = true
    this.flames = flame
  }

  // --- Caméra, commandes ------------------------------------------------------------------

  private setupCamera(): void {
    const camera = this.camera
    camera.lowerRadiusLimit = 7
    camera.upperRadiusLimit = 16
    camera.lowerAlphaLimit = -Math.PI / 2 - ARC
    camera.upperAlphaLimit = -Math.PI / 2 + ARC
    camera.lowerBetaLimit = 0.75
    camera.upperBetaLimit = 1.35
    camera.wheelDeltaPercentage = 0.01
    camera.panningSensibility = 0
    camera.angularSensibilityX = 1400
    camera.angularSensibilityY = 1400
    camera.minZ = 0.3
    camera.maxZ = 400
    camera.fov = 0.9
    camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput')
    camera.attachControl(this.canvas, true)
    this.disposers.push(() => camera.detachControl())
  }

  private setupInput(): void {
    const isTyping = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
    const down = (e: KeyboardEvent) => {
      if (isTyping(e) || !this.inputEnabled) return
      this.keys.add(e.code)
      if ((e.code === 'KeyE' || e.code === 'Enter') && this.focused) {
        e.preventDefault()
        this.interact(this.focused)
      }
    }
    const up = (e: KeyboardEvent) => this.keys.delete(e.code)
    const blur = () => this.keys.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    this.disposers.push(() => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    })
  }

  private setupPipeline(): void {
    const { quality } = this.options
    const pipeline = new DefaultRenderingPipeline('rendu-interieur', true, this.scene, [this.camera])
    pipeline.samples = quality.msaa
    pipeline.fxaaEnabled = quality.msaa <= 1
    pipeline.bloomEnabled = quality.bloom
    pipeline.bloomThreshold = 0.8
    pipeline.bloomWeight = 0.3
    pipeline.bloomKernel = 48
    pipeline.bloomScale = 0.5
    pipeline.imageProcessingEnabled = true
    pipeline.imageProcessing.toneMappingEnabled = true
    pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES
    pipeline.imageProcessing.exposure = 1.1
    pipeline.imageProcessing.contrast = 1.1
    pipeline.imageProcessing.vignetteEnabled = true
    pipeline.imageProcessing.vignetteWeight = 1.8
    pipeline.imageProcessing.vignetteColor = new Color4(0.04, 0.03, 0.06, 0)
    this.pipeline = pipeline
  }

  /** L'interface prend la main (dialogue) : le héros s'arrête. */
  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled
    if (!enabled) this.keys.clear()
  }

  private direction(): { x: number; z: number; walk: boolean } {
    const k = this.keys
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0)
    const r = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0)
    const walk = k.has('ShiftLeft') || k.has('ShiftRight')
    if (f === 0 && r === 0) return { x: 0, z: 0, walk }
    // Avant = direction du regard de la caméra, à plat (le nord, la caméra étant au sud) ; droite = avant tourné d'un quart de tour.
    const fx = -Math.cos(this.camera.alpha)
    const fz = -Math.sin(this.camera.alpha)
    return { x: fx * f + fz * r, z: fz * f - fx * r, walk }
  }

  // --- Boucle -----------------------------------------------------------------------------

  /** Lance le rendu de cette scène (l'appelant a arrêté celui de l'île). */
  start(): void {
    this.updateRoom(true) // annonce la salle de départ à ceux qui viennent de s'abonner
    this.last = performance.now()
    this.loop = () => {
      const now = performance.now()
      const dt = Math.min(0.05, (now - this.last) / 1000)
      this.last = now
      this.update(dt)
      this.scene.render()
    }
    this.engine.runRenderLoop(this.loop)
  }

  stop(): void {
    if (this.loop) this.engine.stopRenderLoop(this.loop)
    this.loop = null
    this.keys.clear()
  }

  private update(dt: number): void {
    const free = this.inputEnabled && !this.fighting
    const dir = free ? this.direction() : { x: 0, z: 0, walk: false }
    const p = this.hero.root.position
    const s = step({ x: p.x, z: p.z }, dir, dir.walk ? WALK_SPEED : RUN_SPEED, dt, this.dungeon, this.obstacles)
    const moving = s.moved > 0.001
    p.x = s.x
    p.z = s.z
    if (!this.fighting) p.y += (s.y - p.y) * Math.min(1, dt * 18)
    if (this.fighting) {
      // Le héros reste sur place (beginFight le déplace lui-même, la mise en scène l'anime).
    } else if (moving) {
      this.hero.yaw = this.hero.yaw + angleDelta(this.hero.yaw, Math.atan2(dir.x, dir.z)) * Math.min(1, dt * 12)
      this.hero.play(dir.walk ? 'walk' : 'run')
    } else {
      this.hero.play('idle')
    }
    // La caméra suit en place (réaffecter `camera.target` annulerait le mouvement de la souris) ; pendant un combat, elle cadre les deux.
    const goal = this.focusTarget ?? new Vector3(p.x, p.y + 1.45, p.z)
    this.camera.target.copyFrom(Vector3.Lerp(this.camera.target, goal, 1 - Math.exp(-(this.focusTarget ? 6 : 14) * dt)))
    if (this.radiusGoal !== null) {
      this.camera.radius += (this.radiusGoal - this.camera.radius) * (1 - Math.exp(-4 * dt))
      if (Math.abs(this.radiusGoal - this.camera.radius) < 0.05) this.radiusGoal = null
    }
    if (this.shake > 0.001) {
      this.camera.target.x += (Math.random() - 0.5) * this.shake
      this.camera.target.y += (Math.random() - 0.5) * this.shake * 0.6
      this.shake *= Math.exp(-9 * dt)
    }
    this.updateRoom(false)
    if (!this.fighting) {
      const foe = this.nearestFoe()
      if (foe) {
        this.fighting = foe // posé tout de suite : un seul combat à la fois
        this.events.emit('fight', foe)
        return
      }
      this.updateFocus()
    }
    if (this.flames && !this.options.calm) {
      this.flameTime += dt
      this.flames.visibility = 0.9 + 0.1 * Math.sin(this.flameTime * 14)
    }
  }

  /** Salle du héros : annoncée à l'interface ; seules les torches des salles voisines sont allumées. */
  private updateRoom(force: boolean): void {
    const index = this.dungeon.roomAt(this.hero.root.position.x)
    if (index === this.room && !force) return
    this.room = index
    for (const t of this.torches) t.light.setEnabled(Math.abs(t.room - index) <= TORCH_REACH)
    this.events.emit('room', { index, label: this.dungeon.floorLabel(index) })
  }

  private updateFocus(): void {
    const p = this.hero.root.position
    let best: Interactable | null = null
    let bestD = Infinity
    for (const it of this.interactables) {
      const d = Math.hypot(p.x - it.x, p.z - it.z)
      if (d < it.radius && d < bestD) {
        best = it
        bestD = d
      }
    }
    if (best !== this.focused) {
      this.focused = best
      this.events.emit('focus', best)
    }
  }

  private interact(target: Interactable): void {
    this.setInputEnabled(false)
    this.hero.yaw = Math.atan2(target.x - this.hero.root.position.x, target.z - this.hero.root.position.z)
    this.hero.playOnce('interact')
    this.events.emit('interact', target)
  }

  // --- Outils de test et de capture (?e2e) ------------------------------------------------

  heroPosition(): { x: number; y: number; z: number } {
    const p = this.hero.root.position
    return { x: p.x, y: p.y, z: p.z }
  }

  teleport(x: number, z: number): void {
    const y = this.dungeon.heightAt(x, z)
    this.hero.root.position.set(x, y, z)
    this.camera.target.set(x, y + 1.45, z)
    this.updateRoom(false)
  }

  /** Cadre la caméra (captures) : écart au sud (radians), inclinaison, distance. */
  frame(offset: number, beta: number, radius: number): void {
    this.camera.alpha = -Math.PI / 2 + offset
    this.camera.beta = beta
    this.camera.radius = radius
  }

  dispose(): void {
    this.stop()
    for (const d of this.disposers) d()
    this.pipeline?.dispose()
    this.scene.dispose()
  }
}

