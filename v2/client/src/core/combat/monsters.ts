/**
 * Modèles d'ennemis, portés de la v1 (Fighter.MONSTERS). Monstres Quaternius (CC0), souhait des
 * enfants : pas seulement des squelettes. Valeur : hauteur visée en mètres (un squelette KayKit
 * mesure environ 2,5 m) ; l'échelle se déduit de la boîte englobante du modèle, mesurée une fois
 * (game/combat). Les squelettes KayKit ne figurent pas ici : voir `isKayKit`.
 */
export const MONSTER_HEIGHTS: Record<string, number> = {
  Mushnub: 1.7,
  MushnubEvolved: 2.6,
  GreenBlob: 1.4,
  Goleling: 2.2,
  GolelingEvolved: 2.8,
  Cactoro: 3.2,
  Armabee: 2.2,
  Dragon: 2.3,
  Ghost: 2.4,
  GhostSkull: 2.5,
  BlueDemon: 3.4,
  Demon: 2.9,
  Orc: 2.7,
  Yeti: 2.8,
}

/** Monstres modélisés de profil : quart de tour (degrés) pour faire face à l'adversaire. */
export const MONSTER_YAW: Record<string, number> = { Dragon: 90 }

/** Personnages KayKit (squelettes) : même squelette et mêmes animations que le héros. */
export const KAYKIT_ENEMIES = ['Skeleton_Warrior', 'Skeleton_Minion', 'Skeleton_Mage', 'Skeleton_Rogue'] as const

export const isMonster = (model: string): boolean => model in MONSTER_HEIGHTS
export const isKayKit = (model: string): boolean => (KAYKIT_ENEMIES as readonly string[]).includes(model)

/** Chemin du modèle sous /ressources/models/. */
export function modelPath(model: string): string {
  return isMonster(model) ? `quaternius/monsters/${model}.glb` : `kaykit/characters/${model}.glb`
}
