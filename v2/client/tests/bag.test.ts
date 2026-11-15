import { describe, expect, it } from 'vitest'
import { BAG_SOURCES, bagEntries, bagOverview, COMBAT_ITEMS, featherHides, hasCombatItems, helpCounted, isBagEmpty, questionAids, questionItemsText, spendInCombat } from '../src/core/bag'
import { Combatant, Encounter } from '../src/core/combat/encounter'
import type { Item } from '../src/core/items'
import { PACK_6E } from './support'

const fight = (hp = 50, max = 100) => {
  const hero = new Combatant('Héros', max, hp)
  const enc = new Encounter(hero, { world: 'lumineux', random: () => 0 })
  enc.engage(new Combatant('Gelée', 60), { tier: 1, rewardXp: 20 })
  return enc
}

const mcq = (choices: string[], index: number, hint = 'Un indice.'): Item =>
  ({ id: 'q', type: 'mcq', choices, answer: { kind: 'choice', index }, hint }) as unknown as Item

describe('sac en combat', () => {
  it('propose la potion puis le bouclier, avec ce qui empêche de s’en servir', () => {
    const enc = fight(50)
    const entries = bagEntries({ potion: 2, bouclier: 1 }, enc)
    expect(entries.map((e) => e.id)).toEqual([...COMBAT_ITEMS])
    expect(entries.every((e) => e.usable && e.why === '')).toBe(true)
    expect(entries[0]).toMatchObject({ name: "Potion d'urgence", count: 2 })
    const empty = bagEntries({}, enc)
    expect(empty.map((e) => [e.usable, e.why])).toEqual([[false, "Tu n'en as plus."], [false, "Tu n'en as plus."]])
    const full = bagEntries({ potion: 1, bouclier: 1 }, fight(100))
    expect(full[0]).toMatchObject({ usable: false, why: 'Ta vie est déjà pleine.' })
    expect(full[1]!.usable).toBe(true)
  })

  it('la potion rend toute la vie et coûte un objet, sans modifier le sac d’origine', () => {
    const enc = fight(30)
    const owned = { potion: 2 }
    const used = spendInCombat(owned, enc, 'potion')!
    expect(used.event).toEqual({ kind: 'potion', healed: 70 })
    expect(enc.hero.hp).toBe(100)
    expect(used.owned).toEqual({ potion: 1 })
    expect(owned).toEqual({ potion: 2 })
  })

  it('le bouclier se lève une fois, fait manquer le prochain coup, puis retombe', () => {
    const enc = fight(80)
    const used = spendInCombat({ bouclier: 3 }, enc, 'bouclier')!
    expect(used.event).toEqual({ kind: 'shield_up' })
    expect(used.owned).toEqual({ bouclier: 2 })
    expect(enc.shieldUp).toBe(true)
    expect(spendInCombat(used.owned, enc, 'bouclier')).toBeNull() // déjà levé : rien n'est dépensé
    const turn = enc.answer('automatisme', { correct: false, speedRatio: 1, rewardFactor: 1, hintUsed: false, difficulty: 1 })
    expect(turn.events.find((e) => e.kind === 'foe_attack')).toMatchObject({ damage: 0, blocked: true })
    expect(enc.hero.hp).toBe(80)
    expect(enc.shieldUp).toBe(false)
  })

  it('refuse sans rien changer : plus d’objet, vie pleine, objet qui n’est pas du combat', () => {
    expect(spendInCombat({}, fight(10), 'potion')).toBeNull()
    expect(spendInCombat({ potion: 1 }, fight(100), 'potion')).toBeNull()
    expect(spendInCombat({ plume: 1 }, fight(10), 'plume')).toBeNull()
    expect(hasCombatItems({ plume: 4 })).toBe(false)
    expect(hasCombatItems({ potion: 1 })).toBe(true)
  })
})

describe('plume et parchemin dans une question', () => {
  it('la plume sert sur un QCM d’au moins trois choix, pas sur deux choix ni sur autre chose', () => {
    const owned = { plume: 1, parchemin: 1 }
    expect(questionAids(mcq(['a', 'b', 'c'], 0), owned)).toEqual(['plume', 'parchemin'])
    expect(questionAids(mcq(['a', 'b'], 0), owned)).toEqual(['parchemin'])
    const typed = { ...mcq(['a', 'b', 'c'], 0), type: 'numeric', answer: { kind: 'number', value: '3' } } as unknown as Item
    expect(questionAids(typed, owned)).toEqual(['parchemin'])
  })

  it('le parchemin demande un indice, les deux demandent d’en avoir', () => {
    expect(questionAids(mcq(['a', 'b', 'c'], 0, '   '), { plume: 1, parchemin: 1 })).toEqual(['plume'])
    expect(questionAids(mcq(['a', 'b', 'c'], 0), {})).toEqual([])
    expect(questionAids(mcq(['a', 'b', 'c'], 0), { plume: 0, parchemin: 2 })).toEqual(['parchemin'])
  })

  it('la plume cache deux mauvaises propositions, jamais la bonne, et en laisse au moins deux', () => {
    for (let n = 3; n <= 6; n += 1) {
      for (let right = 0; right < n; right += 1) {
        for (const roll of [0, 0.3, 0.99]) {
          const item = mcq(Array.from({ length: n }, (_, i) => String(i)), right)
          const hidden = featherHides(item, () => roll)
          expect(hidden).toHaveLength(Math.min(2, n - 2))
          expect(hidden).not.toContain(right)
          expect(new Set(hidden).size).toBe(hidden.length)
          expect(n - hidden.length).toBeGreaterThanOrEqual(2)
          expect(hidden).toEqual([...hidden].sort((a, b) => a - b))
        }
      }
    }
    expect(featherHides(mcq(['a', 'b'], 0))).toEqual([])
  })

  it('sur les vraies questions du paquet : la plume ne cache jamais la bonne réponse', () => {
    const qcms = PACK_6E.items.filter((i) => i.type === 'mcq' && (i.choices?.length ?? 0) >= 3)
    expect(qcms.length).toBeGreaterThan(0)
    for (const item of qcms) {
      const hidden = featherHides(item)
      expect(hidden).toHaveLength(Math.min(2, (item.choices?.length ?? 0) - 2))
      expect(hidden).not.toContain((item.answer as { index: number }).index)
    }
  })
})

describe('rappel des objets de question', () => {
  it('dit ce que le sac garde pour les questions, rien s’il n’y en a pas', () => {
    expect(questionItemsText({ plume: 2, parchemin: 1, potion: 3 })).toBe('Plume ×2, Parchemin ×1')
    expect(questionItemsText({ parchemin: 4 })).toBe('Parchemin ×4')
    expect(questionItemsText({ potion: 3, bouclier: 1 })).toBe('')
    expect(questionItemsText({})).toBe('')
  })
})

describe('aide reçue', () => {
  it('l’indice ordinaire baisse la puissance, un objet du sac ne compte que pour le suivi', () => {
    expect(helpCounted(false, [])).toEqual({ tracking: false, power: false })
    expect(helpCounted(true, [])).toEqual({ tracking: true, power: true })
    expect(helpCounted(false, ['parchemin'])).toEqual({ tracking: true, power: false })
    expect(helpCounted(false, ['plume', 'parchemin'])).toEqual({ tracking: true, power: false })
    expect(helpCounted(true, ['plume'])).toEqual({ tracking: true, power: true })
  })
})

describe('sac consultable sur l’île', () => {
  it('liste les quatre objets dans l’ordre de la v1, même ceux qu’on n’a pas, avec où ils servent', () => {
    const lines = bagOverview({ plume: 2, bouclier: 1 })
    expect(lines.map((l) => l.id)).toEqual(['plume', 'parchemin', 'bouclier', 'potion'])
    expect(lines.map((l) => l.count)).toEqual([2, 0, 1, 0])
    expect(lines.find((l) => l.id === 'plume')?.where).toContain('question')
    expect(lines.find((l) => l.id === 'potion')?.where).toContain('combat')
    for (const line of lines) expect(line.help.length).toBeGreaterThan(5)
  })

  it('un sac vide est reconnu (et dit où trouver des objets) ; un sac abîmé se lit sans planter', () => {
    expect(isBagEmpty({})).toBe(true)
    expect(isBagEmpty({ plume: 0, potion: 0 })).toBe(true)
    expect(isBagEmpty({ potion: 1 })).toBe(false)
    expect(bagOverview({ plume: -3, parchemin: Number.NaN }).map((l) => l.count)).toEqual([0, 0, 0, 0])
    expect(BAG_SOURCES).toContain('coffres')
    expect(BAG_SOURCES).toContain('5')
  })
})
