/**
 * Lecteur de la musique d'ambiance : un seul élément <audio> qui joue les morceaux de
 * content/monde/musique.json (servis sous /musique/), l'un après l'autre en boucle, ou en boucle
 * sur lui-même s'il n'y en a qu'un. Le volume est celui du mélangeur (core/music.ts), recalculé
 * toutes les 50 ms ; à zéro, la lecture est suspendue et reprend où elle en était.
 *
 * Les navigateurs refusent de jouer un son avant un premier geste de l'utilisateur : si la lecture
 * est refusée, on réessaie au premier clic ou à la première touche. Le jeu la lance à l'entrée
 * dans l'île, jamais sur l'écran titre (aucun bouton pour la couper n'y est proposé).
 * `?musique=0` la désactive (captures, mesures).
 */
import { MusicMixer, nextTrack, type Track } from '../core/music'

const TICK_MS = 50

export interface MusicSettings {
  muted: boolean
  /** Volume de l'enfant, de 0 à 1. */
  volume: number
  calm: boolean
}

export interface MusicState {
  enabled: boolean
  playing: boolean
  track: string
  time: number
  /** Durée du morceau en cours, tant que le navigateur n'a pas lu son début : NaN. */
  duration: number
  /** Volume appliqué à l'élément audio (0 à 1). */
  level: number
  muted: boolean
  focus: boolean
}

export class MusicPlayer {
  private audio: HTMLAudioElement | null = null
  private index = 0
  private readonly mixer = new MusicMixer()
  private timer = 0
  private last = 0
  private wanted = false
  private starting = false
  private blocked = false
  private failed = false
  private focus = false
  private settings: MusicSettings = { muted: false, volume: 0.7, calm: false }
  /** Faux avec `?musique=0` ou sans morceau : ni lecture, ni bouton. */
  readonly enabled: boolean

  constructor(
    /** Morceaux, dans l'ordre de lecture (lus aussi par le parcours navigateur). */
    readonly tracks: Track[],
    /** Une voix parle-t-elle (lecture à voix haute) ? La musique se fait alors plus discrète. */
    private readonly speaking: () => boolean,
    params: URLSearchParams,
    private readonly base = '/musique/',
  ) {
    this.enabled = params.get('musique') !== '0' && tracks.length > 0
    document.addEventListener('visibilitychange', () => this.tick())
  }

  /** Le jeu est à l'écran : la musique monte en fondu. */
  start(): void {
    if (!this.enabled || this.failed) return
    this.wanted = true
    this.ensureTimer()
  }

  /** On quitte l'île : la musique s'éteint en fondu, puis s'arrête. */
  stop(): void {
    this.wanted = false
  }

  configure(settings: MusicSettings): void {
    this.settings = settings
  }

  /** Une question est ouverte : silence, pour que l'enfant reste concentré. */
  setFocus(focus: boolean): void {
    this.focus = focus
  }

  state(): MusicState {
    const audio = this.audio
    return {
      enabled: this.enabled,
      playing: audio !== null && !audio.paused,
      track: this.tracks[this.index]?.file ?? '',
      time: audio?.currentTime ?? 0,
      duration: audio?.duration ?? Number.NaN,
      level: audio?.volume ?? 0,
      muted: this.settings.muted,
      focus: this.focus,
    }
  }

  private ensureTimer(): void {
    if (this.timer !== 0) return
    this.last = performance.now()
    this.timer = window.setInterval(() => this.tick(), TICK_MS)
  }

  private tick(): void {
    const now = performance.now()
    const dt = Math.min(0.25, (now - this.last) / 1000)
    this.last = now
    const hidden = document.visibilityState === 'hidden'
    const level = this.mixer.step(dt, {
      on: this.wanted && !this.settings.muted && !this.focus && !hidden,
      volume: this.settings.volume,
      speaking: this.speaking(),
      calm: this.settings.calm,
    })
    const silent = level <= 0.001
    const audio = this.audio
    if (silent) {
      if (audio && !audio.paused) audio.pause() // reprend où elle en était
      if (!this.wanted && audio) {
        window.clearInterval(this.timer)
        this.timer = 0
      }
      return
    }
    const current = this.ensureAudio()
    current.volume = Math.min(1, level)
    if (current.paused && !this.blocked && !this.starting) this.play(current)
  }

  private ensureAudio(): HTMLAudioElement {
    if (this.audio) return this.audio
    const audio = new Audio()
    audio.preload = 'auto'
    audio.loop = this.tracks.length === 1
    audio.volume = 0
    audio.addEventListener('ended', () => {
      this.index = nextTrack(this.index, this.tracks.length)
      this.load(audio)
      this.play(audio)
    })
    audio.addEventListener('error', () => {
      // Fichier absent ou illisible : pas de musique, mais le jeu continue (avertissement, pas une erreur du jeu).
      console.warn(`Musique : ${this.tracks[this.index]?.file ?? '?'} n'a pas pu être lue.`)
      this.failed = true
      this.wanted = false
    })
    this.audio = audio
    this.load(audio)
    return audio
  }

  private load(audio: HTMLAudioElement): void {
    audio.src = this.base + encodeURIComponent(this.tracks[this.index]!.file)
  }

  private play(audio: HTMLAudioElement): void {
    this.starting = true
    audio
      .play()
      .then(() => {
        this.blocked = false
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name === 'NotAllowedError') this.waitForGesture()
        // AbortError : une pause a interrompu le démarrage ; le tick suivant relancera si besoin.
      })
      .finally(() => {
        this.starting = false
      })
  }

  /** Lecture refusée avant tout geste : on réessaie au premier clic ou à la première touche. */
  private waitForGesture(): void {
    this.blocked = true
    const retry = () => {
      window.removeEventListener('pointerdown', retry)
      window.removeEventListener('keydown', retry)
      this.blocked = false
    }
    window.addEventListener('pointerdown', retry)
    window.addEventListener('keydown', retry)
  }
}
