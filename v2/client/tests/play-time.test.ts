import { describe, expect, it } from 'vitest'
import { ApiClient } from '../src/core/api'
import { PlayClock } from '../src/core/playTime'
import { Session } from '../src/core/session'
import { MemoryStore } from '../src/core/storage'
import { fakeFetch, PACK_6E } from './support'

const MIN = 60_000

function clock(start = 1_000_000_000_000) {
  let t = start
  const c = new PlayClock(() => t)
  return { c, advance: (ms: number) => { t += ms }, now: () => t }
}

describe('PlayClock', () => {
  it('compte les secondes jouées et finit la séance à la durée fixée par le parent', () => {
    const { c } = clock()
    c.sync({ session_max_minutes: 20, break_minutes: 30, played_seconds: 0, idle_seconds: 1800 })
    c.tick(19 * 60)
    expect(c.timeOver(true)).toBe(false)
    c.tick(60)
    expect(c.timeOver(true)).toBe(true)
    expect(c.maxMinutes).toBe(20)
  })

  it('prend le plus avancé du compteur du serveur et du sien', () => {
    const { c, advance } = clock()
    c.tick(300) // 5 minutes jouées ici
    advance(10_000)
    c.sync({ played_seconds: 600, idle_seconds: 5 }) // le serveur en compte 10, dont notre séance
    expect(c.playedSeconds).toBe(600)
    c.tick(60)
    c.sync({ played_seconds: 100, idle_seconds: 0 }) // un compteur plus ancien n'efface rien
    expect(c.playedSeconds).toBe(660)
  })

  it('un compteur local plus ancien que l’activité du serveur ne compte plus (autre appareil, pause)', () => {
    const { c, advance } = clock()
    c.tick(900)
    advance(40 * MIN)
    c.sync({ played_seconds: 0, idle_seconds: 35 * 60 }) // le serveur : séance terminée il y a 35 minutes
    expect(c.playedSeconds).toBe(0)
  })

  it('une pause assez longue hors d’une activité remet la séance à zéro, pas pendant une activité', () => {
    const { c, advance } = clock()
    c.sync({ session_max_minutes: 10, played_seconds: 0, idle_seconds: 1800 })
    c.tick(11 * 60)
    expect(c.timeOver(false)).toBe(true)
    advance(29 * MIN)
    expect(c.timeOver(false)).toBe(true)
    advance(2 * MIN)
    expect(c.timeOver(true)).toBe(true) // en pleine activité, rien ne se remet à zéro
    expect(c.timeOver(false)).toBe(false) // pause terminée
    expect(c.playedSeconds).toBe(0)
  })

  it('annonce les minutes avant la fin de la pause, et la phrase de repos en français', () => {
    const { c, advance } = clock()
    c.sync({ session_max_minutes: 10, break_minutes: 30, played_seconds: 0, idle_seconds: 1800 })
    c.tick(25 * 60)
    advance(5 * MIN)
    expect(c.minutesBeforePlay()).toBe(25)
    expect(c.restText()).toBe("Tu as joué 25 minutes : c'est l'heure de la pause ! Tu pourras repartir à l'aventure dans 25 minutes. Ta progression est sauvegardée.")
    advance(29 * MIN + 30_000)
    expect(c.minutesBeforePlay()).toBe(1)
    expect(c.restText()).toContain('dans 1 minute.')
  })

  it('rappel de pause : à l’intervalle réglé, repoussé par « Continuer », jamais si le parent ne l’a pas réglé', () => {
    const { c } = clock()
    expect(c.pauseDue(0)).toBe(false)
    expect(c.pauseDue(15)).toBe(false)
    c.tick(15 * 60)
    expect(c.pauseDue(15)).toBe(true)
    c.snoozePause(15)
    expect(c.pauseDue(15)).toBe(false)
    c.tick(15 * 60)
    expect(c.pauseDue(15)).toBe(true)
  })

  it('une vraie pause remet aussi le rappel de pause à zéro', () => {
    const { c, advance } = clock()
    c.tick(15 * 60)
    expect(c.pauseDue(15)).toBe(true)
    advance(31 * MIN)
    c.checkBreak(false) // séance terminée : le compteur repart de zéro
    expect(c.playedSeconds).toBe(0)
    expect(c.pauseDue(15)).toBe(false)
    c.tick(14 * 60)
    expect(c.pauseDue(15)).toBe(false)
    c.tick(60)
    expect(c.pauseDue(15)).toBe(true)
  })

  it('ignore une info vide du serveur et des réglages invalides', () => {
    const { c } = clock()
    c.sync({})
    c.sync(null)
    c.sync({ session_max_minutes: 0, break_minutes: -5 })
    expect([c.maxMinutes, c.breakMinutes, c.playedSeconds]).toEqual([25, 30, 0])
  })
})

describe('Session : temps de jeu', () => {
  const PROFILE = { id: 7, name: 'Jules', level: '6e', world: 'lumineux' as const }
  const setup = (routes: Parameters<typeof fakeFetch>[0]) => {
    const store = new MemoryStore()
    const server = fakeFetch(routes)
    const api = new ApiClient(store, '', server.fetcher)
    return { session: new Session(api, store), server }
  }

  it('reprend la limite et le temps joué à la connexion et au début d’une session', async () => {
    const { session } = setup({
      'POST /play/login': () => ({ status: 200, body: { token: 't', profile: PROFILE, accommodations: {}, play_time: { played_seconds: 600, idle_seconds: 30, session_max_minutes: 15, break_minutes: 30 } } }),
      'POST /play/session/start': () => ({ status: 200, body: { ...PACK_6E, session_id: 's1', settings: { session_max_minutes: 15, play_time: { played_seconds: 840, idle_seconds: 5, break_minutes: 30 } } } }),
    })
    await session.login(7, '1234')
    expect(session.clock.maxMinutes).toBe(15)
    expect(session.clock.playedSeconds).toBe(600)
    expect(session.timeOver()).toBe(false)
    await session.start('monde')
    expect(session.clock.playedSeconds).toBe(840)
    session.tick(60)
    expect(session.timeOver()).toBe(true)
  })

  it('ne compte rien en mode découverte : pas de parent, pas de limite', () => {
    const { session } = setup({})
    session.startDemo(PACK_6E, PROFILE)
    session.tick(10_000)
    expect(session.clock.playedSeconds).toBe(0)
    expect(session.timeOver()).toBe(false)
  })

  it('ne compte pas hors d’une activité', () => {
    const { session } = setup({})
    session.tick(100)
    expect(session.clock.playedSeconds).toBe(0)
  })
})
