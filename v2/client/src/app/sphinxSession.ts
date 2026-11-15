/**
 * Session d'une traversée de l'île du Sphinx. Sans questions (le serveur rend un paquet vide), mais elle compte le temps de jeu : la limite fixée
 * par le parent vaut aussi pour les énigmes. Comme pour un lieu ou le défi du jour, on ferme la session « monde » de l'île, on ouvre « sphinx »,
 * puis, au retour, on referme celle-ci et on rouvre l'île. Sans compte (découverte) il n'y a pas de serveur : rien à ouvrir. Hors connexion l'île
 * reste jouable (v1) : la traversée a lieu sans session, le temps est compté sur l'appareil.
 */
import { fromServer } from '../core/accessibility'
import type { Services } from './services'

export interface SphinxSession {
  /** Referme la session de la traversée et reprend celle de l'île. */
  end(): Promise<void>
}

export async function startSphinxSession(services: Services, demo: boolean): Promise<SphinxSession> {
  const { session, questions } = services
  if (demo) return { end: async () => {} }
  const easy = fromServer(session.profile?.accommodations).easy_start
  await session.end() // ferme « monde » : il ne reste pas ouvert sans fin pendant la traversée
  const started = await session.start('sphinx', {}, 'sphinx')
  if (!started.ok) console.warn("Traversée hors connexion : le temps de jeu est compté sur l'appareil.")
  return {
    end: async () => {
      await session.end()
      const reopened = await session.start('monde')
      if (!reopened.ok) console.warn("Retour sur l'île : la session n'a pas pu être rouverte (les pierres attendront le réseau).")
      questions.reset(easy)
    },
  }
}
