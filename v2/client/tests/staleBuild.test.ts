import { describe, expect, it } from 'vitest'
import { RELOAD_GUARD_MS, shouldReloadForNewBuild } from '../src/core/staleBuild'

describe('rechargement après une mise en ligne', () => {
  const now = 1_800_000_000_000

  it("recharge la première fois (aucun rechargement dans l'onglet)", () => {
    expect(shouldReloadForNewBuild(now, null)).toBe(true)
  })

  it("ne recharge pas deux fois de suite : l'erreur s'affiche", () => {
    expect(shouldReloadForNewBuild(now, now - 2_000)).toBe(false)
    expect(shouldReloadForNewBuild(now, now - RELOAD_GUARD_MS + 1)).toBe(false)
  })

  it('recharge de nouveau à la mise en ligne suivante', () => {
    expect(shouldReloadForNewBuild(now, now - RELOAD_GUARD_MS)).toBe(true)
    expect(shouldReloadForNewBuild(now, now - 3 * 3_600_000)).toBe(true)
  })

  it('une valeur gardée illisible ou dans le futur ne bloque pas le rechargement', () => {
    expect(shouldReloadForNewBuild(now, Number.NaN)).toBe(true)
    expect(shouldReloadForNewBuild(now, now + 60_000)).toBe(true)
  })
})
