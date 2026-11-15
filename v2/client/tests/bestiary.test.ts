import { describe, expect, it } from 'vitest'
import { bestiaryLines, bestiarySummary, MAX_COUNT, MAX_NAME, MAX_SPECIES, normalizeBestiary, recordDefeat } from '../src/core/bestiary'
import { EMPTY_SAVE, normalizeSave } from '../src/core/save'

describe('Bestiaire', () => {
  it('compte une victoire de plus par créature et rend un bestiaire neuf', () => {
    const start = {}
    const one = recordDefeat(start, 'Squelette')
    const two = recordDefeat(one, 'Squelette')
    const other = recordDefeat(two, 'Gelée verte')
    expect(start).toEqual({})
    expect(one).toEqual({ Squelette: 1 })
    expect(other).toEqual({ Squelette: 2, 'Gelée verte': 1 })
    expect(two).toEqual({ Squelette: 2 }) // les anciens états ne bougent pas
  })

  it('un nom vide ne compte pas, un nom trop long est coupé, le compte et le nombre d’espèces sont bornés', () => {
    expect(recordDefeat({ A: 1 }, '   ')).toEqual({ A: 1 })
    expect(Object.keys(recordDefeat({}, 'x'.repeat(500)))[0]).toHaveLength(MAX_NAME)
    expect(recordDefeat({ A: MAX_COUNT }, 'A')).toEqual({ A: MAX_COUNT })
    const full = Object.fromEntries(Array.from({ length: MAX_SPECIES }, (_, i) => [`Bête ${i}`, 1]))
    expect(Object.keys(recordDefeat(full, 'Nouvelle')).length).toBe(MAX_SPECIES)
    expect(recordDefeat(full, 'Bête 3')['Bête 3']).toBe(2) // une espèce connue compte toujours
  })

  it('relit un bestiaire abîmé sans planter : seuls les noms et les nombres valables restent', () => {
    expect(normalizeBestiary(undefined)).toEqual({})
    expect(normalizeBestiary(null)).toEqual({})
    expect(normalizeBestiary([1, 2])).toEqual({})
    expect(normalizeBestiary('x')).toEqual({})
    expect(normalizeBestiary({ Squelette: 3, '': 2, Vide: 0, Negatif: -4, NaN: Number.NaN, Texte: '5', Infini: Infinity, 'Gelée verte': 2.9, Énorme: 1e9 })).toEqual({
      Squelette: 3,
      'Gelée verte': 2,
      Énorme: MAX_COUNT,
    })
  })

  it('trie les créatures par nombre de victoires puis par nom, et résume en mots', () => {
    const beasts = { Squelette: 5, 'Gelée verte': 2, Dragon: 2, Abeille: 5 }
    expect(bestiaryLines(beasts).map((l) => l.name)).toEqual(['Abeille', 'Squelette', 'Dragon', 'Gelée verte'])
    expect(bestiarySummary({})).toContain('Aucune créature')
    expect(bestiarySummary({ A: 1 })).toBe('1 créature vaincue, 1 espèce rencontrée.')
    expect(bestiarySummary(beasts)).toBe('14 créatures vaincues, 4 espèces rencontrées.')
    expect(bestiarySummary({ A: 3 })).toBe('3 créatures vaincues, 1 espèce rencontrée.')
  })

  it('la partie le garde : vide au départ, relu depuis une ancienne partie, jamais partagé entre deux parties', () => {
    expect(EMPTY_SAVE.bestiary).toEqual({})
    expect(normalizeSave({ xp: 10 }).bestiary).toEqual({})
    expect(normalizeSave({ bestiary: { Squelette: 2, '': 9 } }).bestiary).toEqual({ Squelette: 2 })
    const a = normalizeSave(undefined)
    const b = normalizeSave(undefined)
    expect(a.bestiary).not.toBe(b.bestiary)
  })
})
