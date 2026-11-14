import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import lieux from '@content/monde/lieux.json'
import { Encounter, type AnswerFacts, type EncounterOptions, BOSS_HITS } from '../src/core/combat/encounter'
import { Fighter } from '../src/core/combat/fighter'
import { isKayKit, isMonster, modelPath } from '../src/core/combat/monsters'

const right = (over: Partial<AnswerFacts> = {}): AnswerFacts => ({ correct: true, speedRatio: 1.5, rewardFactor: 1, difficulty: 2, hintPenalized: false, ...over })
const wrong = (): AnswerFacts => ({ correct: false, speedRatio: 1, rewardFactor: 1, difficulty: 2, hintPenalized: false })

function fight(over: Partial<EncounterOptions> & { heroHp?: number; enemyHp?: number } = {}) {
  const hero = new Fighter('héros', over.heroHp ?? 100)
  const enemy = new Fighter('ennemi', over.enemyHp ?? 100)
  const encounter = new Encounter({ hero, enemy, tier: 2, world: 'lumineux', random: () => 0, ...over })
  return { hero, enemy, encounter }
}

describe('Fighter', () => {
  it('ne descend pas sous 0 PV et ne dépasse pas son maximum', () => {
    const f = new Fighter('x', 50)
    expect(f.damage(80)).toBe(50)
    expect(f.alive).toBe(false)
    expect(f.heal(30)).toBe(30)
    expect(f.heal(100)).toBe(20)
    expect(f.hp).toBe(50)
  })
})

describe('puissance d’une bonne réponse', () => {
  it('vaut la base de l’action, modulée par la vitesse', () => {
    expect(fight().encounter.turn('automatisme', right()).resolution).toMatchObject({ kind: 'hit', power: 18, crit: false })
    expect(fight().encounter.turn('chapitre', right()).resolution).toMatchObject({ power: 32, crit: false })
    expect(fight().encounter.turn('chapitre', right({ speedRatio: 0.8 })).resolution).toMatchObject({ power: 38, crit: false }) // × 1,2
    expect(fight().encounter.turn('automatisme', right({ speedRatio: 0.4 })).resolution).toMatchObject({ power: 29, crit: true }) // × 1,6
  })

  it('un indice ordinaire retire 30 % de puissance et interdit le coup critique', () => {
    expect(fight().encounter.turn('automatisme', right({ hintPenalized: true })).resolution).toMatchObject({ power: 13, crit: false }) // 18 × 0,7
    expect(fight().encounter.turn('automatisme', right({ speedRatio: 0.4, hintPenalized: true })).resolution).toMatchObject({ power: 15, crit: false }) // 18 × 1,2 × 0,7
  })

  it('une récompense réduite (clic au hasard) réduit la puissance sans le dire', () => {
    expect(fight().encounter.turn('automatisme', right({ rewardFactor: 0.5 })).resolution).toMatchObject({ power: 9 })
  })

  it('rapporte 10 XP par cran de difficulté', () => {
    expect(fight().encounter.turn('automatisme', right({ difficulty: 3 })).resolution).toMatchObject({ xp: 30 })
  })
})

describe('erreur et riposte', () => {
  it('une erreur n’inflige rien et laisse l’ennemi frapper plein pot (base + force)', () => {
    const { enemy, hero, encounter } = fight()
    const r = encounter.turn('automatisme', wrong())
    expect(r.resolution).toEqual({ kind: 'miss' })
    expect(enemy.hp).toBe(100)
    expect(r.enemyAttack).toEqual({ kind: 'hit', damage: 8, guarded: false }) // 6 + force 2
    expect(hero.hp).toBe(92)
  })

  it('après une bonne réponse, les dégâts subis sont réduits de moitié', () => {
    const { encounter } = fight()
    expect(encounter.turn('automatisme', right()).enemyAttack).toEqual({ kind: 'hit', damage: 4, guarded: true })
  })

  it('les dégâts de l’ennemi dépendent du monde (6 à 10 lumineux, 9 à 14 brouillard)', () => {
    expect(fight({ random: () => 0 }).encounter.enemyTurn(false)).toMatchObject({ damage: 8 })
    expect(fight({ random: () => 0.999 }).encounter.enemyTurn(false)).toMatchObject({ damage: 12 })
    expect(fight({ world: 'brouillard', random: () => 0 }).encounter.enemyTurn(false)).toMatchObject({ damage: 11 })
    expect(fight({ world: 'brouillard', random: () => 0.999 }).encounter.enemyTurn(false)).toMatchObject({ damage: 16 })
  })
})

describe('issue du combat', () => {
  it('l’ennemi tombé ne riposte pas : victoire', () => {
    const { encounter } = fight({ enemyHp: 10 })
    const r = encounter.turn('automatisme', right())
    expect(r.outcome).toBe('victory')
    expect(r.enemyAttack).toBeNull()
    expect(r.resolution).toMatchObject({ kind: 'hit', defeated: true })
  })

  it('un héros à 0 PV se replie, et l’ennemi garde ses blessures', () => {
    const { enemy, encounter } = fight({ heroHp: 5 })
    encounter.turn('automatisme', right()) // 18 de dégâts à l'ennemi, riposte 4
    const r = encounter.turn('automatisme', wrong()) // riposte 8
    expect(r.outcome).toBe('retreat')
    expect(enemy.hp).toBe(82)
  })
})

describe('soin', () => {
  it('rend des PV (35), jamais au-delà du maximum, et n’est proposé que si le héros est blessé', () => {
    const { hero, encounter } = fight({ heroHp: 100 })
    expect(encounter.canHeal).toBe(false)
    hero.damage(20)
    expect(encounter.canHeal).toBe(true)
    const r = encounter.turn('soin', right())
    expect(r.resolution).toMatchObject({ kind: 'heal', power: 35, healed: 20 })
    expect(Encounter.roleOf('soin')).toBe('chapitre')
  })
})

describe('Effaceur (boss)', () => {
  it('brise un sceau par bonne réponse : BOSS_HITS réponses, 7 avec des critiques', () => {
    const slow = fight({ boss: true, enemyHp: 200, heroHp: 10_000 })
    let n = 0
    while (slow.enemy.alive) {
      slow.encounter.turn('automatisme', right())
      n += 1
    }
    expect(n).toBe(BOSS_HITS)
    const quick = fight({ boss: true, enemyHp: 200, heroHp: 10_000 })
    n = 0
    while (quick.enemy.alive) {
      quick.encounter.turn('chapitre', right({ speedRatio: 0.3 }))
      n += 1
    }
    expect(n).toBe(7)
  })

  it('les sceaux valent le même dégât quelle que soit l’action (sauf le soin), et un indice le réduit', () => {
    expect(fight({ boss: true, enemyHp: 200 }).encounter.turn('chapitre', right()).resolution).toMatchObject({ power: 25 })
    expect(fight({ boss: true, enemyHp: 200 }).encounter.turn('automatisme', right({ hintPenalized: true })).resolution).toMatchObject({ power: 18 })
    expect(fight({ boss: true, enemyHp: 200, heroHp: 100 }).encounter.turn('soin', right()).resolution).toMatchObject({ kind: 'heal' })
  })

  it('la difficulté monte d’un cran sous le niveau du joueur à un cran au-dessus', () => {
    const asked = (base: number, questions: number) => {
      const { encounter } = fight({ boss: true, baseLevels: { automatisme: base, chapitre: base } })
      encounter.questions = questions
      return encounter.levelFor('automatisme')
    }
    expect([0, 3, 7].map((q) => asked(3, q))).toEqual([2, 3, 4])
    expect([0, 7].map((q) => asked(1, q))).toEqual([1, 2])
    expect([0, 7].map((q) => asked(5, q))).toEqual([4, 5])
    expect(asked(3, 40)).toBe(4) // plafonné
  })

  it('hors Effaceur, la difficulté reste adaptative (0 = celle du service de questions)', () => {
    expect(fight({ baseLevels: { automatisme: 3, chapitre: 3 } }).encounter.levelFor('chapitre')).toBe(0)
  })
})

describe('« sans pénalité de lenteur »', () => {
  it('la vitesse ne compte plus : ni bonus ni coup critique rapide', () => {
    expect(fight({ noSpeed: true }).encounter.turn('automatisme', right({ speedRatio: 0.1 })).resolution).toMatchObject({ power: 18, crit: false })
  })

  it('la 3e bonne réponse d’affilée sans indice est un coup critique, puis la série repart', () => {
    const { encounter } = fight({ noSpeed: true, heroHp: 10_000, enemyHp: 10_000 })
    const crits = [1, 2, 3, 4, 5, 6].map(() => (encounter.turn('automatisme', right()).resolution as { crit: boolean }).crit)
    expect(crits).toEqual([false, false, true, false, false, true])
  })

  it('une erreur ou un indice casse la régularité', () => {
    const { encounter } = fight({ noSpeed: true, heroHp: 10_000, enemyHp: 10_000 })
    encounter.turn('automatisme', right())
    encounter.turn('automatisme', right())
    encounter.turn('automatisme', wrong())
    expect((encounter.turn('automatisme', right()).resolution as { crit: boolean }).crit).toBe(false)
    expect((encounter.turn('automatisme', right()).resolution as { crit: boolean }).crit).toBe(false)
    expect((encounter.turn('automatisme', right({ hintPenalized: true })).resolution as { crit: boolean }).crit).toBe(false)
  })
})

describe('sac en combat', () => {
  it('le bouclier annule le prochain coup, une seule fois, et ne coûte pas de tour', () => {
    const { hero, encounter } = fight()
    expect(encounter.canUse('bouclier', 1)).toBe(true)
    expect(encounter.useBag('bouclier')).toEqual({ kind: 'shield' })
    expect(encounter.canUse('bouclier', 1)).toBe(false) // déjà levé
    expect(encounter.turn('automatisme', wrong()).enemyAttack).toEqual({ kind: 'blocked' })
    expect(hero.hp).toBe(100)
    expect(encounter.turn('automatisme', wrong()).enemyAttack).toMatchObject({ kind: 'hit' })
  })

  it('la potion rend toute la vie ; grisée si le héros est en pleine forme ou si le sac est vide', () => {
    const { hero, encounter } = fight()
    expect(encounter.canUse('potion', 3)).toBe(false)
    hero.damage(70)
    expect(encounter.canUse('potion', 0)).toBe(false)
    expect(encounter.canUse('potion', 1)).toBe(true)
    expect(encounter.useBag('potion')).toEqual({ kind: 'potion', healed: 70 })
    expect(hero.hp).toBe(100)
  })

  it('plume et parchemin ne s’utilisent pas en combat (ils sont dans la question)', () => {
    expect(fight().encounter.canUse('plume', 3)).toBe(false)
    expect(fight().encounter.useBag('parchemin')).toBeNull()
  })
})

describe('monstres des 30 lieux', () => {
  const root = fileURLToPath(new URL('../public/ressources/models/', import.meta.url))
  const models = [...new Set(lieux.dungeons.flatMap((d) => d.rooms.flatMap((r) => (r.enemies ?? []).map((e) => e.model))))]

  it('chaque modèle d’ennemi est connu et son fichier est livré', () => {
    expect(models.length).toBeGreaterThanOrEqual(18)
    for (const m of models) {
      expect(isMonster(m) || isKayKit(m), `modèle inconnu : ${m}`).toBe(true)
      expect(existsSync(root + modelPath(m)), `fichier absent : ${modelPath(m)}`).toBe(true)
    }
  })
})
