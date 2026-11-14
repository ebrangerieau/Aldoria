/**
 * Voix enregistrées (ElevenLabs) du narrateur et de Maître Ysaline, reprises de la v1
 * (deploy/voix/, générées par tools/voix_elevenlabs.py). `voix/manifest.json` associe l'empreinte
 * SHA-256 du texte exact à son fichier MP3 : un texte qui a son son est joué tel quel, les autres
 * passent par Piper (core/voice.ts). Un texte modifié perd son son jusqu'à la génération suivante.
 *
 * Logique pure : le chargement du manifeste et le calcul de l'empreinte sont injectables (tests).
 */

export interface RecordedLine {
  id: string
  /** « ysaline » ou « narrateur ». */
  voix: string
  fichier: string
}

/** Empreinte SHA-256 (hexadécimal minuscule) du texte en UTF-8, comme `String.sha256_text()` de Godot et hashlib. */
export async function digest(text: string): Promise<string> {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Quand le manifeste n'a pas pu être lu (réseau, fichier absent), on réessaie après ce délai. */
export const RETRY_AFTER_MS = 60_000

export class RecordedVoices {
  private manifest: Record<string, RecordedLine> | null = null
  private loading: Promise<void> | null = null
  private retryAt = 0

  constructor(
    /** Lit le manifeste (empreinte → ligne) ; rend null s'il est absent ou illisible. */
    private readonly load: () => Promise<unknown>,
    /** Adresse du dossier des sons, avec la barre finale. */
    private readonly base = '/voix/',
    private readonly hash: (text: string) => Promise<string> = digest,
    private readonly now: () => number = Date.now,
  ) {}

  /** Charge le manifeste à l'avance (écran de jeu) pour ne pas retarder la première réplique. */
  warm(): Promise<void> {
    return this.ensureLoaded()
  }

  /** Adresse du son enregistré de ce texte, ou null (pas de son, manifeste absent, empreinte impossible). */
  async urlFor(text: string): Promise<string | null> {
    await this.ensureLoaded()
    if (!this.manifest) return null
    let key: string
    try {
      key = await this.hash(text)
    } catch {
      return null // pas de crypto.subtle (page hors contexte sûr) : Piper
    }
    const line = this.manifest[key]
    return line ? this.base + line.fichier : null
  }

  private ensureLoaded(): Promise<void> {
    if (this.manifest && Object.keys(this.manifest).length > 0) return Promise.resolve()
    if (this.loading) return this.loading
    if (this.now() < this.retryAt) return Promise.resolve()
    this.loading = this.load()
      .then((raw) => {
        const manifest = parse(raw)
        if (manifest) this.manifest = manifest
        else this.retryAt = this.now() + RETRY_AFTER_MS
      })
      .catch(() => {
        this.retryAt = this.now() + RETRY_AFTER_MS
      })
      .finally(() => {
        this.loading = null
      })
    return this.loading
  }
}

/** Manifeste valide et non vide, sinon null (un manifeste vide `{}` veut dire « pas de voix générées »). */
function parse(raw: unknown): Record<string, RecordedLine> | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const manifest: Record<string, RecordedLine> = {}
  for (const [key, value] of Object.entries(raw)) {
    const line = value as Partial<RecordedLine> | null
    if (/^[0-9a-f]{64}$/.test(key) && line && typeof line.fichier === 'string' && /^[\w.-]+\.mp3$/.test(line.fichier)) {
      manifest[key] = { id: String(line.id ?? ''), voix: String(line.voix ?? ''), fichier: line.fichier }
    }
  }
  return Object.keys(manifest).length > 0 ? manifest : null
}
