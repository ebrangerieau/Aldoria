/**
 * Sauvegarde de partie v2 : emplacement « v2 » du serveur (PUT /play/save, migration 0013),
 * indépendant de la partie v1. Écrite d'abord en local, puis envoyée ; en cas de conflit
 * (un autre appareil a sauvegardé plus loin), la partie du serveur est adoptée. Une
 * réinitialisation par le parent change l'époque : l'ancienne partie est abandonnée.
 *
 * Seule la progression de jeu vit ici (XP, lieux, apparence, histoire vue) : la maîtrise des
 * notions est calculée par le serveur à partir des réponses, jamais par le client.
 */
import type { ApiClient } from './api'
import type { Store } from './storage'

export const SCHEMA_VERSION = 1

export interface SaveData {
  xp: number
  /** Lieux terminés (code → nombre de fois). */
  places: Record<string, number>
  /** Pierres de savoir éveillées dans l'île (identifiant → date ISO). */
  stones: Record<string, string>
  /** Étapes de l'histoire déjà vues (prologue, pages rendues…). */
  story: string[]
  look: { model: string; main: string; off: string; cape: string }
}

export const EMPTY_SAVE: SaveData = {
  xp: 0,
  places: {},
  stones: {},
  story: [],
  look: { model: 'Knight', main: '1H_Sword', off: 'Round_Shield', cape: 'origine' },
}

interface ServerSave {
  revision: number
  epoch: number
  schema_version: number | null
  data: Partial<SaveData> | null
}

interface LocalSave {
  revision: number
  epoch: number
  data: SaveData
  dirty: boolean
}

export class SaveGame {
  data: SaveData = structuredClone(EMPTY_SAVE)
  private revision = 0
  private epoch = 0
  private dirty = false

  constructor(
    private readonly api: ApiClient,
    private readonly store: Store,
    private readonly profileId: number,
  ) {}

  private get key(): string {
    return `save.${this.profileId}`
  }

  /** Charge la partie : la locale, puis celle du serveur si elle est plus récente. */
  async load(): Promise<void> {
    const local = this.store.get<LocalSave | null>(this.key, null)
    if (local) this.adopt(local.revision, local.epoch, local.data, local.dirty)
    const res = await this.api.get<ServerSave>('/play/save?slot=v2')
    if (!res.ok) return // hors connexion : la partie locale suffit
    const server = res.data
    if (server.epoch !== this.epoch) {
      // Réinitialisée par le parent (ou premier lancement) : la partie du serveur fait foi.
      this.adopt(server.revision, server.epoch, server.data ?? {}, false)
    } else if (server.revision > this.revision && !this.dirty) {
      this.adopt(server.revision, server.epoch, server.data ?? {}, false)
    }
    this.keepLocal()
    if (this.dirty) await this.save()
  }

  /** Enregistre localement puis sur le serveur. */
  async save(): Promise<void> {
    this.dirty = true
    this.keepLocal()
    const res = await this.api.put<ServerSave>('/play/save', {
      slot: 'v2',
      base_revision: this.revision,
      epoch: this.epoch,
      schema_version: SCHEMA_VERSION,
      data: this.data,
    })
    if (res.ok) {
      this.revision = res.data.revision
      this.dirty = false
    } else if (res.status === 409) {
      const current = (res.error.details?.current ?? null) as ServerSave | null
      if (current) this.adopt(current.revision, current.epoch, current.data ?? {}, false)
    }
    this.keepLocal()
  }

  addXp(amount: number): void {
    this.data.xp += Math.max(0, Math.round(amount))
  }

  private adopt(revision: number, epoch: number, data: Partial<SaveData>, dirty: boolean): void {
    this.revision = revision
    this.epoch = epoch
    this.data = { ...structuredClone(EMPTY_SAVE), ...data }
    this.dirty = dirty
  }

  private keepLocal(): void {
    this.store.set(this.key, { revision: this.revision, epoch: this.epoch, data: this.data, dirty: this.dirty })
  }
}
