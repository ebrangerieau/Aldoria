/**
 * Services du jeu, créés une fois au lancement et partagés par l'interface : API, stockage,
 * session, choix des questions, voix, remontée des erreurs. Le monde 3D (GameWorld) est créé à part, quand on entre
 * dans l'île.
 */
import { ApiClient } from '../core/api'
import { ErrorReporter, platformOf } from '../core/errorReport'
import { QuestionService } from '../core/questionService'
import { Session } from '../core/session'
import { defaultStore } from '../core/storage'
import { Voice } from '../core/voice'
import { VERSION } from './buildInfo'
import { captureEnabled, installErrorCapture } from './errors'

export function createServices() {
  const store = defaultStore()
  const api = new ApiClient(store)
  const session = new Session(api, store)
  const questions = new QuestionService(session)
  const voice = new Voice(api)
  const errors = new ErrorReporter(api, VERSION, platformOf(navigator.userAgent))
  const params = new URLSearchParams(location.search)
  if (captureEnabled(params, import.meta.env.PROD)) installErrorCapture(errors, params)
  // Toutes les 10 s, et au retour du réseau : on renvoie les réponses en attente.
  window.setInterval(() => void session.flush(), 10_000)
  window.addEventListener('online', () => void session.flush())
  return { store, api, session, questions, voice, errors }
}

export type Services = ReturnType<typeof createServices>
