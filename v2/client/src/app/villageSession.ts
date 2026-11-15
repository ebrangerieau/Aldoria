/**
 * Session d'une quête de village. Une quête ne pose que ce que son habitant demande (révision espacée, veille de contrôle, enquête sur un document) : le serveur
 * compose ce paquet pour le mode « village » (api : `enigmas` pour les enquêtes, `context` pour les chapitres en cours ou en « contrôle bientôt »). Comme pour un lieu
 * ou le défi du jour, on ferme la session « monde » de l'île, on ouvre « village », puis, à la fin, on referme celle-ci et on rouvre l'île. Sans compte (mode
 * découverte) il n'y a pas de serveur : le paquet de test de l'île suffit, rien n'est changé. Hors connexion, le dernier paquet « village » gardé sert.
 */
import { fromServer } from '../core/accessibility'
import { contextOf, type QuestContext, sessionParams, type Village } from '../core/village'
import type { Services } from './services'

export interface VillageSession {
  /** Chapitres en cours et « contrôle bientôt » du paquet (la veille de contrôle les nomme). */
  context: QuestContext
  /** Referme la session de la quête et reprend celle de l'île. */
  end(): Promise<void>
}

/** Ce que dit le paquet de l'île (aussi composé par le serveur) des chapitres en cours : de quoi écrire la demande d'un habitant avant la session. */
export function islandContext(services: Services): QuestContext {
  return contextOf(services.session.pack?.context)
}

/** Ouvre la session de la quête ; null si le serveur la refuse et qu'il n'y a pas de paquet gardé (l'île reprend alors la sienne). */
export async function startVillageSession(services: Services, village: Village, demo: boolean): Promise<VillageSession | null> {
  const { session, questions } = services
  const easy = fromServer(session.profile?.accommodations).easy_start
  if (demo) {
    questions.reset(easy)
    return { context: islandContext(services), end: async () => questions.reset(easy) }
  }
  const back = async (): Promise<void> => {
    const reopened = await session.start('monde')
    if (!reopened.ok) console.warn("Retour sur l'île : la session n'a pas pu être rouverte (les pierres attendront le réseau).")
    questions.reset(easy)
  }
  await session.end() // ferme « monde » : il ne reste pas ouvert sans fin pendant la quête
  const started = await session.start('village', sessionParams(village), 'village')
  if (!started.ok) {
    await back()
    return null
  }
  questions.reset(easy)
  return {
    context: contextOf(session.pack?.context),
    end: async () => {
      await session.end()
      await back()
    },
  }
}
