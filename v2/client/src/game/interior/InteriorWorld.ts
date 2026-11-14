/**
 * L'intérieur d'un lieu de quête : six salles en enfilade, le héros à la troisième personne, les
 * ennemis endormis dans leur salle, trois piédestaux d'énigme, le coffre de l'Effaceur. Il implémente
 * `QuestStage` (core/quest/controller.ts) : le contrôleur décide, cette scène joue et attend.
 *
 * Le monde se fige pendant une question : seul `explore()` donne la main au joueur, jusqu'au prochain
 * événement (salle, contact avec un ennemi, piédestal, coffre). Aucune esquive ni action rapide n'est
 * demandée pour répondre. Le combat se déclenche au contact (choix provisoire : à trancher avec les
 * enfants, D12).
 */
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DefaultRenderingPipeline,
  DirectionalLight,
  HemisphericLight,
  type AbstractEngine,
  ImageProcessingConfiguration,
  Matrix,
  Mesh,
  MeshBuilder,
  type ParticleSystem,
  PointerEventTypes,
  PointLight,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  type TransformNode,
  Vector3,
} from '@babylonjs/core'
import combat from '@content/monde/combat.json'
import type { BagEffect, TurnResult, World } from '../../core/combat/encounter'
import type { Fighter } from '../../core/combat/fighter'
import { isMonster } from '../../core/combat/monsters'
import type { QuestStage, StageEvent, Tone } from '../../core/quest/controller'
import {
  CHEST_AT, entryPoint, Floor, PEDESTALS, ROOM_D, ROOM_W, roomAt, route, START_POINT, toWorld,
} from '../../core/quest/layout'
import { planLevel } from '../../core/quest/pieces'
import { type EnemyState, type Progress } from '../../core/quest/run'
import type { SaveData } from '../../core/save'
import { angleDelta, RUN_SPEED, step, WALK_SPEED } from '../../core/world/movement'
import { Obstacles } from '../../core/world/obstacles'
import type { DungeonData } from '../../core/world/places'
import { placeModel } from '../assets'
import { type Character, enemyHeight, fitToHeight, loadEnemy, loadHero } from '../characters'
import type { Quality } from '../quality'
import { Effects } from './effects'
import { buildLevel, type BuiltLevel } from './level'

const AGGRO_DISTANCE = 3.6
const PEDESTAL_DISTANCE = 1.7
const PEDESTAL_REARM = 2.6
const CHEST_DISTANCE = 1.9
/** Distance héros / ennemi pendant un combat. */
const FIGHT_GAP = 4.8
const EXPLORE_CAMERA = { alpha: -Math.PI / 2, beta: 1.08, radius: 10 }
const COMBAT_CAMERA = { alpha: -Math.PI / 2, beta: 1.2, radius: 11.5 }

type Theme = (typeof combat)['lumineux']['interieur']

export interface FloatingText {
  text: string
  tone: Tone
  /** Position à l'écran, en pixels CSS du canevas. */
  x: number
  y: number
}

export interface InteriorOptions {
  engine: AbstractEngine
  canvas: HTMLCanvasElement
  def: DungeonData
  progress: Progress
  world: World
  look: SaveData['look']
  quality: Quality
  calm: boolean
  /** Le temps de jeu fixé par le parent est-il écoulé ? */
  timeOver?: () => boolean
  onFloat?: (text: FloatingText) => void
  onProgress?: (label: string, ratio: number) => void
}

interface Foe {
  state: EnemyState
  character: Character
  x: number
  z: number
  height: number
}

interface Pedestal {
  index: number
  x: number
  z: number
  crystal: Mesh
  material: StandardMaterial
  solved: boolean
  armed: boolean
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms))
const color3 = (hex: string): Color3 => Color3.FromHexString(hex)

export class InteriorWorld implements QuestStage {
  readonly scene: Scene
  readonly camera: ArcRotateCamera
  hero!: Character
  private readonly floor: Floor
  private readonly obstacles = new Obstacles()
  private readonly theme: Theme
  private readonly effects: Effects
  private readonly shadows: ShadowGenerator
  private readonly pipeline: DefaultRenderingPipeline | null
  private readonly torchLight: PointLight
  private level!: BuiltLevel
  private foes: Foe[] = []
  private pedestals: Pedestal[] = []
  private flames: { system: ParticleSystem; room: number; on: boolean }[] = []
  private chest: { root: TransformNode; at: Vector3 } | null = null
  private keys = new Set<string>()
  private destination: { x: number; z: number }[] = []
  private resolveExplore: ((event: StageEvent) => void) | null = null
  private leaveQueued = false
  private room = -1
  private disposers: (() => void)[] = []
  private timeCheck = 0
  private cameraGoal: { alpha: number; beta: number; radius: number; target: Vector3 } | null = null
  private shakeUntil = 0
  private spin = 0

  private constructor(private readonly options: InteriorOptions) {
    const { engine, def, world, quality } = options
    this.theme = (world === 'brouillard' ? combat.brouillard : combat.lumineux).interieur
    this.floor = new Floor(def.rooms.length)
    const scene = new Scene(engine)
    this.scene = scene
    scene.skipPointerMovePicking = true
    scene.clearColor = Color4.FromColor3(color3(this.theme.fond), 1)
    scene.ambientColor = color3(this.theme.ambiance).scale(0.4)

    this.camera = new ArcRotateCamera('interieur', EXPLORE_CAMERA.alpha, EXPLORE_CAMERA.beta, EXPLORE_CAMERA.radius, new Vector3(3, 1.3, 10), scene)
    this.setupCamera()

    const hemi = new HemisphericLight('ambiance', new Vector3(0, 1, 0), scene)
    hemi.diffuse = color3(this.theme.ambiance)
    hemi.groundColor = color3(this.theme.ambiance).scale(0.35)
    hemi.specular = Color3.Black()
    hemi.intensity = this.theme.ambiance_force
    const sun = new DirectionalLight('soleil', new Vector3(-0.35, -1, 0.45).normalize(), scene)
    sun.diffuse = color3(this.theme.soleil)
    sun.specular = Color3.Black()
    sun.intensity = this.theme.soleil_force * 0.75
    sun.position = new Vector3(40, 40, -20)
    this.shadows = new ShadowGenerator(Math.min(2048, Math.max(512, quality.shadowMapSize)), sun)
    this.shadows.usePercentageCloserFiltering = quality.shadowMapSize >= 1024
    this.shadows.bias = 0.0006
    this.shadows.normalBias = 0.02
    // La lumière du héros : une torche qui l'accompagne (les torches des murs ne sont que des flammes).
    this.torchLight = new PointLight('torche-heros', new Vector3(0, 3, 0), scene)
    this.torchLight.diffuse = new Color3(this.theme.torche[0], this.theme.torche[1], this.theme.torche[2])
    this.torchLight.specular = Color3.Black()
    this.torchLight.intensity = 0.9
    this.torchLight.range = 11

    this.effects = new Effects(scene, options.calm)
    this.pipeline = quality.bloom ? this.makePipeline(quality) : null
  }

  static async create(options: InteriorOptions): Promise<InteriorWorld> {
    const world = new InteriorWorld(options)
    await world.build()
    return world
  }

  private progress(label: string, ratio: number): void {
    this.options.onProgress?.(label, ratio)
  }

  private makePipeline(quality: Quality): DefaultRenderingPipeline {
    const pipeline = new DefaultRenderingPipeline('interieur-effets', true, this.scene, [this.camera])
    pipeline.samples = quality.msaa
    pipeline.bloomEnabled = true
    pipeline.bloomThreshold = 0.82
    pipeline.bloomWeight = 0.35
    pipeline.bloomKernel = 48
    pipeline.imageProcessingEnabled = true
    pipeline.imageProcessing.toneMappingEnabled = true
    pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES
    pipeline.imageProcessing.vignetteEnabled = true
    pipeline.imageProcessing.vignetteWeight = 1.6
    return pipeline
  }

  private setupCamera(): void {
    const camera = this.camera
    camera.lowerRadiusLimit = 6
    camera.upperRadiusLimit = 15
    camera.lowerBetaLimit = 0.8
    camera.upperBetaLimit = 1.38
    // La caméra reste du côté ouvert : elle ne passe jamais derrière le mur du fond.
    camera.lowerAlphaLimit = -Math.PI / 2 - 0.9
    camera.upperAlphaLimit = -Math.PI / 2 + 0.9
    camera.wheelDeltaPercentage = 0.01
    camera.panningSensibility = 0
    camera.angularSensibilityX = 1400
    camera.angularSensibilityY = 1400
    camera.minZ = 0.3
    camera.maxZ = 160
    camera.fov = 0.85
    camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput')
    camera.attachControl(this.options.canvas, true)
  }

  // --- Construction ------------------------------------------------------------------------

  private async build(): Promise<void> {
    const { scene, options } = this
    const { def, progress } = options
    const plan = planLevel(def)
    this.progress('Les salles', 0.1)
    this.level = await buildLevel(scene, plan, (label) => this.progress(label, 0.3))
    for (const mesh of this.level.sources) this.shadows.addShadowCaster(mesh, false)
    for (const o of plan.obstacles) this.obstacles.add(o)
    const flame = new Color3(this.theme.torche[0], this.theme.torche[1], this.theme.torche[2])
    for (const t of plan.torches) this.flames.push({ system: this.effects.flame(new Vector3(t.x, t.y - 0.2, t.z - 0.05), flame), room: t.room, on: false })
    this.buildGround(def.rooms.length)

    // Salles déjà franchies : portes ouvertes (celle de l'entrée l'est toujours).
    this.floor.openDoor(0)
    this.level.openDoor(1, false)
    for (let i = 0; i < progress.checkpoint; i += 1) {
      this.floor.openDoor(i)
      this.level.openDoor(i + 1, false)
    }

    this.progress('Le héros', 0.45)
    this.hero = await loadHero(this.scene, options.look)
    const start = progress.checkpoint > 0 ? entryPoint(progress.checkpoint) : START_POINT
    this.hero.root.position.set(start.x, 0, start.z)
    this.hero.yaw = Math.PI / 2
    for (const m of this.hero.meshes) this.shadows.addShadowCaster(m, false)
    this.camera.target.set(start.x, 1.3, start.z)

    this.progress('Les gardiens', 0.6)
    const alive = progress.enemies.filter((e) => !e.defeated)
    this.foes = await Promise.all(alive.map((state, k) => this.spawnFoe(state, k)))
    this.buildPedestals()
    this.progress('Prêt', 1)
    this.room = roomAt(start.x, def.rooms.length)
    this.updateFlames()
  }

  /** Sol sombre sous les salles (pour que le bord ouvert ne flotte pas dans le vide) et plan de visée du clic. */
  private buildGround(count: number): void {
    const total = count * ROOM_W
    const ground = MeshBuilder.CreateGround('sol', { width: total, height: ROOM_D }, this.scene)
    ground.position.set(total / 2, 0.02, ROOM_D / 2)
    ground.visibility = 0 // invisible mais pickable : cible du clic
    const under = MeshBuilder.CreateGround('dessous', { width: total + 120, height: 120 }, this.scene)
    under.position.set(total / 2, -0.05, ROOM_D / 2)
    const material = new StandardMaterial('dessous-matiere', this.scene)
    material.diffuseColor = color3(this.theme.fond)
    material.specularColor = Color3.Black()
    under.material = material
    under.isPickable = false
  }

  private async spawnFoe(state: EnemyState, k: number): Promise<Foe> {
    const { spec } = state
    const character = await loadEnemy(this.scene, spec.model, `ennemi-${state.id}-${k}`, spec.scale)
    const at = toWorld(spec.v1_at[0], spec.v1_at[1])
    const x = state.room * ROOM_W + at.x
    const height = enemyHeight(spec.model, spec.scale)
    character.root.position.set(x, 0, at.z)
    character.yaw = -Math.PI / 2 // tourné vers l'ouest, d'où vient le héros
    for (const m of character.meshes) this.shadows.addShadowCaster(m, false)
    this.obstacles.add({ x, z: at.z, r: 0.5 * Math.max(1, spec.scale) })
    // Endormi : un squelette couché ou figé debout se réveille à l'approche ; un monstre veille, immobile.
    if (!isMonster(spec.model)) character.freeze('sleep')
    else this.scene.onAfterRenderObservable.addOnce(() => fitToHeight(character, height))
    return { state, character, x, z: at.z, height }
  }

  private buildPedestals(): void {
    const { progress } = this.options
    const room = progress.enigmaRoom
    if (room < 0 || room < progress.checkpoint) return
    const accent = color3(this.theme.accent)
    PEDESTALS.forEach((p, index) => {
      const x = room * ROOM_W + p.x
      const column = MeshBuilder.CreateCylinder(`piedestal-${index}`, { diameterTop: 0.84, diameterBottom: 1.1, height: 1, tessellation: 16 }, this.scene)
      column.position.set(x, 0.5, p.z)
      const stone = new StandardMaterial(`pierre-${index}`, this.scene)
      stone.diffuseColor = new Color3(0.42, 0.4, 0.46)
      stone.specularColor = Color3.Black()
      column.material = stone
      column.isPickable = false
      this.shadows.addShadowCaster(column)
      column.receiveShadows = true
      const crystal = MeshBuilder.CreateSphere(`cristal-${index}`, { diameter: 0.7, segments: 6 }, this.scene)
      crystal.scaling.y = 1.6
      crystal.position.set(x, 1.55, p.z)
      const material = new StandardMaterial(`cristal-matiere-${index}`, this.scene)
      material.emissiveColor = accent
      material.disableLighting = true
      crystal.material = material
      crystal.isPickable = false
      const solved = progress.solved.has(index)
      if (solved) material.emissiveColor = color3(this.theme.bon)
      this.obstacles.add({ x, z: p.z, r: 0.55 })
      this.pedestals.push({ index, x, z: p.z, crystal, material, solved, armed: true })
    })
  }

  // --- Commandes ---------------------------------------------------------------------------

  private bind(): void {
    const isTyping = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
    const down = (e: KeyboardEvent) => {
      if (isTyping(e)) return
      // Toujours noté : une touche tenue pendant un panneau reprend l'effet à la fin (keyup toujours suivi).
      this.keys.add(e.code)
    }
    const up = (e: KeyboardEvent) => this.keys.delete(e.code)
    const blur = () => this.keys.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    const observer = this.scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERTAP || !this.resolveExplore) return
      const pick = info.pickInfo
      if (pick?.hit && pick.pickedMesh?.name === 'sol' && pick.pickedPoint) {
        const p = this.hero.root.position
        this.destination = route(this.floor, { x: p.x, z: p.z }, { x: pick.pickedPoint.x, z: pick.pickedPoint.z })
      }
    })
    this.disposers.push(() => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      this.scene.onPointerObservable.remove(observer)
    })
  }

  private direction(): { x: number; z: number; walk: boolean } {
    const k = this.keys
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0)
    const r = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0)
    const walk = k.has('ShiftLeft') || k.has('ShiftRight')
    if (f !== 0 || r !== 0) {
      this.destination = []
      const fx = -Math.cos(this.camera.alpha)
      const fz = -Math.sin(this.camera.alpha)
      return { x: fx * f + fz * r, z: fz * f - fx * r, walk }
    }
    const goal = this.destination[0]
    if (goal) {
      const p = this.hero.root.position
      const dx = goal.x - p.x
      const dz = goal.z - p.z
      if (Math.hypot(dx, dz) < 0.5) {
        this.destination.shift()
        return { x: 0, z: 0, walk }
      }
      return { x: dx, z: dz, walk }
    }
    return { x: 0, z: 0, walk }
  }

  // --- Boucle ------------------------------------------------------------------------------

  /** Un pas de temps puis le rendu ; l'hôte l'appelle à chaque image. */
  frame(dt: number): void {
    this.update(dt)
    this.scene.render()
  }

  private update(dt: number): void {
    this.level.update(dt)
    this.spin += dt
    for (const p of this.pedestals) p.crystal.rotation.y = this.spin * 1.2
    const p = this.hero.root.position
    if (this.resolveExplore) this.walk(dt)
    this.torchLight.position.set(p.x, 3.2, p.z - 0.6)
    this.updateCamera(dt)
    const room = roomAt(p.x, this.options.def.rooms.length)
    if (room !== this.room) {
      this.room = room
      this.updateFlames()
      this.emit({ kind: 'room', index: room })
    }
    if (this.resolveExplore) this.checkTriggers()
    this.timeCheck -= dt
    if (this.timeCheck <= 0) {
      this.timeCheck = 1
      if (this.resolveExplore && this.options.timeOver?.()) this.emit({ kind: 'timeOver' })
    }
  }

  private walk(dt: number): void {
    const dir = this.direction()
    const p = this.hero.root.position
    const s = step({ x: p.x, z: p.z }, dir, dir.walk ? WALK_SPEED : RUN_SPEED, dt, this.floor, this.obstacles)
    const moving = s.moved > 0.001
    p.x = s.x
    p.z = s.z
    if (moving) {
      this.hero.yaw = this.hero.yaw + angleDelta(this.hero.yaw, Math.atan2(dir.x, dir.z)) * Math.min(1, dt * 12)
      this.hero.play(dir.walk ? 'walk' : 'run')
    } else {
      this.hero.play('idle')
      if (this.destination.length > 0) this.destination = [] // bloqué : on renonce
    }
  }

  private updateCamera(dt: number): void {
    const camera = this.camera
    const hero = this.hero.root.position
    const k = 1 - Math.exp(-6 * dt)
    let desired: Vector3
    if (this.cameraGoal) {
      const g = this.cameraGoal
      camera.alpha += (g.alpha - camera.alpha) * k
      camera.beta += (g.beta - camera.beta) * k
      camera.radius += (g.radius - camera.radius) * k
      desired = g.target
    } else {
      desired = new Vector3(hero.x, 1.3, hero.z)
    }
    if (performance.now() < this.shakeUntil) desired = desired.add(new Vector3((Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.2, 0))
    // En place : réaffecter `camera.target` annulerait le mouvement de la souris (piège connu de la v2).
    camera.target.copyFrom(Vector3.Lerp(camera.target, desired, k))
  }

  private updateFlames(): void {
    for (const f of this.flames) {
      const on = Math.abs(f.room - this.room) <= 1
      if (on === f.on) continue
      f.on = on
      if (on) f.system.start()
      else f.system.stop()
    }
  }

  private checkTriggers(): void {
    const p = this.hero.root.position
    for (const foe of this.foes) {
      if (foe.state.defeated || foe.state.room !== this.room) continue
      if (Math.hypot(p.x - foe.x, p.z - foe.z) < AGGRO_DISTANCE) {
        this.emit({ kind: 'enemy', id: foe.state.id })
        return
      }
    }
    for (const ped of this.pedestals) {
      if (ped.solved) continue
      const d = Math.hypot(p.x - ped.x, p.z - ped.z)
      if (!ped.armed) ped.armed = d > PEDESTAL_REARM // s'éloigner pour réessayer
      else if (d < PEDESTAL_DISTANCE) {
        this.emit({ kind: 'pedestal', index: ped.index })
        return
      }
    }
    if (this.chest && Math.hypot(p.x - this.chest.at.x, p.z - this.chest.at.z) < CHEST_DISTANCE) this.emit({ kind: 'chest' })
  }

  private emit(event: StageEvent): void {
    const resolve = this.resolveExplore
    if (!resolve) return
    this.resolveExplore = null
    // Entrer dans une salle n'interrompt pas la marche ; tout le reste (ennemi, énigme, coffre, sortie) l'arrête.
    if (event.kind !== 'room') {
      this.destination = []
      this.hero.play('idle')
    }
    resolve(event)
  }

  /** L'enfant quitte le lieu (bouton de l'interface). */
  requestLeave(): void {
    if (this.resolveExplore) this.emit({ kind: 'leave' })
    else this.leaveQueued = true
  }

  // --- QuestStage -------------------------------------------------------------------------

  explore(): Promise<StageEvent> {
    this.cameraGoal = null
    return new Promise((resolve) => {
      if (this.leaveQueued) {
        this.leaveQueued = false
        resolve({ kind: 'leave' })
        return
      }
      this.resolveExplore = resolve
    })
  }

  async engage(enemy: EnemyState): Promise<void> {
    const foe = this.foe(enemy)
    const room = foe.state.room
    const spotX = Math.max(foe.x - FIGHT_GAP, room * ROOM_W + 1.2)
    const hero = this.hero
    const from = hero.root.position.clone()
    this.cameraGoal = { ...COMBAT_CAMERA, target: new Vector3((spotX + foe.x) / 2, 1.2, foe.z) }
    // Le héros se met en place pendant que l'ennemi se réveille.
    if (foe.character.can('awaken')) {
      if (!isMonster(foe.state.spec.model)) foe.character.thaw()
      void foe.character.playOnce('awaken', 'combat')
    }
    hero.play('run')
    hero.yaw = Math.atan2(spotX - from.x, foe.z - from.z)
    await this.tween(450, (t) => hero.root.position.set(from.x + (spotX - from.x) * t, 0, from.z + (foe.z - from.z) * t))
    hero.root.position.set(spotX, 0, foe.z)
    hero.play('idle')
    hero.yaw = Math.PI / 2 - 0.3
    foe.character.yaw = -Math.PI / 2 + 0.3
    await sleep(900)
  }

  async playTurn(enemy: EnemyState, turn: TurnResult, _hero: Fighter): Promise<void> {
    const foe = this.foe(enemy)
    const r = turn.resolution
    if (r.kind === 'miss') {
      void this.hero.playOnce('block', 'idle', 0.8)
      await sleep(500)
    } else if (r.kind === 'heal') {
      void this.hero.playOnce('item', 'idle')
      await sleep(400)
      this.effects.rise(this.heroChest().subtractFromFloats(0, 0.4, 0), color3(this.theme.bon))
      this.float(`+${r.healed}`, 'good', this.heroChest())
      await sleep(600)
    } else {
      const spell = turn.action === 'chapitre'
      void this.hero.playOnce(spell ? 'spell' : 'attack', 'idle', spell ? 1 : 1.2)
      await sleep(350)
      if (spell) await this.effects.projectile(this.heroChest(), this.foeChest(foe), color3(this.theme.accent))
      void foe.character.playOnce('hit', 'combat')
      this.effects.burst(this.foeChest(foe), color3(this.theme.accent), r.crit ? 60 : 30, r.crit ? 6 : 4)
      this.float(r.crit ? `${r.power} !` : `${r.power}`, r.crit ? 'gold' : 'plain', this.foeChest(foe))
      if (!this.options.calm) this.shakeUntil = performance.now() + (r.crit ? 350 : 180)
      await sleep(500)
    }
    if (turn.enemyAttack) {
      await sleep(250)
      void foe.character.playOnce('attack', 'combat')
      await sleep(450)
      if (turn.enemyAttack.kind === 'blocked') {
        void this.hero.playOnce('block', 'idle')
        this.float('Bloqué !', 'accent', this.heroChest())
      } else {
        void this.hero.playOnce('hit', 'idle', turn.enemyAttack.guarded ? 0.8 : 1)
        this.float(`-${turn.enemyAttack.damage}`, 'bad', this.heroChest())
        if (!this.options.calm) this.shakeUntil = performance.now() + 200
      }
      await sleep(600)
    }
  }

  async playBag(effect: BagEffect): Promise<void> {
    if (effect.kind === 'potion') {
      void this.hero.playOnce('item', 'idle')
      this.effects.rise(this.heroChest().subtractFromFloats(0, 0.4, 0), color3(this.theme.bon))
      this.float(`+${effect.healed}`, 'good', this.heroChest())
    } else {
      void this.hero.playOnce('block', 'idle')
      this.float('Bouclier levé !', 'accent', this.heroChest())
    }
    await sleep(700)
  }

  async endFight(enemy: EnemyState, outcome: 'victory' | 'retreat'): Promise<void> {
    const foe = this.foe(enemy)
    if (outcome === 'victory') {
      await foe.character.playOnce('death', null)
      await sleep(500)
      const root = foe.character.root
      await this.tween(600, (t) => root.scaling.setAll(1 - t))
      root.setEnabled(false)
      foe.state.defeated = true
    } else {
      await this.hero.playOnce('death', null)
      await sleep(900)
      const back = enemy.room > 0 ? entryPoint(enemy.room) : START_POINT
      this.hero.root.position.set(back.x, 0, back.z)
      this.hero.yaw = Math.PI / 2
      this.hero.play('idle')
      foe.character.yaw = -Math.PI / 2
      foe.character.play('combat')
      this.destination = []
    }
    this.cameraGoal = null
  }

  async openDoor(room: number): Promise<void> {
    this.floor.openDoor(room)
    this.level.openDoor(room + 1, true)
    await sleep(500)
  }

  async pedestalSolved(index: number): Promise<void> {
    const ped = this.pedestals.find((p) => p.index === index)
    if (!ped) return
    ped.solved = true
    ped.material.emissiveColor = color3(this.theme.bon)
    this.effects.rise(ped.crystal.position.clone(), color3(this.theme.bon))
    await sleep(600)
  }

  pedestalRearm(index: number): void {
    const ped = this.pedestals.find((p) => p.index === index)
    if (ped) ped.armed = false
  }

  async spawnChest(): Promise<void> {
    const room = this.options.progress.bossRoom
    const at = new Vector3(room * ROOM_W + CHEST_AT.x, 0, CHEST_AT.z)
    const placed = await placeModel(this.scene, 'kaykit/dungeon/chest_gold.glb', 1.1, at, -Math.PI / 6, 'coffre')
    for (const m of placed.meshes) this.shadows.addShadowCaster(m, false)
    this.chest = { root: placed.root, at }
    this.effects.burst(at.add(new Vector3(0, 0.8, 0)), new Color3(1, 0.83, 0.28), 50, 4)
    const target = placed.root.scaling.x
    await this.tween(500, (t) => placed.root.scaling.setAll(target * (0.2 + 0.8 * t)))
  }

  async openChest(): Promise<void> {
    const chest = this.chest
    this.chest = null
    void this.hero.playOnce('interact', 'idle')
    if (chest) {
      const gold = new Color3(1, 0.83, 0.28)
      this.effects.burst(chest.at.add(new Vector3(0, 1, 0)), gold, 80, 5)
      this.effects.rise(chest.at, gold)
    }
    await sleep(1200)
    chest?.root.setEnabled(false)
    this.cameraGoal = null
  }

  restored(): void {
    this.effects.rise(this.heroChest().subtractFromFloats(0, 0.4, 0), color3(this.theme.bon))
  }

  levelUp(): void {
    this.effects.rise(this.heroChest().subtractFromFloats(0, 0.4, 0), new Color3(1, 0.83, 0.28))
    void this.hero.playOnce('cheer', 'idle')
  }

  // --- Outils -----------------------------------------------------------------------------

  private foe(enemy: EnemyState): Foe {
    const foe = this.foes.find((f) => f.state.id === enemy.id)
    if (!foe) throw new Error(`ennemi inconnu : ${enemy.id}`)
    return foe
  }

  private heroChest(): Vector3 {
    return this.hero.root.position.add(new Vector3(0, 1.2, 0))
  }

  private foeChest(foe: Foe): Vector3 {
    return new Vector3(foe.x, foe.height * 0.55, foe.z)
  }

  /** Texte qui monte et s'efface, posé par l'interface à l'endroit où le monde le montre. */
  private float(text: string, tone: Tone, at: Vector3): void {
    const { engine, canvas } = this.options
    const viewport = this.camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
    const v = Vector3.Project(at, Matrix.Identity(), this.scene.getTransformMatrix(), viewport)
    this.options.onFloat?.({
      text,
      tone,
      x: (v.x / engine.getRenderWidth()) * canvas.clientWidth,
      y: (v.y / engine.getRenderHeight()) * canvas.clientHeight,
    })
  }

  private tween(ms: number, apply: (t: number) => void): Promise<void> {
    const started = performance.now()
    return new Promise((resolve) => {
      const observer = this.scene.onBeforeRenderObservable.add(() => {
        const t = Math.min(1, (performance.now() - started) / ms)
        apply(t)
        if (t >= 1) {
          this.scene.onBeforeRenderObservable.remove(observer)
          resolve()
        }
      })
    })
  }

  /** À appeler une fois après la construction : commandes actives. */
  start(): void {
    this.bind()
  }

  // --- Outils de test et de capture (?e2e) ------------------------------------------------

  heroPosition(): { x: number; z: number; room: number } {
    const p = this.hero.root.position
    return { x: p.x, z: p.z, room: roomAt(p.x, this.options.def.rooms.length) }
  }

  teleport(x: number, z: number): void {
    this.hero.root.position.set(x, 0, z)
    this.camera.target.set(x, 1.3, z)
    this.room = -1
  }

  frameCamera(alpha: number, beta: number, radius: number): void {
    this.camera.alpha = alpha
    this.camera.beta = beta
    this.camera.radius = radius
  }

  enemyPosition(id: string): { x: number; z: number } | null {
    const foe = this.foes.find((f) => f.state.id === id)
    return foe ? { x: foe.x, z: foe.z } : null
  }

  isDoorOpen(i: number): boolean {
    return this.floor.isDoorOpen(i)
  }

  pedestalPosition(index: number): { x: number; z: number } | null {
    const ped = this.pedestals.find((p) => p.index === index)
    return ped ? { x: ped.x, z: ped.z } : null
  }

  chestPosition(): { x: number; z: number } | null {
    return this.chest ? { x: this.chest.at.x, z: this.chest.at.z } : null
  }

  dispose(): void {
    for (const d of this.disposers) d()
    for (const f of this.flames) f.system.dispose()
    this.pipeline?.dispose()
    this.effects.dispose()
    this.level.dispose()
    this.scene.dispose()
  }
}
