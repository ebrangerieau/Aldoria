/**
 * Ce que le sac permet de faire (v1 : Encounter._open_bag, QuestionPanel._add_item_buttons), sans écran ni moteur.
 * Aucun objet ne fait sauter une question : ils aident à répondre ou à encaisser.
 * - En combat, par le bouton « Sac », sans question et sans perdre son tour : la potion rend toute la vie, le bouclier
 *   fait manquer le prochain coup de l'ennemi.
 * - Dans une question : la plume cache deux mauvaises propositions d'un QCM d'au moins trois choix, le parchemin donne
 *   l'indice. Une aide d'un objet compte comme indice pour le suivi, mais sans baisse de puissance au combat.
 * Les objets sont rangés dans la partie (`core/save.ts`) : l'appelant la range après chaque usage.
 */
import type { CombatEvent, Encounter } from './combat/encounter'
import { count, ITEMS, type ItemId, type Owned, use } from './inventory'
import type { Item } from './items'

/** Objets du bouton « Sac » d'un combat, dans l'ordre de la v1. */
export const COMBAT_ITEMS: readonly ItemId[] = ['potion', 'bouclier']
/** Objets d'une question, dans l'ordre de la v1. */
export const QUESTION_ITEMS: readonly ItemId[] = ['plume', 'parchemin']
/** Propositions retirées par une plume. */
export const FEATHER_HIDES = 2
/** Un QCM d'au moins trois choix : retirer deux propositions en laisse deux au moins. */
export const FEATHER_MIN_CHOICES = 3

type Fighter = Pick<Encounter, 'hero' | 'shieldUp' | 'usePotion' | 'useShield'>

export interface BagEntry {
  id: ItemId
  name: string
  help: string
  count: number
  usable: boolean
  /** Pourquoi il ne sert pas maintenant (vide si `usable`). */
  why: string
}

/** Ce que le sac propose pendant un combat : la potion et le bouclier, avec ce qui empêche de s'en servir. */
export function bagEntries(owned: Owned, fight: Pick<Fighter, 'hero' | 'shieldUp'>): BagEntry[] {
  return COMBAT_ITEMS.map((id) => {
    const n = count(owned, id)
    let why = ''
    if (n <= 0) why = "Tu n'en as plus."
    else if (id === 'potion' && fight.hero.hp >= fight.hero.maxHp) why = 'Ta vie est déjà pleine.'
    else if (id === 'bouclier' && fight.shieldUp) why = 'Ton bouclier est déjà levé.'
    return { id, name: ITEMS[id].name, help: ITEMS[id].help, count: n, usable: why === '', why }
  })
}

/** « Plume ×2, Parchemin ×1 » : ce que le sac garde pour les questions (vide s'il n'y en a pas) ; le panneau du combat le rappelle. */
export function questionItemsText(owned: Owned): string {
  return QUESTION_ITEMS.filter((id) => count(owned, id) > 0)
    .map((id) => `${ITEMS[id].short} ×${count(owned, id)}`)
    .join(', ')
}

/** Le sac contient de quoi servir en combat (potion ou bouclier), même si rien n'est utilisable à cet instant. */
export const hasCombatItems = (owned: Owned): boolean => COMBAT_ITEMS.some((id) => count(owned, id) > 0)

export interface Used {
  /** Le sac après l'usage : un objet de moins. */
  owned: Owned
  /** Ce qui s'est passé, à raconter (la potion rend des PV, le bouclier se lève). */
  event: CombatEvent
}

/** Utilise un objet en plein combat ; null s'il n'est pas utilisable (absent, vie pleine, bouclier déjà levé). Le tour n'est pas perdu. */
export function spendInCombat(owned: Owned, fight: Fighter, id: ItemId): Used | null {
  const entry = bagEntries(owned, fight).find((e) => e.id === id)
  if (!entry?.usable) return null
  const next = use(owned, id)
  if (!next) return null
  return { owned: next, event: id === 'potion' ? fight.usePotion() : fight.useShield() }
}

/** Un QCM dont la plume peut retirer des propositions. */
const featherApplies = (item: Item): boolean =>
  item.type === 'mcq' && item.answer.kind === 'choice' && (item.choices?.length ?? 0) >= FEATHER_MIN_CHOICES

/** Les objets proposés sous une question : ceux que l'enfant possède et qui servent sur cette question. */
export function questionAids(item: Item, owned: Owned): ItemId[] {
  return QUESTION_ITEMS.filter((id) => {
    if (count(owned, id) <= 0) return false
    return id === 'plume' ? featherApplies(item) : item.hint.trim() !== ''
  })
}

/** Les propositions que la plume cache : deux mauvaises, jamais la bonne (rang dans `item.choices`, ordre croissant). */
export function featherHides(item: Item, random: () => number = Math.random): number[] {
  if (!featherApplies(item) || item.answer.kind !== 'choice') return []
  const right = item.answer.index
  const wrong = (item.choices ?? []).map((_, i) => i).filter((i) => i !== right)
  const hidden: number[] = []
  while (hidden.length < FEATHER_HIDES && wrong.length > 1) {
    // Il reste toujours au moins une mauvaise proposition à côté de la bonne.
    hidden.push(wrong.splice(Math.floor(random() * wrong.length), 1)[0]!)
  }
  return hidden.sort((a, b) => a - b)
}

/**
 * Ce que compte l'aide reçue pour une réponse : l'indice ordinaire (« Un indice ? ») baisse la puissance d'un coup et compte pour
 * le suivi ; un objet du sac (plume, parchemin) compte pour le suivi seulement (l'enfant a eu de l'aide), sans baisse de puissance :
 * il l'a gagné, il serait injuste de le lui faire payer.
 */
export function helpCounted(hintShown: boolean, spent: readonly ItemId[]): { tracking: boolean; power: boolean } {
  return { tracking: hintShown || spent.length > 0, power: hintShown }
}
