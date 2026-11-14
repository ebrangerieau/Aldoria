/**
 * Le héros parle en passant de salle en salle (souhait des enfants) : un encouragement, un indice sur
 * la salle suivante (combat, énigme, Effaceur) et le chemin qui reste. Porté de la v1
 * (core/world/hero_voice.gd). Les phrases (content/monde/heros.json) se combinent (début ×
 * indice × progression) et les dernières dites ne reviennent pas : `memory` phrases récentes gardées
 * sur l'appareil, d'une partie à l'autre. Ton du monde : enjoué (lumineux), sobre (brouillard).
 */
import heros from '@content/monde/heros.json'
import type { Store } from '../storage'

type Bank = Record<string, string[]>
const LINES = heros.lines as Record<string, Bank>
const KEY = 'hero_voice'

export class HeroVoice {
  private recent: string[]

  constructor(
    private readonly store: Store | null = null,
    private readonly random: () => number = Math.random,
    private readonly memory: number = heros.memory,
  ) {
    this.recent = store ? store.get<string[]>(KEY, []) : []
  }

  /** Ce que dit le héros en abordant la salle `next` ; `start` : au départ plutôt qu'après une salle franchie.
   * Vide s'il n'y a plus de salle. */
  beforeRoom(world: string, rooms: readonly { kind: string }[], next: number, start = false): string {
    if (next < 0 || next >= rooms.length) return ''
    const bank = LINES[world] ?? LINES.lumineux!
    const kind = rooms[next]!.kind
    const parts = [this.pick(start ? bank.start! : bank.cleared!)]
    if (bank[kind]) parts.push(this.pick(bank[kind]!))
    const boss = rooms.reduce((found, r, i) => (r.kind === 'boss' ? i : found), -1)
    const left = boss - next
    if (kind !== 'boss' && left > 1) parts.push(this.pick(bank.left!).replace('%d', String(left)))
    return parts.join(' ')
  }

  /** Une phrase de la liste, jamais parmi les dernières dites (si la liste le permet). */
  pick(options: readonly string[]): string {
    const fresh = options.filter((o) => !this.recent.includes(o))
    const pool = fresh.length > 0 ? fresh : options
    const chosen = pool[Math.floor(this.random() * pool.length)]!
    this.recent.push(chosen)
    while (this.recent.length > this.memory) this.recent.shift()
    this.store?.set(KEY, this.recent)
    return chosen
  }
}
