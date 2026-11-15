/**
 * Session d'une série de la Lice (Pont des fractions, stand de tir). Comme pour un lieu ou le défi du jour : on ferme la session « monde » de l'île, on ouvre une
 * session « arene » dont le serveur compose les six cibles (`enigma` : le générateur du jeu, deux cibles d'avance), puis, à la fin, on referme celle-ci et on rouvre
 * l'île. Sans compte (mode découverte), il n'y a pas de serveur : des cibles prises dans les vraies questions de test (`visual_samples.json`, tirées des générateurs)
 * remplacent le paquet de l'île le temps de la série. Hors connexion, le dernier paquet gardé sert ; jamais venu ici : la série n'est pas prête.
 */
import { fromServer } from '../core/accessibility'
import type { Item, Pack } from '../core/items'
import { generatorFor, type LiceKind, ROUNDS, sessionParams } from '../core/lice'
import type { Services } from './services'

export interface LiceSession {
  /** Referme la session de la série et reprend celle de l'île. */
  end(): Promise<void>
}

/**
 * Les cibles de démonstration d'un générateur, de la plus facile à la plus difficile puis à nouveau (une série en demande six) : les échantillons de test, rendus
 * comme le serveur les rend aux énigmes (rôle « enigme »).
 */
export function demoRounds(samples: (Item & { generator?: string })[], generator: string, count = ROUNDS + 2): Item[] {
  const own = samples.filter((s) => s.generator === generator)
  const seeds = [...new Set(own.map((s) => s.seed))]
  const ordered = seeds.flatMap((seed) => own.filter((s) => s.seed === seed).sort((a, b) => a.difficulty - b.difficulty))
  return ordered.slice(0, count).map((item) => ({ ...item, role: 'enigme' as const }))
}

/** Ouvre la session de la série ; null si le serveur la refuse et qu'il n'y a pas de paquet gardé (l'île reprend alors la sienne). */
export async function startLiceSession(services: Services, kind: LiceKind, level: string, demo: boolean): Promise<LiceSession | null> {
  const { session, questions } = services
  const params = sessionParams(kind, level)
  if (!params) return null
  const easy = fromServer(session.profile?.accommodations).easy_start
  if (demo) {
    const island = session.pack
    if (!island) return null
    const samples = (await import('../../tests/fixtures/visual_samples.json')).default as unknown as (Item & { generator?: string })[]
    const items = demoRounds(samples, generatorFor(kind, level)!)
    session.pack = { ...island, items } as Pack
    questions.reset(easy)
    return {
      end: async () => {
        session.pack = island
        questions.reset(easy)
      },
    }
  }
  const back = async (): Promise<void> => {
    const reopened = await session.start('monde')
    if (!reopened.ok) console.warn("Retour sur l'île : la session n'a pas pu être rouverte (les pierres attendront le réseau).")
    questions.reset(easy)
  }
  await session.end() // ferme « monde » : il ne reste pas ouvert sans fin pendant la série
  const started = await session.start('arene', params, `arene-${kind}`)
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
