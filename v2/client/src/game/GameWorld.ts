/**
 * Le monde 3D : l'île, le héros à la troisième personne, son renard, Maître Ysaline, les
 * pierres de savoir et les seuils des lieux de quête. Il ne connaît ni React ni le contenu
 * des questions : il annonce ce qui se passe (WorldEvents) et l'interface décide.
 *
 * Commandes : ZQSD ou WASD (position des touches, pas la lettre : `KeyboardEvent.code`),
 * flèches, Maj pour marcher, souris (glisser) pour tourner la caméra, molette pour zoomer,
 * E ou Entrée pour agir, clic sur le sol pour y aller (aménagement « gestes »).
 */
import {
  type AbstractEngine,
  AnimationPropertiesOverride,
  ArcRotateCamera,
  Color3,
  Matrix,
  type Mesh,
  MeshBuilder,
  PointerEventTypes,
  Scene,
  SceneInstrumentation,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import ile from '@content/monde/ile.json'
import { lookOf } from '../core/appearance'
import { Emitter } from '../core/events'
import { ELEMENTS, elementOf, ISLAND_RELICS, MIN_RELICS } from '../core/relics'
import type { SaveData } from '../core/save'
import { defaultsFor, fur, type Look } from '../core/wardrobe'
import { generatorFor } from '../core/lice'
import { colorFor } from '../core/pont'
import { questDone, type Villager, villageFor } from '../core/village'
import type { HeightGrid } from '../core/world/heightGrid'
import type { Obstacles } from '../core/world/obstacles'
import { heading, type MapMarker, mapMarkers, type ReliefPalette } from '../core/world/minimap'
import { angleDelta, RUN_SPEED, step, WALK_SPEED } from '../core/world/movement'
import { isOpen, type Place, placesFor, regionTitle } from '../core/world/places'
import { fogDensityFactor, fogNote, type RegionLight, regionLights } from '../core/world/regionLight'
import { type IslandLayout, SEA_LEVEL, Terrain } from '../core/world/terrain'
import { type Atmosphere, createAtmosphere } from './atmosphere'
import { type Character, dress, loadFox, loadHero, loadMonster, loadNpc, settleOnGround, skinnedHeights, tintFox } from './characters'
import { type Enemy, type FloatTone, InteriorWorld, type Pedestal } from './interior'
import { today as localDay } from '../core/dailyChallenge'
import { beacon, buildDecor, setBeacon } from './decor'
import { sparkle } from './effects'
import { createEngine, type EngineKind } from './engine'
import { buildGround, buildSea, type Ground } from './island'
import { chooseQuality, type Quality } from './quality'
import { THEMES, type WorldName } from './theme'

export type InteractableKind = 'lieu' | 'pierre' | 'ysaline' | 'sortie' | 'jour' | 'coffre' | 'relique' | 'table' | 'barque' | 'habitant' | 'pont' | 'tir'

export interface Interactable {
  id: string
  kind: InteractableKind
  label: string
  x: number
  z: number
  radius: number
  place?: Place
  open?: boolean
  /** Une relique à ramasser (core/relics.ts) : son identifiant. */
  relic?: string
  /** Un habitant du village (core/village.ts) : `open` tant que sa quête du jour n'est pas faite. */
  npc?: Villager
}

export type WorldEvents = {
  progress: { label: string; ratio: number }
  /** `note` : le texte de brouillard d'une région que la classe n'a pas encore au programme (vide ailleurs). */
  region: { code: string | null; title: string; note?: string }
  focus: Interactable | null
  interact: Interactable
  stats: { fps: number; drawCalls: number; triangles: number }
  /** Position du héros pour la carte, dix fois par seconde : cap du héros et du regard (degrés, 0 = nord). */
  hero: HeroPose
  /** L'état d'un repère de la carte a changé (pierre éveillée…). */
  markers: MapMarker[]
  /** On entre dans un lieu de quête (son intérieur est à l'écran), ou on en sort (null). */
  interior: { place: Place } | null
  /** Salle du héros dans l'intérieur d'un lieu (« Étage 2 / 6 »). */
  floor: { index: number; label: string }
  /** Le héros a approché un ennemi : l'interface mène le combat (ui/useFight.tsx). */
  fight: Enemy
  /** Le héros a approché un piédestal de la salle-énigme : l'interface pose la question (ui/useFight.tsx). */
  riddle: Pedestal
  /** Nombre flottant d'un combat (dégâts, soin), en pixels de l'écran. */
  float: { text: string; tone: FloatTone; x: number; y: number }
}

export interface HeroPose {
  x: number
  z: number
  heading: number
  view: number
}

/** Ce que la mini-carte lit du monde : les hauteurs du sol affiché, ses couleurs et ses repères. */
export interface MapInfo {
  heightAt: (x: number, z: number) => number
  extent: number
  palette: ReliefPalette
  markers: MapMarker[]
}

export interface WorldOptions {
  level: string
  world: WorldName
  save: SaveData
  /** Aménagement « mode calme » : ni éclat ni secousse. */
  calm: boolean
  /** Avancement du chargement (l'écran de chargement l'affiche). */
  onProgress?: (label: string, ratio: number) => void
}

const layout = ile as unknown as IslandLayout
const today = (): string => new Date().toISOString().slice(0, 10)
/** Écran d'apparence : durée du cadrage de la caméra, et décalage (écran) qui garde le héros à gauche du panneau. */
const SHOWCASE_MS = 900
const SHOWCASE_OFFSET = -1.5

export class GameWorld {
  readonly events = new Emitter<WorldEvents>()
  readonly terrain = new Terrain(layout)
  readonly quality: Quality
  scene!: Scene
  engine!: AbstractEngine
  engineKind: EngineKind = 'webgl2'
  hero!: Character
  /** L'apparence du héros et du renard à l'écran (validée : core/appearance.ts) ; `setLook` la change. */
  look!: Look
  camera!: ArcRotateCamera
  private grid!: HeightGrid
  private obstacles!: Obstacles
  private atmosphere!: Atmosphere
  private fox: Character | null = null
  private keys = new Set<string>()
  private destination: { x: number; z: number } | null = null
  private inputEnabled = true
  private interactables: Interactable[] = []
  private dayCrystal: Mesh | null = null
  /** Les habitants du village de la classe : leur personnage et le « ! » au-dessus de leur tête tant que leur quête du jour attend. */
  private villagers = new Map<string, { npc: Villager; character: Character; marker: TransformNode }>()
  /** Lieux terminés (code → nombre de fois) : la partie du monde est celle de sa création, celle-ci suit les fins de lieu. */
  private placesDone: Record<string, number>
  private dayRing: Mesh | null = null
  private focused: Interactable | null = null
  private region: string | null = null
  /** Lumière de chaque région selon les pages rapportées (core/world/regionLight.ts) : le sol et la brume locale la suivent. */
  private lights: Record<string, RegionLight> = {}
  private ground: Ground | null = null
  private baseFog = 0
  private fogTarget = 0
  private lastCameraInput = 0
  /** Cadrage en cours vers un but (écran d'apparence) : la caméra s'en approche pendant `SHOWCASE_MS`, puis la souris reprend la main. */
  private cameraGoal: { alpha: number; beta: number; radius: number; offsetX: number; until: number } | null = null
  private cameraBefore: { beta: number; radius: number } | null = null
  /** Ce qui est réellement à l'écran (`look` est ce qui est voulu) : le modèle du héros et le pelage du renard. `setLook` s'applique à la file, dans l'ordre. */
  private shownModel = ''
  private shownFur = ''
  private lookQueue: Promise<void> = Promise.resolve()
  private closed = false
  private stones = new Map<string, Mesh>()
  /** Les reliques encore à ramasser : leur éclat et leur anneau, par identifiant. */
  private relicMeshes = new Map<string, { gem: Mesh; ring: Mesh }>()
  /** Les quatre éclats de la Table des Reliques (ils tournent), et son anneau (allumé tant qu'une table du jour attend). */
  private tableGems: Mesh[] = []
  /** La barque du Sphinx, qui tangue doucement sur l'eau (immobile en mode calme). */
  private boat: Mesh | null = null
  private disposers: (() => void)[] = []
  private statsTimer = 0
  private regionTimer = 0
  private heroTimer = 0
  private instrumentation: SceneInstrumentation | null = null
  places: Place[] = []
  private islandLoop: (() => void) | null = null
  private lastFrame = 0
  /** Intérieur d'un lieu à l'écran : l'île est en pause. */
  interior: InteriorWorld | null = null

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: WorldOptions,
    private readonly params: URLSearchParams,
  ) {
    this.quality = chooseQuality(params)
    this.placesDone = { ...options.save.places }
  }

  static async create(canvas: HTMLCanvasElement, options: WorldOptions, params = new URLSearchParams(location.search)): Promise<GameWorld> {
    const world = new GameWorld(canvas, options, params)
    await world.build()
    return world
  }

  private progress(label: string, ratio: number): void {
    this.options.onProgress?.(label, ratio)
    this.events.emit('progress', { label, ratio })
  }

  private async build(): Promise<void> {
    const { engine, kind } = await createEngine(this.canvas, this.params)
    this.engine = engine
    this.engineKind = kind
    engine.setHardwareScalingLevel(this.quality.hardwareScaling / Math.min(window.devicePixelRatio || 1, 2))
    const scene = new Scene(engine)
    this.scene = scene
    scene.skipPointerMovePicking = true
    // Fondu entre deux animations (marche, course, attente).
    scene.animationPropertiesOverride = new AnimationPropertiesOverride()
    scene.animationPropertiesOverride.enableBlending = true
    scene.animationPropertiesOverride.blendingSpeed = 0.08

    const theme = THEMES[this.options.world]
    const start = layout.depart
    this.camera = new ArcRotateCamera('camera', -Math.PI / 2, 1.22, 8.5, new Vector3(start.x, 3, start.z), scene)
    this.setupCamera()
    this.atmosphere = createAtmosphere(scene, this.camera, theme, this.quality)

    this.progress("Le relief de l'île", 0.1)
    const places = placesFor(this.options.level, this.terrain)
    this.places = places
    this.lights = regionLights(places, this.placesDone)
    this.baseFog = theme.fogDensity
    this.fogTarget = theme.fogDensity
    const ground = buildGround(scene, this.terrain, theme, this.quality.terrainSubdivisions, this.lightLevels())
    const grid = ground.grid
    this.ground = ground
    this.grid = grid
    buildSea(scene, this.terrain, theme)
    const steps = ['La Citadelle des Archives', 'Les lieux de quête', 'Le village', "L'île du Sphinx", 'Les forêts', 'Les nuages']
    const decor = await buildDecor(scene, this.terrain, grid, places, this.options.world, this.quality, this.atmosphere.shadows, (label) => {
      this.progress(label, 0.2 + (0.5 * (steps.indexOf(label) + 1)) / steps.length)
    })
    this.obstacles = decor.obstacles

    this.progress('Le héros', 0.75)
    this.look = lookOf(this.options.save, this.options.world)
    this.hero = await loadHero(scene, this.look)
    this.shownModel = this.look.model
    this.hero.root.position.set(start.x, grid.heightAt(start.x, start.z), start.z)
    this.hero.yaw = (start.cap * Math.PI) / 180
    for (const m of this.hero.meshes) this.atmosphere.shadows.addShadowCaster(m, false)
    // Renard de Jules, dans le monde lumineux (`?renard=0` pour l'enlever, par exemple en capture).
    if (this.options.world === 'lumineux' && this.params.get('renard') !== '0') {
      this.fox = await loadFox(scene)
      tintFox(this.fox, fur(this.look.pet_fur))
      this.shownFur = this.look.pet_fur
      this.fox.root.position.set(start.x - 1.5, grid.heightAt(start.x - 1.5, start.z - 1.5), start.z - 1.5)
      for (const m of this.fox.meshes) this.atmosphere.shadows.addShadowCaster(m, false)
      const fox = this.fox
      scene.onAfterRenderObservable.addOnce(() => settleOnGround(fox))
    }

    this.progress('Maître Ysaline', 0.85)
    const ysaline = await loadNpc(scene, 'Mage', 'ysaline', '2H_Staff', 'Spellbook_open')
    const ys = layout.ysaline
    ysaline.root.position.set(ys.x, grid.heightAt(ys.x, ys.z), ys.z)
    ysaline.yaw = Math.atan2(start.x - ys.x, start.z - ys.z)
    for (const m of ysaline.meshes) this.atmosphere.shadows.addShadowCaster(m, false)
    this.obstacles.add({ x: ys.x, z: ys.z, r: 0.6 })

    this.buildInteractables(places)
    this.bindInput()
    // Compteurs par image (?perf et tests) : appels de dessin, durée d'une image.
    if (this.params.has('perf') || this.params.has('e2e')) {
      this.instrumentation = new SceneInstrumentation(scene)
      this.instrumentation.captureFrameTime = true
    }
    this.progress("L'île est prête", 1)
    // Les habitants arrivent après : leurs modèles (3,6 Mo chacun) ne retardent pas l'entrée dans l'île ; chacun apparaît quand il est chargé.
    void this.buildVillagers().catch((error: unknown) => {
      if (!this.closed) console.error('Les habitants du village n’ont pas pu être chargés', error)
    })

    this.lastFrame = performance.now()
    this.islandLoop = () => {
      const now = performance.now()
      const dt = Math.min(0.05, (now - this.lastFrame) / 1000)
      this.lastFrame = now
      this.update(dt)
      scene.render()
    }
    engine.runRenderLoop(this.islandLoop)
    const onResize = () => engine.resize()
    window.addEventListener('resize', onResize)
    this.disposers.push(() => window.removeEventListener('resize', onResize))
  }

  // --- Caméra ---------------------------------------------------------------------------

  private setupCamera(): void {
    const camera = this.camera
    camera.lowerRadiusLimit = 3.5
    camera.upperRadiusLimit = 18
    camera.lowerBetaLimit = 0.45
    camera.upperBetaLimit = 1.5
    camera.wheelDeltaPercentage = 0.01
    camera.panningSensibility = 0
    camera.angularSensibilityX = 1400
    camera.angularSensibilityY = 1400
    camera.minZ = 0.2
    camera.maxZ = 2400
    camera.fov = 0.9
    camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput')
    camera.attachControl(this.canvas, true)
    const onPointer = () => {
      this.lastCameraInput = performance.now()
    }
    this.canvas.addEventListener('pointerdown', onPointer)
    this.canvas.addEventListener('wheel', onPointer, { passive: true })
    this.disposers.push(() => {
      this.canvas.removeEventListener('pointerdown', onPointer)
      this.canvas.removeEventListener('wheel', onPointer)
    })
  }

  private updateCamera(dt: number, moving: boolean): void {
    const camera = this.camera
    const hero = this.hero.root.position
    const target = new Vector3(hero.x, hero.y + 1.45, hero.z)
    // En place : réaffecter `camera.target` recalculerait les angles depuis l'ancienne position
    // et annulerait chaque frame le mouvement de la souris.
    camera.target.copyFrom(Vector3.Lerp(camera.target, target, 1 - Math.exp(-10 * dt)))
    this.followGoal(dt)
    // Sans action de la souris depuis un moment, la caméra revient doucement derrière le héros.
    if (moving && performance.now() - this.lastCameraInput > 1800) {
      const yaw = this.hero.yaw
      const behind = Math.atan2(-Math.cos(yaw), -Math.sin(yaw))
      camera.alpha += angleDelta(camera.alpha, behind) * Math.min(1, dt * 1.6)
    }
    // Jamais sous le sol : on relève la caméra tant qu'elle touche le relief.
    for (let k = 0; k < 8; k += 1) {
      const p = camera.position
      if (p.y > this.grid.heightAt(p.x, p.z) + 0.7 || camera.beta <= camera.lowerBetaLimit!) break
      camera.beta = Math.max(camera.lowerBetaLimit!, camera.beta - 0.04)
      camera.getViewMatrix(true)
    }
  }

  /** La caméra glisse vers son but (écran d'apparence) ; à la fin du délai elle l'atteint et la souris reprend la main. */
  private followGoal(dt: number): void {
    const goal = this.cameraGoal
    if (!goal) return
    const camera = this.camera
    const k = 1 - Math.exp(-7 * dt)
    camera.alpha += angleDelta(camera.alpha, goal.alpha) * k
    camera.beta += (goal.beta - camera.beta) * k
    camera.radius += (goal.radius - camera.radius) * k
    camera.targetScreenOffset.x += (goal.offsetX - camera.targetScreenOffset.x) * k
    this.lastCameraInput = performance.now()
    if (performance.now() >= goal.until) {
      camera.alpha += angleDelta(camera.alpha, goal.alpha)
      camera.beta = goal.beta
      camera.radius = goal.radius
      camera.targetScreenOffset.x = goal.offsetX
      this.cameraGoal = null
    }
  }

  /**
   * Écran d'apparence ouvert (`true`) ou fermé : la caméra passe devant le héros, tout près et décalé pour qu'il reste visible à côté du panneau
   * (à droite), puis revient derrière lui comme avant. Le héros ne bouge pas pendant ce temps (l'interface a la main) ; la souris peut tourner autour.
   */
  setShowcase(on: boolean): void {
    if (this.interior) return
    const camera = this.camera
    const behind = Math.atan2(-Math.cos(this.hero.yaw), -Math.sin(this.hero.yaw))
    if (on) {
      this.cameraBefore ??= { beta: camera.beta, radius: camera.radius }
      this.cameraGoal = { alpha: behind + Math.PI, beta: 1.32, radius: 4.8, offsetX: SHOWCASE_OFFSET, until: performance.now() + SHOWCASE_MS }
    } else if (this.cameraBefore) {
      this.cameraGoal = { alpha: behind, beta: this.cameraBefore.beta, radius: this.cameraBefore.radius, offsetX: 0, until: performance.now() + SHOWCASE_MS }
      this.cameraBefore = null
    }
  }

  // --- Commandes ------------------------------------------------------------------------

  private bindInput(): void {
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
    // Clic (sans glisser) sur le sol : le héros y va.
    this.scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERTAP || !this.inputEnabled) return
      const pick = info.pickInfo
      if (pick?.hit && pick.pickedMesh?.name === 'sol' && pick.pickedPoint) {
        this.destination = { x: pick.pickedPoint.x, z: pick.pickedPoint.z }
      }
    })
  }

  /** L'interface prend la main (question, dialogue) : le héros s'arrête. */
  setInputEnabled(enabled: boolean): void {
    if (this.interior) {
      this.interior.setInputEnabled(enabled)
      return
    }
    this.inputEnabled = enabled
    if (!enabled) {
      this.keys.clear()
      this.destination = null
    }
  }

  private direction(): { x: number; z: number; walk: boolean } {
    const k = this.keys
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0)
    const r = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0)
    const walk = k.has('ShiftLeft') || k.has('ShiftRight')
    if (f !== 0 || r !== 0) {
      this.destination = null
      // Avant = direction du regard de la caméra, à plat ; droite = avant tourné d'un quart
      // de tour (repère main gauche de Babylon.js : avant +z, droite +x).
      const fx = -Math.cos(this.camera.alpha)
      const fz = -Math.sin(this.camera.alpha)
      return { x: fx * f + fz * r, z: fz * f - fx * r, walk }
    }
    if (this.destination) {
      const p = this.hero.root.position
      const dx = this.destination.x - p.x
      const dz = this.destination.z - p.z
      if (Math.hypot(dx, dz) < 0.6) {
        this.destination = null
        return { x: 0, z: 0, walk }
      }
      return { x: dx, z: dz, walk }
    }
    return { x: 0, z: 0, walk }
  }

  // --- Boucle ---------------------------------------------------------------------------

  private update(dt: number): void {
    const dir = this.inputEnabled ? this.direction() : { x: 0, z: 0, walk: false }
    const p = this.hero.root.position
    const s = step({ x: p.x, z: p.z }, dir, dir.walk ? WALK_SPEED : RUN_SPEED, dt, this.grid, this.obstacles)
    const moving = s.moved > 0.001
    p.x = s.x
    p.z = s.z
    p.y += (s.y - p.y) * Math.min(1, dt * 18)
    if (moving) {
      const yaw = Math.atan2(dir.x, dir.z)
      this.hero.yaw = this.hero.yaw + angleDelta(this.hero.yaw, yaw) * Math.min(1, dt * 12)
      this.hero.play(dir.walk ? 'walk' : 'run')
    } else {
      this.hero.play('idle')
    }
    if (!moving && this.destination) this.destination = null // bloqué : on renonce
    this.updateFox(dt)
    this.updateCamera(dt, moving)

    // La brume de l'air suit la région du héros en douceur (d'un coup en mode calme).
    const fog = this.scene.fogDensity
    this.scene.fogDensity = this.options.calm ? this.fogTarget : fog + (this.fogTarget - fog) * Math.min(1, dt * 1.2)

    this.regionTimer -= dt
    if (this.regionTimer <= 0) {
      this.regionTimer = 0.5
      const region = this.terrain.regionAt(p.x, p.z)
      if (region !== this.region) {
        this.region = region
        this.events.emit('region', { code: region, title: region ? regionTitle(region) : '', note: fogNote(region, this.lights) })
        this.fogTarget = this.fogFor(region)
      }
      this.updateFocus()
    }
    this.heroTimer -= dt
    if (this.heroTimer <= 0) {
      this.heroTimer = 0.1
      this.events.emit('hero', this.heroPose())
    }
    this.statsTimer -= dt
    if (this.statsTimer <= 0) {
      this.statsTimer = 1
      this.events.emit('stats', {
        fps: Math.round(this.engine.getFps()),
        drawCalls: this.instrumentation?.drawCallsCounter.current ?? 0,
        triangles: Math.round(this.scene.getActiveIndices() / 3),
      })
    }
  }

  /** Le renard suit le héros à deux pas, sur le côté ; il court s'il est distancé. */
  private updateFox(dt: number): void {
    if (!this.fox) return
    const hero = this.hero.root.position
    const fox = this.fox.root.position
    const yaw = this.hero.yaw
    const goal = { x: hero.x - Math.sin(yaw) * 2.2 + Math.cos(yaw) * 1.2, z: hero.z - Math.cos(yaw) * 2.2 - Math.sin(yaw) * 1.2 }
    const dx = goal.x - fox.x
    const dz = goal.z - fox.z
    const dist = Math.hypot(dx, dz)
    if (dist > 30) {
      fox.set(goal.x, this.grid.heightAt(goal.x, goal.z), goal.z) // trop loin : il nous rejoint
      return
    }
    const speed = dist > 4 ? RUN_SPEED * 1.1 : dist > 0.8 ? WALK_SPEED : 0
    const s = step({ x: fox.x, z: fox.z }, { x: dx, z: dz }, speed, dt, this.grid, this.obstacles)
    fox.x = s.x
    fox.z = s.z
    fox.y += (s.y - fox.y) * Math.min(1, dt * 15)
    if (s.moved > 0.001) {
      this.fox.yaw += angleDelta(this.fox.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 8)
      this.fox.play(speed > WALK_SPEED ? 'run' : 'walk')
    } else {
      this.fox.play('idle')
    }
  }

  // --- Ce qu'on peut faire dans l'île ---------------------------------------------------

  private buildInteractables(places: Place[]): void {
    const done = this.placesDone
    for (const place of places) {
      const open = isOpen(place, done)
      const y = this.grid.heightAt(place.x, place.z)
      const toStart = Math.atan2(layout.depart.x - place.x, layout.depart.z - place.z)
      const door = new Vector3(place.x + Math.sin(toStart) * 7.5, y, place.z + Math.cos(toStart) * 7.5)
      door.y = this.grid.heightAt(door.x, door.z)
      beacon(this.scene, `seuil-${place.dungeon.code}`, door, open ? '#ffd27a' : '#7a7f8c', open)
      this.interactables.push({
        id: place.dungeon.code, kind: 'lieu', label: place.dungeon.title, x: door.x, z: door.z, radius: 4, place, open,
      })
    }
    const ys = layout.ysaline
    this.interactables.push({ id: 'ysaline', kind: 'ysaline', label: 'Maître Ysaline', x: ys.x, z: ys.z, radius: 3.2 })
    // Pierres de savoir : une près du départ, une au cœur de chaque région.
    const stones: { id: string; x: number; z: number; label: string }[] = [
      { id: 'pierre-eveil', ...layout.pierre_eveil, label: "La Pierre d'éveil" },
    ]
    for (const [code, region] of Object.entries(layout.regions)) {
      stones.push({ id: `pierre-${code}`, x: region.x - 9, z: region.z + 7, label: `La Pierre de ${regionTitle(code).replace(/^(Les?|La|L')\s*/, '')}` })
    }
    const material = new StandardMaterial('pierre', this.scene)
    material.diffuseColor = Color3.FromHexString('#6c6f7d')
    material.specularColor = new Color3(0.08, 0.08, 0.1)
    for (const stone of stones) {
      if (this.grid.heightAt(stone.x, stone.z) < 1) continue
      const y = this.grid.heightAt(stone.x, stone.z)
      const mesh = MeshBuilder.CreateCylinder(stone.id, { diameterTop: 0.6, diameterBottom: 1.25, height: 2.2, tessellation: 6 }, this.scene)
      mesh.position.set(stone.x, y + 1.0, stone.z)
      mesh.rotation.y = stone.x
      mesh.material = material
      mesh.receiveShadows = true
      mesh.isPickable = false
      this.atmosphere.shadows.addShadowCaster(mesh, false)
      // Cristal au-dessus de la pierre : bleu pâle tant qu'elle dort, doré une fois éveillée.
      const crystal = MeshBuilder.CreatePolyhedron(`${stone.id}-cristal`, { type: 1, size: 0.32 }, this.scene)
      crystal.position.set(stone.x, y + 2.75, stone.z)
      crystal.scaling.y = 1.6
      const glow = new StandardMaterial(`${stone.id}-cristal`, this.scene)
      glow.disableLighting = true
      glow.diffuseColor = Color3.Black()
      crystal.material = glow
      crystal.isPickable = false
      const awake = this.options.save.stones[stone.id] === today()
      this.setStoneLook(crystal, awake)
      this.stones.set(stone.id, crystal)
      beacon(this.scene, stone.id, new Vector3(stone.x, y, stone.z), '#8fd3ff', !awake)
      this.obstacles.add({ x: stone.x, z: stone.z, r: 0.75 })
      this.interactables.push({ id: stone.id, kind: 'pierre', label: stone.label, x: stone.x, z: stone.z, radius: 2.8, open: !awake })
    }
    this.buildDayStone()
    this.buildRelics()
    this.buildRelicTable()
    this.buildBoat()
    this.buildBridge()
    this.buildRange()
    // Les cristaux tournent doucement sur eux-mêmes (immobiles en mode calme).
    if (!this.options.calm) {
      this.scene.onBeforeRenderObservable.add(() => {
        const dt = this.engine.getDeltaTime() / 1000
        for (const crystal of this.stones.values()) crystal.rotation.y += dt * 0.8
        if (this.dayCrystal) this.dayCrystal.rotation.y += dt * 0.8
        for (const { gem } of this.relicMeshes.values()) gem.rotation.y += dt * 1.1
        for (const gem of this.tableGems) gem.rotation.y += dt * 0.9
        if (this.boat) {
          const t = performance.now() / 1000
          this.boat.position.y = SEA_LEVEL - 0.05 + Math.sin(t * 1.3) * 0.07
          this.boat.rotation.z = Math.sin(t * 1.1) * 0.025
        }
      })
    }
  }

  /**
   * Les reliques de l'île (core/relics.ts, positions de reliques.json) : un éclat flottant de la couleur et de la forme de leur élément,
   * sur un anneau lumineux. Celles que la partie possède déjà ne sont pas posées. Elles ne figurent pas sur la mini-carte : on les trouve
   * en se promenant.
   */
  private buildRelics(): void {
    const owned = new Set(this.options.save.relics)
    for (const relic of ISLAND_RELICS) {
      if (owned.has(relic.id)) continue
      const { x, z } = relic.source
      const y = this.grid.heightAt(x, z)
      if (y < 1) continue
      const element = elementOf(relic)
      const gem =
        element.forme === 'cercle'
          ? MeshBuilder.CreateSphere(`${relic.id}-eclat`, { diameter: 0.7, segments: 8 }, this.scene)
          : MeshBuilder.CreatePolyhedron(`${relic.id}-eclat`, { type: element.forme === 'triangle' ? 0 : element.forme === 'losange' ? 1 : 3, size: 0.42 }, this.scene)
      if (element.forme === 'losange') gem.scaling.y = 1.5
      gem.position.set(x, y + 1.3, z)
      const glow = new StandardMaterial(`${relic.id}-eclat`, this.scene)
      glow.disableLighting = true
      glow.diffuseColor = Color3.Black()
      glow.emissiveColor = Color3.FromHexString(element.couleur).scale(1.1)
      gem.material = glow
      gem.isPickable = false
      const ring = beacon(this.scene, `relique-${relic.id}`, new Vector3(x, y, z), element.couleur, true)
      this.relicMeshes.set(relic.id, { gem, ring })
      this.interactables.push({ id: `relique-${relic.id}`, kind: 'relique', label: relic.name, x, z, radius: 2.4, relic: relic.id })
    }
  }

  /**
   * La Table des Reliques (décision D13), sur le plateau de la Citadelle (`table_reliques` de ile.json) : un plateau de pierre sur son socle, quatre
   * éclats aux coins (un par élément) et un anneau qui brille tant qu'une table du jour attend (au moins deux reliques, récompense pas encore prise).
   */
  private buildRelicTable(): void {
    const { x, z } = layout.table_reliques
    const y = this.grid.heightAt(x, z)
    if (y < 1) return
    const stone = new StandardMaterial('table-reliques-pierre', this.scene)
    stone.diffuseColor = Color3.FromHexString('#8c8674')
    stone.specularColor = new Color3(0.08, 0.08, 0.1)
    const base = MeshBuilder.CreateCylinder('table-reliques-socle', { diameterTop: 1.5, diameterBottom: 2.1, height: 0.95, tessellation: 8 }, this.scene)
    base.position.set(x, y + 0.47, z)
    const slab = MeshBuilder.CreateBox('table-reliques-plateau', { width: 3.1, depth: 3.1, height: 0.3 }, this.scene)
    slab.position.set(x, y + 1.1, z)
    for (const mesh of [base, slab]) {
      mesh.material = stone
      mesh.receiveShadows = true
      mesh.isPickable = false
      this.atmosphere.shadows.addShadowCaster(mesh, false)
    }
    this.obstacles.add({ x, z, r: 1.7 })
    ELEMENTS.forEach((element, i) => {
      const gem =
        element.forme === 'cercle'
          ? MeshBuilder.CreateSphere(`table-reliques-${element.id}`, { diameter: 0.5, segments: 8 }, this.scene)
          : MeshBuilder.CreatePolyhedron(`table-reliques-${element.id}`, { type: element.forme === 'triangle' ? 0 : element.forme === 'losange' ? 1 : 3, size: 0.3 }, this.scene)
      if (element.forme === 'losange') gem.scaling.y = 1.5
      gem.position.set(x + (i % 2 === 0 ? -1.05 : 1.05), y + 1.65, z + (i < 2 ? -1.05 : 1.05))
      const glow = new StandardMaterial(`table-reliques-${element.id}`, this.scene)
      glow.disableLighting = true
      glow.diffuseColor = Color3.Black()
      glow.emissiveColor = Color3.FromHexString(element.couleur).scale(1.1)
      gem.material = glow
      gem.isPickable = false
      this.tableGems.push(gem)
    })
    const ready = this.tableReady(this.options.save)
    beacon(this.scene, 'table-reliques', new Vector3(x, y, z), '#c8a2e8', ready)
    this.interactables.push({ id: 'table-reliques', kind: 'table', label: 'La Table des Reliques', x, z, radius: 3.4, open: ready })
  }

  /**
   * Le pont des fractions (la Lice, sur le plateau de la Citadelle ; core/pont.ts) : une passerelle de bois entre deux piles de pierre, deux rambardes et, à côté,
   * un tas de planches aux couleurs des réglettes (une par dénominateur). Il n'existe que pour une classe qui a ce jeu (la 6e). Pas de modèle : des formes simples.
   * Le héros s'en approche et E ouvre le jeu (`kind: 'pont'`) ; un anneau lumineux le désigne.
   */
  private buildBridge(): void {
    if (!generatorFor('pont', this.options.level)) return
    const { x, z } = layout.pont
    const y = this.grid.heightAt(x, z)
    if (y < 1) return
    const matte = (name: string, hex: string): StandardMaterial => {
      const m = new StandardMaterial(name, this.scene)
      m.diffuseColor = Color3.FromHexString(hex)
      m.specularColor = new Color3(0.06, 0.06, 0.08)
      return m
    }
    const wood = matte('pont-bois', '#a8703f')
    const stone = matte('pont-pierre', '#8c8674')
    const solid = (mesh: Mesh, material: StandardMaterial): Mesh => {
      mesh.material = material
      mesh.receiveShadows = true
      mesh.isPickable = false
      this.atmosphere.shadows.addShadowCaster(mesh, false)
      return mesh
    }
    // La passerelle suit l'axe est-ouest : deux piles, le tablier posé dessus, une rambarde de chaque côté.
    for (const side of [-1, 1]) {
      const pier = MeshBuilder.CreateCylinder(`pont-pile-${side}`, { diameterTop: 1.1, diameterBottom: 1.5, height: 1.5, tessellation: 8 }, this.scene)
      pier.position.set(x + side * 3.4, y + 0.75, z)
      solid(pier, stone)
      this.obstacles.add({ x: x + side * 3.4, z, r: 0.8 })
    }
    const deck = MeshBuilder.CreateBox('pont-tablier', { width: 7.4, height: 0.28, depth: 1.7 }, this.scene)
    deck.position.set(x, y + 1.55, z)
    solid(deck, wood)
    for (const side of [-1, 1]) {
      const rail = MeshBuilder.CreateBox(`pont-rambarde-${side}`, { width: 7.4, height: 0.12, depth: 0.12 }, this.scene)
      rail.position.set(x, y + 2.35, z + side * 0.78)
      solid(rail, wood)
      for (const post of [-3.4, 0, 3.4]) {
        const stake = MeshBuilder.CreateBox(`pont-poteau-${side}-${post}`, { width: 0.14, height: 0.85, depth: 0.14 }, this.scene)
        stake.position.set(x + post, y + 1.95, z + side * 0.78)
        solid(stake, wood)
      }
    }
    // Le tas de planches, au sud de la passerelle : des longueurs de 1/2, 1/3, 1/4, 1/6 de perche aux couleurs de leurs dénominateurs.
    for (const [i, length] of ['1/2', '1/3', '1/4', '1/6'].entries()) {
      const fraction = length === '1/2' ? 0.5 : length === '1/3' ? 0.34 : length === '1/4' ? 0.25 : 0.17
      const plank = MeshBuilder.CreateBox(`pont-planche-${length}`, { width: 7.4 * fraction * 0.9, height: 0.16, depth: 0.5 }, this.scene)
      plank.position.set(x - 3.2 + 7.4 * fraction * 0.45, y + 0.12 + i * 0.17, z - 3.1)
      solid(plank, matte(`pont-planche-${length}`, colorFor(length)))
    }
    beacon(this.scene, 'pont-fractions', new Vector3(x, y, z - 1.8), '#e09f3e', true)
    this.interactables.push({ id: 'pont-fractions', kind: 'pont', label: 'Le pont des fractions', x, z: z - 1.8, radius: 4.4, open: true })
  }

  /**
   * Le stand de tir de la Lice (sur le plateau de la Citadelle, face au pont ; core/tir.ts) : un comptoir de bois où l'on se tient, deux piquets de visée et, plus
   * loin, une cible peinte sur un poteau (anneaux rouges et blancs, cœur doré). Il existe pour les deux classes (rapporteur en 6e, repère de l'arbalète en 2nde).
   * Le héros s'en approche et E ouvre le jeu (`kind: 'tir'`) ; un anneau lumineux le désigne. Pas de modèle : des formes simples.
   */
  private buildRange(): void {
    if (!generatorFor('tir', this.options.level)) return
    const { x, z } = layout.stand_tir
    const y = this.grid.heightAt(x, z)
    if (y < 1) return
    const matte = (name: string, hex: string): StandardMaterial => {
      const m = new StandardMaterial(name, this.scene)
      m.diffuseColor = Color3.FromHexString(hex)
      m.specularColor = new Color3(0.06, 0.06, 0.08)
      return m
    }
    const wood = matte('tir-bois', '#a8703f')
    const solid = (mesh: Mesh, material: StandardMaterial): Mesh => {
      mesh.material = material
      mesh.receiveShadows = true
      mesh.isPickable = false
      this.atmosphere.shadows.addShadowCaster(mesh, false)
      return mesh
    }
    // Le comptoir où l'archer se tient, et ses deux piquets.
    const counter = MeshBuilder.CreateBox('tir-comptoir', { width: 3.4, height: 0.9, depth: 0.7 }, this.scene)
    counter.position.set(x, y + 0.45, z)
    solid(counter, wood)
    this.obstacles.add({ x, z, r: 1.7 })
    for (const side of [-1, 1]) {
      const stake = MeshBuilder.CreateBox(`tir-piquet-${side}`, { width: 0.16, height: 1.5, depth: 0.16 }, this.scene)
      stake.position.set(x + side * 1.9, y + 0.75, z)
      solid(stake, wood)
    }
    // La cible, au nord, face au comptoir : un poteau et quatre disques posés les uns devant les autres (le plus petit, le plus près de l'archer).
    const targetZ = z + 7
    const pole = MeshBuilder.CreateCylinder('tir-poteau', { diameter: 0.22, height: 2.2, tessellation: 8 }, this.scene)
    pole.position.set(x, y + 1.1, targetZ + 0.2)
    solid(pole, wood)
    const rings: [number, string][] = [[1.1, '#c93c34'], [0.82, '#f4efe0'], [0.54, '#c93c34'], [0.26, '#e0b13e']]
    for (const [i, [radius, hex]] of rings.entries()) {
      const disc = MeshBuilder.CreateCylinder(`tir-anneau-${i}`, { diameter: radius * 2, height: 0.06, tessellation: 24 }, this.scene)
      disc.rotation.x = Math.PI / 2
      disc.position.set(x, y + 1.95, targetZ - i * 0.06)
      solid(disc, matte(`tir-anneau-${i}`, hex))
    }
    this.obstacles.add({ x, z: targetZ, r: 0.8 })
    beacon(this.scene, 'tir-stand', new Vector3(x, y, z - 1.8), '#d9534f', true)
    this.interactables.push({ id: 'tir-stand', kind: 'tir', label: 'Le stand de tir', x, z: z - 1.8, radius: 4.4, open: true })
  }

  /**
   * La barque de l'île du Sphinx (core/sphinx), sur la côte est : une coque de bois avec une proue, un mât et une voile claire, qui flotte juste
   * au large de la plage ; le héros s'en approche par la plage (`barque` de ile.json) et E le fait monter à bord. Pas de modèle : des formes simples.
   */
  private buildBoat(): void {
    const { x, z, bateau } = layout.barque
    if (this.grid.heightAt(bateau.x, bateau.z) > SEA_LEVEL - 0.5) return // pas d'eau là : pas de barque (le test de la disposition le garde)
    const wood = new StandardMaterial('barque-bois', this.scene)
    wood.diffuseColor = Color3.FromHexString('#8b5a2b')
    wood.specularColor = new Color3(0.05, 0.05, 0.05)
    const sail = new StandardMaterial('barque-voile', this.scene)
    sail.diffuseColor = Color3.FromHexString('#f3ead2')
    sail.emissiveColor = Color3.FromHexString('#f3ead2').scale(0.08) // à peine : trop clair, la voile devenait un aplat blanc
    sail.backFaceCulling = false
    const hull = MeshBuilder.CreateBox('barque-coque', { width: 3.6, height: 0.8, depth: 1.7 }, this.scene)
    hull.position.set(bateau.x, SEA_LEVEL - 0.05, bateau.z)
    hull.material = wood
    const bow = MeshBuilder.CreateBox('barque-proue', { width: 1.2, height: 0.8, depth: 1.2 }, this.scene)
    bow.rotation.y = Math.PI / 4
    bow.position.set(1.8, 0, 0) // vers l'est, vers l'île du Sphinx
    bow.material = wood
    bow.parent = hull
    const mast = MeshBuilder.CreateCylinder('barque-mat', { diameter: 0.14, height: 3.2, tessellation: 8 }, this.scene)
    mast.position.set(-0.2, 1.9, 0)
    mast.material = wood
    mast.parent = hull
    const cloth = MeshBuilder.CreatePlane('barque-toile', { width: 2.1, height: 2.2 }, this.scene)
    cloth.rotation.y = Math.PI / 2 // la voile est tendue dans le sens de la coque
    cloth.position.set(-0.2, 2.2, 0)
    cloth.material = sail
    cloth.parent = hull
    for (const mesh of [hull, bow, mast, cloth]) mesh.isPickable = false
    this.atmosphere.shadows.addShadowCaster(hull, false)
    this.obstacles.add({ x: bateau.x, z: bateau.z, r: 2.1 })
    this.boat = hull
    beacon(this.scene, 'barque', new Vector3(x, SEA_LEVEL, z), '#f3ead2', true)
    this.interactables.push({ id: 'barque', kind: 'barque', label: 'La barque du Sphinx', x, z, radius: 4.2, open: true })
  }

  /**
   * Les habitants du village de la classe (core/village.ts) : chacun se tient à son emplacement autour du puits (`ile.json`, village.habitants), tourné vers le puits ;
   * un « ! » doré flotte au-dessus de sa tête tant que sa quête du jour attend. L'interaction (E) ouvre son dialogue (`interact`, kind « habitant »).
   */
  private async buildVillagers(): Promise<void> {
    const village = villageFor(this.options.level)
    if (!village) return
    const center = layout.village
    const material = new StandardMaterial('habitant-appel', this.scene)
    material.disableLighting = true
    material.diffuseColor = Color3.Black()
    material.emissiveColor = Color3.FromHexString('#ffd447')
    for (const [index, npc] of village.npcs.entries()) {
      const slot = center.habitants[index]
      if (!slot) continue
      const x = center.x + slot.dx
      const z = center.z + slot.dz
      const y = this.grid.heightAt(x, z)
      const parts = defaultsFor(npc.model)
      const character = await loadNpc(this.scene, npc.model, `habitant-${npc.code}`, parts.main, parts.off)
      if (this.closed) return // le monde s'est fermé pendant le chargement
      character.root.position.set(x, y, z)
      character.yaw = Math.atan2(center.x - x, center.z - z)
      for (const m of character.meshes) this.atmosphere.shadows.addShadowCaster(m, false)
      this.obstacles.add({ x, z, r: 0.6 })
      // Le « ! » : un trait effilé et un point, dorés (jamais de texte dans le monde : pas de police à charger).
      const marker = new TransformNode(`habitant-${npc.code}-appel`, this.scene)
      const bar = MeshBuilder.CreateCylinder(`habitant-${npc.code}-trait`, { diameterTop: 0.36, diameterBottom: 0.16, height: 0.62, tessellation: 8 }, this.scene)
      const dot = MeshBuilder.CreateSphere(`habitant-${npc.code}-point`, { diameter: 0.2, segments: 8 }, this.scene)
      bar.parent = marker
      dot.parent = marker
      bar.position.y = 0.2
      dot.position.y = -0.26
      for (const mesh of [bar, dot]) {
        mesh.material = material
        mesh.isPickable = false
      }
      marker.position.set(x, y + 2.55, z)
      this.villagers.set(npc.code, { npc, character, marker })
      const done = questDone(this.options.save, npc.code, localDay())
      marker.setEnabled(!done)
      this.interactables.push({ id: `habitant-${npc.code}`, kind: 'habitant', label: npc.name, x, z, radius: 2.6, open: !done, npc })
      this.events.emit('markers', this.mapMarkers()) // le repère du village s'allume dès qu'un habitant attend
    }
    // Le « ! » monte et descend doucement (immobile en mode calme).
    if (!this.options.calm) {
      this.scene.onBeforeRenderObservable.add(() => {
        const bob = Math.sin(performance.now() / 1000 * 2.6) * 0.09
        for (const { marker, character } of this.villagers.values()) marker.position.y = character.root.position.y + 2.55 + bob
      })
    }
  }

  /** Les quêtes du jour ont changé (une quête vient d'être faite) : le « ! » de chaque habitant s'éteint ou s'allume. */
  setQuestState(quests: Record<string, string>): void {
    const day = localDay()
    for (const { npc, marker } of this.villagers.values()) {
      const waiting = quests[npc.code] !== day
      marker.setEnabled(waiting)
      const target = this.interactables.find((it) => it.id === `habitant-${npc.code}`)
      if (target) target.open = waiting
    }
    this.events.emit('markers', this.mapMarkers()) // le repère du village suit les quêtes qui attendent
  }

  /** Le héros parle à un habitant : ils se tournent l'un vers l'autre, l'habitant fait un geste (la quête faite : il se réjouit). */
  talkTo(code: string, cheer = false): void {
    const talker = this.villagers.get(code)
    if (!talker) return
    const hero = this.hero.root.position
    const at = talker.character.root.position
    talker.character.yaw = Math.atan2(hero.x - at.x, hero.z - at.z)
    this.hero.yaw = Math.atan2(at.x - hero.x, at.z - hero.z)
    void talker.character.playOnce(cheer ? 'cheer' : 'interact')
  }

  private tableReady(save: Pick<SaveData, 'relics' | 'table'>): boolean {
    return save.relics.length >= MIN_RELICS && save.table !== localDay()
  }

  /** Les reliques ou la récompense du jour ont changé : l'anneau de la table s'allume ou s'éteint. */
  setTableState(save: Pick<SaveData, 'relics' | 'table'>): void {
    const target = this.interactables.find((it) => it.id === 'table-reliques')
    if (!target) return
    target.open = this.tableReady(save)
    setBeacon(this.scene, 'table-reliques', '#c8a2e8', target.open)
  }

  /** Une relique vient d'être ramassée : elle disparaît de l'île dans une gerbe d'étincelles. */
  relicCollected(id: string): void {
    const mesh = this.relicMeshes.get(id)
    const at = this.interactables.findIndex((it) => it.relic === id)
    if (at >= 0) this.interactables.splice(at, 1)
    if (mesh) {
      this.sparkle(mesh.gem.position.clone())
      mesh.gem.dispose(false, true)
      mesh.ring.dispose(false, true)
      this.relicMeshes.delete(id)
    }
    this.hero.playOnce('cheer')
    if (this.focused?.relic === id) {
      this.focused = null
      this.events.emit('focus', null)
    }
  }

  /**
   * La Pierre du Jour (défi quotidien), sur le chemin de la Citadelle : plus haute que les pierres de savoir, grès chaud et cristal
   * doré tant que le défi du jour reste à relever ; le cristal s'apaise une fois relevé (elle se réveille demain).
   */
  private buildDayStone(): void {
    const { x, z } = layout.pierre_jour
    const y = this.grid.heightAt(x, z)
    if (y < 1) return
    const material = new StandardMaterial('pierre-jour', this.scene)
    material.diffuseColor = Color3.FromHexString('#9a8566')
    material.specularColor = new Color3(0.08, 0.08, 0.1)
    const mesh = MeshBuilder.CreateCylinder('pierre-jour', { diameterTop: 0.7, diameterBottom: 1.5, height: 2.8, tessellation: 6 }, this.scene)
    mesh.position.set(x, y + 1.25, z)
    mesh.material = material
    mesh.receiveShadows = true
    mesh.isPickable = false
    this.atmosphere.shadows.addShadowCaster(mesh, false)
    const crystal = MeshBuilder.CreatePolyhedron('pierre-jour-cristal', { type: 1, size: 0.4 }, this.scene)
    crystal.position.set(x, y + 3.4, z)
    crystal.scaling.y = 1.6
    const glow = new StandardMaterial('pierre-jour-cristal', this.scene)
    glow.disableLighting = true
    glow.diffuseColor = Color3.Black()
    crystal.material = glow
    crystal.isPickable = false
    this.dayCrystal = crystal
    this.dayRing = beacon(this.scene, 'pierre-jour', new Vector3(x, y, z), '#ffd447', true)
    this.obstacles.add({ x, z, r: 0.85 })
    const done = this.options.save.daily.days.includes(localDay())
    this.interactables.push({ id: 'pierre-jour', kind: 'jour', label: 'La Pierre du Jour', x, z, radius: 3, open: !done })
    this.setDayLook(!done)
  }

  /**
   * Habille le héros et son renard avec cette apparence (celle de l'écran de personnalisation, déjà validée par `lookOf`). La même silhouette : seulement
   * ses pièces, sa cape et le pelage ; une autre : un nouveau modèle prend la place de l'ancien, au même endroit et dans le même sens (ombre comprise).
   * Les demandes se font l'une après l'autre (le chargement d'un modèle est asynchrone) et chacune habille avec le dernier choix : des clics rapprochés
   * ne laissent jamais deux héros ni des pièces du mauvais modèle. Pas pendant un lieu : son héros est rechargé à chaque entrée avec `this.look`.
   */
  setLook(next: Look): Promise<void> {
    this.look = next
    const run = () => this.applyLook()
    this.lookQueue = this.lookQueue.then(run, run)
    return this.lookQueue
  }

  /** Met à l’écran la dernière apparence voulue : le pelage du renard, puis les pièces du héros ou son nouveau modèle. */
  private async applyLook(): Promise<void> {
    if (this.closed) return
    const wanted = this.look
    if (this.fox && wanted.pet_fur !== this.shownFur) {
      tintFox(this.fox, fur(wanted.pet_fur))
      this.shownFur = wanted.pet_fur
    }
    if (this.interior) return // `leavePlace` remet l'île à jour
    if (wanted.model === this.shownModel) {
      dress(this.hero, wanted.model, wanted)
      return
    }
    const old = this.hero
    const replacement = await loadHero(this.scene, wanted)
    if (this.closed) return // le monde s'est fermé pendant le chargement : sa scène n'existe plus
    replacement.root.position.copyFrom(old.root.position)
    replacement.yaw = old.yaw
    for (const m of replacement.meshes) this.atmosphere.shadows.addShadowCaster(m, false)
    for (const m of old.meshes) this.atmosphere.shadows.removeShadowCaster(m, false)
    this.hero = replacement
    this.shownModel = wanted.model
    old.dispose()
  }

  /**
   * Un lieu vient d'être terminé : les lieux qui s'ouvrent (le suivant de sa région) s'allument, leur repère sur la mini-carte aussi.
   * Le monde garde la partie de sa création : sans cet appel, le lieu suivant n'apparaîtrait ouvert qu'après un rechargement.
   */
  placeCompleted(done: Record<string, number>): void {
    this.placesDone = { ...done }
    this.relight()
    for (const it of this.interactables) {
      if (it.kind !== 'lieu' || !it.place) continue
      const open = isOpen(it.place, this.placesDone)
      it.open = open
      setBeacon(this.scene, `seuil-${it.place.dungeon.code}`, open ? '#ffd27a' : '#7a7f8c', open)
    }
    this.events.emit('markers', this.mapMarkers())
  }

  /** Lumière de chaque région, de 0 à 1, pour le sol. */
  private lightLevels(): Record<string, number> {
    return Object.fromEntries(Object.entries(this.lights).map(([code, region]) => [code, region.light]))
  }

  /** Densité de brume de l'air d'une région (celle du monde, épaissie quand la région n'est pas éclairée ; hors région : celle du monde). */
  private fogFor(region: string | null): number {
    const light = region ? this.lights[region]?.light : undefined
    return light === undefined ? this.baseFog : this.baseFog * fogDensityFactor(light)
  }

  /** Les pages rapportées ont changé : le sol de chaque région reprend ses couleurs, la brume du héros suit. */
  private relight(): void {
    this.lights = regionLights(this.places, this.placesDone)
    this.ground?.setLights(this.lightLevels())
    this.fogTarget = this.fogFor(this.region)
    if (this.options.calm) this.scene.fogDensity = this.fogTarget
  }

  /** Densité de brume du monde, hors de toute région sombre (tests dans le navigateur). */
  fogBase(): number {
    return this.baseFog
  }

  /** Lumière et état de chaque région (tests dans le navigateur et lecteurs d'écran). */
  regionLights(): Record<string, RegionLight> {
    return this.lights
  }

  /** Le défi du jour vient d'être relevé (ou ne l'est pas encore) : l'éclat de la pierre et son repère sur la carte suivent. */
  setDayChallenge(todo: boolean): void {
    const target = this.interactables.find((it) => it.id === 'pierre-jour')
    if (!target) return
    target.open = todo
    this.setDayLook(todo)
    this.events.emit('markers', this.mapMarkers())
  }

  private setDayLook(todo: boolean): void {
    const crystal = this.dayCrystal
    if (crystal) (crystal.material as StandardMaterial).emissiveColor = Color3.FromHexString(todo ? '#ffd447' : '#9fa8b8').scale(todo ? 1.25 : 0.85)
    if (this.dayRing) this.dayRing.setEnabled(todo)
  }

  private setStoneLook(crystal: Mesh, awake: boolean): void {
    const material = crystal.material as StandardMaterial
    material.emissiveColor = Color3.FromHexString(awake ? '#ffd27a' : '#6fb6ff').scale(awake ? 1.2 : 0.75)
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

  /** Ce que l'interface a décidé après une question : la pierre s'éveille (ou pas). */
  stoneAnswered(id: string, correct: boolean): void {
    const target = this.interactables.find((it) => it.id === id)
    if (!target) return
    if (correct) {
      target.open = false
      const crystal = this.stones.get(id)
      if (crystal) this.setStoneLook(crystal, true)
      const ring = this.scene.getMeshByName(`${id}-anneau`)
      ring?.setEnabled(false)
      this.hero.playOnce('cheer')
      this.sparkle(new Vector3(target.x, this.grid.heightAt(target.x, target.z) + 2.4, target.z))
    } else {
      this.hero.playOnce('hit')
    }
    this.events.emit('focus', this.focused)
    this.events.emit('markers', this.mapMarkers())
  }

  // --- Mini-carte -------------------------------------------------------------------------

  heroPose(): HeroPose {
    const p = this.hero.root.position
    const yaw = this.hero.yaw
    const alpha = this.camera.alpha
    return { x: p.x, z: p.z, heading: heading(Math.sin(yaw), Math.cos(yaw)), view: heading(-Math.cos(alpha), -Math.sin(alpha)) }
  }

  private mapMarkers(): MapMarker[] {
    return mapMarkers(layout, this.options.level, this.interactables, this.placesDone)
  }

  mapInfo(): MapInfo {
    const theme = THEMES[this.options.world]
    const grid = this.grid
    return {
      heightAt: (x, z) => grid.heightAt(x, z),
      extent: layout.taille,
      palette: { water: theme.waterColor, regions: Object.values(layout.regions), desaturate: theme.desaturate },
      markers: this.mapMarkers(),
    }
  }

  /** Gerbe d'étincelles (plus discrète en mode calme). */
  private sparkle(at: Vector3): void {
    sparkle(this.scene, at, this.options.calm)
  }

  // --- Outils de test et de capture (?e2e) ------------------------------------------------

  heroPosition(): { x: number; y: number; z: number } {
    const p = this.hero.root.position
    return { x: p.x, y: p.y, z: p.z }
  }

  /** Hauteur d'un monstre à l'échelle 1, squelette appliqué (v2/tools/mesurer_monstres.mjs). */
  async measureMonster(model: string): Promise<{ height: number }> {
    const monster = await loadMonster(this.scene, model, `mesure-${model}`, 1)
    monster.root.position.set(0, 300, 0) // loin de tout, sous le regard de personne
    const frame = () => new Promise<void>((resolve) => this.scene.onAfterRenderObservable.addOnce(() => resolve()))
    await frame()
    await frame()
    const { lowest, highest } = skinnedHeights(monster)
    monster.root.dispose(false, true)
    return { height: highest - lowest }
  }

  teleport(x: number, z: number, faceX?: number, faceZ?: number): void {
    this.hero.root.position.set(x, this.grid.heightAt(x, z), z)
    if (faceX !== undefined && faceZ !== undefined) this.hero.yaw = Math.atan2(faceX - x, faceZ - z)
    this.camera.target.set(x, this.grid.heightAt(x, z) + 1.45, z)
    this.camera.alpha = Math.atan2(-Math.cos(this.hero.yaw), -Math.sin(this.hero.yaw))
    this.regionTimer = 0
    this.heroTimer = 0
  }

  /** Où un point du monde tombe à l'écran, en pixels de la page : les tests dans le navigateur vérifient qu'un panneau ne cache pas le héros. */
  projectToScreen(x: number, y: number, z: number): { x: number; y: number } {
    const width = this.engine.getRenderWidth()
    const height = this.engine.getRenderHeight()
    const p = Vector3.Project(new Vector3(x, y, z), Matrix.Identity(), this.scene.getTransformMatrix(), this.camera.viewport.toGlobal(width, height))
    return { x: (p.x / width) * this.canvas.clientWidth, y: (p.y / height) * this.canvas.clientHeight }
  }

  /** Cadre la caméra (captures) : angle autour du héros, hauteur, distance. */
  frame(alpha: number, beta: number, radius: number): void {
    this.camera.alpha = alpha
    this.camera.beta = beta
    this.camera.radius = radius
    this.lastCameraInput = performance.now()
  }

  // --- Intérieur d'un lieu de quête -------------------------------------------------------------

  /**
   * Entre dans le lieu `code` : son intérieur (scène à part, même moteur) remplace l'île à l'écran, qui
   * est mise en pause. Rend faux si ce lieu n'existe pas pour cette classe. `onProgress` : chargement.
   */
  async enterPlace(code: string, onProgress?: (label: string, ratio: number) => void): Promise<boolean> {
    const place = this.places.find((p) => p.dungeon.code === code)
    if (!place || this.interior) return false
    this.setInputEnabled(false)
    const interior = await InteriorWorld.create(this.engine, this.canvas, {
      place,
      world: this.options.world,
      look: this.look,
      quality: this.quality,
      calm: this.options.calm,
      onProgress,
    })
    interior.events.on('focus', (it) => this.events.emit('focus', it))
    interior.events.on('interact', (it) => this.events.emit('interact', it))
    interior.events.on('room', (floor) => this.events.emit('floor', floor))
    interior.events.on('fight', (enemy) => this.events.emit('fight', enemy))
    interior.events.on('riddle', (pedestal) => this.events.emit('riddle', pedestal))
    interior.events.on('float', (float) => this.events.emit('float', float))
    // L'île se met en pause : plus d'image, plus d'événement de la souris pour sa caméra.
    if (this.islandLoop) this.engine.stopRenderLoop(this.islandLoop)
    this.camera.detachControl()
    this.interior = interior
    this.focused = null
    interior.start()
    this.events.emit('region', { code: place.dungeon.region, title: place.dungeon.title })
    this.events.emit('interior', { place })
    this.events.emit('focus', null)
    return true
  }

  /** Sort du lieu : l'intérieur disparaît, l'île reprend là où le héros l'avait laissée, devant la porte. */
  leavePlace(): void {
    const interior = this.interior
    if (!interior) return
    interior.dispose()
    this.interior = null
    this.camera.attachControl(this.canvas, true)
    this.lastFrame = performance.now()
    if (this.islandLoop) this.engine.runRenderLoop(this.islandLoop)
    this.region = null // la région du héros est annoncée de nouveau
    this.regionTimer = 0
    this.setInputEnabled(true)
    this.events.emit('interior', null)
    this.events.emit('focus', this.focused)
    void this.setLook(this.look) // une apparence choisie pendant le lieu (jamais par l'écran, mais sans risque) est mise à l'écran
  }

  dispose(): void {
    this.closed = true
    this.interior?.dispose()
    this.interior = null
    for (const d of this.disposers) d()
    this.engine.stopRenderLoop()
    this.scene.dispose()
    this.engine.dispose()
  }
}
