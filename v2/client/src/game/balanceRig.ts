/**
 * La balance géante de la salle-énigme (Tour des Fractions) en 3D : un fléau sur une colonne, deux plateaux qui restent horizontaux, des boîtes de masse inconnue et
 * des billes (v1 : core/world/balance_rig.gd). Billes et boîtes sont des « thin instances » : une centaine de billes coûte un seul appel de dessin. Les nombres
 * (étiquette de chaque plateau, masse essayée sur chaque boîte) sont écrits sur des plans qui regardent la caméra, jamais la couleur seule.
 *
 * La scène ne décide de rien : l'interface (ui/BalanceEnigma.tsx) pousse l'état de la manche (`show`) et la balance l'affiche ; les dimensions, les places des objets
 * et le mouvement du fléau sont dans core/balanceRig.ts (testés).
 */
import {
  Color3,
  DynamicTexture,
  Matrix,
  type Mesh,
  MeshBuilder,
  type Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import type { Heavier } from '../core/balanceEnigma'
import {
  ARM, BOX, boxSpots, HANG, marbleSpots, MARBLE_R, PIVOT_H, PLATE_R, plateLabel, platePositions, type Spot, tiltAt, tiltFor,
} from '../core/balanceRig'
import type { BalanceNames, BalanceState } from '../core/visuals'

/** Ce que la balance montre : tout l'état de la manche. */
export interface RigView {
  state: BalanceState
  names: BalanceNames
  heavier: Heavier
  /** La masse écrite sur chaque boîte (essai montré), null : rien. */
  shown: number | null
}

export interface RigSnapshot {
  left: { boxes: number; units: number }
  right: { boxes: number; units: number }
  names: BalanceNames
  shown: number | null
  /** Inclinaison actuelle et but, en degrés. */
  tilt: number
  goal: number
  /** Étiquettes écrites sur les plateaux. */
  labels: string[]
  /** Nombre de masses écrites sur les boîtes. */
  guessLabels: number
  settled: boolean
}

interface Label {
  mesh: Mesh
  texture: DynamicTexture
  set(text: string): void
}

/** Un plan qui regarde toujours la caméra, avec un texte blanc cerné de noir (police du système : rien à charger). */
function textPlane(scene: Scene, name: string, width: number, height: number, font: number): Label {
  const w = 512
  const h = Math.round((512 * height) / width)
  const texture = new DynamicTexture(name, { width: w, height: h }, scene, true)
  texture.hasAlpha = true
  const material = new StandardMaterial(name, scene)
  material.diffuseTexture = texture
  material.useAlphaFromDiffuseTexture = true
  material.emissiveColor = Color3.White()
  material.disableLighting = true
  material.backFaceCulling = false
  const mesh = MeshBuilder.CreatePlane(name, { width, height }, scene)
  mesh.material = material
  mesh.billboardMode = 7 // Mesh.BILLBOARDMODE_ALL
  mesh.isPickable = false
  const set = (text: string) => {
    const ctx = texture.getContext() as unknown as CanvasRenderingContext2D
    ctx.clearRect(0, 0, w, h)
    ctx.font = `bold ${font}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = font / 5
    ctx.strokeStyle = '#1a1424'
    ctx.strokeText(text, w / 2, h / 2)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(text, w / 2, h / 2)
    texture.update()
  }
  return { mesh, texture, set }
}

const material = (scene: Scene, name: string, hex: string, specular = 0.1): StandardMaterial => {
  const m = new StandardMaterial(name, scene)
  m.diffuseColor = Color3.FromHexString(hex)
  m.specularColor = new Color3(specular, specular, specular)
  return m
}

export class BalanceRig {
  readonly root: TransformNode
  private beam: TransformNode
  private plates: [TransformNode, TransformNode]
  private chains: [Mesh, Mesh]
  private objects: { boxes: Mesh | null; marbles: Mesh | null }[] = [
    { boxes: null, marbles: null },
    { boxes: null, marbles: null },
  ]
  private counts: [Label, Label]
  private guessLabels: Label[] = []
  private shapes: Record<string, Mesh> = {}
  private tilt = 0
  private from = 0
  private goal = 0
  private elapsed = Infinity
  private calm = false
  private shown: RigView | null = null

  private constructor(
    private readonly scene: Scene,
    accent: string,
    private readonly cast: (mesh: Mesh) => void,
  ) {
    this.root = new TransformNode('balance-geante', scene)
    const stone = material(scene, 'balance-pierre', '#4a4452', 0.05)
    const brass = material(scene, 'balance-laiton', '#b8862f', 0.25)
    const keep = (mesh: Mesh, parent: TransformNode, at: Vector3, mat: StandardMaterial, shadow = true): Mesh => {
      mesh.material = mat
      mesh.parent = parent
      mesh.position.copyFrom(at)
      mesh.isPickable = false
      mesh.receiveShadows = true
      if (shadow) this.cast(mesh)
      return mesh
    }
    keep(MeshBuilder.CreateCylinder('balance-socle', { diameterTop: 1.4, diameterBottom: 1.8, height: 0.3, tessellation: 24 }, scene), this.root, new Vector3(0, 0.15, 0), stone)
    keep(MeshBuilder.CreateCylinder('balance-colonne', { diameterTop: 0.28, diameterBottom: 0.4, height: PIVOT_H, tessellation: 16 }, scene), this.root, new Vector3(0, PIVOT_H / 2, 0), brass)
    this.beam = new TransformNode('balance-flau', scene)
    this.beam.parent = this.root
    this.beam.position.y = PIVOT_H
    keep(MeshBuilder.CreateBox('balance-barre', { width: ARM * 2 + 0.3, height: 0.14, depth: 0.16 }, scene), this.beam, Vector3.Zero(), brass)
    const knob = material(scene, 'balance-pivot', accent)
    knob.emissiveColor = Color3.FromHexString(accent).scale(0.45)
    keep(MeshBuilder.CreateSphere('balance-pivot', { diameter: 0.4, segments: 12 }, scene), this.beam, Vector3.Zero(), knob)

    const chain = (side: number): Mesh =>
      keep(MeshBuilder.CreateCylinder(`balance-chaine-${side}`, { diameter: 0.05, height: HANG, tessellation: 6 }, scene), this.root, new Vector3(side * ARM, PIVOT_H - HANG / 2, 0), brass, false)
    this.chains = [chain(-1), chain(1)]
    const plate = (side: string): TransformNode => {
      const holder = new TransformNode(`balance-plateau-${side}`, scene)
      holder.parent = this.root
      keep(MeshBuilder.CreateCylinder(`balance-assiette-${side}`, { diameterTop: PLATE_R * 2, diameterBottom: PLATE_R * 1.8, height: 0.1, tessellation: 28 }, scene), holder, Vector3.Zero(), brass)
      return holder
    }
    this.plates = [plate('gauche'), plate('droite')]
    this.counts = [textPlane(scene, 'balance-compte-gauche', 1.9, 0.48, 70), textPlane(scene, 'balance-compte-droite', 1.9, 0.48, 70)]
    this.counts.forEach((label, i) => {
      label.mesh.parent = this.plates[i]!
      label.mesh.position.y = 1.45 // au-dessus du fléau (même penché) : jamais cachée par lui, ni par les masses écrites sur les boîtes, ni par le panneau du bas
      label.set('vide')
    })
    this.place()
  }

  /** `cast` : donne un maillage au générateur d'ombres de la scène (la balance n'en connaît pas). */
  static create(scene: Scene, accent: string, cast: (mesh: Mesh) => void): BalanceRig {
    return new BalanceRig(scene, accent, cast)
  }

  private shape(name: string): Mesh {
    const known = this.shapes[name]
    if (known) return known
    const { scene } = this
    let mesh: Mesh
    switch (name) {
      case 'sac': {
        mesh = MeshBuilder.CreateSphere('forme-sac', { diameterX: BOX * 1.1, diameterY: BOX, diameterZ: BOX * 1.1, segments: 10 }, scene)
        mesh.material = material(scene, 'forme-sac', '#a87a4c')
        break
      }
      case 'pièce': {
        mesh = MeshBuilder.CreateCylinder('forme-piece', { diameter: MARBLE_R * 1.9, height: MARBLE_R * 1.0, tessellation: 12 }, scene)
        mesh.material = material(scene, 'forme-piece', '#ffcc4d', 0.6)
        break
      }
      case 'bille': {
        mesh = MeshBuilder.CreateSphere('forme-bille', { diameter: MARBLE_R * 2, segments: 8 }, scene)
        mesh.material = material(scene, 'forme-bille', '#4db8f2', 0.4)
        break
      }
      default: {
        mesh = MeshBuilder.CreateBox('forme-boite', { size: BOX }, scene)
        mesh.material = material(scene, 'forme-boite', '#9e5cdb')
      }
    }
    mesh.isVisible = false
    mesh.isPickable = false
    this.shapes[name] = mesh
    return mesh
  }

  /** Une série d'objets sur un plateau : une copie du modèle (la forme dit « boîte » ou « sac », « bille » ou « pièce ») et une instance par place. */
  private fill(plate: number, kind: 'boxes' | 'marbles', shapeName: string, spots: Spot[]): void {
    const slot = this.objects[plate]!
    slot[kind]?.dispose()
    slot[kind] = null
    if (spots.length === 0) return
    const mesh = this.shape(shapeName).clone(`${kind}-${plate}`)
    mesh.isVisible = true
    mesh.parent = this.plates[plate]!
    mesh.alwaysSelectAsActiveMesh = true // les instances sont hors de la boîte du modèle
    mesh.isPickable = false
    mesh.receiveShadows = true
    const buffer = new Float32Array(spots.length * 16)
    spots.forEach((s, n) => Matrix.Translation(s.x, s.y, s.z).copyToArray(buffer, n * 16))
    mesh.thinInstanceSetBuffer('matrix', buffer, 16, true)
    slot[kind] = mesh
    this.cast(mesh)
  }

  /** Les plateaux, les boîtes, les billes, les étiquettes. */
  private setSides(state: BalanceState, names: BalanceNames): void {
    ;([state.left, state.right] as const).forEach((side, i) => {
      this.fill(i, 'boxes', names.box[0], boxSpots(side.boxes))
      this.fill(i, 'marbles', names.unit[0], marbleSpots(side.units, side.boxes > 0))
      this.counts[i]!.set(plateLabel(side, names.box, names.unit))
    })
  }

  /** La masse essayée, écrite au-dessus de chaque boîte (null : rien). */
  private showGuess(value: number | null, state: BalanceState): void {
    for (const label of this.guessLabels) {
      label.mesh.material?.dispose(true, true)
      label.mesh.dispose()
    }
    this.guessLabels = []
    if (value === null) return
    ;([state.left, state.right] as const).forEach((side, i) => {
      for (const [n, spot] of boxSpots(side.boxes).entries()) {
        const label = textPlane(this.scene, `balance-masse-${i}-${n}`, 0.62, 0.62, 330)
        label.set(String(value))
        label.mesh.parent = this.plates[i]!
        label.mesh.position.set(spot.x, spot.y + BOX / 2 + 0.42, spot.z)
        this.guessLabels.push(label)
      }
    })
  }

  /** Montre l'état de la manche ; ne refait que ce qui a changé. `calm` : le fléau glisse sans rebondir. */
  show(view: RigView, calm: boolean): void {
    this.calm = calm
    const before = this.shown
    const key = (v: RigView) => JSON.stringify([v.state, v.names.box[0], v.names.unit[0]])
    if (!before || key(before) !== key(view)) this.setSides(view.state, view.names)
    if (!before || before.shown !== view.shown || key(before) !== key(view)) this.showGuess(view.shown, view.state)
    if (!before || before.heavier !== view.heavier) {
      this.from = this.tilt
      this.goal = tiltFor(view.heavier)
      this.elapsed = before ? 0 : Infinity
      if (!before) this.tilt = this.goal
    }
    this.shown = { ...view, state: { left: { ...view.state.left }, right: { ...view.state.right } } }
    this.place()
  }

  /** Fait avancer le mouvement du fléau (appelé à chaque image). */
  update(dt: number): void {
    if (!Number.isFinite(this.elapsed)) return
    this.elapsed += dt
    this.tilt = tiltAt(this.from, this.goal, this.elapsed, this.calm)
    if (this.elapsed >= (this.calm ? 0.6 : 0.9)) {
      this.tilt = this.goal
      this.elapsed = Infinity
    }
    this.place()
  }

  /** Le fléau penche, les plateaux pendent sous ses extrémités et restent horizontaux. */
  private place(): void {
    this.beam.rotation.z = (this.tilt * Math.PI) / 180
    const p = platePositions(this.tilt)
    this.plates[0].position.set(p.left.x, p.left.y, p.left.z)
    this.plates[1].position.set(p.right.x, p.right.y, p.right.z)
    this.chains[0].position.set(p.leftChain.x, p.leftChain.y, p.leftChain.z)
    this.chains[1].position.set(p.rightChain.x, p.rightChain.y, p.rightChain.z)
  }

  /** Où est un plateau dans le monde (étincelles). */
  plateWorld(left: boolean): Vector3 {
    return this.plates[left ? 0 : 1].getAbsolutePosition().clone()
  }

  /** Le haut de la balance, dans le monde (étincelles, caméra). */
  topWorld(): Vector3 {
    return this.root.getAbsolutePosition().add(new Vector3(0, PIVOT_H, 0))
  }

  snapshot(): RigSnapshot {
    const view = this.shown
    return {
      left: view ? { ...view.state.left } : { boxes: 0, units: 0 },
      right: view ? { ...view.state.right } : { boxes: 0, units: 0 },
      names: view?.names ?? { box: ['boîte', 'boîtes'], unit: ['bille', 'billes'] },
      shown: view?.shown ?? null,
      tilt: this.tilt,
      goal: this.goal,
      labels: view ? [plateLabel(view.state.left, view.names.box, view.names.unit), plateLabel(view.state.right, view.names.box, view.names.unit)] : [],
      guessLabels: this.guessLabels.length,
      settled: !Number.isFinite(this.elapsed),
    }
  }

  dispose(): void {
    this.root.dispose(false, true)
    for (const mesh of Object.values(this.shapes)) mesh.dispose(false, true)
  }
}
