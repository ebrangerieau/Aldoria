/**
 * Temps de jeu de la séance (PRD US-11) : durée maximale fixée par le parent et rappel de pause.
 * Porté de la v1 (game/autoload/session.gd : `sync_play_time`, `time_over`, `rest_text`) et de son
 * rappel de pause (autoload Accessibility). Le serveur fait foi (api/app/play_time.py : même compteur
 * sur tous les appareils, rechargement compris) : le client compte les secondes jouées pendant qu'il
 * est ouvert et garde le plus avancé des deux compteurs. Une pause d'au moins `breakMinutes` sans
 * jouer ouvre une nouvelle séance.
 *
 * Aucune question n'est jamais contre la montre : ce temps-ci est le temps de la séance, pas celui
 * d'une réponse. La fin de séance ne coupe pas une question en cours (le jeu la vérifie entre deux
 * actions) et rien n'est perdu : la progression est sauvegardée.
 */
export interface PlayTimeInfo {
  played_seconds?: number
  idle_seconds?: number
  session_max_minutes?: number
  break_minutes?: number
}

export const DEFAULT_MAX_MINUTES = 25
export const DEFAULT_BREAK_MINUTES = 30

const plural = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`

export class PlayClock {
  playedSeconds = 0
  maxMinutes = DEFAULT_MAX_MINUTES
  breakMinutes = DEFAULT_BREAK_MINUTES
  /** Dernier moment où l'on a joué (ms depuis 1970) ; 0 : jamais. */
  private lastPlayMs = 0
  private nextPauseSeconds = 0

  constructor(private readonly now: () => number = Date.now) {}

  /**
   * Temps de la séance connu du serveur (connexion, début de session) : on garde le plus avancé des deux
   * compteurs (une fin de session a pu ne pas encore partir). Réglages du parent (durée, pause) repris.
   */
  sync(info: PlayTimeInfo | null | undefined): void {
    if (!info || Object.keys(info).length === 0) return
    if (info.session_max_minutes && info.session_max_minutes > 0) this.maxMinutes = info.session_max_minutes
    if (info.break_minutes && info.break_minutes > 0) this.breakMinutes = info.break_minutes
    const last = this.now() - (info.idle_seconds ?? 0) * 1000
    // Notre compteur ne vaut que s'il date d'après la dernière activité connue du serveur.
    const localValid = this.playedSeconds > 0 && this.lastPlayMs >= last
    this.playedSeconds = Math.max(localValid ? this.playedSeconds : 0, info.played_seconds ?? 0)
    this.lastPlayMs = Math.max(this.lastPlayMs, last)
  }

  /** Des secondes de jeu actif (onglet visible). */
  tick(seconds: number): void {
    if (seconds <= 0) return
    this.playedSeconds += seconds
    this.lastPlayMs = this.now()
  }

  /** Hors d'une activité, une pause assez longue remet la séance à zéro. */
  checkBreak(inActivity: boolean): void {
    if (inActivity || this.playedSeconds <= 0) return
    if (this.now() - this.lastPlayMs >= this.breakMinutes * 60_000) {
      this.playedSeconds = 0
      this.nextPauseSeconds = 0
    }
  }

  /** Durée maximale de jeu atteinte. */
  timeOver(inActivity = false): boolean {
    this.checkBreak(inActivity)
    return this.playedSeconds >= this.maxMinutes * 60
  }

  /** Minutes avant la fin de la pause (nouvelle séance), au moins 1. */
  minutesBeforePlay(): number {
    const idle = (this.now() - this.lastPlayMs) / 1000
    return Math.max(1, Math.ceil((this.breakMinutes * 60 - idle) / 60))
  }

  /** Phrase de fin de séance. */
  restText(): string {
    const played = Math.round(this.playedSeconds / 60)
    return `Tu as joué ${plural(played, 'minute', 'minutes')} : c'est l'heure de la pause ! Tu pourras repartir à l'aventure dans ${plural(this.minutesBeforePlay(), 'minute', 'minutes')}. Ta progression est sauvegardée.`
  }

  // --- Rappel de pause (aménagement `pause_minutes` du parent, 0 : jamais) --------------------

  pauseDue(pauseMinutes: number): boolean {
    if (pauseMinutes <= 0) return false
    if (this.nextPauseSeconds <= 0) this.nextPauseSeconds = pauseMinutes * 60
    return this.playedSeconds >= this.nextPauseSeconds
  }

  /** « Continuer » : le prochain rappel vient `pauseMinutes` plus tard. */
  snoozePause(pauseMinutes: number): void {
    this.nextPauseSeconds = this.playedSeconds + pauseMinutes * 60
  }

  resetPauseTimer(): void {
    this.nextPauseSeconds = 0
  }
}
