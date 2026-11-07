/**
 * Services du jeu, créés une fois au lancement et partagés par l'interface : API, stockage,
 * session, choix des questions, voix. Le monde 3D (GameWorld) est créé à part, quand on entre
 * dans l'île.
 */
import { ApiClient } from '../core/api'
import { QuestionService } from '../core/questionService'
import { Session } from '../core/session'
import { defaultStore } from '../core/storage'
import { Voice } from '../core/voice'

export function createServices() {
  const store = defaultStore()
  const api = new ApiClient(store)
  const session = new Session(api, store)
  const questions = new QuestionService(session)
  const voice = new Voice(api)
  // Toutes les 10 s, et au retour du réseau : on renvoie les réponses en attente.
  window.setInterval(() => void session.flush(), 10_000)
  window.addEventListener('online', () => void session.flush())
  return { store, api, session, questions, voice }
}

export type Services = ReturnType<typeof createServices>
