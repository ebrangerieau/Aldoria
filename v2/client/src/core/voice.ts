/**
 * Lecture à voix haute. Un texte français qui a sa voix enregistrée (Maître Ysaline, narrateur :
 * ElevenLabs, core/recordedVoices.ts) est joué tel quel, même sans compte ni réseau autre que le
 * site. Sinon, enfant connecté et en ligne : voix neuronale du serveur (Piper, POST /play/speech,
 * même voix sur tous les PC, sons gardés en cache par l'API). Sinon : voix du navigateur
 * (speechSynthesis). Les morceaux (énoncé, propositions) se lisent l'un après l'autre ; un
 * nouvel appel interrompt la lecture en cours.
 */
import type { ApiClient } from './api'
import { RecordedVoices } from './recordedVoices'

const SERVER_LANGS = ['fr', 'en', 'es']
const RETRY_AFTER_MS = 60_000

/** Manifeste des voix enregistrées, servi à côté du jeu (deploy/voix/ dans l'image web). */
async function fetchManifest(): Promise<unknown> {
  const res = await fetch('/voix/manifest.json')
  return res.ok ? ((await res.json()) as unknown) : null
}

export class Voice {
  private audio: HTMLAudioElement | null = null
  private generation = 0
  private offUntil = 0
  private cache = new Map<string, string>()
  private speaking = false

  constructor(
    private readonly api: ApiClient,
    private readonly recordings = new RecordedVoices(fetchManifest),
  ) {}

  /** À l'entrée dans l'île : charge le manifeste des voix enregistrées avant la première réplique. */
  warm(): void {
    void this.recordings.warm()
  }

  /** Une lecture est en cours : la musique se fait plus discrète. */
  get isSpeaking(): boolean {
    return this.speaking
  }

  stop(): void {
    this.generation += 1
    this.speaking = false
    this.audio?.pause()
    this.audio = null
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }

  async say(parts: string[], lang = 'fr-FR', rate = 0.95): Promise<void> {
    this.stop()
    const generation = this.generation
    this.speaking = true
    try {
      for (const text of parts.map((p) => p.trim()).filter(Boolean)) {
        if (generation !== this.generation) return
        // Le texte a sa voix enregistrée (français seulement) : pas de Piper, pas de voix de l'appareil.
        if (lang.startsWith('fr') && (await this.playRecorded(text, generation))) continue
        if (generation !== this.generation) return
        const played = this.canUseServer(lang) ? await this.playServer(text, lang, rate, generation) : false
        if (!played && generation === this.generation) await this.playDevice(text, lang, rate)
      }
    } finally {
      if (generation === this.generation) this.speaking = false // sinon, une lecture plus récente a pris le relais
    }
  }

  /** Vrai si le son enregistré a été joué (ou si la lecture a été interrompue entre-temps). */
  private async playRecorded(text: string, generation: number): Promise<boolean> {
    const url = await this.recordings.urlFor(text)
    if (!url) return false
    if (generation !== this.generation) return true
    const audio = new Audio(url)
    this.audio = audio
    let started = false
    await new Promise<void>((resolve) => {
      audio.onplaying = () => {
        started = true
      }
      audio.onended = () => resolve()
      audio.onpause = () => resolve() // stop() : la lecture en cours s'interrompt
      audio.onerror = () => resolve()
      audio.play().catch(() => resolve())
    })
    // Fichier absent ou illisible avant le moindre son : Piper prend le relais pour ce morceau.
    return started || generation !== this.generation
  }

  private canUseServer(lang: string): boolean {
    return this.api.token !== '' && this.api.online && SERVER_LANGS.includes(lang.slice(0, 2)) && Date.now() >= this.offUntil
  }

  private async playServer(text: string, lang: string, rate: number, generation: number): Promise<boolean> {
    const key = `${lang}|${rate}|${text}`
    let url = this.cache.get(key)
    if (!url) {
      const blob = await this.api.postForBlob('/play/speech', { text, lang, rate })
      if (!blob) {
        this.offUntil = Date.now() + RETRY_AFTER_MS // service de voix absent : l'appareil prend le relais
        return false
      }
      url = URL.createObjectURL(blob)
      this.cache.set(key, url)
    }
    if (generation !== this.generation) return true
    const audio = new Audio(url)
    this.audio = audio
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve()
      audio.onerror = () => resolve()
      audio.play().catch(() => resolve())
    })
    return true
  }

  private playDevice(text: string, lang: string, rate: number): Promise<void> {
    if (!('speechSynthesis' in window)) return Promise.resolve()
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang
      utterance.rate = rate
      const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(lang.slice(0, 2)))
      if (voice) utterance.voice = voice
      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()
      window.speechSynthesis.speak(utterance)
    })
  }
}
