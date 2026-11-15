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
import {
  CAPE_COLORS, defaultLook, isTwoHanded, newlyUnlocked, PARTS, PET_FURS, PET_NAMES, type Look, type Progress, requirementMet, requirementText, sanitizeLook,
  SILHOUETTES, type Unlockable, unlockedCount, type World,
} from './wardrobe'

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

/** Le compagnon à montrer dans la barre du haut : son nom (celui que l'enfant a choisi), ou rien dans un monde sans compagnon (le renard n'existe que dans le monde lumineux). */
export function companionLabel(save: Pick<SaveData, 'look' | 'xp' | 'places'>, world: World): string {
  return hasPet(world) ? lookOf(save, world).pet_name : ''
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

/** Un changement demandé dans l'écran d'apparence : un ou plusieurs champs de l'`Look` ; `choose` le valide. */
export type LookChoice = Partial<Pick<Look, 'model' | 'main' | 'off' | 'head' | 'cape' | 'cape_color' | 'pet_name' | 'pet_fur'>>

/**
 * L'apparence après ce choix, toujours validée avec ce que l'enfant a débloqué : un choix verrouillé ou incompatible n'a aucun effet (la valeur
 * d'avant est gardée), une autre silhouette reprend ses pièces par défaut, une arme à deux mains libère la main gauche.
 */
export function choose(look: Look, choice: LookChoice, world: World, progress: Progress): Look {
  const kept = sanitizeLook(look, world, progress)
  return { ...sanitizeLook({ ...kept, ...choice }, world, progress), seen: kept.seen }
}

/** Un choix de l'écran : son nom, s'il est celui de l'apparence, et ce qui le verrouille (`locked` : texte de la condition, « Niveau 5 »). */
export interface MenuEntry {
  id: string
  name: string
  selected: boolean
  /** Rien pour un choix libre ; sinon ce qu'il faut faire (« Niveau 5 », « Termine 2 lieux »). */
  locked?: string
  /** Un choix impossible pour une autre raison que la progression (main gauche avec une arme à deux mains) : la raison. */
  unavailable?: string
  /** Couleur à montrer à côté du nom (cape, pelage) ; jamais seule : le nom et la coche l'accompagnent. */
  swatch?: string
}

export interface Menu {
  silhouettes: MenuEntry[]
  main: MenuEntry[]
  off: MenuEntry[]
  /** Vrai si cette silhouette a un couvre-chef à retirer. */
  hasHead: boolean
  capeColors: MenuEntry[]
  /** Le compagnon : seulement dans le monde lumineux. */
  pet: { names: MenuEntry[]; furs: MenuEntry[] } | null
}

const lockOf = (item: Unlockable, progress: Progress): string | undefined => (requirementMet(item, progress) ? undefined : requirementText(item))

/** Tout ce que l'écran d'apparence propose pour cette apparence et cette progression (aucun calcul dans l'interface). */
export function menuOf(look: Look, world: World, progress: Progress): Menu {
  const parts = PARTS[look.model]!
  const twoHanded = isTwoHanded(look.main)
  return {
    silhouettes: SILHOUETTES.map((s) => ({ id: s.model, name: s.name, selected: s.model === look.model, locked: lockOf(s, progress) })),
    main: parts.main.map(([id, name]) => ({ id, name, selected: id === look.main })),
    off: parts.off.map(([id, name]) => ({
      id, name, selected: id === look.off,
      unavailable: twoHanded && id !== '' ? 'Une arme à deux mains occupe les deux mains.' : undefined,
    })),
    hasHead: parts.head !== '',
    // « D'origine » : pas de pastille (la cape d'origine a la couleur de sa silhouette, jamais « blanche »).
    capeColors: CAPE_COLORS.map((c) => ({ id: c.id, name: c.name, selected: c.id === look.cape_color, locked: lockOf(c, progress), swatch: c.id === 'origine' ? undefined : c.color })),
    pet: hasPet(world)
      ? {
          names: PET_NAMES.map((name) => ({ id: name, name, selected: name === look.pet_name })),
          furs: PET_FURS.map((f) => ({ id: f.id, name: f.name, selected: f.id === look.pet_fur, locked: lockOf(f, progress), swatch: f.main })),
        }
      : null,
  }
}
