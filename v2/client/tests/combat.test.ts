import { describe, expect, it } from 'vitest'
import {
  type Action, type Answer, BASE_POWER, BOSS_CRIT_MULT, BOSS_HITS, Combatant, CRIT_MULT, Encounter, type EncounterSettings, type Engagement,
  FAST_MULT, FOE_DAMAGE, GUARD_MULT, HINT_MULT,
} from '../src/core/combat/encounter'
import { answerXp, heroMaxHp, levelForXp, levelProgress, MAX_LEVEL, xpForLevel } from '../src/core/progression'

const right = (over: Partial<Answer> = {}): Answer => ({ correct: true, speedRatio: 0.8, rewardFactor: 1, hintUsed: false, difficulty: 2, ...over })
const wrong = (over: Partial<Answer> = {}): Answer => ({ correct: false, speedRatio: 0.8, rewardFactor: 1, hintUsed: false, difficulty: 2, ...over })

/** Un combat : héros à 100 PV, ennemi à `foeHp`, riposte au milieu de sa fourchette (random = 0,5). */
function fight(over: Partial<EncounterSettings & Engagement> = {}, foeHp = 100, heroHp = 100) {
  const { world, noSpeed, random, ...engagement } = over
  const hero = new Combatant('Archiviste', 100, heroHp)
  const foe = new Combatant('Champignon', foeHp)
  const encounter = new Encounter(hero, { world: world ?? 'lumineux', noSpeed, random: random ?? (() => 0.5) })
  encounter.engage(foe, { tier: 1, rewardXp: 30, ...engagement })
  return { hero, foe, encounter }
}

const strike = (events: { kind: string }[]) => events.find((e) => e.kind === 'hero_strike') as { power: number; crit: boolean } | undefined

describe('Progression', () => {
  it('place les niveaux à 100·n·(n−1) XP', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(199)).toBe(1)
    expect(levelForXp(200)).toBe(2)
    expect(levelForXp(600)).toBe(3)
    expect(levelForXp(1199)).toBe(3)
    expect(xpForLevel(5)).toBe(2000)
    expect(levelForXp(10 ** 9)).toBe(MAX_LEVEL)
  })

  it('mesure l’avancement dans le niveau et donne 10 PV par niveau', () => {
    expect(levelProgress(400)).toBeCloseTo(0.5, 5)
    expect(levelProgress(10 ** 9)).toBe(1)
    expect(heroMaxHp(1)).toBe(100)
    expect(heroMaxHp(4)).toBe(130)
  })

  it('donne 10 XP par cran de difficulté', () => {
    expect(answerXp(1)).toBe(10)
    expect(answerXp(5)).toBe(50)
  })
})

describe('Puissance d’un coup', () => {
  it('frappe à la puissance de base sur une réponse juste, sans vitesse particulière', () => {
    const { encounter, foe } = fight()
    const turn = encounter.answer('automatisme', right({ speedRatio: 1.4 }))
    expect(strike(turn.events)).toEqual({ kind: 'hero_strike', action: 'automatisme', power: BASE_POWER.automatisme, crit: false })
    expect(foe.hp).toBe(100 - BASE_POWER.automatisme)
  })

  it('le sort du chapitre frappe plus fort que la frappe', () => {
    const { encounter } = fight()
    const turn = encounter.answer('chapitre', right({ speedRatio: 1.4 }))
    expect(strike(turn.events)!.power).toBe(BASE_POWER.chapitre)
    expect(BASE_POWER.chapitre).toBeGreaterThan(BASE_POWER.automatisme)
  })

  it('une réponse rapide (moins que le temps cible) frappe 20 % plus fort', () => {
    const { encounter } = fight()
    const hit = strike(encounter.answer('automatisme', right({ speedRatio: 0.7 })).events)!
    expect(hit.power).toBe(Math.round(BASE_POWER.automatisme * FAST_MULT))
    expect(hit.crit).toBe(false)
  })

  it('en moins de la moitié du temps cible, c’est un coup critique', () => {
    const { encounter } = fight()
    const hit = strike(encounter.answer('automatisme', right({ speedRatio: 0.3 })).events)!
    expect(hit).toMatchObject({ crit: true, power: Math.round(BASE_POWER.automatisme * CRIT_MULT) })
  })

  it('l’indice retire le critique et réduit la puissance de 30 %', () => {
    const { encounter } = fight()
    const hit = strike(encounter.answer('automatisme', right({ speedRatio: 0.3, hintUsed: true })).events)!
    expect(hit.crit).toBe(false)
    expect(hit.power).toBe(Math.round(BASE_POWER.automatisme * FAST_MULT * HINT_MULT))
  })

  it('les clics au hasard réduisent les gains (facteur de récompense)', () => {
    const { encounter } = fight()
    const hit = strike(encounter.answer('chapitre', right({ speedRatio: 1.4, rewardFactor: 0.5 })).events)!
    expect(hit.power).toBe(Math.round(BASE_POWER.chapitre * 0.5))
  })

  it('une bonne réponse rapporte 10 XP par cran de difficulté', () => {
    const { encounter } = fight()
    const turn = encounter.answer('automatisme', right({ difficulty: 3 }))
    expect(turn.events[0]).toEqual({ kind: 'xp', amount: 30 })
  })
})

describe('Sans pénalité de lenteur', () => {
  it('ignore la vitesse : jamais de critique ni de bonus de rapidité au début', () => {
    const { encounter } = fight({ noSpeed: true })
    const hit = strike(encounter.answer('automatisme', right({ speedRatio: 0.1 })).events)!
    expect(hit).toMatchObject({ crit: false, power: BASE_POWER.automatisme })
  })

  it('le critique récompense la régularité : troisième bonne réponse d’affilée', () => {
    const { encounter } = fight({ noSpeed: true }, 1000)
    const crits = [1, 2, 3, 4, 5, 6].map(() => strike(encounter.answer('automatisme', right({ speedRatio: 2 })).events)!.crit)
    expect(crits).toEqual([false, false, true, false, false, true])
  })

  it('une erreur remet la série à zéro', () => {
    const { encounter } = fight({ noSpeed: true }, 1000)
    encounter.answer('automatisme', right())
    encounter.answer('automatisme', right())
    encounter.answer('automatisme', wrong())
    expect(strike(encounter.answer('automatisme', right()).events)!.crit).toBe(false)
  })

  it('pas de critique avec un indice', () => {
    const { encounter } = fight({ noSpeed: true }, 1000)
    encounter.answer('automatisme', right())
    encounter.answer('automatisme', right())
    expect(strike(encounter.answer('automatisme', right({ hintUsed: true })).events)!.crit).toBe(false)
  })
})

describe('Soin', () => {
  it('rend des PV, jamais plus que le maximum, et l’ennemi riposte ensuite', () => {
    const { encounter, hero } = fight({}, 100, 90)
    const turn = encounter.answer('soin', right({ speedRatio: 1.4 }))
    expect(turn.events).toContainEqual({ kind: 'hero_heal', healed: 10 })
    expect(turn.events.at(-1)).toMatchObject({ kind: 'foe_attack', blocked: false })
    expect(hero.hp).toBeLessThanOrEqual(hero.maxHp)
  })

  it('n’est proposé qu’à un héros blessé', () => {
    expect(fight({}, 100, 100).encounter.canHeal).toBe(false)
    expect(fight({}, 100, 99).encounter.canHeal).toBe(true)
  })

  it('interroge le chapitre', () => {
    const { encounter } = fight()
    expect(encounter.roleOf('soin')).toBe('chapitre')
    expect(encounter.roleOf('automatisme')).toBe('automatisme')
    expect(encounter.roleOf('chapitre')).toBe('chapitre')
  })
})

describe('Riposte de l’ennemi', () => {
  it('frappe plus fort dans le Brouillard que dans le monde lumineux', () => {
    expect(FOE_DAMAGE.brouillard[0]).toBeGreaterThan(FOE_DAMAGE.lumineux[0])
    const lumineux = fight({ world: 'lumineux', random: () => 0 })
    const brouillard = fight({ world: 'brouillard', random: () => 0 })
    lumineux.encounter.answer('automatisme', wrong())
    brouillard.encounter.answer('automatisme', wrong())
    expect(100 - lumineux.hero.hp).toBe(FOE_DAMAGE.lumineux[0] + 1)
    expect(100 - brouillard.hero.hp).toBe(FOE_DAMAGE.brouillard[0] + 1)
  })

  it('reste dans la fourchette, bornes comprises', () => {
    for (const [draw, expected] of [[0, 6], [0.999999, 10]] as const) {
      const { encounter, hero } = fight({ random: () => draw, tier: 0 })
      encounter.answer('automatisme', wrong())
      expect(100 - hero.hp).toBe(expected)
    }
  })

  it('ajoute la force de l’ennemi', () => {
    const weak = fight({ tier: 1 })
    const strong = fight({ tier: 4 })
    weak.encounter.answer('automatisme', wrong())
    strong.encounter.answer('automatisme', wrong())
    expect(weak.hero.hp - strong.hero.hp).toBe(3)
  })

  it('frappe deux fois moins fort après une bonne réponse (garde)', () => {
    const miss = fight()
    const hit = fight({}, 1000)
    miss.encounter.answer('automatisme', wrong())
    hit.encounter.answer('automatisme', right())
    const taken = (c: ReturnType<typeof fight>) => 100 - c.hero.hp
    expect(taken(hit)).toBe(Math.round(taken(miss) * GUARD_MULT))
  })

  it('une erreur n’abîme pas l’ennemi et ouvre l’explication', () => {
    const { encounter, foe } = fight()
    const turn = encounter.answer('chapitre', wrong())
    expect(turn.events[0]).toEqual({ kind: 'hero_stumble' })
    expect(foe.hp).toBe(100)
    expect(turn.outcome).toBeNull()
  })
})

describe('Sac', () => {
  it('le bouclier arrête le prochain coup, une seule fois', () => {
    const { encounter, hero } = fight()
    expect(encounter.useShield()).toEqual({ kind: 'shield_up' })
    expect(encounter.shieldUp).toBe(true)
    const turn = encounter.answer('automatisme', wrong())
    expect(turn.events.at(-1)).toEqual({ kind: 'foe_attack', damage: 0, blocked: true })
    expect(hero.hp).toBe(100)
    expect(encounter.shieldUp).toBe(false)
    encounter.answer('automatisme', wrong())
    expect(hero.hp).toBeLessThan(100)
  })

  it('la potion rend toute la vie, sans passer le tour', () => {
    const { encounter, hero, foe } = fight({}, 100, 25)
    expect(encounter.usePotion()).toEqual({ kind: 'potion', healed: 75 })
    expect(hero.hp).toBe(100)
    expect(foe.hp).toBe(100)
    expect(encounter.questions).toBe(0)
  })
})

describe('Fin du combat', () => {
  it('victoire : l’ennemi tombe, l’XP du combat est rendue, pas de riposte', () => {
    const { encounter, hero } = fight({ rewardXp: 45 }, 15)
    const turn = encounter.answer('automatisme', right({ speedRatio: 1.4 }))
    expect(turn.outcome).toBe('victory')
    expect(turn.events.map((e) => e.kind)).toEqual(['xp', 'hero_strike', 'foe_down', 'xp'])
    expect(turn.events.at(-1)).toEqual({ kind: 'xp', amount: 45 })
    expect(hero.hp).toBe(100)
  })

  it('repli : le héros à 0 PV tombe, sans autre conséquence', () => {
    const { encounter, hero } = fight({}, 100, 5)
    const turn = encounter.answer('automatisme', wrong())
    expect(hero.hp).toBe(0)
    expect(turn.outcome).toBe('retreat')
    expect(turn.events.slice(-2).map((e) => e.kind)).toEqual(['foe_attack', 'hero_down'])
  })

  it('le bouclier sauve un héros à 1 PV', () => {
    const { encounter, hero } = fight({}, 100, 1)
    encounter.useShield()
    expect(encounter.answer('automatisme', wrong()).outcome).toBeNull()
    expect(hero.hp).toBe(1)
  })
})

describe('D’un ennemi au suivant (un Encounter par donjon, comme dans la v1)', () => {
  it('le bouclier levé passe au combat suivant, il n’est perdu que sur un coup', () => {
    const { encounter, hero } = fight({}, 10)
    encounter.useShield()
    expect(encounter.answer('automatisme', right({ speedRatio: 1.4 })).outcome).toBe('victory') // pas de riposte : le bouclier reste
    expect(encounter.shieldUp).toBe(true)
    encounter.engage(new Combatant('Squelette', 100), { tier: 2, rewardXp: 35 })
    const turn = encounter.answer('automatisme', wrong())
    expect(turn.events.at(-1)).toEqual({ kind: 'foe_attack', damage: 0, blocked: true })
    expect(hero.hp).toBe(100)
  })

  it('la série du critique « sans vitesse » continue chez l’ennemi suivant', () => {
    const { encounter } = fight({ noSpeed: true }, 20)
    encounter.answer('automatisme', right()) // 18 : l'ennemi (20 PV) tient
    expect(encounter.answer('automatisme', right()).outcome).toBe('victory') // deuxième bonne réponse d'affilée
    encounter.engage(new Combatant('Gelée', 200), { tier: 2, rewardXp: 35 })
    expect(strike(encounter.answer('automatisme', right()).events)!.crit).toBe(true) // la troisième
  })

  it('remet à zéro ce qui est propre au combat : questions posées, difficulté du boss, ennemi', () => {
    const { encounter } = fight({ boss: true, baseLevels: { chapitre: 3 } }, 220)
    for (let k = 0; k < 5; k += 1) encounter.answer('chapitre', wrong())
    expect(encounter.questions).toBe(5)
    expect(encounter.questionLevel('chapitre')).toBeGreaterThan(2)
    const next = new Combatant('Autre', 80)
    encounter.engage(next, { tier: 1, rewardXp: 20 })
    expect(encounter.questions).toBe(0)
    expect(encounter.foe).toBe(next)
    expect(encounter.isBoss).toBe(false)
    expect(encounter.questionLevel('chapitre')).toBe(0)
  })

  it('refuse de jouer sans combat ouvert', () => {
    const lone = new Encounter(new Combatant('Archiviste', 100), { world: 'lumineux' })
    expect(() => lone.answer('automatisme', right())).toThrow(/engage/)
  })
})

describe('Boss de synthèse', () => {
  const boss = (over: Partial<EncounterSettings & Engagement> = {}, hp = 100) =>
    fight({ boss: true, baseLevels: { automatisme: 3, chapitre: 3 }, ...over }, hp)

  it('chaque bonne réponse brise un sceau : 8 coups, quelle que soit l’action', () => {
    const { encounter, foe } = boss()
    const power = Math.ceil(100 / BOSS_HITS)
    for (const action of ['automatisme', 'chapitre'] as Action[]) {
      const hit = strike(encounter.answer(action, right({ speedRatio: 1.4 })).events)!
      expect(hit.power).toBe(power)
    }
    expect(foe.hp).toBe(100 - 2 * power)
  })

  it('au mieux 7 questions avec des critiques, 8 sans, jusqu’à 12 avec un indice à chaque question', () => {
    // 220 PV : un boss réel (les Effaceurs ont de 200 à 260 PV, lieux.json).
    const count = (answer: Answer) => {
      const { encounter } = boss({ random: () => 0 }, 220)
      let n = 0
      while (n < 50) {
        n += 1
        if (encounter.answer('chapitre', answer).outcome === 'victory') break
        encounter.hero.heal(100) // le héros tient : on compte les questions du boss seulement
      }
      return n
    }
    expect(count(right({ speedRatio: 0.2 }))).toBe(7)
    expect(count(right({ speedRatio: 1.2 }))).toBe(BOSS_HITS)
    const hinted = count(right({ speedRatio: 1.2, hintUsed: true }))
    expect(hinted).toBeGreaterThan(BOSS_HITS)
    expect(hinted).toBeLessThanOrEqual(12)
    expect(Math.round(Math.ceil(220 / BOSS_HITS) * BOSS_CRIT_MULT)).toBe(35)
  })

  it('le soin d’un boss reste un soin (puissance de base)', () => {
    const { encounter, hero } = boss({}, 100)
    hero.damage(60)
    const turn = encounter.answer('soin', right({ speedRatio: 1.4 }))
    expect(turn.events).toContainEqual({ kind: 'hero_heal', healed: BASE_POWER.soin })
  })

  it('la difficulté monte de un cran sous le niveau du joueur à un cran au-dessus', () => {
    const { encounter } = boss()
    const levels: number[] = []
    for (let k = 0; k < BOSS_HITS; k += 1) {
      levels.push(encounter.questionLevel('chapitre'))
      encounter.answer('chapitre', wrong()) // la difficulté ne dépend que du nombre de questions posées
      encounter.hero.heal(100)
    }
    expect(levels[0]).toBe(2)
    expect(levels.at(-1)).toBe(4)
    expect(levels).toEqual([...levels].sort((a, b) => a - b))
  })

  it('reste entre 1 et 5, et sans boss laisse QuestionService choisir', () => {
    const low = fight({ boss: true, baseLevels: { chapitre: 1 } }).encounter
    expect(low.questionLevel('chapitre')).toBe(1)
    const high = fight({ boss: true, baseLevels: { chapitre: 5 } }).encounter
    for (let k = 0; k < 10; k += 1) {
      high.answer('chapitre', wrong())
      high.hero.heal(100)
    }
    expect(high.questionLevel('chapitre')).toBe(5)
    expect(fight().encounter.questionLevel('chapitre')).toBe(0)
    expect(boss().encounter.isBoss).toBe(true)
  })
})
