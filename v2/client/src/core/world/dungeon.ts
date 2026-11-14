/**
 * Intérieur d'un lieu de quête : un donjon en enfilade, repris de la v1 (game/core/world/dungeon_level.gd).
 * Six salles de 16 × 20 m alignées d'ouest en est, reliées par une porte au milieu de chaque mur de
 * séparation ; chaque salle est 4 m plus haut que la précédente (« donjon qui monte », souhait des
 * enfants) et un escalier, contre le mur est, mène à la porte de la suivante. Le côté sud reste ouvert :
 * vue en coupe, la caméra est au sud et ne voit jamais à travers un mur.
 *
 * Aucune dépendance au moteur : ce module décrit la géométrie (sol, escalier, murs, pièces du décor,
 * obstacles) et la scène (game/interior.ts) la dresse. Repère du monde intérieur : x vers l'est, z vers
 * le nord (comme l'île), mur nord de chaque salle en z = 0, bord sud ouvert en z = -20. La « profondeur »
 * d'un point est -z (0 au mur nord, 20 au bord sud) : c'est le « z » de la v1, ce qui garde valables les
 * positions des ennemis et du décor écrites dans lieux.json.
 */

export const TILE = 4
export const ROOM_W = 16
export const ROOM_D = 20
export const TILES_X = 4
export const TILES_Z = 5
/** Profondeur du milieu du mur de séparation (3e dalle) : la porte et l'escalier y sont. */
export const DOOR_DEPTH = 10
export const DOOR_HALF = 1.1
export const WALL_T = 0.6
/** Mètres entre deux salles d'un donjon qui monte. */
export const CLIMB_RISE = 4
/** Longueur de l'escalier (pièce « stairs » : 4 m de long, 5 m de large). */
export const STAIR_RUN = 4
export const STAIR_HALF = 2.5
/** Le centre du héros reste à cette distance d'un mur (rayon du héros, plus l'épaisseur du mur). */
export const WALL_CLEARANCE = 0.75
/** Passage d'une porte pour le centre du héros (la porte fait ±1,1 m ; le corps déborde d'environ 0,45 m). */
export const DOOR_PASS = 0.8
/** Hauteur rendue hors du donjon (murs, vide) : la marche du héros s'y refuse (comme l'eau profonde). */
export const VOID_HEIGHT = -10
/** Distance héros – ennemi pendant un combat (v1 : FIGHT_GAP). */
export const FIGHT_GAP = 4.8
/** À cette distance d'un ennemi de sa salle, le combat s'engage (v1 : AGGRO_DISTANCE). */
export const AGGRO_DISTANCE = 3.6
/** Le héros ne se place pas plus près que cela du mur ouest de la salle pour combattre. */
export const FIGHT_MARGIN = 1.2
/** Rayon de l'obstacle d'un ennemi (v1 : 0,5). */
export const ENEMY_RADIUS = 0.5
/** Où apparaît le coffre de l'Effaceur dans sa salle : x dans la salle et profondeur, comme dans la v1 (CHEST_AT). */
export const CHEST_AT: [number, number] = [12.5, 10]
/** Le héros ouvre le coffre (touche E) à cette distance (v1 : 1,9, un peu plus ici : on n'attend pas le contact). */
export const CHEST_REACH = 2.4
/** Rayon de l'obstacle du coffre. */
export const CHEST_RADIUS = 0.9
/** Salles dont la porte de sortie n'attend rien : l'entrée, et l'énigme tant qu'elle n'est pas portée (étape 1.5). */
export const OPEN_KINDS = new Set(['entree', 'enigme'])

export type Vec3 = [number, number, number]

/** Décor propre à un lieu (champ `v1_decor` de lieux.json) ; les valeurs absentes prennent celles de DEFAULT_DECOR. */
export interface DungeonDecor {
  floor?: string
  floor_accent?: string
  walls?: string[]
  banners?: string[]
  /** [modèle, position dans la salle (x, y, profondeur), orientation Godot en degrés, rayon de l'obstacle]. */
  props?: [string, Vec3, number, number][]
  /** Couleur des torches, composantes de 0 à 1. */
  torch_color?: Vec3
}

export const DEFAULT_DECOR: Required<DungeonDecor> = {
  floor: 'floor_tile_large',
  floor_accent: 'floor_tile_large_rocks',
  walls: ['wall', 'wall_arched'],
  banners: ['banner_patternA_red', 'banner_patternA_blue'],
  props: [
    ['barrel_large', [1.4, 0, 1.6], 0, 0.8],
    ['barrel_small_stack', [3.0, 0, 1.1], 0, 0.7],
    ['crates_stacked', [14.4, 0, 1.8], -20, 0.9],
    ['keg_decorated', [14.9, 0, 5.0], 90, 0.7],
  ],
  torch_color: [1, 0.62, 0.28],
}

export type PieceRole = 'sol' | 'mur' | 'porte' | 'escalier' | 'pilier' | 'banniere' | 'torche' | 'meuble' | 'fondation'

/** Une pièce du décor à poser (modèles KayKit « dungeon », à leur taille d'origine). */
export interface Piece {
  /** Nom du modèle, sans extension (kaykit/dungeon/<nom>.glb). */
  model: string
  role: PieceRole
  room: number
  /** Position de l'origine du modèle dans le monde intérieur. */
  x: number
  y: number
  z: number
  /** Cap de la face avant du modèle, en degrés dans le sens des aiguilles d'une montre depuis le nord (0 nord, 90 est, 180 sud, 270 ouest). */
  heading: number
  /** Étirement en hauteur (mur sous la porte, escalier d'un étage qui n'est pas de 4 m). */
  scaleY?: number
}

export interface Torch {
  room: number
  x: number
  y: number
  z: number
}

export interface Circle {
  x: number
  z: number
  r: number
}

/** Cap (0 = nord, sens des aiguilles d'une montre) d'un modèle tourné de `yaw` degrés dans la v1 (Godot, z vers le sud). */
export const headingOf = (yaw: number): number => (((180 - yaw) % 360) + 360) % 360

export class Dungeon {
  readonly length: number
  /** Portes fermées : la porte k est entre la salle k et la salle k + 1 (son battant est dans le mur ouest de la salle k + 1). */
  private readonly closed = new Set<number>()

  constructor(
    readonly roomCount: number,
    readonly rise = CLIMB_RISE,
    readonly decor: DungeonDecor = {},
  ) {
    this.length = roomCount * ROOM_W
  }

  // --- Repères ------------------------------------------------------------------------

  /** Coin nord-ouest du sol d'une salle. */
  roomOrigin(i: number): { x: number; y: number; z: number } {
    return { x: i * ROOM_W, y: i * this.rise, z: 0 }
  }

  /** Point du monde intérieur pour une position (x dans la salle, profondeur) de la v1 ; les salles impaires sont en miroir est-ouest. */
  point(room: number, x: number, depth: number, mirror = false): { x: number; z: number } {
    return { x: room * ROOM_W + (mirror && room % 2 === 1 ? ROOM_W - x : x), z: -depth }
  }

  roomAt(x: number): number {
    return Math.min(this.roomCount - 1, Math.max(0, Math.floor(x / ROOM_W)))
  }

  /** Point d'arrivée dans une salle, juste après la porte ouest. */
  entryPoint(i: number): { x: number; y: number; z: number } {
    return { x: i * ROOM_W + 2.5, y: i * this.rise, z: -DOOR_DEPTH }
  }

  /** La salle a un escalier vers la suivante. */
  hasStairs(i: number): boolean {
    return this.rise > 0 && i < this.roomCount - 1
  }

  floorLabel(i: number): string {
    return `Étage ${i + 1} / ${this.roomCount}`
  }

  // --- Portes ---------------------------------------------------------------------------

  /** Ferme les portes de sortie des salles qui demandent d'être vaincues (toutes sauf celles de `OPEN_KINDS`). */
  lockDoors(kinds: string[]): void {
    this.closed.clear()
    kinds.forEach((kind, room) => {
      if (room < this.roomCount - 1 && !OPEN_KINDS.has(kind)) this.closed.add(room)
    })
  }

  isDoorOpen(door: number): boolean {
    return !this.closed.has(door)
  }

  openDoor(door: number): void {
    this.closed.delete(door)
  }

  /** Portes encore fermées. */
  get lockedDoors(): number[] {
    return [...this.closed].sort((a, b) => a - b)
  }

  // --- Combats --------------------------------------------------------------------------

  /** Position d'un ennemi (x dans la salle, profondeur : `v1_at` de lieux.json) : le même point que dans la v1, sans miroir. */
  enemyPoint(room: number, at: [number, number]): { x: number; z: number } {
    return this.point(room, at[0], at[1])
  }

  /** Où se met le héros pour combattre un ennemi : FIGHT_GAP à sa gauche (à l'ouest), sans sortir de la salle. */
  fightSpot(room: number, enemy: { x: number; z: number }): { x: number; z: number } {
    return { x: Math.max(enemy.x - FIGHT_GAP, room * ROOM_W + FIGHT_MARGIN), z: enemy.z }
  }

  /** Où apparaît le coffre dans la salle de l'Effaceur. */
  chestPoint(room: number): { x: number; z: number } {
    return this.point(room, CHEST_AT[0], CHEST_AT[1])
  }

  // --- Sol ----------------------------------------------------------------------------

  /**
   * Hauteur du sol sous un point : celle de sa salle, ou de l'escalier qui monte vers la suivante.
   * Hors du donjon et le long des murs (à moins d'un rayon de héros de leur surface), VOID_HEIGHT :
   * le déplacement du héros (core/world/movement.ts) s'y refuse comme dans l'eau profonde.
   */
  heightAt(x: number, z: number): number {
    const depth = -z
    if (x < WALL_CLEARANCE || x > this.length - WALL_CLEARANCE) return VOID_HEIGHT
    if (depth < WALL_CLEARANCE || depth > ROOM_D - 0.4) return VOID_HEIGHT
    // Mur de séparation, percé par la porte (fermée : plein).
    const wall = Math.round(x / ROOM_W)
    if (wall >= 1 && wall <= this.roomCount - 1 && Math.abs(x - wall * ROOM_W) < WALL_CLEARANCE) {
      if (Math.abs(depth - DOOR_DEPTH) > DOOR_PASS || this.closed.has(wall - 1)) return VOID_HEIGHT
    }
    const i = this.roomAt(x)
    const base = i * this.rise
    const local = x - i * ROOM_W
    if (this.hasStairs(i) && local > ROOM_W - STAIR_RUN && Math.abs(depth - DOOR_DEPTH) < STAIR_HALF) {
      return base + ((local - (ROOM_W - STAIR_RUN)) / STAIR_RUN) * this.rise
    }
    return base
  }

  /** Obstacles ronds : le décor posé contre les murs (tonneaux, caisses, étagères). */
  obstacles(): Circle[] {
    const out: Circle[] = []
    for (let i = 0; i < this.roomCount; i += 1) {
      for (const [, at, , radius] of this.props()) {
        const p = this.point(i, at[0], at[2], true)
        out.push({ x: p.x, z: p.z, r: radius })
      }
    }
    return out
  }

  private props(): [string, Vec3, number, number][] {
    return this.decor.props ?? DEFAULT_DECOR.props
  }

  // --- Pièces du décor ----------------------------------------------------------------

  pieces(): Piece[] {
    const out: Piece[] = []
    for (let i = 0; i < this.roomCount; i += 1) this.roomPieces(i, out)
    return out
  }

  /** Torches de toutes les salles : deux contre le mur nord, à 4 et 12 m. */
  torches(): Torch[] {
    const out: Torch[] = []
    for (let i = 0; i < this.roomCount; i += 1) {
      const base = i * this.rise
      for (const x of [4, 12]) out.push({ room: i, x: i * ROOM_W + x, y: base + 3, z: -0.7 })
    }
    return out
  }

  torchColor(): Vec3 {
    return this.decor.torch_color ?? DEFAULT_DECOR.torch_color
  }

  private roomPieces(i: number, out: Piece[]): void {
    const d = { ...DEFAULT_DECOR, ...this.decor }
    const ox = i * ROOM_W
    const oy = i * this.rise
    const add = (model: string, role: PieceRole, x: number, y: number, depth: number, yaw: number, scaleY?: number): Piece => {
      const piece: Piece = { model, role, room: i, x: ox + x, y: oy + y, z: -depth, heading: headingOf(yaw) }
      if (scaleY !== undefined) piece.scaleY = scaleY
      out.push(piece)
      return piece
    }
    // Sol : une dalle différente (éboulis, planches sombres) seulement le long du mur nord, hors du passage.
    for (let ix = 0; ix < TILES_X; ix += 1) {
      for (let iz = 0; iz < TILES_Z; iz += 1) {
        const accent = iz === 0 && ix === 1 + (i % 2)
        add(accent ? d.floor_accent : d.floor, 'sol', 2 + ix * TILE, 0, 2 + iz * TILE, 0)
      }
    }
    // Mur nord.
    for (let ix = 0; ix < TILES_X; ix += 1) add(d.walls[(ix + i) % 2]!, 'mur', 2 + ix * TILE, 0, 0, 0)
    // Mur ouest : porte vers la salle d'avant (pour la première salle, la sortie du lieu).
    for (let iz = 0; iz < TILES_Z; iz += 1) {
      const doorway = iz === 2
      add(doorway ? 'wall_doorway' : 'wall', doorway ? 'porte' : 'mur', 0, 0, 2 + iz * TILE, 90)
    }
    const last = i === this.roomCount - 1
    if (last) {
      for (let iz = 0; iz < TILES_Z; iz += 1) add('wall', 'mur', ROOM_W, 0, 2 + iz * TILE, -90)
    } else if (this.rise > 0) {
      // Escalier contre le mur est : muret plein, plus bas sous la porte de la salle suivante.
      for (let iz = 0; iz < TILES_Z; iz += 1) add('wall', 'mur', ROOM_W, 0, 2 + iz * TILE, -90, iz === 2 ? this.rise / 4 : undefined)
      // L'origine de la pièce est au haut des marches (son bord z = 0, pas son centre) : posée sur la ligne du mur
      // est, tournée de -90°, elle monte vers l'est sans vide derrière elle et suit la rampe de heightAt.
      add('stairs', 'escalier', ROOM_W, 0, DOOR_DEPTH, -90, this.rise / 4)
    }
    add('pillar_decorated', 'pilier', 0, 0, 0, 0)
    if (last || this.rise > 0) add('pillar_decorated', 'pilier', ROOM_W, 0, 0, 0)
    // Décor contre les murs (jamais sur le passage des portes ni au centre).
    const mirror = i % 2 === 1
    add(d.banners[mirror ? 1 : 0]!, 'banniere', 6.5, 0, 0.05, 0)
    add(d.banners[mirror ? 0 : 1]!, 'banniere', 9.5, 0, 0.05, 0)
    for (const [model, at, yaw] of this.props()) add(model, 'meuble', mirror ? ROOM_W - at[0] : at[0], at[1], at[2], yaw)
    add('candle_triple', 'meuble', 8, 0, 0.9, 0)
    for (const x of [4, 12]) add('torch_mounted', 'torche', x, 2.2, 0.1, 0)
    // Mur sous le bord sud d'une salle (vue en coupe : pas de sol flottant).
    if (this.rise > 0) for (let ix = 0; ix < TILES_X; ix += 1) add('wall', 'fondation', 2 + ix * TILE, -4, ROOM_D, 180)
  }
}
