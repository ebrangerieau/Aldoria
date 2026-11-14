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
  type Mesh,
  MeshBuilder,
  PointerEventTypes,
  Scene,
  SceneInstrumentation,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'
import ile from '@content/monde/ile.json'
import { Emitter } from '../core/events'
import type { SaveData } from '../core/save'
import type { HeightGrid } from '../core/world/heightGrid'
import type { Obstacles } from '../core/world/obstacles'
import { heading, type MapMarker, mapMarkers, type ReliefPalette } from '../core/world/minimap'
import { angleDelta, RUN_SPEED, step, WALK_SPEED } from '../core/world/movement'
import { isOpen, type Place, placesFor, regionTitle } from '../core/world/places'
import { type IslandLayout, Terrain } from '../core/world/terrain'
import { type Atmosphere, createAtmosphere } from './atmosphere'
import { type Character, loadFox, loadHero, loadMonster, loadNpc, settleOnGround, skinnedHeights } from './characters'
import { type Enemy, type FloatTone, InteriorWorld, type Pedestal } from './interior'
import { today as localDay } from '../core/dailyChallenge'
import { beacon, buildDecor, setBeacon } from './decor'
import { sparkle } from './effects'
import { createEngine, type EngineKind } from './engine'
import { buildGround, buildSea } from './island'
import { chooseQuality, type Quality } from './quality'
import { THEMES, type WorldName } from './theme'

export type InteractableKind = 'lieu' | 'pierre' | 'ysaline' | 'sortie' | 'jour' | 'coffre'

export interface Interactable {
  id: string
  kind: InteractableKind
  label: string
  x: number
  z: number
  radius: number
  place?: Place
  open?: boolean
}

export type WorldEvents = {
  progress: { label: string; ratio: number }
  region: { code: string | null; title: string }
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

export class GameWorld {
  readonly events = new Emitter<WorldEvents>()
  readonly terrain = new Terrain(layout)
  readonly quality: Quality
  scene!: Scene
  engine!: AbstractEngine
  engineKind: EngineKind = 'webgl2'
  hero!: Character
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
  /** Lieux terminés (code → nombre de fois) : la partie du monde est celle de sa création, celle-ci suit les fins de lieu. */
  private placesDone: Record<string, number>
  private dayRing: Mesh | null = null
  private focused: Interactable | null = null
  private region: string | null = null
  private lastCameraInput = 0
  private stones = new Map<string, Mesh>()
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
    const { mesh: ground, grid } = buildGround(scene, this.terrain, theme, this.quality.terrainSubdivisions)
    this.grid = grid
    buildSea(scene, this.terrain, theme)
    void ground

    const places = placesFor(this.options.level, this.terrain)
    this.places = places
    const steps = ['La Citadelle des Archives', 'Les lieux de quête', 'Le village', "L'île du Sphinx", 'Les forêts', 'Les nuages']
    const decor = await buildDecor(scene, this.terrain, grid, places, this.options.world, this.quality, this.atmosphere.shadows, (label) => {
      this.progress(label, 0.2 + (0.5 * (steps.indexOf(label) + 1)) / steps.length)
    })
    this.obstacles = decor.obstacles

    this.progress('Le héros', 0.75)
    this.hero = await loadHero(scene, this.options.save.look)
    this.hero.root.position.set(start.x, grid.heightAt(start.x, start.z), start.z)
    this.hero.yaw = (start.cap * Math.PI) / 180
    for (const m of this.hero.meshes) this.atmosphere.shadows.addShadowCaster(m, false)
    // Renard de Jules, dans le monde lumineux (`?renard=0` pour l'enlever, par exemple en capture).
    if (this.options.world === 'lumineux' && this.params.get('renard') !== '0') {
      this.fox = await loadFox(scene)
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

    this.regionTimer -= dt
    if (this.regionTimer <= 0) {
      this.regionTimer = 0.5
      const region = this.terrain.regionAt(p.x, p.z)
      if (region !== this.region) {
        this.region = region
        this.events.emit('region', { code: region, title: region ? regionTitle(region) : '' })
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
    // Les cristaux tournent doucement sur eux-mêmes (immobiles en mode calme).
    if (!this.options.calm) {
      this.scene.onBeforeRenderObservable.add(() => {
        const dt = this.engine.getDeltaTime() / 1000
        for (const crystal of this.stones.values()) crystal.rotation.y += dt * 0.8
        if (this.dayCrystal) this.dayCrystal.rotation.y += dt * 0.8
      })
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
   * Un lieu vient d'être terminé : les lieux qui s'ouvrent (le suivant de sa région) s'allument, leur repère sur la mini-carte aussi.
   * Le monde garde la partie de sa création : sans cet appel, le lieu suivant n'apparaîtrait ouvert qu'après un rechargement.
   */
  placeCompleted(done: Record<string, number>): void {
    this.placesDone = { ...done }
    for (const it of this.interactables) {
      if (it.kind !== 'lieu' || !it.place) continue
      const open = isOpen(it.place, this.placesDone)
      it.open = open
      setBeacon(this.scene, `seuil-${it.place.dungeon.code}`, open ? '#ffd27a' : '#7a7f8c', open)
    }
    this.events.emit('markers', this.mapMarkers())
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
      look: this.options.save.look,
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
  }

  dispose(): void {
    this.interior?.dispose()
    this.interior = null
    for (const d of this.disposers) d()
    this.engine.stopRenderLoop()
    this.scene.dispose()
    this.engine.dispose()
  }
}
