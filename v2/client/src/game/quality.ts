/**
 * Profils de rendu (PC seulement : la v2 ne vise plus la tablette). Choisis par `?qualite=`
 * dans l'adresse, sinon « haut ». « bas » sert aux PC faibles et aux tests dans un navigateur
 * sans carte graphique (rendu logiciel de la CI).
 */
export type QualityName = 'haut' | 'moyen' | 'bas'

export interface Quality {
  name: QualityName
  /** Cases du maillage du sol sur toute la largeur (3,4 m par case à 256). */
  terrainSubdivisions: number
  shadowMapSize: number
  shadowCascades: number
  msaa: number
  ssao: boolean
  bloom: boolean
  glow: boolean
  /** Part de la végétation gardée (1 = toute). Sans niveaux de détail, 1 dépasse 2,5 millions de
   * triangles visibles : à remonter quand les arbres lointains seront simplifiés (phase 3). */
  vegetation: number
  /** Résolution de rendu : 1 = pleine, 1.5 = deux tiers. */
  hardwareScaling: number
}

const PROFILES: Record<QualityName, Quality> = {
  haut: {
    name: 'haut', terrainSubdivisions: 256, shadowMapSize: 2048, shadowCascades: 3, msaa: 4,
    ssao: true, bloom: true, glow: true, vegetation: 0.6, hardwareScaling: 1,
  },
  moyen: {
    name: 'moyen', terrainSubdivisions: 200, shadowMapSize: 1024, shadowCascades: 2, msaa: 2,
    ssao: false, bloom: true, glow: true, vegetation: 0.45, hardwareScaling: 1,
  },
  bas: {
    name: 'bas', terrainSubdivisions: 128, shadowMapSize: 512, shadowCascades: 1, msaa: 1,
    ssao: false, bloom: false, glow: false, vegetation: 0.25, hardwareScaling: 1.5,
  },
}

export function chooseQuality(params: URLSearchParams): Quality {
  const wanted = params.get('qualite') as QualityName | null
  return PROFILES[wanted && wanted in PROFILES ? wanted : 'haut']
}
