/**
 * Musique d'ambiance : liste des morceaux (content/monde/musique.json) et mélangeur de volume,
 * sans le moindre son. Le lecteur (app/music.ts) joue les fichiers et lui demande, image après
 * image, à quel volume. Règles reprises de la v1 : fondu d'une seconde et demie, volume de fond
 * sous les voix et les effets, plus discrète quand une voix parle, silence pendant une question
 * (l'enfant doit rester concentré), plus basse en mode calme.
 */
import musique from '@content/monde/musique.json'

export interface Track {
  file: string
  title: string
  tool: string
}

export const TRACKS: Track[] = (musique as unknown as { morceaux: { fichier: string; titre: string; outil: string }[] }).morceaux.map(
  (m) => ({ file: m.fichier, title: m.titre, tool: m.outil }),
)

/** Volume par défaut (réglable dans les Options, de 0 à 1). */
export const DEFAULT_VOLUME = 0.7
/** Musique de fond : sous les voix et les effets. */
export const BASE_DB = -6
/** En plus, pendant qu'une voix parle. */
export const DUCK_DB = -9
/** En plus, avec l'aménagement « mode calme ». */
export const CALM_DB = -8
export const FADE_SECONDS = 1.5
/** Vitesse de l'atténuation sous une voix, en décibels par seconde. */
const DUCK_RATE = 18

export const dbToLinear = (db: number): number => 10 ** (db / 20)

/** Rapproche `value` de `target` d'au plus `step`. */
export function approach(value: number, target: number, step: number): number {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step)
}

/** Morceau suivant : dans l'ordre, puis on recommence (un seul morceau : toujours le même). */
export function nextTrack(index: number, count: number): number {
  return count <= 0 ? 0 : (index + 1) % count
}

/** Crédits à afficher dans les Options : une phrase par outil, avec tous ses morceaux. */
export function creditLines(tracks: Track[]): string[] {
  const byTool = new Map<string, string[]>()
  for (const t of tracks) byTool.set(t.tool, [...(byTool.get(t.tool) ?? []), `« ${t.title} »`])
  return [...byTool].map(([tool, titles]) => {
    const list = titles.length > 1 ? `${titles.slice(0, -1).join(', ')} et ${titles[titles.length - 1]}` : titles[0]
    return `${list}, ${titles.length > 1 ? 'créées' : 'créée'} avec ${tool}.`
  })
}

/** Volume réglé par l'enfant (0 à 1), une valeur absente ou fausse valant le volume par défaut. */
export function volumeOf(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : DEFAULT_VOLUME
}

export interface MixInput {
  /** La musique doit se faire entendre (en jeu, ni coupée, ni pendant une question). */
  on: boolean
  /** Volume de l'enfant, de 0 à 1. */
  volume: number
  speaking: boolean
  calm: boolean
}

export class MusicMixer {
  /** Fondu : 0 = silence, 1 = plein volume. */
  fade = 0
  /** Atténuation sous une voix, en décibels (0 ou négative). */
  duck = 0

  /** Fait avancer les fondus de `dt` secondes ; rend le volume du lecteur (0 à 1, linéaire). */
  step(dt: number, input: MixInput): number {
    this.fade = approach(this.fade, input.on ? 1 : 0, dt / FADE_SECONDS)
    this.duck = approach(this.duck, input.speaking ? DUCK_DB : 0, dt * DUCK_RATE)
    const volume = Math.min(1, Math.max(0, input.volume))
    return this.fade * volume * dbToLinear(BASE_DB + this.duck + (input.calm ? CALM_DB : 0))
  }
}
