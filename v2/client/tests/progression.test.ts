import { describe, expect, it } from 'vitest'
import * as inv from '../src/core/progression/inventory'
import { answerXp, heroMaxHp, levelForXp, levelProgress, MAX_LEVEL, xpForLevel } from '../src/core/progression/progression'

describe('progression', () => {
  it('atteint le niveau n à 100·n·(n−1) XP', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 200, 600, 1200, 2000])
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(199)).toBe(1)
    expect(levelForXp(200)).toBe(2)
    expect(levelForXp(599)).toBe(2)
    expect(levelForXp(600)).toBe(3)
    expect(levelForXp(10_000_000)).toBe(MAX_LEVEL)
  })

  it('mesure l’avancement dans le niveau, de 0 à 1', () => {
    expect(levelProgress(0)).toBe(0)
    expect(levelProgress(100)).toBeCloseTo(0.5)
    expect(levelProgress(200)).toBe(0)
    expect(levelProgress(10_000_000)).toBe(1)
  })

  it('donne 10 PV de plus par niveau, et 10 XP par cran de difficulté', () => {
    expect(heroMaxHp(1)).toBe(100)
    expect(heroMaxHp(4)).toBe(130)
    expect([1, 3, 5].map(answerXp)).toEqual([10, 30, 50])
  })
})

describe('sac', () => {
  it('ne dépasse jamais 5 de chaque objet', () => {
    const full = inv.give({}, Array(7).fill('potion'))
    expect(full.potion).toBe(inv.MAX_PER_ITEM)
    expect(inv.give(full, ['potion']).potion).toBe(5)
  })

  it('tire plutôt les objets que l’on a peu, jamais ceux dont le sac est plein', () => {
    const owned = { plume: 5, parchemin: 5, bouclier: 5, potion: 0 }
    expect(inv.draw(owned, 3, () => 0.3)).toEqual(['potion', 'potion', 'potion'])
    expect(inv.draw({ plume: 5, parchemin: 5, bouclier: 5, potion: 5 }, 2)).toEqual([])
    // 5 tirages d'un sac vide sur un seul objet : l'objet plein est écarté en cours de route
    const drawn = inv.draw({ plume: 4, parchemin: 5, bouclier: 5, potion: 5 }, 4, () => 0)
    expect(drawn).toEqual(['plume'])
  })

  it('retire un objet à l’usage, ou refuse s’il n’en reste pas', () => {
    expect(inv.use({ bouclier: 2 }, 'bouclier')).toEqual({ bouclier: 1 })
    expect(inv.use({ bouclier: 0 }, 'bouclier')).toBeNull()
    expect(inv.use({}, 'potion')).toBeNull()
  })

  it('annonce un gain et résume le sac en français', () => {
    expect(inv.describe(['plume', 'bouclier', 'bouclier'])).toBe('Plume du sage, Bouclier ×2')
    expect(inv.foundText([])).toBe('')
    expect(inv.foundText(['potion'])).toBe('Dans ton sac : Potion d\'urgence.')
    expect(inv.summary({})).toBe("Sac : vide pour l'instant")
    expect(inv.summary({ plume: 2, bouclier: 1 })).toBe('Sac : Plume ×2 · Bouclier ×1')
  })
})
