/**
 * Les régions de l'île s'éclairent page après page (PRD V2-09, repris du brouillard de la carte de la v1) : une région que la classe n'a pas encore au
 * programme reste sous le brouillard (« brume »), une région au programme s'éveille avec son premier lieu puis gagne en lumière à chaque page rapportée,
 * jusqu'à être « éclairée » quand tous ses lieux sont terminés. Pur et testé sans moteur : le sol (game/island.ts) et la brume locale (GameWorld)
 * lisent seulement la lumière de chaque région ; la progression vient de la partie (`places`, lieux terminés), jamais d'un compteur à part.
 */
import { type Place, REGIONS } from './places'

export type RegionState = 'brume' | 'endormie' | 'eveillee' | 'eclairee'

/** Lumière d'une région au programme sans aucune page : ni sombre ni éclatante, pour que l'île reste accueillante au départ. */
export const BASE_LIGHT = 0.5
/** De combien la brume locale épaissit l'air d'une région sans lumière (facteur 1 + FOG_BOOST pour la brume, 1 pour une région éclairée). */
export const FOG_BOOST = 0.8

export interface RegionLight {
  code: string
  /** Lieux de la région pour la classe. */
  total: number
  /** Lieux terminés au moins une fois. */
  done: number
  /** 0 (brouillard) à 1 (éclairée). */
  light: number
  state: RegionState
}

/** Lumière et état de chaque région (même celles sans lieu : brume), d'après les lieux de la classe et ceux que la partie a terminés. */
export function regionLights(places: readonly Pick<Place, 'dungeon'>[], done: Record<string, number>, codes: readonly string[] = Object.keys(REGIONS)): Record<string, RegionLight> {
  const out: Record<string, RegionLight> = {}
  for (const code of codes) {
    const own = places.filter((p) => p.dungeon.region === code)
    const finished = own.filter((p) => (done[p.dungeon.code] ?? 0) > 0).length
    if (own.length === 0) {
      out[code] = { code, total: 0, done: 0, light: 0, state: 'brume' }
      continue
    }
    const ratio = finished / own.length
    out[code] = {
      code,
      total: own.length,
      done: finished,
      light: BASE_LIGHT + (1 - BASE_LIGHT) * ratio,
      state: finished === 0 ? 'endormie' : finished === own.length ? 'eclairee' : 'eveillee',
    }
  }
  return out
}

/** Facteur de la densité de brume du monde pour un héros dans une région de cette lumière (1 : pas de brume de plus ; au carré du manque de lumière, comme le sol : le brouillard épaissit, l'attente à peine). */
export const fogDensityFactor = (light: number): number => 1 + FOG_BOOST * (1 - Math.min(1, Math.max(0, light))) ** 2

/** Le texte de brouillard d'une région que la classe n'a pas au programme (vide ailleurs, ou hors région). */
export function fogNote(code: string | null, lights: Record<string, RegionLight>): string {
  if (!code || lights[code]?.state !== 'brume') return ''
  return REGIONS[code]?.fog ?? ''
}

/** Ce que la carte et les lecteurs d'écran disent d'une région : « 1 page sur 3 rapportée », « sous le brouillard »… */
export function lightText(region: RegionLight): string {
  if (region.state === 'brume') return 'sous le brouillard'
  if (region.state === 'eclairee') return `éclairée (${region.total} ${region.total > 1 ? 'pages rapportées' : 'page rapportée'})`
  return `${region.done} page${region.done > 1 ? 's' : ''} sur ${region.total} rapportée${region.done > 1 ? 's' : ''}`
}
