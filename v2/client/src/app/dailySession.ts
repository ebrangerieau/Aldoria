/**
 * Session du défi du jour. Le défi ne pose que des automatismes (paquet « defi » du serveur : ratios réservés aux automatismes,
 * sans révisions ni chapitres en cours) : comme pour un lieu (même principe que la visite d'un lieu), on ferme la session « monde » de
 * l'île, on ouvre une session « defi », puis, à la fin, on referme celle-ci et on rouvre l'île. Sans compte (découverte) il n'y a
 * pas de serveur : le paquet de test de l'île suffit, rien n'est changé. Hors connexion, le dernier paquet « defi » gardé sert.
 */
import { fromServer } from '../core/accessibility'
import type { Services } from './services'

export interface DailySession {
  /** Referme la session du défi et reprend celle de l'île. */
  end(): Promise<void>
}

/** Ouvre la session du défi ; null si le serveur la refuse et qu'il n'y a pas de paquet gardé (l'île reprend alors la sienne). */
export async function startDailySession(services: Services, demo: boolean): Promise<DailySession | null> {
  const { session, questions } = services
  const easy = fromServer(session.profile?.accommodations).easy_start
  if (demo) {
    questions.reset(easy)
    return { end: async () => questions.reset(easy) }
  }
  const back = async (): Promise<void> => {
    const reopened = await session.start('monde')
    if (!reopened.ok) console.warn("Retour sur l'île : la session n'a pas pu être rouverte (les pierres attendront le réseau).")
    questions.reset(easy)
  }
  await session.end() // ferme « monde » : il ne reste pas ouvert sans fin pendant le défi
  const started = await session.start('defi')
  if (!started.ok) {
    await back()
    return null
  }
  questions.reset(easy)
  return {
    end: async () => {
      await session.end()
      await back()
    },
  }
}
