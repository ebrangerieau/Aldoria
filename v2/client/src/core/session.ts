/**
 * Session de jeu : enfant connecté, paquet de questions, file des réponses (portée de la v1,
 * game/autoload/session.gd). Mode dégradé : chaque réponse est d'abord écrite dans le
 * stockage local avec un UUID, puis envoyée à l'API ; en cas de coupure, l'envoi est
 * retenté et le serveur ignore les doublons.
 */
import type { ApiClient } from './api'
import type { Item, Pack } from './items'
import type { QuestionSource } from './questionService'
import type { Store } from './storage'

export const BATCH_SIZE = 50
/** Refus définitif (requête invalide) ; les autres échecs se retentent (réseau, 401, 5xx). */
export const REJECTED_FOR_GOOD = [400, 403, 404, 409, 413, 422]

export interface Profile {
  id: number
  name: string
  level: string
  level_label?: string
  world: 'lumineux' | 'brouillard'
  accommodations?: Record<string, unknown>
}

export interface Attempt {
  profile_id: number // local seulement : retiré avant l'envoi
  id: string
  session_id: string | null
  item_id: string
  generator: string | null
  difficulty: number
  notion_ids: string[]
  correct: boolean
  time_ms: number
  time_target_ms: number
  hint_used: boolean
  game_mode: string
  answered_at: string
}

export type SessionMode = 'arene' | 'donjon' | 'defi' | 'village' | 'sphinx' | 'monde'

export class Session implements QuestionSource {
  profile: Profile | null = null
  sessionId = ''
  mode: SessionMode | '' = ''
  pack: Pack | null = null
  answered = 0
  activeSeconds = 0
  onQueueChange: (pending: number) => void = () => {}

  private queue: Attempt[]
  private asideQueue: { profile_id: number; notion: string }[]
  private aside = new Set<string>()
  private flushing: Promise<void> | null = null

  constructor(
    private readonly api: ApiClient,
    private readonly store: Store,
    private readonly now: () => Date = () => new Date(),
    private readonly uuid: () => string = () => crypto.randomUUID(),
  ) {
    this.queue = store.get<Attempt[]>('attempts', [])
    this.asideQueue = store.get<{ profile_id: number; notion: string }[]>('aside', [])
    const auth = store.get<{ token?: string; profile?: Profile }>('auth', {})
    if (auth.token && auth.profile) {
      api.token = auth.token
      this.profile = auth.profile
    }
  }

  get loggedIn(): boolean {
    return this.api.token !== '' && this.profile !== null
  }

  /** Mode découverte : sans compte ni serveur, rien n'est enregistré ni envoyé. */
  demo = false

  /** Mode découverte (sans serveur) : un paquet de test et un profil fictif. */
  startDemo(pack: Pack, profile: Profile): void {
    this.demo = true
    this.profile = profile
    this.applyPack(pack)
    this.mode = 'monde'
  }

  async login(profileId: number, pin: string) {
    const res = await this.api.post<{ token: string; profile: Profile; accommodations?: Record<string, unknown> }>(
      '/play/login',
      { profile_id: profileId, pin },
      false,
    )
    if (res.ok) {
      this.api.token = res.data.token
      this.profile = { ...res.data.profile, accommodations: res.data.accommodations ?? {} }
      this.store.set('auth', { token: this.api.token, profile: this.profile })
    }
    return res
  }

  /** Changement de joueur : ses réponses en attente restent dans la file, rattachées à lui. */
  async logout(): Promise<void> {
    await this.flush()
    this.api.token = ''
    this.profile = null
    this.sessionId = ''
    this.pack = null
    this.aside.clear()
    this.store.remove('auth')
    for (const key of this.store.keys()) if (key.startsWith('pack.')) this.store.remove(key)
  }

  /** Ouvre une session et charge le paquet. Sans réseau, reprend le dernier paquet gardé. */
  async start(mode: SessionMode, params: Record<string, unknown> = {}, cacheKey = ''): Promise<{ ok: boolean; offline?: boolean }> {
    this.mode = mode
    this.answered = 0
    const key = `pack.${cacheKey || mode}`
    const res = await this.api.post<Pack>('/play/session/start', { ...params, mode })
    if (res.ok) {
      this.applyPack(res.data)
      this.store.set(key, res.data)
      this.aside = new Set(this.ownAside().map((a) => a.notion))
      return { ok: true }
    }
    if (res.status === 0) {
      const cached = this.store.get<Pack | null>(key, null)
      if (cached) {
        this.applyPack({ ...cached, session_id: '' })
        return { ok: true, offline: true }
      }
    }
    return { ok: false }
  }

  /** Fin de session ; `rating` : note de plaisir de 1 à 5 (fin de lieu), 0 sinon. */
  async end(rating = 0): Promise<void> {
    await this.flush()
    if (this.sessionId) {
      const body: Record<string, unknown> = { session_id: this.sessionId, active_seconds: Math.round(this.activeSeconds) }
      if (rating > 0) body.rating = rating
      await this.api.post('/play/session/end', body)
    }
    this.sessionId = ''
    this.mode = ''
  }

  /** Temps actif (le navigateur suspend le rendu d'un onglet caché : rien n'est compté). */
  tick(seconds: number): void {
    if (this.sessionId || this.mode) this.activeSeconds += seconds
  }

  // --- QuestionSource -------------------------------------------------------------------

  items(): Item[] {
    return this.pack?.items ?? []
  }

  startLevels() {
    return this.pack?.start_levels ?? {}
  }

  isSetAside(item: Item): boolean {
    return item.notions.some((n) => this.aside.has(n))
  }

  record(item: Item, correct: boolean, timeMs: number, hintUsed: boolean, gameMode: string): void {
    this.answered += 1
    if (this.demo) return // découverte : aucune réponse ne part vers le suivi d'un enfant
    this.queue.push({
      profile_id: this.profile?.id ?? 0,
      id: this.uuid(),
      session_id: this.sessionId || null,
      item_id: item.id,
      generator: item.generator ?? null,
      difficulty: item.difficulty,
      notion_ids: item.notions,
      correct,
      time_ms: Math.round(timeMs),
      time_target_ms: item.time_target_ms || 20000,
      hint_used: hintUsed,
      game_mode: gameMode,
      answered_at: this.now().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    })
    this.store.set('attempts', this.queue)
    this.onQueueChange(this.pendingCount())
    void this.flush()
  }

  // --- « Pas vu en classe » ------------------------------------------------------------

  setAside(notion: string): void {
    if (this.aside.has(notion)) return
    this.aside.add(notion)
    this.asideQueue.push({ profile_id: this.profile?.id ?? 0, notion })
    this.store.set('aside', this.asideQueue)
    void this.flushAside()
  }

  // --- Envoi ------------------------------------------------------------------------------

  pendingCount(): number {
    return this.ownQueue().length
  }

  /** Envoie la file ; un appel pendant un envoi en cours attend la fin de celui-ci. */
  flush(): Promise<void> {
    if (!this.flushing) {
      this.flushing = this.sendQueue().finally(() => {
        this.flushing = null
      })
    }
    return this.flushing
  }

  private async sendQueue(): Promise<void> {
    if (this.ownAside().length > 0) await this.flushAside()
    if (!this.api.token) return
    while (this.ownQueue().length > 0) {
      const batch = this.ownQueue().slice(0, BATCH_SIZE)
      const payload = batch.map(({ profile_id: _local, ...attempt }) => attempt)
      const res = await this.api.post('/play/attempts', { attempts: payload })
      if (!res.ok && !REJECTED_FOR_GOOD.includes(res.status)) return // nouvel essai plus tard
      if (!res.ok) console.warn(`[Aldoria] ${batch.length} réponse(s) refusée(s) (${res.status}), écartée(s)`)
      const sent = new Set(batch.map((a) => a.id))
      this.queue = this.queue.filter((a) => !sent.has(a.id))
      this.store.set('attempts', this.queue)
      this.onQueueChange(this.pendingCount())
    }
  }

  private async flushAside(): Promise<void> {
    if (!this.api.token) return
    for (const entry of this.ownAside()) {
      const res = await this.api.post('/play/notions/set-aside', { notion: entry.notion })
      if (!res.ok && !REJECTED_FOR_GOOD.includes(res.status)) return
      this.asideQueue = this.asideQueue.filter((a) => a !== entry)
      this.store.set('aside', this.asideQueue)
    }
  }

  private applyPack(pack: Pack): void {
    this.pack = pack
    this.sessionId = pack.session_id ?? ''
    this.activeSeconds = 0
  }

  private ownQueue(): Attempt[] {
    const me = this.profile?.id ?? 0
    return this.queue.filter((a) => (a.profile_id ?? me) === me)
  }

  private ownAside() {
    const me = this.profile?.id ?? 0
    return this.asideQueue.filter((a) => a.profile_id === me)
  }
}
