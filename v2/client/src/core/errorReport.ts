/**
 * Erreurs du jeu envoyées au serveur (`POST /play/client-errors`, api/app/client_errors.py), pour
 * les voir avant que les enfants les racontent : message, endroit du code, écran, version du build
 * et type de navigateur. Jamais de donnée d'enfant (ni prénom, ni question, ni réponse). L'exploitant
 * les lit dans l'espace parent (Exploitation → Erreurs du jeu). Porté d'ErrorReport (v1).
 *
 * Une même erreur n'est envoyée qu'une fois par lot, avec son compte ; sans appareil relié ou sans
 * réseau, elle attend l'envoi suivant. Le branchement sur le navigateur est dans app/errors.ts.
 */
import type { ApiClient } from './api'

export const PATH = '/play/client-errors'
/** Erreurs différentes par envoi (limite de l'API). */
export const MAX_BATCH = 20
/** Erreurs différentes gardées par lancement : une boucle d'erreurs ne déborde pas. */
export const MAX_DISTINCT = 50
/** Compte maximal accepté par l'API pour une erreur. */
export const MAX_COUNT = 1000

export interface ReportedError {
  message: string
  location: string
  scene: string
  count: number
}

export class ErrorReporter {
  /** Écran en cours (titre, profils, île…), posé par l'interface. */
  scene = ''
  private pending = new Map<string, ReportedError>()
  private seen = new Set<string>()
  private sending = false

  constructor(
    private readonly api: ApiClient,
    readonly version: string,
    readonly platform: string,
  ) {}

  add(message: string, location = ''): void {
    const text = cleanMessage(message).slice(0, 500) || '(erreur sans message)'
    const where = location.slice(0, 200)
    const key = `${where}|${text}`
    const known = this.pending.get(key)
    if (known) {
      known.count = Math.min(MAX_COUNT, known.count + 1)
      return
    }
    if (!this.seen.has(key) && this.seen.size >= MAX_DISTINCT) return
    this.seen.add(key)
    this.pending.set(key, { message: text, location: where, scene: this.scene.slice(0, 120), count: 1 })
  }

  /** Erreurs en attente d'envoi. */
  list(): ReportedError[] {
    return [...this.pending.values()]
  }

  /** Envoie un lot. Accepté, ou refusé pour de bon (422 : inutile de réessayer) : retiré de la file. */
  async send(): Promise<void> {
    if (!this.api.deviceToken || this.pending.size === 0 || this.sending) return
    this.sending = true
    try {
      const keys = [...this.pending.keys()].slice(0, MAX_BATCH)
      const errors = keys.map((k) => this.pending.get(k)!)
      const res = await this.api.post(PATH, { version: this.version, platform: this.platform, errors }, false)
      if (res.ok || res.status === 422) for (const k of keys) this.pending.delete(k)
    } finally {
      this.sending = false
    }
  }
}

/** « BJS - [20:41:03]: Shader… » (journal de Babylon.js) → « Shader… ». */
export function cleanMessage(raw: string): string {
  return raw.replace(/^BJS - \[\d{2}:\d{2}:\d{2}\]: /, '').replace(/\s+/g, ' ').trim()
}

/** Premier endroit d'une pile d'appels (« /assets/GameWorld-x.js:1:2345 »), sans l'adresse du site. */
export function locationOf(stack: string | undefined, fallback = '', origin = ''): string {
  for (const line of (stack ?? '').split('\n')) {
    const m = /(https?:\/\/[^\s)]+|\/[^\s)]+):(\d+):(\d+)/.exec(line)
    if (m) return `${stripOrigin(m[1]!, origin)}:${m[2]}:${m[3]}`
  }
  return stripOrigin(fallback, origin)
}

function stripOrigin(url: string, origin: string): string {
  return origin && url.startsWith(origin) ? url.slice(origin.length) : url
}

/** « Web Windows Chrome » : de quoi retrouver le navigateur, sans désigner l'appareil. */
export function platformOf(userAgent: string): string {
  const parts = ['Web']
  const system = ['Windows', 'Mac OS', 'CrOS', 'Linux', 'Android', 'iPhone', 'iPad'].find((s) => userAgent.includes(s))
  if (system) parts.push(system === 'CrOS' ? 'ChromeOS' : system)
  const browser = ['Firefox', 'Edg', 'OPR', 'Chrome', 'Safari'].find((b) => userAgent.includes(b))
  if (browser) parts.push({ Edg: 'Edge', OPR: 'Opera' }[browser] ?? browser)
  return parts.join(' ').slice(0, 80)
}
