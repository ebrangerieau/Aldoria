/**
 * L'énigme d'un lieu : trois piédestaux dans la quatrième salle, une question chacun (v1 : scenes/dungeon/dungeon.gd,
 * `_solve_pedestal`). Une bonne réponse éveille le cristal (XP du lieu et de la question) ; une erreur montre la méthode et le
 * piédestal repose jusqu'à ce que le héros s'éloigne puis revienne. Les trois cristaux éveillés ouvrent la porte, et un objet
 * attendait sur le dernier piédestal. Pur : l'interface range la nouvelle partie par `persist`, la scène 3D ne décide de rien.
 *
 * Hors connexion, ou si la session n'a pas d'énigme jouable (visuel non dessiné), une question du chapitre la remplace :
 * aucun lieu ne reste infranchissable.
 */
import combat from '@content/monde/combat.json'
import type { Item } from '../items'
import { describe, draw, give, type ItemId } from '../inventory'
import { answerXp } from '../progression'
import type { QuestionService } from '../questionService'
import type { SaveData } from '../save'
import type { DungeonData } from '../world/places'

/** Nombre de piédestaux, donc de questions, d'une énigme. */
export const PEDESTALS = 3
/** Objets du sac trouvés quand l'énigme est résolue. */
export const ENIGMA_ITEMS = 1

/**
 * L'introduction de la salle-énigme : celle du lieu, sauf si elle décrit un décor que la v2 n'a pas encore (la balance géante,
 * phase 2) : `enigme_introductions` de combat.json donne alors le texte des trois cristaux.
 */
export function enigmaIntro(def: Pick<DungeonData, 'enigma'>): string {
  const byMode = combat.enigme_introductions as Record<string, string>
  return byMode[def.enigma.mode] ?? def.enigma.intro
}

/** L'XP d'une bonne réponse à un piédestal : celle du lieu (`enigma.xp`) et celle de la question. */
export function enigmaXp(def: Pick<DungeonData, 'enigma'>, difficulty: number): number {
  return Math.max(0, Math.round(def.enigma.xp)) + answerXp(difficulty)
}

/**
 * La question d'un piédestal : une énigme de la session, à défaut une question du chapitre, à défaut n'importe laquelle (comme le combat) ;
 * null seulement si le paquet est vide. La porte attend les trois cristaux : une question manquante ne doit jamais la fermer pour de bon.
 */
export function riddleItem(questions: Pick<QuestionService, 'next'>): Item | null {
  return questions.next('enigme') ?? questions.next('chapitre') ?? questions.next()
}

export interface Found {
  /** La partie avec les objets au sac (jamais modifiée sur place). */
  save: SaveData
  found: ItemId[]
}

/** `count` objets tirés pour le sac (moins, ou aucun, si le sac est plein). */
export function findItems(save: SaveData, count: number, random: () => number = Math.random): Found {
  const found = draw(save.items, count, random)
  return { found, save: found.length > 0 ? { ...save, items: give(save.items, found) } : save }
}

/** Ce qu'on annonce à l'ouverture de la porte, quand il y a eu une trouvaille. */
export function foundBanner(found: readonly ItemId[]): string {
  return found.length === 0 ? '' : `Trouvé : ${describe(found)} !`
}
