/**
 * Personnalisation (PRD V2-08), portée de la v1 (game/core/progression/wardrobe.gd) : apparence du héros
 * (silhouette KayKit, arme, main gauche, couvre-chef, cape et sa couleur) et compagnon animal du monde de
 * Jules (nom, pelage). Purement cosmétique : aucun effet sur les combats. Données : content/monde/apparence.json.
 *
 * Certains choix se débloquent avec le niveau du héros ou les lieux terminés (`requirementMet`) : de quoi
 * donner un sens aux coffres sans rien vendre. L'apparence est rangée dans la partie ; `sanitizeLook` la
 * revalide toujours (valeur inconnue, verrouillée ou incompatible : celle par défaut), si bien qu'une
 * sauvegarde d'un autre appareil au contenu invalide reste jouable.
 */
import data from '@content/monde/apparence.json'

export interface Look {
  model: string
  /** Pièce tenue en main droite (nom du maillage dans le .glb). */
  main: string
  /** Pièce de la main gauche (« » : rien). */
  off: string
  head: boolean
  cape: boolean
  cape_color: string
  pet_name: string
  pet_fur: string
  /** Nombre de choix débloqués déjà vus (signale les nouveautés). */
  seen: number
}

export interface Unlockable {
  level?: number
  dungeons?: number
}
export interface Silhouette extends Unlockable {
  model: string
  name: string
}
export interface CapeColor extends Unlockable {
  id: string
  name: string
  color: string
}
export interface PetFur extends Unlockable {
  id: string
  name: string
  main: string
  light: string
}
export interface Parts {
  main: [string, string][]
  off: [string, string][]
  head: string
  cape: string
  default_off: string
}

export const SILHOUETTES = data.silhouettes as Silhouette[]
export const PARTS = data.parts as unknown as Record<string, Parts>
export const CAPE_COLORS = data.cape_colors as CapeColor[]
export const PET_FURS = data.pet_furs as PetFur[]
export const PET_NAMES = data.pet_names as string[]
const ATTACKS = data.attacks as Record<string, string[]>

export type World = 'lumineux' | 'brouillard'

/** Ce qui débloque : niveau du héros et lieux terminés. */
export interface Progress {
  level: number
  dungeons: number
}

export const isTwoHanded = (part: string): boolean => part.startsWith('2H_')

/** Condition de déblocage : niveau du héros et nombre de lieux terminés. */
export function requirementMet(item: Unlockable, progress: Progress): boolean {
  return progress.level >= (item.level ?? 1) && progress.dungeons >= (item.dungeons ?? 0)
}

export function requirementText(item: Unlockable): string {
  const needed = item.dungeons ?? 0
  if (needed > 0) return `Termine ${needed} lieu${needed > 1 ? 'x' : ''}`
  return `Niveau ${item.level ?? 1}`
}

/** Pièces par défaut d'une silhouette (au changement de silhouette). */
export function defaultsFor(model: string): Pick<Look, 'model' | 'main' | 'off' | 'head' | 'cape' | 'cape_color'> {
  const parts = PARTS[model]!
  return { model, main: parts.main[0]![0], off: parts.default_off, head: true, cape: true, cape_color: 'origine' }
}

/** Apparence de départ d'un monde : Chevalier pour Jules, Rôdeur dans le Brouillard. */
export function defaultLook(world: World): Look {
  return { ...defaultsFor(world === 'brouillard' ? 'Rogue_Hooded' : 'Knight'), pet_name: PET_NAMES[0]!, pet_fur: PET_FURS[0]!.id, seen: 0 }
}

const ids = (pairs: [string, string][]): string[] => pairs.map(([id]) => id)

function allowed(list: { id: string; level?: number; dungeons?: number }[], value: unknown, progress: Progress, fallback: string): string {
  const entry = list.find((e) => e.id === value)
  return entry && requirementMet(entry, progress) ? entry.id : fallback
}

/** Apparence valide et autorisée : toute valeur inconnue, verrouillée ou incompatible (arme à deux mains et main gauche) reprend sa valeur par défaut. */
export function sanitizeLook(raw: unknown, world: World, progress: Progress): Look {
  let look = defaultLook(world)
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return look
  const given = raw as Record<string, unknown>
  const wanted = SILHOUETTES.find((s) => s.model === given.model)
  // Silhouette connue et débloquée : elle prend ses pièces par défaut (les choix de l'autre silhouette ne la suivent pas).
  if (wanted && wanted.model !== look.model && requirementMet(wanted, progress)) look = { ...look, ...defaultsFor(wanted.model) }
  const parts = PARTS[look.model]!
  if (typeof given.main === 'string' && ids(parts.main).includes(given.main)) look.main = given.main
  if (typeof given.off === 'string' && ids(parts.off).includes(given.off)) look.off = given.off
  if (isTwoHanded(look.main)) look.off = ''
  look.head = parts.head !== '' ? given.head !== false : false
  look.cape = given.cape !== false
  look.cape_color = allowed(CAPE_COLORS, given.cape_color, progress, 'origine')
  look.pet_fur = allowed(PET_FURS, given.pet_fur, progress, PET_FURS[0]!.id)
  if (typeof given.pet_name === 'string' && PET_NAMES.includes(given.pet_name)) look.pet_name = given.pet_name
  look.seen = typeof given.seen === 'number' && given.seen > 0 ? Math.floor(given.seen) : 0
  return look
}

/** Nombre de choix débloqués (silhouettes, couleurs de cape, et pelages si le héros a un compagnon) : comparé à `look.seen` pour signaler les nouveautés. */
export function unlockedCount(progress: Progress, withPet: boolean): number {
  const lists: Unlockable[][] = [SILHOUETTES, CAPE_COLORS, ...(withPet ? [PET_FURS] : [])]
  return lists.reduce((n, list) => n + list.filter((item) => requirementMet(item, progress)).length, 0)
}

/** Noms des choix qui se débloquent en passant d'un état à l'autre (coffre, niveau), à annoncer une fois. */
export function newlyUnlocked(before: Progress, after: Progress, withPet: boolean): string[] {
  const out: string[] = []
  const news = (kind: string, list: { name: string; level?: number; dungeons?: number }[]) => {
    for (const item of list) if (requirementMet(item, after) && !requirementMet(item, before)) out.push(`${kind} : ${item.name.toLowerCase()}`)
  }
  news('Silhouette', SILHOUETTES)
  news('Cape', CAPE_COLORS)
  if (withPet) news('Pelage', PET_FURS)
  return out
}

/** Animations d'attaque (KayKit) selon l'arme tenue en main droite. */
export function attacksFor(look: Pick<Look, 'main'> & Partial<Pick<Look, 'off'>>): string[] {
  const main = look.main
  if (main.endsWith('Wand') || main.endsWith('Staff')) return ATTACKS.magic!
  if (main.endsWith('Crossbow')) return ATTACKS[isTwoHanded(main) ? '2H_ranged' : '1H_ranged']!
  if (main === 'Mug') return ATTACKS.unarmed!
  if (isTwoHanded(main)) return ATTACKS['2H']!
  return ATTACKS[(look.off ?? '').endsWith('Offhand') ? 'dual' : '1H']!
}

export function fur(id: string): PetFur {
  return PET_FURS.find((f) => f.id === id) ?? PET_FURS[0]!
}
