/**
 * Lecteur des effets sonores (core/sfx.ts) : Web Audio, un tampon décodé par son, joué à la demande avec un volume et une
 * hauteur. Les navigateurs ne laissent démarrer le son qu'après un geste : le contexte est créé et les fichiers chargés au premier
 * clic ou à la première touche (les sons sont alors prêts bien avant la première question). Un son demandé avant d'être prêt
 * est abandonné, jamais retardé. `?sons=0` désactive tout (captures, mesures).
 */
import { clampPitch, gainOf, soundUrl, SOUNDS, VOLUME_DB, type Sound } from '../core/sfx'

export interface SfxState {
  enabled: boolean
  /** Sons décodés, prêts à jouer. */
  loaded: Sound[]
  /** Nombre de sons joués depuis le lancement. */
  played: number
  /** Dernier son joué. */
  last: Sound | null
}

export class SfxPlayer {
  private context: AudioContext | null = null
  private readonly buffers = new Map<Sound, AudioBuffer>()
  private loading = false
  private played = 0
  private last: Sound | null = null
  readonly enabled: boolean

  constructor(params: URLSearchParams, private readonly base = '/ressources/sfx/') {
    this.enabled = params.get('sons') !== '0' && typeof AudioContext !== 'undefined'
    if (this.enabled) {
      const wake = () => {
        document.removeEventListener('pointerdown', wake)
        document.removeEventListener('keydown', wake)
        void this.warm()
      }
      document.addEventListener('pointerdown', wake)
      document.addEventListener('keydown', wake)
    }
  }

  /** Crée le contexte audio et charge les sons (une seule fois). À appeler depuis un geste de l'utilisateur. */
  async warm(): Promise<void> {
    if (!this.enabled || this.loading) return
    this.loading = true
    try {
      this.context ??= new AudioContext()
      const context = this.context
      await Promise.all(
        SOUNDS.map(async (name) => {
          const res = await fetch(soundUrl(name, this.base))
          if (!res.ok) return
          this.buffers.set(name, await context.decodeAudioData(await res.arrayBuffer()))
        }),
      )
    } catch {
      // Pas de son (réseau, décodage) : le jeu reste jouable, `play` ne fait simplement rien pour les sons absents.
    }
  }

  play(name: Sound, pitch = 1): void {
    const context = this.context
    const buffer = this.buffers.get(name)
    if (!this.enabled || !context || !buffer) return
    if (context.state === 'suspended') void context.resume()
    const source = context.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = clampPitch(pitch)
    const gain = context.createGain()
    gain.gain.value = gainOf(VOLUME_DB)
    source.connect(gain).connect(context.destination)
    source.start()
    this.played += 1
    this.last = name
  }

  state(): SfxState {
    return { enabled: this.enabled, loaded: SOUNDS.filter((s) => this.buffers.has(s)), played: this.played, last: this.last }
  }
}
