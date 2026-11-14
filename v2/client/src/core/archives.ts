/**
 * Les Archives : étoiles de maîtrise par notion, groupées par chapitre (`GET /play/progress`), reprises de la v1
 * (scenes/archives). 0 étoile : jamais vue ; ★ en cours ; ★★ fragile ; ★★★ acquise. Le dernier état reçu est gardé sur
 * l'appareil pour une consultation hors connexion. La maîtrise n'est jamais calculée ici : le serveur la donne (étoiles et
 * libellé d'état), le client la montre.
 */
import type { ApiClient } from './api'
import type { Store } from './storage'

export interface ArchiveNotion {
  code: string
  label: string
  /** 0 à 3. */
  stars: number
  /** « à découvrir », « en cours », « fragile », « acquise » : écrit par le serveur. */
  state: string
  /** Faux : une épreuve existe pour cette notion seulement bientôt (« archive encore scellée »). */
  playable: boolean
}

export interface ArchiveChapter {
  code: string
  title: string
  /** Matière du chapitre (« Mathématiques »), pour grouper l'affichage. */
  subject: string
  /** « en_cours », « controle_bientot », « a_venir »… */
  status: string
  notions: ArchiveNotion[]
}

export const STATUS_TEXT: Record<string, string> = { en_cours: 'en classe en ce moment', controle_bientot: 'contrôle bientôt !' }

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Charge utile de l'API, relue avec prudence (un cache d'une ancienne version peut manquer de champs). */
export function parseProgress(raw: unknown): ArchiveChapter[] {
  const chapters = (raw as { chapters?: unknown } | null)?.chapters
  if (!Array.isArray(chapters)) return []
  return chapters.flatMap((c): ArchiveChapter[] => {
    if (typeof c !== 'object' || c === null) return []
    const r = c as Record<string, unknown>
    const notions = Array.isArray(r.notions) ? r.notions : []
    return [
      {
        code: str(r.code),
        title: str(r.title),
        subject: str((r.subject as { label?: unknown } | undefined)?.label),
        status: str(r.status),
        notions: notions.flatMap((n): ArchiveNotion[] => {
          if (typeof n !== 'object' || n === null) return []
          const m = n as Record<string, unknown>
          const stars = typeof m.stars === 'number' ? Math.min(3, Math.max(0, Math.trunc(m.stars))) : 0
          return [{ code: str(m.code), label: str(m.label), stars, state: str(m.state), playable: m.playable === true }]
        }),
      },
    ]
  })
}

export const playableNotions = (chapter: ArchiveChapter): ArchiveNotion[] => chapter.notions.filter((n) => n.playable)

/** Notions jouables par nombre d'étoiles : [à découvrir, en cours, fragiles, acquises]. */
export function countStars(chapters: readonly ArchiveChapter[]): [number, number, number, number] {
  const counts: [number, number, number, number] = [0, 0, 0, 0]
  for (const chapter of chapters) for (const n of playableNotions(chapter)) counts[n.stars as 0 | 1 | 2 | 3] += 1
  return counts
}

const plural = (n: number): string => (n > 1 ? 's' : '')

/** « 3 notions acquises ★★★ · 1 fragile · 4 en cours · 7 à découvrir » (phrase de la v1). */
export function summaryText(counts: readonly [number, number, number, number]): string {
  const [discover, doing, fragile, done] = counts
  return `${done} notion${plural(done)} acquise${plural(done)} ★★★ · ${fragile} fragile${plural(fragile)} · ${doing} en cours · ${discover} à découvrir`
}

/** « ★★☆ ». */
export const starsText = (stars: number): string => '★'.repeat(stars) + '☆'.repeat(3 - stars)

/** Chapitres groupés par matière, dans l'ordre où le serveur les donne. */
export function bySubject(chapters: readonly ArchiveChapter[]): { subject: string; chapters: ArchiveChapter[] }[] {
  const groups: { subject: string; chapters: ArchiveChapter[] }[] = []
  for (const chapter of chapters) {
    const group = groups.find((g) => g.subject === chapter.subject)
    if (group) group.chapters.push(chapter)
    else groups.push({ subject: chapter.subject, chapters: [chapter] })
  }
  return groups
}

export interface ArchivesView {
  chapters: ArchiveChapter[]
  /** Dernier état gardé sur l'appareil, faute de connexion. */
  cached: boolean
}

const cacheKey = (profileId: number): string => `progress_${profileId}`

/** Les Archives de l'enfant : le serveur d'abord (et on garde la réponse), sinon le dernier état connu, sinon rien (null). */
export async function loadArchives(api: ApiClient, store: Store, profileId: number): Promise<ArchivesView | null> {
  if (api.token !== '') {
    const res = await api.get<unknown>('/play/progress')
    if (res.ok) {
      const chapters = parseProgress(res.data)
      store.set(cacheKey(profileId), res.data)
      return { chapters, cached: false }
    }
  }
  const kept = store.get<unknown>(cacheKey(profileId), null)
  if (kept === null) return null
  return { chapters: parseProgress(kept), cached: true }
}
