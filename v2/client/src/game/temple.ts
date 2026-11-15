/**
 * Le temple du Sphinx en 3D : une scène à part (même moteur, même canevas que l'île, qui est mise en pause pendant qu'on y est, comme l'intérieur d'un
 * lieu). La scène ne décide de rien : l'état du plateau (core/sphinx/board.ts) reste dans ui/SphinxPuzzle.tsx, qui le pousse ici par `show` après
 * chaque pas ; la scène l'affiche (le héros marche, un bloc glisse) et rend le clic sur une dalle (`tile`). Pas de touche ici : l'interface est la seule entrée.
 *
 * La caméra est fixe, au sud, et cadre toute la salle dans la part de l'écran que le panneau latéral laisse libre (core/sphinx/stage.ts). Géométrie en formes
 * simples fusionnées avec des couleurs par sommet (une salle = quelques appels de dessin), comme le temple de la v1 ; un bloc est un maillage à lui par indice.
 * Rien ne dépend de la couleur seule : une dalle gravée est un losange creux, un bloc porte une croix, un bloc posé une coche dorée qui flotte au-dessus,
 * un bloc coincé un « ! » qui tremble.
 */
import {
  type AbstractEngine,
  ArcRotateCamera,
  Color3,
  Color4,
  DefaultRenderingPipeline,
  DirectionalLight,
  HemisphericLight,
  ImageProcessingConfiguration,
  Matrix,
  Mesh,
  MeshBuilder,
  PointerEventTypes,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
  VertexBuffer,
} from '@babylonjs/core'
import { Emitter } from '../core/events'
import { SphinxBoard, type Cell, type Dir } from '../core/sphinx/board'
import {
  BLOCK_HEIGHT, BLOCK_SIDE, boxStates, type BoxState, CAMERA_ALPHA, CAMERA_BETA, CAMERA_FOV, cellAt, cellCenter, FLOOR_THICKNESS, frame, freeWindow, glide,
  PALETTES, templePlan, type TemplePalette, type TemplePlan, TILE, VESTIBULE, WALL_HEIGHT, WALL_LOW, yawOf,
} from '../core/sphinx/stage'
import { fur, type Look } from '../core/wardrobe'
import { angleDelta } from '../core/world/movement'
import { type Character, loadFox, loadHero, settleOnGround, tintFox } from './characters'
import { sparkle } from './effects'
import type { Quality } from './quality'
import type { WorldName } from './theme'

export interface TempleOptions {
  world: WorldName
  look: Look
  quality: Quality
  /** Aménagement « mode calme » : les mouvements sautent d'une case à l'autre, rien ne tremble ni ne flotte, moins d'étincelles. */
  calm: boolean
  /** Le pelage du renard du héros (monde lumineux) : il s'assoit sur le mur près du Sphinx. Absent : pas de renard. */
  pet?: string
  /** Les cases du premier plateau (la salle d'accueil par défaut). */
  rows?: readonly string[]
}

/** Ce que l'interface pousse après chaque pas : tout l'état à montrer, jamais un morceau. */
export interface TempleView {
  player: Cell
  boxes: Cell[]
  facing: Dir
  solved: boolean
  /** Indice du bloc coincé, -1 sinon. */
  stuck: number
}

export interface TempleSnapshot {
  rows: string[]
  /** Le dernier état poussé. */
  shown: TempleView | null
  /** Où sont réellement le héros et les blocs dans la scène (cases les plus proches). */
  seen: { player: Cell; boxes: Cell[] }
  /** Tout est arrivé à sa place (aucun glissement en cours). */
  settled: boolean
  states: BoxState[]
}

export type TempleEvents = {
  /** Un clic sur une dalle du temple (pas forcément libre : c'est à l'interface de décider). */
  tile: Cell
}

interface Part {
  mesh: Mesh
  color: string
}

interface BlockNode {
  root: TransformNode
  body: Mesh
  tick: TransformNode
  bang: TransformNode
  /** Où il doit être (monde). */
  x: number
  z: number
  state: BoxState
}

/** Sol : un petit jeu de teintes autour de la couleur de la dalle, pour que la pierre ne soit pas un aplat. */
function shade(hex: string, factor: number): string {
  const c = Color3.FromHexString(hex).scale(factor)
  return new Color3(Math.min(1, c.r), Math.min(1, c.g), Math.min(1, c.b)).toHexString()
}

/** Des formes simples fusionnées en un maillage, la couleur de chacune posée sur ses sommets (un seul matériau, un seul appel de dessin). */
function solid(name: string, parts: Part[], material: StandardMaterial): Mesh | null {
  if (parts.length === 0) return null
  for (const { mesh, color } of parts) {
    const c = Color3.FromHexString(color)
    const n = mesh.getTotalVertices()
    const colors = new Float32Array(n * 4)
    for (let i = 0; i < n; i += 1) {
      colors[i * 4] = c.r
      colors[i * 4 + 1] = c.g
      colors[i * 4 + 2] = c.b
      colors[i * 4 + 3] = 1
    }
    mesh.setVerticesData(VertexBuffer.ColorKind, colors)
  }
  const merged = Mesh.MergeMeshes(parts.map((p) => p.mesh), true, true, undefined, false, false)
  if (!merged) return null
  merged.name = name
  merged.material = material
  merged.useVertexColors = true
  merged.isPickable = false
  merged.receiveShadows = true
  return merged
}

function box(scene: Scene, w: number, h: number, d: number, x: number, y: number, z: number, rotationY = 0): Mesh {
  const mesh = MeshBuilder.CreateBox('forme', { width: w, height: h, depth: d }, scene)
  mesh.position.set(x, y, z)
  mesh.rotation.y = rotationY
  return mesh
}

export class TempleWorld {
  readonly events = new Emitter<TempleEvents>()
  readonly scene: Scene
  camera!: ArcRotateCamera
  private hero!: Character
  /** Le renard du héros, assis sur le mur près du Sphinx : il ne pousse aucun bloc (comme dans la v1). */
  private fox: Character | null = null
  private board!: SphinxBoard
  private plan!: TemplePlan
  private rows: string[] = []
  private readonly palette: TemplePalette
  private readonly shared: { stone: StandardMaterial; body: StandardMaterial; placed: StandardMaterial; plinth: StandardMaterial; mark: StandardMaterial; tick: StandardMaterial; bang: StandardMaterial }
  private level: (Mesh | TransformNode)[] = []
  private floor: Mesh | null = null
  private blocks: BlockNode[] = []
  private shadows: ShadowGenerator | null = null
  private pipeline: DefaultRenderingPipeline | null = null
  private view: TempleView | null = null
  private wasSolved = false
  private inset = 0
  private loop: (() => void) | null = null
  private last = 0
  private time = 0
  private heroTarget = { x: 0, z: 0 }
  private disposers: (() => void)[] = []

  private constructor(
    private readonly engine: AbstractEngine,
    private readonly canvas: HTMLCanvasElement,
    private readonly options: TempleOptions,
  ) {
    this.scene = new Scene(engine)
    this.palette = PALETTES[options.world]
    const make = (name: string, color: string, extra?: (m: StandardMaterial) => void): StandardMaterial => {
      const m = new StandardMaterial(name, this.scene)
      m.diffuseColor = Color3.FromHexString(color)
      m.specularColor = new Color3(0.05, 0.05, 0.05)
      extra?.(m)
      return m
    }
    const p = this.palette
    this.shared = {
      stone: make('temple-pierre', '#ffffff'),
      body: make('bloc', p.block),
      placed: make('bloc-pose', p.blockPlaced, (m) => {
        m.emissiveColor = Color3.FromHexString(p.blockPlaced).scale(0.18)
      }),
      plinth: make('bloc-socle', shade(p.block, 0.7)),
      mark: make('bloc-croix', p.blockMark),
      tick: make('coche', p.goalInlay, (m) => {
        m.disableLighting = true
        m.emissiveColor = Color3.FromHexString('#ffd447')
        m.diffuseColor = Color3.Black()
      }),
      bang: make('alerte', '#ff6a4d', (m) => {
        m.disableLighting = true
        m.emissiveColor = Color3.FromHexString('#ff6a4d')
        m.diffuseColor = Color3.Black()
      }),
    }
  }

  static async create(engine: AbstractEngine, canvas: HTMLCanvasElement, options: TempleOptions): Promise<TempleWorld> {
    const temple = new TempleWorld(engine, canvas, options)
    try {
      await temple.build()
    } catch (error) {
      temple.dispose()
      throw error
    }
    return temple
  }

  private async build(): Promise<void> {
    const { scene, palette } = this
    const { quality } = this.options
    scene.clearColor = Color4.FromColor3(Color3.FromHexString(palette.sky), 1)
    scene.skipPointerMovePicking = true

    this.camera = new ArcRotateCamera('camera-temple', CAMERA_ALPHA, CAMERA_BETA, 24, Vector3.Zero(), scene)
    this.camera.fov = CAMERA_FOV
    this.camera.minZ = 0.5
    this.camera.maxZ = 600
    this.camera.inputs.clear() // fixe : ni souris, ni flèches (elles sont à l'énigme)

    const hemi = new HemisphericLight('temple-ambiance', new Vector3(0, 1, 0), scene)
    hemi.diffuse = Color3.FromHexString(palette.ambient)
    hemi.groundColor = Color3.FromHexString(palette.sand).scale(0.7)
    hemi.specular = Color3.Black()
    hemi.intensity = palette.ambientIntensity
    const sun = new DirectionalLight('temple-soleil', new Vector3(0.4, -0.85, 0.55).normalize(), scene)
    sun.position = new Vector3(-20, 40, -30)
    sun.diffuse = Color3.FromHexString(palette.sun)
    sun.specular = Color3.Black()
    sun.intensity = palette.sunIntensity
    if (quality.name !== 'bas') {
      const shadows = new ShadowGenerator(quality.shadowMapSize, sun)
      shadows.usePercentageCloserFiltering = true
      shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM
      shadows.bias = 0.004
      shadows.normalBias = 0.02
      shadows.darkness = 0.35
      this.shadows = shadows
    }

    // Le sable autour du temple.
    const sand = MeshBuilder.CreateBox('temple-sable', { width: 600, height: 0.2, depth: 600 }, scene)
    sand.position.y = -FLOOR_THICKNESS - 0.1
    const sandMaterial = new StandardMaterial('temple-sable', scene)
    sandMaterial.diffuseColor = Color3.FromHexString(palette.sand)
    sandMaterial.specularColor = Color3.Black()
    sand.material = sandMaterial
    sand.isPickable = false
    sand.receiveShadows = true

    this.hero = await loadHero(scene, this.options.look)
    this.hero.root.scaling.setAll(0.9)
    for (const m of this.hero.meshes) this.shadows?.addShadowCaster(m, false)
    if (this.options.pet) {
      const fox = await loadFox(scene)
      tintFox(fox, fur(this.options.pet))
      for (const m of fox.meshes) this.shadows?.addShadowCaster(m, false)
      fox.root.scaling.setAll(1.5) // vu de loin, sur le mur : un renard de la taille de l'île y serait une tache
      fox.root.setEnabled(false)
      scene.onAfterRenderObservable.addOnce(() => settleOnGround(fox)) // ses os sont calculés à la première image
      this.fox = fox
    }

    this.load(this.options.rows ?? VESTIBULE)
    this.setupPointer()
    this.setupPipeline()
    const resize = this.engine.onResizeObservable.add(() => this.refit())
    this.disposers.push(() => this.engine.onResizeObservable.remove(resize))
    this.refit()
  }

  // --- Salle ------------------------------------------------------------------------------

  /** Dresse la salle d'un plateau (rangées de core/sphinx/board.ts) ; la précédente disparaît. Le héros, la lumière et la scène restent. */
  load(rows: readonly string[]): void {
    this.clearLevel()
    this.rows = [...rows]
    this.board = SphinxBoard.fromRows(rows)
    this.plan = templePlan(this.board)
    const { scene, palette, plan, board } = this
    const height = board.height

    // Sol : une dalle par case, de teintes un peu différentes.
    const floor: Part[] = plan.floor.map((c) => {
      const p = cellCenter(height, c)
      const hash = ((c.x * 7 + c.y * 13) % 5) / 5
      const color = shade((c.x + c.y) % 2 === 0 ? palette.floorA : palette.floorB, 0.96 + hash * 0.08)
      return { mesh: box(scene, TILE - 0.05, FLOOR_THICKNESS, TILE - 0.05, p.x, -FLOOR_THICKNESS / 2, p.z), color }
    })
    this.floor = solid('temple-sol', floor, this.shared.stone)
    if (this.floor) {
      this.floor.isPickable = true
      this.level.push(this.floor)
    }

    // Dalles gravées : un losange creux (deux liserés), pour qu'on le voie sans la couleur.
    const marks: Part[] = []
    for (const g of plan.goals) {
      const p = cellCenter(height, g)
      for (const [half, width, color] of [[0.82, 0.13, palette.goal], [0.5, 0.09, palette.goalInlay]] as const) {
        const edge = half * Math.SQRT2
        for (const [dx, dz, angle] of [[1, 1, Math.PI / 4], [-1, -1, Math.PI / 4], [1, -1, -Math.PI / 4], [-1, 1, -Math.PI / 4]] as const) {
          marks.push({ mesh: box(scene, edge + width, 0.03, width, p.x + (dx * half) / 2, 0.015, p.z + (dz * half) / 2, angle), color })
        }
      }
    }
    const engraved = solid('temple-gravures', marks, this.shared.stone)
    if (engraved) this.level.push(engraved)

    // Murs : bas devant une dalle (on voit toujours les blocs), pleins ailleurs ; un chaperon plus clair au sommet.
    const walls: Part[] = []
    for (const w of plan.walls) {
      const p = cellCenter(height, w.cell)
      const h = w.low ? WALL_LOW : WALL_HEIGHT
      const hash = ((w.cell.x * 5 + w.cell.y * 11) % 4) / 4
      walls.push({ mesh: box(scene, TILE, h, TILE, p.x, h / 2, p.z), color: shade(palette.wall, 0.94 + hash * 0.1) })
      walls.push({ mesh: box(scene, TILE + 0.08, 0.14, TILE + 0.08, p.x, h + 0.07, p.z), color: palette.wallTop })
    }
    const stone = solid('temple-murs', walls, this.shared.stone)
    if (stone) {
      this.level.push(stone)
      this.shadows?.addShadowCaster(stone, false)
    }
    this.buildSphinx()

    // Blocs : un maillage par indice, qui glisse d'une case à l'autre.
    this.blocks = board.boxes.map((b, i) => this.buildBlock(i, cellCenter(height, b)))

    const start = cellCenter(height, board.player)
    this.hero.root.position.set(start.x, 0, start.z)
    this.heroTarget = { x: start.x, z: start.z }
    this.view = null
    this.wasSolved = false
    this.refit()
  }

  private clearLevel(): void {
    for (const node of this.level) node.dispose()
    for (const b of this.blocks) b.root.dispose()
    this.level = []
    this.blocks = []
    this.floor = null
  }

  /** Un bloc : un cube de pierre ocre sur un socle, une croix gravée dessus ; la coche et le point d'exclamation flottent au-dessus quand il le faut. */
  private buildBlock(index: number, at: { x: number; z: number }): BlockNode {
    const { scene } = this
    const root = new TransformNode(`bloc-${index}`, scene)
    root.position.set(at.x, 0, at.z)
    const plinth = box(scene, BLOCK_SIDE + 0.16, 0.2, BLOCK_SIDE + 0.16, 0, 0.1, 0)
    plinth.material = this.shared.plinth
    plinth.parent = root
    const body = box(scene, BLOCK_SIDE, BLOCK_HEIGHT, BLOCK_SIDE, 0, 0.2 + BLOCK_HEIGHT / 2, 0)
    body.material = this.shared.body
    body.parent = root
    for (const angle of [Math.PI / 4, -Math.PI / 4]) {
      const bar = box(scene, BLOCK_SIDE * 0.95, 0.04, 0.14, 0, 0.2 + BLOCK_HEIGHT + 0.015, 0, angle)
      bar.material = this.shared.mark
      bar.parent = root
    }
    const top = 0.2 + BLOCK_HEIGHT

    // La coche (deux traits) et le point d'exclamation, toujours face à la caméra.
    const tick = new TransformNode(`bloc-${index}-coche`, scene)
    tick.billboardMode = TransformNode.BILLBOARDMODE_ALL
    tick.parent = root
    tick.position.y = top + 0.85
    for (const [length, cx, cy, angle] of [[0.4, -0.2, -0.1, -0.9], [0.78, 0.12, 0.04, 0.88]] as const) {
      const stroke = MeshBuilder.CreateBox('coche-trait', { width: length, height: 0.15, depth: 0.1 }, scene)
      stroke.position.set(cx, cy, 0)
      stroke.rotation.z = angle
      stroke.material = this.shared.tick
      stroke.parent = tick
    }
    const bang = new TransformNode(`bloc-${index}-alerte`, scene)
    bang.billboardMode = TransformNode.BILLBOARDMODE_ALL
    bang.parent = root
    bang.position.y = top + 0.9
    const bar = MeshBuilder.CreateCylinder('alerte-trait', { diameterTop: 0.36, diameterBottom: 0.16, height: 0.6, tessellation: 8 }, scene)
    bar.position.y = 0.18
    const dot = MeshBuilder.CreateSphere('alerte-point', { diameter: 0.22, segments: 8 }, scene)
    dot.position.y = -0.24
    for (const part of [bar, dot]) {
      part.material = this.shared.bang
      part.parent = bang
    }
    tick.setEnabled(false)
    bang.setEnabled(false)
    for (const mesh of root.getChildMeshes(false)) {
      mesh.isPickable = false
      this.shadows?.addShadowCaster(mesh, false)
      mesh.receiveShadows = true
    }
    return { root, body, tick, bang, x: at.x, z: at.z, state: 'libre' }
  }

  /** Le Sphinx, assis sur le mur du fond et tourné vers l'enfant : un lion de pierre en formes simples (corps, pattes, poitrail, tête, coiffe rayée d'or). */
  private buildSphinx(): void {
    const { scene, palette, plan, board } = this
    const top = plan.walls.filter((w) => w.cell.y === plan.min.y).map((w) => w.cell.x).sort((a, b) => a - b)
    const x = top.length > 0 ? top[Math.floor(top.length / 2)]! : Math.round((plan.min.x + plan.max.x) / 2)
    const at = cellCenter(board.height, { x, y: plan.min.y })
    const y = top.length > 0 ? WALL_HEIGHT + 0.14 : 0
    const stone = palette.stone
    const dark = shade(stone, 0.78)
    const gold = palette.goalInlay
    const parts: Part[] = [
      { mesh: box(scene, 2.4, 0.26, 3.0, at.x, y + 0.13, at.z + 0.1), color: dark },
      { mesh: box(scene, 1.35, 0.95, 2.0, at.x, y + 0.74, at.z + 0.55), color: stone },
      { mesh: box(scene, 1.15, 1.05, 0.8, at.x, y + 0.78, at.z + 1.25), color: shade(stone, 0.9) },
      { mesh: box(scene, 0.9, 1.25, 0.65, at.x, y + 1.1, at.z - 0.3), color: shade(stone, 1.04) },
      { mesh: box(scene, 0.38, 0.45, 1.2, at.x - 0.42, y + 0.48, at.z - 0.85), color: shade(stone, 1.1) },
      { mesh: box(scene, 0.38, 0.45, 1.2, at.x + 0.42, y + 0.48, at.z - 0.85), color: shade(stone, 1.1) },
      { mesh: MeshBuilder.CreateSphere('sphinx-tete', { diameter: 0.9, segments: 8 }, scene), color: shade(stone, 1.15) },
      { mesh: box(scene, 0.2, 0.95, 0.5, at.x - 0.56, y + 1.78, at.z - 0.45), color: gold },
      { mesh: box(scene, 0.2, 0.95, 0.5, at.x + 0.56, y + 1.78, at.z - 0.45), color: gold },
      { mesh: box(scene, 1.0, 0.14, 0.75, at.x, y + 2.3, at.z - 0.45), color: gold },
    ]
    const head = parts[6]!.mesh
    head.position.set(at.x, y + 1.82, at.z - 0.62)
    // Le renard s'assoit sur le mur voisin du Sphinx (s'il y en a un), tourné vers l'enfant.
    const next = [x + 1, x - 1].find((cx) => top.includes(cx))
    if (this.fox) {
      this.fox.root.setEnabled(next !== undefined)
      if (next !== undefined) {
        const perch = cellCenter(board.height, { x: next, y: plan.min.y })
        this.fox.root.position.set(perch.x, y, perch.z)
        this.fox.yaw = Math.PI
      }
    }
    const statue = solid('temple-sphinx', parts, this.shared.stone)
    if (statue) {
      this.level.push(statue)
      this.shadows?.addShadowCaster(statue, false)
    }
  }

  // --- Entrées ----------------------------------------------------------------------------

  private setupPointer(): void {
    const observer = this.scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERTAP) return
      const floor = this.floor
      if (!floor) return
      const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => mesh === floor)
      if (!pick?.hit || !pick.pickedPoint) return
      const cell = cellAt(this.board.height, { x: pick.pickedPoint.x, z: pick.pickedPoint.z })
      if (this.board.isTile(cell)) this.events.emit('tile', cell)
    })
    this.disposers.push(() => this.scene.onPointerObservable.remove(observer))
  }

  private setupPipeline(): void {
    const { quality } = this.options
    const pipeline = new DefaultRenderingPipeline('rendu-temple', true, this.scene, [this.camera])
    pipeline.samples = quality.msaa
    pipeline.fxaaEnabled = quality.msaa <= 1
    pipeline.bloomEnabled = quality.bloom
    pipeline.bloomThreshold = 0.85
    pipeline.bloomWeight = 0.25
    pipeline.bloomKernel = 40
    pipeline.bloomScale = 0.5
    pipeline.imageProcessingEnabled = true
    pipeline.imageProcessing.toneMappingEnabled = true
    pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES
    pipeline.imageProcessing.exposure = 1.05
    pipeline.imageProcessing.contrast = 1.08
    this.pipeline = pipeline
  }

  /** Le panneau de l'interface occupe `px` pixels à droite : la salle se cadre dans le reste. */
  setInset(px: number): void {
    const next = Math.max(0, Math.round(px))
    if (next === this.inset) return
    this.inset = next
    this.refit()
  }

  /** Recadre la caméra (fixe) sur toute la salle, dans la part libre de l'écran. */
  private refit(): void {
    const width = this.canvas.clientWidth || this.engine.getRenderWidth()
    const aspect = this.engine.getRenderWidth() / Math.max(1, this.engine.getRenderHeight())
    const shot = frame(this.plan, aspect, freeWindow(width, this.inset))
    const camera = this.camera
    camera.target.copyFrom(new Vector3(shot.target.x, shot.target.y, shot.target.z))
    camera.alpha = shot.alpha
    camera.beta = shot.beta
    camera.radius = shot.radius
  }

  // --- État montré ------------------------------------------------------------------------

  /** Montre l'état du plateau : le héros et les blocs vont à leur case (d'un coup si c'est loin ou en mode calme), les repères changent. */
  show(view: TempleView): void {
    const first = this.view === null
    this.view = { ...view, player: { ...view.player }, boxes: view.boxes.map((b) => ({ ...b })) }
    const { board } = this
    const heroAt = cellCenter(board.height, view.player)
    this.heroTarget = heroAt
    this.hero.yaw = first ? yawOf(view.facing) : this.hero.yaw
    const states = boxStates(view.boxes, board.goals, view.stuck)
    view.boxes.forEach((b, i) => {
      const node = this.blocks[i]
      if (!node) return
      const at = cellCenter(board.height, b)
      node.x = at.x
      node.z = at.z
      if (node.state !== states[i]) {
        node.state = states[i]!
        node.body.material = states[i] === 'pose' ? this.shared.placed : this.shared.body
        node.tick.setEnabled(states[i] === 'pose')
        node.bang.setEnabled(states[i] === 'coince')
      }
    })
    if (first) this.settle()
    if (view.solved && !this.wasSolved) this.celebrate()
    this.wasSolved = view.solved
  }

  /** Tout saute à sa place (premier état montré). */
  private settle(): void {
    this.hero.root.position.x = this.heroTarget.x
    this.hero.root.position.z = this.heroTarget.z
    for (const b of this.blocks) b.root.position.set(b.x, 0, b.z)
  }

  /** L'énigme est résolue : le héros se réjouit, une gerbe d'étincelles sur chaque bloc posé. */
  private celebrate(): void {
    void this.hero.playOnce('cheer', 'idle')
    for (const b of this.blocks) sparkle(this.scene, new Vector3(b.x, 0.6, b.z), this.options.calm)
  }

  private update(dt: number): void {
    this.time += dt
    const calm = this.options.calm
    const hero = this.hero.root.position
    const fromX = hero.x
    const fromZ = hero.z
    hero.x = glide(hero.x, this.heroTarget.x, dt, calm)
    hero.z = glide(hero.z, this.heroTarget.z, dt, calm)
    const moving = Math.hypot(this.heroTarget.x - hero.x, this.heroTarget.z - hero.z) > 0.05
    if (this.view) {
      const wanted = yawOf(this.view.facing)
      this.hero.yaw += angleDelta(this.hero.yaw, wanted) * Math.min(1, dt * 20)
    }
    if (moving || Math.hypot(hero.x - fromX, hero.z - fromZ) > 0.001) this.hero.play('walk')
    else this.hero.play('idle')
    for (const b of this.blocks) {
      const p = b.root.position
      p.x = glide(p.x, b.x, dt, calm)
      p.z = glide(p.z, b.z, dt, calm)
      if (!calm && b.state === 'coince') b.root.rotation.z = Math.sin(this.time * 18) * 0.03
      else b.root.rotation.z = 0
      if (!calm && b.state !== 'libre') {
        const bob = Math.sin(this.time * 3 + b.x) * 0.06
        b.tick.position.y = 0.2 + BLOCK_HEIGHT + 0.85 + bob
        b.bang.position.y = 0.2 + BLOCK_HEIGHT + 0.9 + bob
      }
    }
  }

  // --- Boucle -----------------------------------------------------------------------------

  /** Lance le rendu de cette scène (l'appelant a arrêté celui de l'île). */
  start(): void {
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
  }

  // --- Outils de test et de capture (?e2e) ------------------------------------------------

  snapshot(): TempleSnapshot {
    const height = this.board.height
    const near = (x: number, z: number): Cell => cellAt(height, { x, z })
    const states = this.view ? boxStates(this.view.boxes, this.board.goals, this.view.stuck) : []
    const settled =
      Math.hypot(this.hero.root.position.x - this.heroTarget.x, this.hero.root.position.z - this.heroTarget.z) < 0.01 &&
      this.blocks.every((b) => Math.hypot(b.root.position.x - b.x, b.root.position.z - b.z) < 0.01)
    return {
      rows: this.rows,
      shown: this.view,
      seen: { player: near(this.hero.root.position.x, this.hero.root.position.z), boxes: this.blocks.map((b) => near(b.root.position.x, b.root.position.z)) },
      settled,
      states,
    }
  }

  /** Où une case tombe à l'écran, en pixels de la page : les tests dans le navigateur cliquent sur la scène. */
  projectCell(cell: Cell): { x: number; y: number } {
    const at = cellCenter(this.board.height, cell)
    const width = this.engine.getRenderWidth()
    const height = this.engine.getRenderHeight()
    const p = Vector3.Project(new Vector3(at.x, 0, at.z), Matrix.Identity(), this.scene.getTransformMatrix(), this.camera.viewport.toGlobal(width, height))
    return { x: (p.x / width) * this.canvas.clientWidth, y: (p.y / height) * this.canvas.clientHeight }
  }

  dispose(): void {
    this.stop()
    for (const d of this.disposers) d()
    this.pipeline?.dispose()
    this.hero?.dispose()
    this.scene.dispose()
  }
}
