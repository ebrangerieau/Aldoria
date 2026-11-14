/**
 * Textes du combat par monde (content/monde/combat.json, repris de la v1) : noms des actions, encouragements,
 * cris de victoire, texte du repli. Aucun texte d'histoire dans le code (règle des données du monde).
 */
import texts from '@content/monde/combat.json'
import type { Action, World } from './encounter'

interface WorldTexts {
  actions: Record<Action, string>
  encouragements: string[]
  victoire: string[]
  repli: string
}

export const combatTexts = (world: World): WorldTexts => (texts as unknown as Record<World, WorldTexts>)[world]

/** Un mot de la liste, tiré au hasard. */
export function pickOne(list: string[], random: () => number = Math.random): string {
  return list[Math.floor(random() * list.length)] ?? ''
}
