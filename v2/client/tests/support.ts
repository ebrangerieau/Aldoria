import pack6e from './fixtures/pack_6e.json'
import type { Pack } from '../src/core/items'

/** Paquet de session réel (6e), exporté de l'API par tools/export_pack_fixture.py. */
export const PACK_6E = pack6e as unknown as Pack

/** Faux serveur : enregistre les requêtes et répond selon `routes` (status 0 = coupure). */
export function fakeFetch(routes: Record<string, (body: unknown) => { status: number; body?: unknown }>) {
  const calls: { method: string; path: string; body: unknown }[] = []
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input).replace('/api/v1', '')
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    const method = init?.method ?? 'GET'
    calls.push({ method, path, body })
    const route = routes[`${method} ${path}`]
    const answer = route ? route(body) : { status: 404, body: { error: { code: 'not_found', message: '' } } }
    if (answer.status === 0) throw new TypeError('Failed to fetch')
    return new Response(answer.body === undefined ? '' : JSON.stringify(answer.body), { status: answer.status })
  }) as typeof fetch
  return { fetcher, calls }
}
