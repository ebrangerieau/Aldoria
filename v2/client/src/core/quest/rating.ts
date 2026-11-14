/**
 * La note de plaisir de fin de lieu (v1 : ui/hud/rating_panel.gd) : « Comment as-tu trouvé ce lieu ? », de 1 à 5 étoiles.
 * C'est un indicateur du PRD (§2) que le parent voit : facultative, « Passer » ne note rien (0). Envoyée avec la fin de la
 * session du lieu (`session/end`, champ `rating`).
 */

export const RATING_WORDS = ['Bof', 'Moyen', 'Bien', 'Très bien', 'Génial !'] as const
export const MAX_RATING = RATING_WORDS.length

/** La note envoyée au serveur : un entier de 1 à 5, ou 0 (pas de note) pour toute autre valeur. */
export function normalizeRating(value: unknown): number {
  const n = typeof value === 'number' ? Math.round(value) : 0
  return n >= 1 && n <= MAX_RATING ? n : 0
}

/** Le mot qui accompagne une note (« Génial ! »), vide sans note. */
export function ratingWord(value: number): string {
  const n = normalizeRating(value)
  return n === 0 ? '' : RATING_WORDS[n - 1]!
}
