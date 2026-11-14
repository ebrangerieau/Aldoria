import { describe, expect, it } from 'vitest'
import {
  canCatchUp, countedDay, EMPTY_DAILY, formatDuration, normalizeDaily, openWeeklyChest, recordDaily, shiftDay, streak, today, weekCount,
  WEEKLY_CHEST_XP, weeklyChestReady, weekStart,
} from '../src/core/dailyChallenge'

describe('dates', () => {
  it('décale et trouve le lundi de la semaine', () => {
    expect(shiftDay('2026-10-01', -1)).toBe('2026-09-30')
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDay('2026-03-28', 2)).toBe('2026-03-30') // changement d'heure : toujours deux jours
    expect(weekStart('2026-10-11')).toBe('2026-10-05') // dimanche : semaine du lundi 5
    expect(weekStart('2026-10-05')).toBe('2026-10-05') // lundi
    expect(weekStart('2026-10-08')).toBe('2026-10-05')
  })

  it('écrit la date locale de l’appareil et les durées en français', () => {
    expect(today(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05')
    expect(today(new Date(2026, 0, 9, 0, 1))).toBe('2026-01-09')
    expect(formatDuration(42_400)).toBe('42 s')
    expect(formatDuration(134_000)).toBe('2 min 14 s')
    expect(formatDuration(60_000)).toBe('1 min 00 s')
  })
})

describe('série de jours', () => {
  const days = ['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10']

  it('compte les jours consécutifs jusqu’à aujourd’hui, ou hier si le défi du jour reste à faire', () => {
    expect(streak(days, '2026-10-10')).toBe(4)
    expect(streak(days, '2026-10-11')).toBe(4) // défi du jour pas encore fait : la série tient
    expect(streak(days, '2026-10-12')).toBe(0) // un jour manqué : série cassée
    expect(streak([], '2026-10-12')).toBe(0)
  })

  it('un jour manqué se rattrape une fois : d’abord le défi du jour, puis la veille, ensuite l’entraînement', () => {
    let list = ['2026-10-08', '2026-10-09'] // le 10 manqué
    expect(countedDay(list, '2026-10-11')).toBe('2026-10-11')
    list = [...list, '2026-10-11']
    expect(canCatchUp(list, '2026-10-11')).toBe(true)
    expect(countedDay(list, '2026-10-11')).toBe('2026-10-10')
    list = [...list, '2026-10-10']
    expect(countedDay(list, '2026-10-11')).toBe('')
    expect(streak(list, '2026-10-11')).toBe(4) // série réparée
    expect(canCatchUp(['2026-10-07', '2026-10-11'], '2026-10-11')).toBe(false) // deux jours manqués : rien à rattraper
  })

  it('compte les défis de la semaine, du lundi au dimanche', () => {
    const list = ['2026-10-04', '2026-10-05', '2026-10-07', '2026-10-11', '2026-10-12']
    expect(weekCount(list, '2026-10-08')).toBe(3) // 5, 7 et 11 octobre
    expect(weekCount(list, '2026-10-12')).toBe(1)
  })
})

describe('record et coffre de la semaine', () => {
  it('garde le meilleur (plus de bonnes réponses, puis plus rapide) et la plus longue série', () => {
    let s = recordDaily(EMPTY_DAILY, '2026-10-10', 8, 150_000, '2026-10-10')
    s = recordDaily(s, '2026-10-11', 8, 120_000, '2026-10-11')
    s = recordDaily(s, '2026-10-11', 7, 60_000, '2026-10-11') // même jour : pas de doublon
    expect(s.days).toEqual(['2026-10-10', '2026-10-11'])
    expect(s.best).toEqual({ correct: 8, ms: 120_000 })
    expect(s.best_streak).toBe(2)
    s = recordDaily(s, '', 10, 200_000, '2026-10-11') // entraînement : le record compte quand même
    expect(s.best.correct).toBe(10)
    expect(s.days).toHaveLength(2)
  })

  it('ne garde que les 21 derniers jours, sans modifier l’état reçu', () => {
    let s = EMPTY_DAILY
    for (let i = 0; i < 30; i += 1) s = recordDaily(s, shiftDay('2026-09-01', i), 5, 100_000, shiftDay('2026-09-01', i))
    expect(s.days).toHaveLength(21)
    expect(s.days[0]).toBe('2026-09-10')
    expect(EMPTY_DAILY.days).toEqual([])
  })

  it('offre le coffre à partir de cinq défis, une seule fois par semaine', () => {
    let s = EMPTY_DAILY
    for (const day of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']) s = recordDaily(s, day, 6, 100_000, day)
    expect(weeklyChestReady(s, '2026-10-08')).toBe(false)
    s = recordDaily(s, '2026-10-10', 6, 100_000, '2026-10-10')
    expect(weeklyChestReady(s, '2026-10-10')).toBe(true)
    const opened = openWeeklyChest(s, '2026-10-10')
    expect(opened.xp).toBe(WEEKLY_CHEST_XP)
    expect(weeklyChestReady(opened.state, '2026-10-11')).toBe(false) // un seul coffre par semaine
    expect(openWeeklyChest(opened.state, '2026-10-11').xp).toBe(0)
    expect(weeklyChestReady(opened.state, '2026-10-12')).toBe(false) // nouvelle semaine : tout recommence
  })

  it('une partie ancienne sans défi quotidien est complétée', () => {
    expect(normalizeDaily(undefined)).toEqual(EMPTY_DAILY)
    expect(normalizeDaily({ days: ['2026-10-02', 'x', 4, '2026-10-01'], best: { correct: '9' } })).toEqual({
      days: ['2026-10-01', '2026-10-02', 'x'], best: { correct: 9, ms: 0 }, best_streak: 0, chests: [],
    })
  })
})
