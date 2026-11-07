/**
 * Ambiance d'un monde (choisi par le parent, la classe ne change que le contenu) : lumière,
 * ciel, brouillard, couleurs du sol. « lumineux » : fin d'après-midi dorée ; « brouillard » :
 * matin froid et voilé, plus mystérieux.
 */
export type WorldName = 'lumineux' | 'brouillard'

export interface WorldTheme {
  /** Hauteur du soleil (degrés au-dessus de l'horizon) et direction (0 = nord). */
  sunElevation: number
  sunAzimuth: number
  sunColor: string
  sunIntensity: number
  skyColor: string
  /** Ciel en dégradé : zénith, horizon (= couleur du brouillard), lueur autour du soleil. */
  zenithColor: string
  sunGlowColor: string
  groundColor: string
  hemiIntensity: number
  fogColor: string
  fogDensity: number
  waterColor: string
  /** Mélange des couleurs du sol vers le gris (0 = couleurs franches). */
  desaturate: number
  darken: number
  contrast: number
  exposure: number
  vignette: number
}

export const THEMES: Record<WorldName, WorldTheme> = {
  lumineux: {
    sunElevation: 28, sunAzimuth: 225, sunColor: '#fff1d6', sunIntensity: 1.9,
    skyColor: '#cfe6ff', zenithColor: '#4d8fdc', sunGlowColor: '#ffe2ad', groundColor: '#6b5a3c', hemiIntensity: 0.55,
    fogColor: '#dbe7ef', fogDensity: 0.0024,
    waterColor: '#2f86ad', desaturate: 0, darken: 1, contrast: 1.1, exposure: 1.0, vignette: 1.2,
  },
  brouillard: {
    sunElevation: 14, sunAzimuth: 120, sunColor: '#d7e2ff', sunIntensity: 1.3,
    skyColor: '#9fb1c6', zenithColor: '#566a82', sunGlowColor: '#e6ecf5', groundColor: '#3a3f4a', hemiIntensity: 0.8,
    fogColor: '#a9b4c0', fogDensity: 0.0075,
    waterColor: '#2c5068', desaturate: 0.32, darken: 0.92, contrast: 1.15, exposure: 1.0, vignette: 2.2,
  },
}
