import { describe, expect, it } from 'vitest'
import * as inv from '../src/core/inventory'

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

describe('sac relu d’une partie', () => {
  it('ne garde que les objets connus, entre 0 et 5', () => {
    expect(inv.normalizeOwned(undefined)).toEqual({})
    expect(inv.normalizeOwned('x')).toEqual({})
    expect(inv.normalizeOwned([1, 2])).toEqual({})
    expect(inv.normalizeOwned({ plume: 2.9, bouclier: 99, potion: 0, parchemin: -3, epee: 4, soin: 'beaucoup' })).toEqual({ plume: 2, bouclier: 5 })
  })
})
