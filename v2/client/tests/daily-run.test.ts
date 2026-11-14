import { describe, expect, it } from 'vitest'
import { COMPLETION_XP, EMPTY_DAILY, QUESTIONS, recordDaily, shiftDay, WEEKLY_CHEST_XP, type DailyState } from '../src/core/dailyChallenge'
import { DailyRun, GAME_MODE, introText, isCatchUp, openChest, pips, timeText, titleFor } from '../src/core/dailyRun'

const TODAY = '2026-10-14' // un mercredi
const play = (run: DailyRun, wrong: number[] = [], each = 4000, xp = 20) => {
  for (let i = 0; i < QUESTIONS; i += 1) run.answer(!wrong.includes(i), each, xp)
  return run
}

describe('textes du défi', () => {
  it('annonce le défi du jour, le rattrapage ou l’entraînement', () => {
    expect(titleFor(TODAY, TODAY)).toBe('Défi du jour')
    expect(titleFor(shiftDay(TODAY, -1), TODAY)).toBe('Défi de rattrapage')
    expect(titleFor('', TODAY)).toBe('Défi du jour')
    expect(isCatchUp(shiftDay(TODAY, -1), TODAY)).toBe(true)
    expect(isCatchUp('', TODAY)).toBe(false)
    expect(GAME_MODE).toBe('defi')
  })

  it('l’introduction ne parle ni de chrono ni de record avec l’aménagement « sans pénalité de lenteur »', () => {
    expect(introText(TODAY, TODAY, false)).toContain('pas de chrono à l’écran'.replace('’', "'"))
    expect(introText(TODAY, TODAY, false)).toContain('comparé à ton record')
    const calm = introText(TODAY, TODAY, true)
    expect(calm).toContain('Prends tout ton temps')
    expect(calm).not.toMatch(/chrono|record/)
    expect(introText('', TODAY, false)).toContain("celui-ci est pour t'entraîner")
    expect(introText(shiftDay(TODAY, -1), TODAY, false)).toContain('Tu as manqué hier : ce défi le rattrape')
  })

  it('écrit le temps, rien sans l’aménagement', () => {
    expect(timeText(134_000, false)).toBe(', en 2 min 14 s')
    expect(timeText(42_000, false)).toBe(', en 42 s')
    expect(timeText(134_000, true)).toBe('')
  })
})

describe('déroulé du défi', () => {
  it('compte les bonnes réponses, le temps de réponse et l’XP des bonnes réponses seulement', () => {
    const run = new DailyRun(TODAY, TODAY)
    run.answer(true, 3000, 20)
    run.answer(false, 5000, 30)
    expect(run.correct).toBe(1)
    expect(run.timeMs).toBe(8000)
    expect(run.complete).toBe(false)
    expect(pips(run.results)).toEqual(['juste', 'faux', ...Array(8).fill('attente')])
    play(new DailyRun(TODAY, TODAY)) // dix réponses : complet
    const full = play(new DailyRun(TODAY, TODAY))
    full.answer(true, 1000, 99) // une onzième réponse est ignorée
    expect(full.results).toHaveLength(QUESTIONS)
    expect(full.correct).toBe(10)
  })

  it('un défi interrompu ne compte pas : ni bilan, ni série, ni record', () => {
    const run = new DailyRun(TODAY, TODAY)
    for (let i = 0; i < 9; i += 1) run.answer(true, 1000, 10)
    expect(run.finish(EMPTY_DAILY, false)).toBeNull()
  })

  it('le premier défi : bilan, record à battre, série d’un jour, XP et bonus de fin', () => {
    const report = play(new DailyRun(TODAY, TODAY), [3, 8], 4000, 20).finish(EMPTY_DAILY, false)!
    expect(report.title).toBe('Défi réussi !') // 8 sur 10
    expect(report.lines).toEqual([
      '8 bonnes réponses sur 10, en 40 s.',
      "Premier défi : c'est ton record à battre !",
      "Série : 1 jour d'affilée.",
      'Coffre de la semaine : 1 / 5 défis.',
      `+${8 * 20 + COMPLETION_XP} XP`,
    ])
    expect(report.xp).toBe(8 * 20 + COMPLETION_XP)
    expect(report.state.days).toEqual([TODAY])
    expect(report.state.best).toEqual({ correct: 8, ms: 40_000 })
    expect(report.chestReady).toBe(false)
  })

  it('un nouveau record ou le record à battre, au nombre de bonnes réponses puis au temps', () => {
    const before: DailyState = { ...EMPTY_DAILY, best: { correct: 8, ms: 50_000 }, days: [shiftDay(TODAY, -1)] }
    const faster = play(new DailyRun(TODAY, TODAY), [0, 1], 4000).finish(before, false)!
    expect(faster.lines[1]).toBe('Nouveau record ! (avant : 8 sur 10, en 50 s)') // même score, plus vite
    const better = play(new DailyRun(TODAY, TODAY), [], 9000).finish(before, false)!
    expect(better.lines[1]).toContain('Nouveau record !') // meilleur score, même plus lent
    const worse = play(new DailyRun(TODAY, TODAY), [0, 1, 2], 1000).finish(before, false)!
    expect(worse.lines[1]).toBe('Ton record : 8 sur 10, en 50 s.')
    expect(worse.title).toBe('Défi réussi !')
    expect(play(new DailyRun(TODAY, TODAY), [0, 1, 2, 3, 4], 1000).finish(before, false)!.title).toBe('Défi terminé !')
    expect(faster.lines[2]).toBe("Série : 2 jours d'affilée.")
  })

  it('sans pénalité de lenteur : aucun temps dans le bilan', () => {
    const before: DailyState = { ...EMPTY_DAILY, best: { correct: 5, ms: 60_000 } }
    const report = play(new DailyRun(TODAY, TODAY), [], 4000).finish(before, true)!
    expect(report.lines.join(' ')).not.toMatch(/ en \d/)
    expect(report.lines[0]).toBe('10 bonnes réponses sur 10.')
  })

  it('un défi de rattrapage compte pour hier et rétablit la série ; un entraînement ne compte pas de jour mais garde le record', () => {
    const state = recordDaily(recordDaily(EMPTY_DAILY, shiftDay(TODAY, -2), 7, 50_000, shiftDay(TODAY, -2)), TODAY, 7, 50_000, TODAY)
    expect(state.days).toEqual([shiftDay(TODAY, -2), TODAY]) // hier manqué
    const catchUp = play(new DailyRun(shiftDay(TODAY, -1), TODAY)).finish(state, false)!
    expect(catchUp.state.days).toEqual([shiftDay(TODAY, -2), shiftDay(TODAY, -1), TODAY])
    expect(catchUp.lines[2]).toBe("Série : 3 jours d'affilée.")
    expect(catchUp.xp).toBe(10 * 20 + COMPLETION_XP)
    const training = play(new DailyRun('', TODAY), [], 1000).finish(catchUp.state, false)!
    expect(training.state.days).toEqual(catchUp.state.days)
    expect(training.xp).toBe(10 * 20) // pas de bonus de fin pour un entraînement
    expect(training.state.best.correct).toBe(10)
  })
})

describe('coffre de la semaine', () => {
  // Lundi 12 au vendredi 16 octobre : cinq défis dans la semaine.
  const week = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']
  const sofar = week.reduce((s, d) => recordDaily(s, d, 8, 40_000, d), EMPTY_DAILY)

  it('est prêt au cinquième défi de la semaine, s’ouvre une fois et rend de l’XP et deux objets', () => {
    const report = play(new DailyRun('2026-10-16', '2026-10-16')).finish(sofar, false)!
    expect(report.lines[3]).toBe('Coffre de la semaine : 5 / 5 défis.')
    expect(report.chestReady).toBe(true)
    const chest = openChest(report.state, {}, '2026-10-16', () => 0)
    expect(chest.xp).toBe(WEEKLY_CHEST_XP)
    expect(chest.lines[0]).toBe("Cinq défis cette semaine : le coffre s'ouvre !")
    expect(chest.lines[1]).toBe(`+${WEEKLY_CHEST_XP} XP`)
    expect(chest.lines[2]).toMatch(/^Dans ton sac : /)
    expect(Object.values(chest.owned).reduce((a, b) => a + b, 0)).toBe(2)
    // Une seule fois par semaine.
    const again = openChest(chest.state, chest.owned, '2026-10-16')
    expect(again.xp).toBe(0)
    expect(again.lines).toEqual([])
    expect(again.owned).toEqual(chest.owned)
  })

  it('n’ouvre rien avant le cinquième défi', () => {
    const chest = openChest(sofar, { plume: 1 }, '2026-10-15')
    expect(chest.xp).toBe(0)
    expect(chest.owned).toEqual({ plume: 1 })
    expect(chest.state).toBe(sofar)
  })

  it('un sac plein ne gagne pas d’objet mais le coffre rend quand même son XP', () => {
    const full = { plume: 5, parchemin: 5, bouclier: 5, potion: 5 }
    const ready = play(new DailyRun('2026-10-16', '2026-10-16')).finish(sofar, false)!.state
    const chest = openChest(ready, full, '2026-10-16')
    expect(chest.xp).toBe(WEEKLY_CHEST_XP)
    expect(chest.lines).toHaveLength(2)
    expect(chest.owned).toEqual(full)
  })
})
