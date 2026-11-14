/**
 * Lieux de quête de l'île pour une classe : les donjons de la v1 (content/monde/lieux.json),
 * posés sur les emplacements de leur région (Terrain.slots). Dans une région, les lieux
 * s'ouvrent l'un après l'autre (le suivant quand le précédent a été terminé une fois).
 */
import lieux from '@content/monde/lieux.json'
import regions from '@content/monde/regions.json'
import type { DungeonDecor } from './dungeon'
import type { Point, Terrain } from './terrain'

/** Un ennemi de `lieux.json` (salle de combat, ou Effaceur dans la salle du boss). */
export interface EnemySpec {
  model: string
  name: string
  hp: number
  tier: number
  xp: number
  /** Sa place dans la salle, dans le repère de la v1 (x vers l'est, profondeur vers le fond). */
  v1_at: [number, number]
  /** Étirement propre à cet ennemi (1 par défaut ; les Effaceurs vont de 1,1 à 1,8). */
  scale?: number
}

export interface DungeonData {
  code: string
  level: string
  subject: string
  region: string
  order: number
  title: string
  chapter_codes: string[]
  chapter_title: string
  intro: string
  outro: string
  threshold: string
  page: string
  page_text: string
  boss_intro: string
  boss_defeat: string
  enigma: { generator: string; mode: string; title: string; intro: string; xp: number }
  chest_xp: number
  rooms: { kind: string; title: string; enemies?: EnemySpec[] }[]
  v1_map_piece: string
  /** Décor des salles (sol, murs, bannières, objets, couleur des torches) ; vide : décor par défaut. */
  v1_decor: DungeonDecor
}

export interface Place extends Point {
  dungeon: DungeonData
  /** Rang dans sa région (0 = premier ouvert). */
  rank: number
  /** Lieu à terminer avant celui-ci (null pour le premier de la région). */
  previous: string | null
}

export const DUNGEONS = (lieux as unknown as { dungeons: DungeonData[] }).dungeons
export const REGIONS = (regions as unknown as { regions: Record<string, { title: string; fog: string }> }).regions
export const WORLD_TEXTS = regions as unknown as { citadel_text: string; welcome: string }

export function regionTitle(code: string): string {
  if (code === 'citadelle') return 'La Citadelle des Archives'
  if (code === 'sphinx') return "L'Île du Sphinx"
  return REGIONS[code]?.title ?? code
}

export function placesFor(level: string, terrain: Terrain): Place[] {
  const out: Place[] = []
  const rankInRegion: Record<string, number> = {}
  const lastInRegion: Record<string, string> = {}
  for (const dungeon of DUNGEONS.filter((d) => d.level === level).sort((a, b) => a.order - b.order)) {
    const rank = rankInRegion[dungeon.region] ?? 0
    const slot = terrain.slots[dungeon.region]?.[rank]
    if (!slot) continue // région sans emplacement libre : signalé par les tests
    out.push({ ...slot, dungeon, rank, previous: lastInRegion[dungeon.region] ?? null })
    rankInRegion[dungeon.region] = rank + 1
    lastInRegion[dungeon.region] = dungeon.code
  }
  return out
}

/** Un lieu est ouvert si c'est le premier de sa région, ou si le précédent a été terminé. */
export function isOpen(place: Place, done: Record<string, number>): boolean {
  return place.previous === null || (done[place.previous] ?? 0) > 0
}
