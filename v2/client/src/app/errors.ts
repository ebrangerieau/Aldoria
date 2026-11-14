/**
 * Branche ErrorReporter sur le navigateur : exceptions non rattrapées, promesses rejetées sans
 * traitement, et `console.error` (Babylon.js y journalise ses erreurs de rendu, React les siennes).
 * Actif dans le jeu construit (`npm run build`), pas sous `npm run dev` sauf `?erreurs=1` ;
 * `?erreurs=0` le coupe. `?erreur_test=1` lève une erreur d'essai au démarrage (parcours navigateur).
 * Rien ne part sans appareil relié : le mode découverte et les tests n'envoient rien.
 */
import { type ErrorReporter, locationOf } from '../core/errorReport'
import { reloadPending } from './staleBuild'

export const TEST_ERROR = "Erreur d'essai (erreur_test=1)"

export function captureEnabled(params: URLSearchParams, production: boolean): boolean {
  const wanted = params.get('erreurs')
  return wanted === '1' || (production && wanted !== '0')
}

export function installErrorCapture(reporter: ErrorReporter, params: URLSearchParams): void {
  const origin = location.origin
  window.addEventListener('error', (event) => {
    if (reloadPending()) return // nouvelle version : la page se recharge (app/staleBuild.ts)
    const fallback = event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : ''
    reporter.add(event.message || String(event.error), locationOf((event.error as Error | undefined)?.stack, fallback, origin))
  })
  window.addEventListener('unhandledrejection', (event) => {
    if (reloadPending()) return
    const reason = event.reason as unknown
    const message = reason instanceof Error ? reason.message : String(reason)
    reporter.add(`Promesse rejetée : ${message}`, locationOf(reason instanceof Error ? reason.stack : undefined, '', origin))
  })
  const original = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    original(...args)
    if (reloadPending()) return
    const text = args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : safeJson(a))).join(' ')
    const error = args.find((a): a is Error => a instanceof Error)
    reporter.add(text, locationOf(error?.stack, 'console.error', origin))
  }
  if (params.get('erreur_test') === '1') {
    window.setTimeout(() => {
      throw new Error(TEST_ERROR)
    }, 0)
  }
  // Envoi toutes les 15 s, et quand l'onglet est quitté ou caché.
  window.setInterval(() => void reporter.send(), 15_000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void reporter.send()
  })
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
