/**
 * Le temple du Sphinx vu en 3D (game/temple.ts), la part qui se calcule sans moteur : où se pose chaque case du plateau (core/sphinx/board.ts) dans le
 * monde, quels murs se voient, comment la caméra cadre la salle, les couleurs de chaque monde et le lissage des mouvements. Repris de la v1
 * (core/world/sphinx_temple.gd), mais la caméra est fixe et cadre toute la salle d'un coup : un puzzle de blocs se lit d'en haut.
 *
 * Repère : la caméra est au sud et regarde vers le nord (+z), comme partout dans la v2 ; la colonne x du plateau va vers la droite de l'écran (+x) et la rangée 0
 * est au fond (z le plus grand) : « haut » (u, y - 1) éloigne de la caméra, « droite » (r, x + 1) va vers la droite. Un test garde cette orientation.
 */
import { type Cell, type Dir } from './board'

/** Côté d'une dalle, en mètres. */
export const TILE = 2
/** Hauteur d'un mur ordinaire, et d'un mur qui a une dalle derrière lui (au nord) : bas, pour ne jamais cacher un bloc à la caméra du sud. */
export const WALL_HEIGHT = 1.5
export const WALL_LOW = 0.7
/** Épaisseur du sol (le dessus est à y = 0). */
export const FLOOR_THICKNESS = 0.3
/** Bloc : côté, hauteur. Un peu plus petit qu'une dalle, pour qu'on voie la dalle autour. */
export const BLOCK_SIDE = 1.5
export const BLOCK_HEIGHT = 1.05
/** Le Sphinx est assis sur le mur du fond : sa hauteur au-dessus du mur compte dans le cadrage. */
export const SPHINX_HEIGHT = 2.2

/** Un point du monde, en mètres. */
export interface Point {
  x: number
  z: number
}

/** Centre de la case `cell` d'un plateau de `height` rangées. */
export function cellCenter(height: number, cell: Cell): Point {
  return { x: cell.x * TILE, z: (height - 1 - cell.y) * TILE }
}

/** La case sous un point du monde (pour un clic) ; peut sortir du plateau, c'est à l'appelant de vérifier `board.isTile`. */
export function cellAt(height: number, p: Point): Cell {
  return { x: Math.round(p.x / TILE), y: height - 1 - Math.round(p.z / TILE) }
}

/** Le sens de marche d'une direction du plateau, dans le monde. */
export const WORLD_DIRS: Readonly<Record<Dir, Point>> = {
  l: { x: -1, z: 0 },
  r: { x: 1, z: 0 },
  u: { x: 0, z: 1 },
  d: { x: 0, z: -1 },
}

/** Cap du héros (rotation autour de y ; 0 : vers le nord, +z) quand il regarde dans une direction. */
export function yawOf(dir: Dir): number {
  const d = WORLD_DIRS[dir]
  return Math.atan2(d.x, d.z)
}

const key = (c: Cell): string => `${c.x},${c.y}`

/** La salle d'accueil du temple : le Sphinx y reçoit l'enfant avant la première énigme et le raccompagne à la fin (aucun bloc, aucune dalle gravée). */
export const VESTIBULE: readonly string[] = ['#########', '#       #', '#   @   #', '#       #', '#########']

/** Les dimensions et les cases d'un plateau, tout ce que le plan du temple lit (`SphinxBoard` en est un). */
export interface BoardShape {
  width: number
  height: number
  walls: readonly Cell[]
  goals: readonly Cell[]
  isTile(cell: Cell): boolean
}

export interface WallPiece {
  cell: Cell
  /** Une dalle est juste derrière (au nord) : le mur est bas, la caméra du sud verrait sinon un bloc disparaître derrière lui. */
  low: boolean
}

export interface TemplePlan {
  width: number
  height: number
  floor: Cell[]
  goals: Cell[]
  walls: WallPiece[]
  /** Les cases qui comptent pour le cadrage : dalles et murs vus. */
  min: Cell
  max: Cell
}

/** Le plan du temple : les dalles, les dalles gravées et les murs qui touchent le temple (les autres, au loin, ne se voient pas : du sable). */
export function templePlan(board: BoardShape): TemplePlan {
  const floor: Cell[] = []
  for (let y = 0; y < board.height; y += 1) {
    for (let x = 0; x < board.width; x += 1) {
      if (board.isTile({ x, y })) floor.push({ x, y })
    }
  }
  const touches = (c: Cell): boolean => {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if ((dx !== 0 || dy !== 0) && board.isTile({ x: c.x + dx, y: c.y + dy })) return true
      }
    }
    return false
  }
  const walls: WallPiece[] = board.walls.filter(touches).map((cell) => ({ cell, low: board.isTile({ x: cell.x, y: cell.y - 1 }) }))
  const all = [...floor, ...walls.map((w) => w.cell)]
  const min = { x: Math.min(...all.map((c) => c.x)), y: Math.min(...all.map((c) => c.y)) }
  const max = { x: Math.max(...all.map((c) => c.x)), y: Math.max(...all.map((c) => c.y)) }
  return { width: board.width, height: board.height, floor, goals: [...board.goals], walls, min, max }
}

export type BoxState = 'libre' | 'pose' | 'coince'

/** L'état de chaque bloc : posé sur une dalle gravée, coincé dans un coin, ou libre. */
export function boxStates(boxes: readonly Cell[], goals: readonly Cell[], stuck: number): BoxState[] {
  const goalKeys = new Set(goals.map(key))
  return boxes.map((b, i) => (goalKeys.has(key(b)) ? 'pose' : i === stuck ? 'coince' : 'libre'))
}

// --- Caméra -----------------------------------------------------------------------------------

/** Cap de la caméra (au sud, elle regarde vers le nord), inclinaison depuis la verticale, champ vertical. */
export const CAMERA_ALPHA = -Math.PI / 2
export const CAMERA_BETA = 0.62
export const CAMERA_FOV = 0.8

export interface Shot {
  alpha: number
  beta: number
  radius: number
  target: { x: number; y: number; z: number }
}

/** La part de l'écran où la salle doit tenir, en coordonnées de l'écran (-1 à gauche et en bas, 1 à droite et en haut). */
export interface FreeWindow {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

type Vec = { x: number; y: number; z: number }
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Vec, b: Vec): Vec => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const unit = (a: Vec): Vec => {
  const n = Math.hypot(a.x, a.y, a.z) || 1
  return { x: a.x / n, y: a.y / n, z: a.z / n }
}

/** Où un point du monde tombe à l'écran pour une caméra (repère main gauche de Babylon.js) ; `depth` : sa distance devant la caméra. */
export function project(shot: Shot, aspect: number, p: Vec, fov = CAMERA_FOV): { x: number; y: number; depth: number } {
  const sinB = Math.sin(shot.beta)
  const eye = {
    x: shot.target.x + shot.radius * Math.cos(shot.alpha) * sinB,
    y: shot.target.y + shot.radius * Math.cos(shot.beta),
    z: shot.target.z + shot.radius * Math.sin(shot.alpha) * sinB,
  }
  const forward = unit(sub(shot.target, eye))
  const right = unit(cross({ x: 0, y: 1, z: 0 }, forward))
  const up = cross(forward, right)
  const d = sub(p, eye)
  const depth = dot(d, forward)
  const half = Math.tan(fov / 2)
  return { x: dot(d, right) / (depth * half * aspect), y: dot(d, up) / (depth * half), depth }
}

/** Les huit coins de la salle : à la hauteur des murs au sud, du Sphinx au nord. */
function corners(plan: TemplePlan): Vec[] {
  const south = cellCenter(plan.height, { x: 0, y: plan.max.y }).z - TILE / 2
  const north = cellCenter(plan.height, { x: 0, y: plan.min.y }).z + TILE / 2
  const west = plan.min.x * TILE - TILE / 2
  const east = plan.max.x * TILE + TILE / 2
  const out: Vec[] = []
  for (const x of [west, east]) {
    out.push({ x, y: -FLOOR_THICKNESS, z: south }, { x, y: WALL_HEIGHT, z: south })
    out.push({ x, y: -FLOOR_THICKNESS, z: north }, { x, y: WALL_HEIGHT + SPHINX_HEIGHT, z: north })
  }
  return out
}

/** Le plus petit recul de la caméra qui fait tenir toute la salle dans `window`, la salle étant recentrée dans cette fenêtre. */
export function frame(plan: TemplePlan, aspect: number, window: FreeWindow): Shot {
  const cs = corners(plan)
  const centerX = (Math.min(...cs.map((c) => c.x)) + Math.max(...cs.map((c) => c.x))) / 2
  const centerZ = (Math.min(...cs.map((c) => c.z)) + Math.max(...cs.map((c) => c.z))) / 2
  const half = Math.tan(CAMERA_FOV / 2)
  const wantX = (window.xMin + window.xMax) / 2
  const wantY = (window.yMin + window.yMax) / 2
  let shot: Shot = { alpha: CAMERA_ALPHA, beta: CAMERA_BETA, radius: 8, target: { x: centerX, y: 0, z: centerZ } }
  for (let radius = 8; radius <= 120; radius += 0.25) {
    shot = { alpha: CAMERA_ALPHA, beta: CAMERA_BETA, radius, target: { x: centerX, y: 0, z: centerZ } }
    // La salle se décale dans la fenêtre : on déplace le point visé (à droite pour que le contenu parte à gauche, au nord pour qu'il descende).
    for (let pass = 0; pass < 4; pass += 1) {
      const shown = cs.map((c) => project(shot, aspect, c))
      const midX = (Math.min(...shown.map((s) => s.x)) + Math.max(...shown.map((s) => s.x))) / 2
      const midY = (Math.min(...shown.map((s) => s.y)) + Math.max(...shown.map((s) => s.y))) / 2
      shot = {
        ...shot,
        target: {
          x: shot.target.x + (midX - wantX) * radius * half * aspect,
          y: 0,
          z: shot.target.z + ((midY - wantY) * radius * half) / Math.cos(CAMERA_BETA),
        },
      }
    }
    const shown = cs.map((c) => project(shot, aspect, c))
    if (
      shown.every((s) => s.depth > 0 && s.x >= window.xMin && s.x <= window.xMax && s.y >= window.yMin && s.y <= window.yMax)
    ) {
      return shot
    }
  }
  return shot
}

/** La fenêtre libre quand un panneau de `insetRight` pixels occupe le côté droit d'un écran de `width` pixels de large. */
export function freeWindow(width: number, insetRight: number): FreeWindow {
  const xMax = Math.min(0.96, 1 - (2 * Math.max(0, insetRight)) / Math.max(1, width) - 0.04)
  return { xMin: -0.96, xMax: Math.max(-0.2, xMax), yMin: -0.94, yMax: 0.94 }
}

// --- Mouvement --------------------------------------------------------------------------------

/** Au-delà de ce nombre de dalles, un déplacement saute (annuler plusieurs pas, recommencer, l'aide du Sphinx qui remet la salle) au lieu de glisser. */
export const SLIDE_LIMIT = 1.6

/** Vitesse de rattrapage (par seconde) : un pas de 110 ms (marche vers une dalle) est fini avant le suivant. */
export const GLIDE_RATE = 38

/**
 * Rapproche `current` de `target` en `dt` secondes. Saute d'un coup quand l'écart dépasse `SLIDE_LIMIT` dalles, en mode calme (`snap`), ou quand il est
 * minuscule ; un nouveau but remplace l'ancien sans jamais retarder le suivant.
 */
export function glide(current: number, target: number, dt: number, snap = false): number {
  const gap = target - current
  if (snap || Math.abs(gap) > SLIDE_LIMIT * TILE || Math.abs(gap) < 0.002) return target
  return current + gap * (1 - Math.exp(-GLIDE_RATE * Math.max(0, dt)))
}

// --- Couleurs ---------------------------------------------------------------------------------

export type WorldName = 'lumineux' | 'brouillard'

export interface TemplePalette {
  /** Fond du ciel et du sable alentour. */
  sky: string
  sand: string
  floorA: string
  floorB: string
  /** Pourtour des dalles gravées. */
  goal: string
  goalInlay: string
  wall: string
  wallTop: string
  block: string
  blockMark: string
  /** Bloc posé sur une dalle gravée. */
  blockPlaced: string
  stone: string
  ambient: string
  ambientIntensity: number
  sun: string
  sunIntensity: number
}

export const PALETTES: Record<WorldName, TemplePalette> = {
  lumineux: {
    sky: '#f0d9a8', sand: '#c99a55', floorA: '#f3e8c6', floorB: '#e6d8b0', goal: '#7a4f12', goalInlay: '#e9b93a', wall: '#8b6a3e', wallTop: '#b9915a',
    block: '#b8763a', blockMark: '#3a2410', blockPlaced: '#e3b341', stone: '#d4bd8c', ambient: '#fff0cf', ambientIntensity: 0.7, sun: '#ffe2b0', sunIntensity: 1.75,
  },
  brouillard: {
    sky: '#1b2432', sand: '#2a3140', floorA: '#76809a', floorB: '#687289', goal: '#9fb4d8', goalInlay: '#cfe0ff', wall: '#333c4c', wallTop: '#566074',
    block: '#8d6a4a', blockMark: '#14100c', blockPlaced: '#d9c46a', stone: '#6a7487', ambient: '#8fa3c8', ambientIntensity: 0.85, sun: '#a9c4ff', sunIntensity: 1.3,
  },
}
