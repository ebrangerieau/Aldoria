/**
 * Le bestiaire (v1 : SaveManager.record_defeat, scenes/archives) : chaque créature vaincue dans un lieu s'ajoute à la partie, par son nom, avec le nombre de victoires. Les
 * Archives le montrent à côté des notions. Pur et testé sans moteur ; un état se rend toujours neuf (jamais modifié sur place).
 */
export type Beasts = Record<string, number>

/** Espèces gardées au plus (les lieux n'en ont qu'une soixantaine : la limite ne protège que d'une partie abîmée). */
export const MAX_SPECIES = 200
export const MAX_NAME = 80
export const MAX_COUNT = 9999

/** Bestiaire relu d'une partie ancienne ou abîmée : noms non vides, nombres entiers de 1 à MAX_COUNT, MAX_SPECIES espèces au plus. */
export function normalizeBestiary(raw: unknown): Beasts {
  const given = (typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
  const out: Beasts = {}
  for (const [name, n] of Object.entries(given)) {
    const clean = name.trim().slice(0, MAX_NAME)
    if (clean === '' || typeof n !== 'number' || !Number.isFinite(n) || n < 1) continue
    if (!(clean in out) && Object.keys(out).length >= MAX_SPECIES) continue
    out[clean] = Math.min(MAX_COUNT, (out[clean] ?? 0) + Math.floor(n))
  }
  return out
}

/** Une victoire de plus sur cette créature : un bestiaire neuf. Un nom vide ne compte pas ; une espèce de trop (au-delà de MAX_SPECIES) non plus. */
export function recordDefeat(beasts: Beasts, name: string): Beasts {
  const clean = name.trim().slice(0, MAX_NAME)
  if (clean === '') return beasts
  if (!(clean in beasts) && Object.keys(beasts).length >= MAX_SPECIES) return beasts
  return { ...beasts, [clean]: Math.min(MAX_COUNT, (beasts[clean] ?? 0) + 1) }
}

export interface BeastLine {
  name: string
  count: number
}

/** Les créatures, les plus souvent vaincues d'abord, puis par ordre alphabétique. */
export function bestiaryLines(beasts: Beasts): BeastLine[] {
  return Object.entries(beasts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'))
}

const plural = (n: number): string => (n > 1 ? 's' : '')

/** « 5 créatures vaincues, 3 espèces rencontrées. » ou, sans victoire, où en trouver. */
export function bestiarySummary(beasts: Beasts): string {
  const species = Object.keys(beasts).length
  if (species === 0) return "Aucune créature pour l'instant. Un lieu de quête t'attend !"
  const total = Object.values(beasts).reduce((sum, n) => sum + n, 0)
  return `${total} créature${plural(total)} vaincue${plural(total)}, ${species} espèce${plural(species)} rencontrée${plural(species)}.`
}
