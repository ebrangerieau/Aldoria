/**
 * Client HTTP de l'API (même API que la v1, /api/v1/play). Chaque appel rend
 * { ok, status, data, error } ; une erreur réseau (status 0) passe `online` à faux sans
 * bloquer le jeu. L'appareil est relié à une famille par un code à 8 chiffres donné par un
 * parent : son jeton accompagne chaque requête (en-tête X-Aldoria-Device).
 */
import type { Store } from './storage'

export const API_PREFIX = '/api/v1'

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; data: unknown; error: ApiError }

export class ApiClient {
  token = ''
  deviceToken = ''
  online = true
  onOnlineChange: (online: boolean) => void = () => {}

  constructor(
    private readonly store: Store,
    private readonly base = '',
    private readonly fetcher: typeof fetch = (...args) => fetch(...args),
  ) {
    this.deviceToken = store.get<{ token?: string }>('device', {}).token ?? ''
  }

  get paired(): boolean {
    return this.deviceToken !== ''
  }

  /** Relie l'appareil à une famille (code donné dans l'espace parent → Famille). */
  async pair(code: string): Promise<ApiResult<{ device_token: string; family: string }>> {
    const res = await this.post<{ device_token: string; family: string }>('/play/devices/pair', { code }, false)
    if (res.ok) {
      this.deviceToken = res.data.device_token
      this.store.set('device', { token: this.deviceToken, family: res.data.family })
    }
    return res
  }

  /** Appareil retiré par un parent : il faudra un nouveau code. */
  forgetDevice(): void {
    this.deviceToken = ''
    this.store.remove('device')
  }

  get<T>(path: string, auth = true): Promise<ApiResult<T>> {
    return this.request<T>('GET', path, undefined, auth)
  }

  post<T>(path: string, body: unknown = {}, auth = true): Promise<ApiResult<T>> {
    return this.request<T>('POST', path, body, auth)
  }

  put<T>(path: string, body: unknown = {}, auth = true): Promise<ApiResult<T>> {
    return this.request<T>('PUT', path, body, auth)
  }

  /** POST qui rend un son (voix du serveur). null si indisponible. */
  async postForBlob(path: string, body: unknown): Promise<Blob | null> {
    try {
      const res = await this.fetcher(this.base + API_PREFIX + path, {
        method: 'POST',
        headers: this.headers(true),
        body: JSON.stringify(body),
      })
      return res.ok ? await res.blob() : null
    } catch {
      return null
    }
  }

  private headers(auth: boolean): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' }
    if (auth && this.token) headers.Authorization = `Bearer ${this.token}`
    if (this.deviceToken) headers['X-Aldoria-Device'] = this.deviceToken
    return headers
  }

  private async request<T>(method: string, path: string, body: unknown, auth: boolean): Promise<ApiResult<T>> {
    let res: Response
    try {
      res = await this.fetcher(this.base + API_PREFIX + path, {
        method,
        headers: this.headers(auth),
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      this.setOnline(false)
      return { ok: false, status: 0, data: null, error: { code: 'network', message: 'Pas de connexion au serveur.' } }
    }
    this.setOnline(true)
    const text = await res.text()
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }
    if (res.ok) return { ok: true, status: res.status, data: data as T }
    const error = (data as { error?: ApiError } | null)?.error ?? { code: `http_${res.status}`, message: 'Erreur du serveur.' }
    return { ok: false, status: res.status, data, error }
  }

  private setOnline(online: boolean): void {
    if (online !== this.online) {
      this.online = online
      this.onOnlineChange(online)
    }
  }
}
