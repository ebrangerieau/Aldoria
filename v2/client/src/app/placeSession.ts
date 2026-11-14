/**
 * Session d'un lieu de quête. Un lieu ne pose que les questions de ses chapitres (règle de la v1, vérifiée côté API par
 * api/tests/test_dungeon.py) : on y entre en fermant la session « monde » de l'île (sinon elle resterait ouverte côté serveur,
 * sans fin) puis en ouvrant une session « donjon » avec ses chapitres et son générateur d'énigme ; en sortant, on ferme celle
 * du lieu et on rouvre l'île. Sans compte (mode découverte), il n'y a pas de serveur : le paquet de test est restreint à la
 * matière du lieu, puis rendu à la sortie. Hors connexion, un lieu jamais visité n'a pas de paquet gardé : on prend alors le
 * paquet de l'île restreint à sa matière (les réponses attendent le réseau, comme partout).
 */
import type { Pack } from '../core/items'
import type { DungeonData } from '../core/world/places'
import { fromServer } from '../core/accessibility'
import type { Services } from './services'

/** Le paquet de test (mode découverte) restreint à la matière du lieu ; tout le paquet si rien n'y correspond. */
export function demoPackFor(pack: Pack, dungeon: Pick<DungeonData, 'level' | 'subject'>): Pack {
  const prefix = `${dungeon.level}.${dungeon.subject}.`
  const items = pack.items.filter((item) => item.notions.some((n) => n.startsWith(prefix)))
  return { ...pack, items: items.length > 0 ? items : pack.items }
}

export interface PlaceSession {
  /** Referme la session du lieu et reprend celle de l'île ; `rating` : la note de plaisir de 1 à 5 (0 : pas de note). */
  end(rating?: number): Promise<void>
}

/** Ouvre la session du lieu ; null si le serveur la refuse et qu'il n'y a pas de paquet gardé. */
export async function startPlaceSession(services: Services, dungeon: DungeonData, demo: boolean): Promise<PlaceSession | null> {
  const { session, questions } = services
  const easy = fromServer(session.profile?.accommodations).easy_start
  if (demo) {
    const island = session.pack
    if (!island) return null
    session.pack = demoPackFor(island, dungeon)
    questions.reset(easy)
    return {
      end: async () => {
        session.pack = island
        questions.reset(easy)
      },
    }
  }
  const island = session.pack
  const back = async (): Promise<void> => {
    const reopened = await session.start('monde')
    if (!reopened.ok) console.warn("Retour sur l'île : la session n'a pas pu être rouverte (les pierres attendront le réseau).")
    questions.reset(easy)
  }
  const leaving: PlaceSession = {
    end: async (rating = 0) => {
      await session.end(rating) // ferme celle du lieu (son temps actif, ses réponses, la note)
      await back()
    },
  }
  await session.end() // ferme « monde » : il ne reste pas ouvert sans fin pendant la visite
  const params = { focus_chapters: dungeon.chapter_codes, enigma: { generator: dungeon.enigma.generator, count: 6 } }
  const started = await session.start('donjon', params, dungeon.code)
  if (started.ok) {
    questions.reset(easy)
    return leaving
  }
  if (island && !services.api.online) {
    // Hors connexion, jamais venu ici : le paquet de l'île, restreint à la matière du lieu.
    session.pack = demoPackFor(island, dungeon)
    questions.reset(easy)
    return leaving
  }
  await back() // le serveur a refusé : on n'entre pas, l'île reprend sa session
  return null
}
