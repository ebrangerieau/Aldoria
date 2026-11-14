/**
 * Objets du sac, portés de la v1 (core/progression/inventory.gd) : des récompenses utiles à
 * certains moments. Aucun ne fait sauter une question : ils aident à répondre ou à encaisser.
 * - plume, parchemin : dans une question (QuestionPanel), sauf au défi du jour ;
 * - bouclier, potion : en combat, par le bouton « Sac », sans perdre son tour.
 * Gagnés : coffre d'un lieu (2), énigme résolue (1), coffre de la semaine (2), quête du village (1).
 * À ranger dans la partie (`core/save.ts`) ; le combat (`core/combat/encounter.ts`) applique déjà le bouclier et la potion.
 */
export const MAX_PER_ITEM = 5

export type ItemId = 'plume' | 'parchemin' | 'bouclier' | 'potion'
export type Owned = Partial<Record<ItemId, number>>

export const ORDER: readonly ItemId[] = ['plume', 'parchemin', 'bouclier', 'potion']

export const ITEMS: Record<ItemId, { name: string; short: string; help: string }> = {
  plume: { name: 'Plume du sage', short: 'Plume', help: "Retire deux mauvaises propositions d'un QCM." },
  parchemin: { name: "Parchemin d'indice", short: 'Parchemin', help: 'Un indice gratuit, sans perdre de puissance.' },
  bouclier: { name: 'Bouclier', short: 'Bouclier', help: 'Le prochain coup de l’ennemi ne te touche pas.' },
  potion: { name: "Potion d'urgence", short: 'Potion', help: 'Rend toute ta vie, sans question.' },
}

export const count = (owned: Owned, id: ItemId): number => Math.max(0, Math.floor(owned[id] ?? 0))

/** `n` objets tirés au hasard, plutôt ceux que l'on a peu ; jamais au-delà de MAX_PER_ITEM. */
export function draw(owned: Owned, n: number, random: () => number = Math.random): ItemId[] {
  const held: Record<ItemId, number> = { plume: 0, parchemin: 0, bouclier: 0, potion: 0 }
  for (const id of ORDER) held[id] = count(owned, id)
  const out: ItemId[] = []
  for (let i = 0; i < n; i += 1) {
    const weights = ORDER.map((id) => Math.max(0, MAX_PER_ITEM - held[id]))
    const total = weights.reduce((a, b) => a + b, 0)
    if (total <= 0) break
    let roll = random() * total
    for (let k = 0; k < ORDER.length; k += 1) {
      roll -= weights[k]!
      if (roll < 0) {
        out.push(ORDER[k]!)
        held[ORDER[k]!] += 1
        break
      }
    }
  }
  return out
}

/** Le sac après un gain : jamais au-delà du maximum par objet. */
export function give(owned: Owned, ids: readonly ItemId[]): Owned {
  const next: Owned = { ...owned }
  for (const id of ids) next[id] = Math.min(MAX_PER_ITEM, count(next, id) + 1)
  return next
}

/** Le sac après l'usage d'un objet, ou null s'il n'en reste pas. */
export function use(owned: Owned, id: ItemId): Owned | null {
  const have = count(owned, id)
  return have > 0 ? { ...owned, [id]: have - 1 } : null
}

/** « Plume du sage, Bouclier ×2 » (annonce d'un gain). */
export function describe(ids: readonly ItemId[]): string {
  const counts = new Map<ItemId, number>()
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  return ORDER.filter((id) => counts.has(id))
    .map((id) => ITEMS[id].name + (counts.get(id)! > 1 ? ` ×${counts.get(id)}` : ''))
    .join(', ')
}

/** Phrase d'annonce, vide si rien n'a été gagné (sac plein). */
export function foundText(ids: readonly ItemId[]): string {
  return ids.length === 0 ? '' : `Dans ton sac : ${describe(ids)}.`
}

/** Contenu du sac : « Sac : Plume ×2 · Bouclier ×1 », ou un sac vide. */
export function summary(owned: Owned): string {
  const parts = ORDER.filter((id) => count(owned, id) > 0).map((id) => `${ITEMS[id].short} ×${count(owned, id)}`)
  return 'Sac : ' + (parts.length > 0 ? parts.join(' · ') : "vide pour l'instant")
}
