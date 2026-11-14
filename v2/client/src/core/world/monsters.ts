/**
 * Ennemis d'un lieu : les squelettes KayKit (même rig que le héros, donc à sa hauteur) et les monstres
 * Quaternius (hauteur reprise de la v1, mise à l'échelle du héros de la v2, et échelle mesurée une fois :
 * content/monde/monstres.json, v2/tools/mesurer_monstres.mjs). Aucune dépendance au moteur.
 */
import data from '@content/monde/monstres.json'

interface MonsterRow {
  hauteur_v1: number
  echelle: number
  cap: number
}

const table = data as unknown as {
  hauteur_heros_v1: number
  hauteur_heros: number
  squelettes: string[]
  monstres: Record<string, MonsterRow>
}

/** Hauteur du héros dans le jeu, en mètres. */
export const HERO_HEIGHT = table.hauteur_heros
/** Rapport des hauteurs du héros, v2 sur v1 : ce qui était à l'échelle du héros de la v1 (un coffre, un décor) se réduit d'autant. */
export const V1_TO_V2 = table.hauteur_heros / table.hauteur_heros_v1

export const isSkeleton = (model: string): boolean => table.squelettes.includes(model)

export interface MonsterFit {
  /** Hauteur visée, en mètres, avant l'étirement propre à l'ennemi (`scale` de lieux.json). */
  height: number
  /** Échelle à donner au modèle Quaternius pour l'atteindre. */
  scale: number
  /** Quart de tour des monstres modélisés de profil, en radians. */
  yaw: number
}

/** Mesures d'un monstre Quaternius, ou null pour un squelette ou un modèle inconnu. */
export function monsterFit(model: string): MonsterFit | null {
  const row = table.monstres[model]
  if (!row) return null
  return {
    height: (row.hauteur_v1 * table.hauteur_heros) / table.hauteur_heros_v1,
    scale: row.echelle,
    yaw: (row.cap * Math.PI) / 180,
  }
}

export const MONSTER_MODELS = Object.keys(table.monstres)

/** Fichier d'un modèle d'ennemi, relatif à /ressources/models/ (squelette KayKit ou monstre Quaternius). */
export const enemyFile = (model: string): string =>
  isSkeleton(model) ? `kaykit/characters/${model}.glb` : `quaternius/monsters/${model}.glb`

/** Les fichiers des ennemis d'un lieu, sans doublon (le boss compris : on le préchargera avec les autres). */
export function enemyFiles(rooms: { enemies?: { model: string }[] }[]): string[] {
  return [...new Set(rooms.flatMap((room) => (room.enemies ?? []).map((enemy) => enemyFile(enemy.model))))]
}
