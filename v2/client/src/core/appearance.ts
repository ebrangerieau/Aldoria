/**
 * L'apparence de l'enfant dans sa partie : l'`Look` de core/wardrobe.ts (silhouette, armes, couvre-chef, cape et sa couleur, compagnon) rangée dans
 * `SaveData.look`, toujours relue par `sanitizeLook` avec ce que l'enfant a débloqué (niveau du héros, lieux terminés) : une valeur inconnue,
 * verrouillée ou incompatible reprend sa valeur par défaut, si bien qu'une partie d'un autre appareil reste jouable. Purement cosmétique.
 *
 * Ce module relie la partie (core/save.ts) et la logique de la personnalisation ; la scène 3D et l'écran (ui/Wardrobe.tsx) ne décident de rien.
 */
import { levelForXp } from './progression'
import { placesDone } from './relics'
import type { SaveData } from './save'
import { defaultLook, newlyUnlocked, type Look, type Progress, sanitizeLook, unlockedCount, type World } from './wardrobe'

/** Le compagnon animal n'existe que dans le monde lumineux (le renard de Jules). */
export const hasPet = (world: World): boolean => world === 'lumineux'

/** Ce qui débloque une apparence : le niveau du héros et les lieux terminés. */
export function progressOf(save: Pick<SaveData, 'xp' | 'places'>): Progress {
  return { level: levelForXp(save.xp), dungeons: placesDone(save) }
}

/**
 * Une apparence relue d'une ancienne partie (`{ model, main, off, cape: 'origine' }` : la cape était alors un identifiant de couleur) ou d'un autre
 * appareil : les champs absents prennent leur valeur par défaut. Elle n'est pas encore validée (le monde et la progression manquent) : `lookOf` le fait.
 */
export function normalizeLook(raw: unknown): Look {
  const base = defaultLook('lumineux')
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return base
  const given = { ...(raw as Record<string, unknown>) }
  if (typeof given.cape === 'string') {
    // Ancienne forme : la cape était sa couleur.
    if (typeof given.cape_color !== 'string') given.cape_color = given.cape
    given.cape = true
  }
  return { ...base, ...given } as Look
}

/** L'apparence valide et autorisée de la partie, pour le monde de l'enfant. */
export function lookOf(save: Pick<SaveData, 'look' | 'xp' | 'places'>, world: World): Look {
  return sanitizeLook(save.look, world, progressOf(save))
}

/** La partie avec une nouvelle apparence (déjà validée avec ce que l'enfant a débloqué) ; jamais modifiée sur place. */
export function withLook<T extends Pick<SaveData, 'look' | 'xp' | 'places'>>(save: T, raw: unknown, world: World): T {
  return { ...save, look: sanitizeLook(raw, world, progressOf(save)) }
}

/** Les choix qui se débloquent entre deux états de la partie (coffre, niveau), à annoncer une fois : « Cape : vert forêt »… */
export function unlockNews(before: Pick<SaveData, 'xp' | 'places'>, after: Pick<SaveData, 'xp' | 'places'>, world: World): string[] {
  return newlyUnlocked(progressOf(before), progressOf(after), hasPet(world))
}

/** Ce que l'enfant a dès le départ (niveau 1, aucun lieu terminé) : ce ne sont pas des nouveautés. */
const START: Progress = { level: 1, dungeons: 0 }

/** Combien de choix débloqués au-delà de ceux de départ l'enfant n'a pas encore vus dans l'écran d'apparence (pastille du bouton). */
export function unseenCount(save: Pick<SaveData, 'look' | 'xp' | 'places'>, world: World): number {
  const pet = hasPet(world)
  const seen = Math.max(lookOf(save, world).seen, unlockedCount(START, pet))
  return Math.max(0, unlockedCount(progressOf(save), pet) - seen)
}

/** La partie avec toutes les nouveautés marquées vues (l'enfant a ouvert l'écran d'apparence). */
export function markSeen<T extends Pick<SaveData, 'look' | 'xp' | 'places'>>(save: T, world: World): T {
  const look = lookOf(save, world)
  return { ...save, look: { ...look, seen: unlockedCount(progressOf(save), hasPet(world)) } }
}
