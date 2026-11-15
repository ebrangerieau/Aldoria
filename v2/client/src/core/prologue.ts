/**
 * Le prologue (v1 : scenes/prologue) : cinq tableaux qui racontent la Grande Chronique, le vol de Malvrek, le Brouillard de l'Oubli, puis Maître Ysaline
 * qui confie la quête. Joué dans l'île par une caméra de cinéma (`GameWorld.setCinematic`, ui/Prologue.tsx), chaque tableau lu de la voix enregistrée du
 * narrateur ou de Maître Ysaline ; le texte, caché d'abord, se lit à la demande. Pur et testé : les tableaux (content/monde/prologue.json), leurs textes
 * (content/voix/lignes.json, un par monde), le temps de lecture, et « vu / pas vu » dans la partie (`story`).
 */
import prologue from '@content/monde/prologue.json'
import lignes from '@content/voix/lignes.json'
import type { SaveData } from './save'

export type World = 'lumineux' | 'brouillard'

/** Étape de l'histoire rangée dans `SaveData.story` quand l'enfant a vu (ou passé) le prologue. */
export const STORY_KEY = 'prologue'

/** Ce que la caméra cadre : un point de l'île (x vers l'est, z vers le nord), `haut` mètres au-dessus du sol, vu sous `alpha` / `beta` à `rayon` mètres. */
export interface Shot {
  x: number
  z: number
  haut: number
  alpha: number
  beta: number
  rayon: number
}

export interface Tableau {
  id: string
  titre: string
  /** Qui parle, écrit sous le titre (« Le narrateur », « La gardienne de la Chronique »). */
  qui: string
  voix: 'narrateur' | 'ysaline'
  /** Id de la réplique enregistrée, dans le monde de l'enfant. */
  ligne: string
  /** Texte lu (celui qui est enregistré). */
  texte: string
  /** Endroit de l'île visé (code d'un lieu de ile.json, d'une région, « ysaline », « depart »…), pour les tests. */
  lieu: string
  plan: Shot
}

interface Raw {
  id: string
  titre: string
  qui: string
  voix: 'narrateur' | 'ysaline'
  ligne: string
  lieu: string
  plan: Shot
}

const RAW = (prologue as unknown as { tableaux: Raw[] }).tableaux
const TEXT = new Map((lignes as unknown as { id: string; texte: string }[]).map((l) => [l.id, l.texte]))

/** Les cinq tableaux dans le monde de l'enfant (le ton de Jules, ou celui de Tom). */
export function tableaux(world: World): Tableau[] {
  return RAW.map((t) => {
    const ligne = `${t.ligne}-${world}`
    return { ...t, ligne, texte: TEXT.get(ligne) ?? '' }
  })
}

/** Le prologue se joue tout seul la première fois, pour un enfant connecté (jamais en mode découverte : rien n'y est enregistré, le parcours de test l'attendrait en vain). */
export const shouldAutoplay = (save: Pick<SaveData, 'story'>, demo: boolean): boolean => !demo && !save.story.includes(STORY_KEY)

/** La partie qui garde le prologue comme vu (un état neuf ; déjà vu : la même). */
export function markSeen<T extends Pick<SaveData, 'story'>>(save: T): T {
  return save.story.includes(STORY_KEY) ? save : { ...save, story: [...save.story, STORY_KEY] }
}

/**
 * Temps pour lire un tableau (ms) quand la voix n'a rien dit (appareil sans voix, son qui n'a pas pu partir) : l'enfant lit à son rythme, le tableau suivant ne vient pas
 * avant. Entre 5 et 25 secondes.
 */
export const readingTime = (text: string): number => Math.min(25_000, Math.max(5_000, Math.round(text.length * 70)))

/** Pause entre la fin de la voix et le tableau suivant (ms). */
export const PAUSE_AFTER_VOICE = 1_300

/** Une voix qui finit avant ce délai (ms) n'a probablement rien dit : le texte s'affiche d'office. */
export const SILENT_BELOW = 900
