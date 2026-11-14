/**
 * L'Effaceur d'un lieu : le gardien de sa dernière salle (`room.kind === 'boss'` dans content/monde/lieux.json).
 * Règles du combat : core/combat/encounter.ts (sceaux, difficulté qui monte). Pur : aucune dépendance au moteur.
 */
import type { DungeonData, EnemySpec } from '../world/places'

export interface BossInfo {
  /** Indice de sa salle dans le lieu. */
  room: number
  spec: EnemySpec
}

/** L'Effaceur d'un lieu, ou null si le lieu n'en a pas. */
export function bossOf(def: Pick<DungeonData, 'rooms'>): BossInfo | null {
  const room = def.rooms.findIndex((r) => r.kind === 'boss')
  const spec = def.rooms[room]?.enemies?.[0]
  return room >= 0 && spec ? { room, spec } : null
}

/** La salle `room` est-elle celle de l'Effaceur ? */
export const isBossRoom = (def: Pick<DungeonData, 'rooms'>, room: number): boolean => def.rooms[room]?.kind === 'boss'
