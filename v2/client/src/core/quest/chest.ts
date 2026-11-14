/**
 * Fin d'un lieu : le coffre de l'Effaceur, la page rendue à la Grande Chronique et le salut de Maître Ysaline au retour sur l'île.
 * Règles portées de la v1 (scenes/dungeon/dungeon.gd : _open_chest). Pur : `completePlace` rend une nouvelle partie, jamais
 * modifiée sur place ; l'interface la range par `persist`.
 *
 * - À chaque fin de lieu : l'XP du coffre (`chest_xp`) et deux objets du sac.
 * - La première fois seulement : la page est rendue (`page_text`, titre « La page des X retrouvée ! ») et Maître Ysaline salue
 *   l'Archiviste au retour sur l'île en annonçant le chemin qui s'ouvre (texte et voix enregistrée : content/voix/lignes.json,
 *   `page-<code>`). Ensuite : le mot de la fin (`outro`).
 */
import lignes from '@content/voix/lignes.json'
import { draw, foundText, give, type ItemId } from '../inventory'
import type { SaveData } from '../save'
import type { DungeonData } from '../world/places'

/** Objets gagnés dans le coffre. */
export const CHEST_ITEMS = 2

export interface Completion {
  /** La partie après la fin du lieu : lieu +1, XP du coffre, objets, page rendue (première fois). */
  save: SaveData
  /** Première fois que ce lieu est terminé : la page est rendue et Maître Ysaline salue au retour. */
  first: boolean
  found: ItemId[]
}

/** Termine un lieu : calcule la nouvelle partie. `random` : tirage des objets (tests). */
export function completePlace(save: SaveData, def: Pick<DungeonData, 'code' | 'chest_xp'>, random: () => number = Math.random): Completion {
  const done = save.places[def.code] ?? 0
  const first = done === 0
  const found = draw(save.items, CHEST_ITEMS, random)
  const key = `page-${def.code}`
  return {
    first,
    found,
    save: {
      ...save,
      xp: save.xp + Math.max(0, Math.round(def.chest_xp)),
      places: { ...save.places, [def.code]: done + 1 },
      items: give(save.items, found),
      story: first && !save.story.includes(key) ? [...save.story, key] : save.story,
    },
  }
}

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

const plural = (n: number, one: string, many: string): string => (n > 1 ? many : one)

/** Ce qui s'affiche à l'ouverture du coffre : la page rendue (première fois) ou le mot de la fin. */
export function chestMessage(
  def: Pick<DungeonData, 'title' | 'page' | 'page_text' | 'outro' | 'chest_xp'>,
  facts: { first: boolean; answered: number; correct: number; found: readonly ItemId[] },
): { title: string; text: string } {
  const story = facts.first && def.page_text ? def.page_text : def.outro
  const lines = [
    story,
    `${facts.correct} ${plural(facts.correct, 'bonne réponse', 'bonnes réponses')} sur ${facts.answered}. +${def.chest_xp} XP dans le coffre.`,
  ]
  const items = foundText(facts.found)
  if (items) lines.push(items)
  const title = facts.first && def.page ? `${capitalize(def.page)} retrouvée !` : `${def.title} : terminé !`
  return { title, text: lines.join('\n') }
}

/** Le salut de Maître Ysaline au retour de la première fin d'un lieu (voix enregistrée), ou null si le lieu n'en a pas. */
export function pageGreeting(code: string): string | null {
  return (lignes as { id: string; texte: string }[]).find((l) => l.id === `page-${code}`)?.texte ?? null
}
