/**
 * Plan de construction de l'intérieur d'un lieu : quelles pièces KayKit poser, où, tournées de
 * combien (recette de la v1, game/core/world/dungeon_level.gd). Pur : la scène Babylon.js
 * (game/interior/level.ts) exécute ce plan. Une salle = 4 × 5 dalles de 4 m, mur du fond, mur
 * ouest avec sa porte (dès la 2e salle), colonnes, bannières, objets le long des murs (décor du
 * lieu, `v1_decor`), torches et une bougie. Les salles impaires sont en miroir est-ouest.
 */
import type { Decor, DungeonData } from '../world/places'
import type { Circle } from '../world/obstacles'
import { ROOM_D, ROOM_W, toWorld, yawToWorld } from './layout'

export interface Piece {
  /** Nom du fichier sous /ressources/models/kaykit/dungeon/ (sans .glb). */
  name: string
  x: number
  y: number
  z: number
  /** Orientation en radians. */
  yaw: number
  /** Porte entre la salle d'index `door - 1` et la salle `door` (battant mobile, hors fusion). */
  door?: number
}

export interface LevelPlan {
  pieces: Piece[]
  /** Objets du décor : le héros les contourne. */
  obstacles: Circle[]
  /** Position de chaque torche (la flamme et sa lumière). */
  torches: { x: number; y: number; z: number; room: number }[]
}

export const TILE = 4
const TILES_X = 4
const TILES_Z = 5

/** Objets le long des murs quand le lieu n'a pas de décor propre (salles paires ; impaires en miroir). */
export const DEFAULT_PROPS: NonNullable<Decor['props']> = [
  ['barrel_large', [1.4, 0, 1.6], 0, 0.8],
  ['barrel_small_stack', [3.0, 0, 1.1], 0, 0.7],
  ['crates_stacked', [14.4, 0, 1.8], -20, 0.9],
  ['keg_decorated', [14.9, 0, 5.0], 90, 0.7],
]

export const DEFAULT_FLOOR = 'floor_tile_large'
export const DEFAULT_ACCENT = 'floor_tile_large_rocks'
export const DEFAULT_WALLS = ['wall', 'wall_arched']
export const DEFAULT_BANNERS = ['banner_patternA_red', 'banner_patternA_blue']

/** Toutes les pièces que `planLevel` peut utiliser avec un décor donné (pour le chargement et les tests). */
export function piecesOf(plan: LevelPlan): string[] {
  return [...new Set(plan.pieces.map((p) => p.name))].sort()
}

export function planLevel(def: DungeonData): LevelPlan {
  const decor = def.v1_decor ?? {}
  const floorPiece = decor.floor ?? DEFAULT_FLOOR
  const accentPiece = decor.floor_accent ?? DEFAULT_ACCENT
  const walls = decor.walls ?? DEFAULT_WALLS
  const banners = decor.banners ?? DEFAULT_BANNERS
  const props = decor.props ?? DEFAULT_PROPS
  const count = def.rooms.length
  const pieces: Piece[] = []
  const obstacles: Circle[] = []
  const torches: LevelPlan['torches'] = []

  for (let i = 0; i < count; i += 1) {
    const x0 = i * ROOM_W
    // Pose une pièce aux coordonnées de la v1 de la salle (z vers le sud), converties pour le monde.
    const put = (name: string, v1x: number, y: number, v1z: number, yawDegrees = 0, extra: Partial<Piece> = {}) => {
      const at = toWorld(v1x, v1z)
      pieces.push({ name, x: x0 + at.x, y, z: at.z, yaw: yawToWorld(yawDegrees), ...extra })
    }

    // Sol : une dalle différente (éboulis, planches sombres) seulement le long du mur du fond, hors du passage.
    for (let ix = 0; ix < TILES_X; ix += 1) {
      for (let iz = 0; iz < TILES_Z; iz += 1) {
        const accent = iz === 0 && ix === 1 + (i % 2)
        put(accent ? accentPiece : floorPiece, 2 + ix * TILE, 0, 2 + iz * TILE)
      }
    }
    // Mur du fond.
    for (let ix = 0; ix < TILES_X; ix += 1) put(walls[(ix + i) % 2]!, 2 + ix * TILE, 0, 0)
    // Mur ouest : extérieur pour la 1re salle, sinon mur de séparation avec sa porte au milieu.
    for (let iz = 0; iz < TILES_Z; iz += 1) {
      const doorway = i > 0 && iz === 2
      put(doorway ? 'wall_doorway' : 'wall', 0, 0, 2 + iz * TILE, 90, doorway ? { door: i } : {})
    }
    if (i === count - 1) for (let iz = 0; iz < TILES_Z; iz += 1) put('wall', ROOM_W, 0, 2 + iz * TILE, -90)
    put('pillar_decorated', 0, 0, 0)
    if (i === count - 1) put('pillar_decorated', ROOM_W, 0, 0)

    // Décor contre les murs (jamais sur le passage des portes ni au centre).
    const mirror = i % 2 === 1
    put(banners[mirror ? 1 : 0]!, 6.5, 0, 0.05)
    put(banners[mirror ? 0 : 1]!, 9.5, 0, 0.05)
    for (const [name, [px, py, pz], yaw, radius] of props) {
      const v1x = mirror ? ROOM_W - px : px
      put(name, v1x, py, pz, yaw)
      const at = toWorld(v1x, pz)
      obstacles.push({ x: x0 + at.x, z: at.z, r: radius })
    }
    put('candle_triple', 8, 0, 0.9)
    for (const tx of [4, 12]) {
      put('torch_mounted', tx, 2.2, 0.1)
      const at = toWorld(tx, 0.7)
      torches.push({ x: x0 + at.x, y: 3, z: at.z, room: i })
    }
  }
  return { pieces, obstacles, torches }
}

/** Salle contenant un point de la salle : utile aux tests (aucune pièce hors des murs). */
export const insideLevel = (x: number, z: number, count: number): boolean => x >= -0.01 && x <= count * ROOM_W + 0.01 && z >= -0.01 && z <= ROOM_D + 0.01
