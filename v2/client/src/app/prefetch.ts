/**
 * Préchargement des modèles d'un lieu pendant que l'enfant lit son seuil. Un squelette KayKit pèse 4,8 Mo (ses 95 animations) :
 * un lieu qui en a trois sortes en tire 8,7 Mo à la première visite, soit 4 s à 50 Mbit/s et 20 s à 8 Mbit/s. Une simple requête
 * remplit le cache du navigateur ; l'intérieur, qui charge ensuite les mêmes fichiers, les y trouve (nginx les revalide : 304).
 */
import { enemyFiles } from '../core/world/monsters'
import type { Place } from '../core/world/places'

const MODELS = '/ressources/models'
const asked = new Set<string>()

export function prefetchPlace(place: Place): void {
  for (const file of enemyFiles(place.dungeon.rooms)) {
    if (asked.has(file)) continue
    asked.add(file)
    fetch(`${MODELS}/${file}`, { priority: 'low' } as RequestInit).catch(() => asked.delete(file)) // hors ligne : on réessaiera
  }
}
