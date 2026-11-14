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
  Color4,
  DynamicTexture,
  type Engine,
  EngineInstrumentation,
  type Mesh,
  MeshBuilder,
  ParticleSystem,
  PointerEventTypes,
  Scene,
  SceneInstrumentation,
  StandardMaterial,
  Vector3,
  type WebGPUEngine,
} from '@babylonjs/core'
import ile from '@content/monde/ile.json'
import { Emitter } from '../core/events'
import { browserLabel, type FrameSample, type PerfReport, percentile, summarize, tourAt, tourStops } from '../core/perf'
import type { SaveData } from '../core/save'
import type { HeightGrid } from '../core/world/heightGrid'
import type { Obstacles } from '../core/world/obstacles'
import { angleDelta, RUN_SPEED, step, WALK_SPEED } from '../core/world/movement'
import { isOpen, type Place, placesFor, regionTitle } from '../core/world/places'
import { type IslandLayout, Terrain } from '../core/world/terrain'
import { type Atmosphere, createAtmosphere } from './atmosphere'
import { type Character, loadFox, loadHero, loadNpc, settleOnGround } from './characters'
import { beacon, buildDecor } from './decor'
import { createEngine, type EngineKind } from './engine'
import { buildGround, buildSea } from './island'
import { chooseQuality, type Quality } from './quality'
import { THEMES, type WorldName } from './theme'

export type InteractableKind = 'lieu' | 'pierre' | 'ysaline'

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
  stats: { fps: number; drawCalls: number; triangles: number; engine: string }
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
  /** WebGPU demandé mais pas pris : pourquoi (repli sur WebGL 2). */
  engineFallback: string | undefined
  /** Moment où l'île est prête (ms depuis l'ouverture de la page). */
  readyAt = 0
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
  private focused: Interactable | null = null
  private region: string | null = null
  private lastCameraInput = 0
  private stones = new Map<string, Mesh>()
  private sparkTexture: DynamicTexture | null = null
  private disposers: (() => void)[] = []
  private statsTimer = 0
  private regionTimer = 0
  private instrumentation: SceneInstrumentation | null = null

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: WorldOptions,
    private readonly params: URLSearchParams,
  ) {
    this.quality = chooseQuality(params)
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
    const { engine, kind, fallback } = await createEngine(this.canvas, this.params)
    this.engine = engine
    this.engineKind = kind
    this.engineFallback = fallback
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
    // Compteurs par image (?perf, ?mesure et tests) : appels de dessin, durée d'une image.
    if (this.params.has('perf') || this.params.has('e2e') || this.params.has('mesure')) {
      this.instrumentation = new SceneInstrumentation(scene)
      this.instrumentation.captureFrameTime = true
    }
    this.progress("L'île est prête", 1)
    this.readyAt = performance.now()

    let last = performance.now()
    engine.runRenderLoop(() => {
      const now = performance.now()
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      this.update(dt)
      scene.render()
    })
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
    // Une fois par seconde de temps réel (dt est plafonné : à 3 images par seconde, il
    // faudrait sept secondes pour le premier relevé).
    const now = performance.now()
    if (now >= this.statsTimer) {
      this.statsTimer = now + 1000
      this.events.emit('stats', {
        fps: Math.round(this.engine.getFps()),
        drawCalls: this.instrumentation?.drawCallsCounter.current ?? 0,
        triangles: Math.round(this.scene.getActiveIndices() / 3),
        engine: this.engineLabel(),
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
    const done = this.options.save.places
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
    // Les cristaux tournent doucement sur eux-mêmes (immobiles en mode calme).
    if (!this.options.calm) {
      this.scene.onBeforeRenderObservable.add(() => {
        const dt = this.engine.getDeltaTime() / 1000
        for (const crystal of this.stones.values()) crystal.rotation.y += dt * 0.8
      })
    }
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
  }

  /** Gerbe d'étincelles (plus discrète en mode calme). */
  private sparkle(at: Vector3): void {
    if (!this.sparkTexture) {
      const texture = new DynamicTexture('etincelle', 64, this.scene, false)
      const ctx = texture.getContext()
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
      gradient.addColorStop(0, 'rgba(255,255,255,1)')
      gradient.addColorStop(0.4, 'rgba(255,230,160,0.8)')
      gradient.addColorStop(1, 'rgba(255,200,80,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 64, 64)
      texture.hasAlpha = true
      texture.update()
      this.sparkTexture = texture
    }
    const calm = this.options.calm
    const ps = new ParticleSystem('etincelles', calm ? 80 : 400, this.scene)
    ps.particleTexture = this.sparkTexture
    ps.emitter = at
    ps.minEmitBox = new Vector3(-0.3, 0, -0.3)
    ps.maxEmitBox = new Vector3(0.3, 0.4, 0.3)
    ps.color1 = new Color4(1, 0.92, 0.6, 1)
    ps.color2 = new Color4(0.6, 0.85, 1, 1)
    ps.colorDead = new Color4(1, 0.8, 0.3, 0)
    ps.minSize = 0.08
    ps.maxSize = calm ? 0.18 : 0.3
    ps.minLifeTime = 0.6
    ps.maxLifeTime = 1.4
    ps.emitRate = calm ? 120 : 600
    ps.manualEmitCount = calm ? 60 : 300
    ps.gravity = new Vector3(0, -2, 0)
    ps.direction1 = new Vector3(-2, 4, -2)
    ps.direction2 = new Vector3(2, 7, 2)
    ps.minEmitPower = 1
    ps.maxEmitPower = calm ? 1.5 : 3
    ps.blendMode = ParticleSystem.BLENDMODE_ADD
    ps.disposeOnStop = true
    ps.targetStopDuration = 1.6
    ps.start()
  }

  // --- Banc de mesure (?mesure) ------------------------------------------------------------

  engineLabel(): string {
    return this.engineKind === 'webgpu' ? 'WebGPU' : this.engineFallback ? 'WebGL 2 (repli)' : 'WebGL 2'
  }

  /**
   * Le héros fait le tour de l'île (`tourStops`, core/perf.ts) ; à chaque arrêt, la caméra fait un
   * tour complet. Relève la durée de chaque image, le temps du processeur (scene.render) et, si le
   * navigateur le permet, celui de la carte graphique. Le premier dixième de chaque arrêt n'est pas
   * compté : le saut d'un arrêt à l'autre n'arrive jamais en jouant.
   */
  async measure(seconds: number, onProgress?: (ratio: number) => void): Promise<PerfReport> {
    const stops = tourStops(layout)
    const instrumentation = this.instrumentation ?? new SceneInstrumentation(this.scene)
    instrumentation.captureFrameTime = true
    this.instrumentation = instrumentation
    const gpu = new EngineInstrumentation(this.engine)
    gpu.captureGPUFrameTime = true
    this.setInputEnabled(false)
    const samples: FrameSample[] = []
    const drawCalls: number[] = []
    const triangles: number[] = []
    let index = -1
    let alpha = 0
    const start = performance.now()
    let last = start
    await new Promise<void>((resolve) => {
      const observer = this.scene.onAfterRenderObservable.add(() => {
        const now = performance.now()
        const at = tourAt(stops, seconds, (now - start) / 1000)
        if (at.done) {
          this.scene.onAfterRenderObservable.remove(observer)
          resolve()
          return
        }
        if (at.index !== index) {
          index = at.index
          const stop = stops[index]!
          this.teleport(stop.x, stop.z, stop.faceX, stop.faceZ)
          this.camera.beta = 1.22
          this.camera.radius = 8.5
          alpha = this.camera.alpha
        } else if (at.turn > 0.1) {
          const gpuNs = gpu.gpuFrameTimeCounter?.current ?? 0
          samples.push({ frameMs: now - last, cpuMs: instrumentation.frameTimeCounter.current, gpuMs: gpuNs > 0 ? gpuNs / 1e6 : undefined })
          drawCalls.push(instrumentation.drawCallsCounter.current)
          triangles.push(this.scene.getActiveIndices() / 3)
        }
        this.camera.alpha = alpha + at.turn * Math.PI * 2
        this.lastCameraInput = now
        last = now
        onProgress?.(Math.min(1, (now - start) / 1000 / seconds))
      })
    })
    gpu.dispose()
    this.teleport(layout.depart.x, layout.depart.z, layout.citadelle.x, layout.citadelle.z)
    this.setInputEnabled(true)
    const info = (this.engine as Engine | WebGPUEngine).getInfo()
    const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
    return {
      date: new Date().toISOString().slice(0, 10),
      browser: browserLabel(navigator.userAgent),
      gpu: (this.engineKind === 'webgpu' ? [info.vendor, info.renderer, info.version] : [info.renderer]).filter((v) => v && !v.startsWith('unknown')).join(' '),
      engine: this.engineLabel(),
      quality: this.quality.name,
      width: this.engine.getRenderWidth(),
      height: this.engine.getRenderHeight(),
      seconds,
      summary: summarize(samples),
      drawCalls: Math.round(percentile(drawCalls, 100)),
      triangles: Math.round(percentile(triangles, 100)),
      loadMs: this.readyAt,
      heapMb: memory ? memory.usedJSHeapSize / 1048576 : null,
    }
  }

  // --- Outils de test et de capture (?e2e) ------------------------------------------------

  heroPosition(): { x: number; y: number; z: number } {
    const p = this.hero.root.position
    return { x: p.x, y: p.y, z: p.z }
  }

  teleport(x: number, z: number, faceX?: number, faceZ?: number): void {
    this.hero.root.position.set(x, this.grid.heightAt(x, z), z)
    if (faceX !== undefined && faceZ !== undefined) this.hero.yaw = Math.atan2(faceX - x, faceZ - z)
    this.camera.target.set(x, this.grid.heightAt(x, z) + 1.45, z)
    this.camera.alpha = Math.atan2(-Math.cos(this.hero.yaw), -Math.sin(this.hero.yaw))
    this.regionTimer = 0
  }

  /** Cadre la caméra (captures) : angle autour du héros, hauteur, distance. */
  frame(alpha: number, beta: number, radius: number): void {
    this.camera.alpha = alpha
    this.camera.beta = beta
    this.camera.radius = radius
    this.lastCameraInput = performance.now()
  }

  dispose(): void {
    for (const d of this.disposers) d()
    this.engine.stopRenderLoop()
    this.scene.dispose()
    this.engine.dispose()
  }
}
