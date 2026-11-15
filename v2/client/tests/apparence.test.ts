import { describe, expect, it } from 'vitest'
import { lookOf, markSeen, normalizeLook, progressOf, unlockNews, unseenCount, withLook } from '../src/core/appearance'
import { chestMessage, completePlace } from '../src/core/quest/chest'
import { EMPTY_SAVE, normalizeSave, type SaveData } from '../src/core/save'
import { CAPE_COLORS, defaultLook, PARTS, PET_FURS, SILHOUETTES } from '../src/core/wardrobe'
import { xpForLevel } from '../src/core/progression'

const fresh = (over: Partial<SaveData> = {}): SaveData => ({ ...structuredClone(EMPTY_SAVE), ...over })
const places = (n: number): Record<string, number> => Object.fromEntries(Array.from({ length: n }, (_, i) => [`l${i}`, 1]))

describe('L’apparence dans la partie', () => {
  it('une ancienne partie ({ model, main, off, cape: « origine » }) se relit sans rien perdre', () => {
    const old = { model: 'Knight', main: '1H_Sword', off: 'Round_Shield', cape: 'origine' }
    const look = normalizeLook(old)
    expect(look).toMatchObject({ model: 'Knight', main: '1H_Sword', off: 'Round_Shield', cape: true, cape_color: 'origine', head: true })
    expect(look.pet_name).toBeTruthy()
    expect(normalizeLook({ ...old, cape: 'rouge' }).cape_color).toBe('rouge') // la cape était alors sa couleur
    expect(normalizeLook(null)).toEqual(defaultLook('lumineux'))
    expect(normalizeLook('Knight')).toEqual(defaultLook('lumineux'))
    expect(normalizeSave({ look: old as never }).look.cape).toBe(true)
    expect(normalizeSave({}).look).toEqual(defaultLook('lumineux'))
  })

  it('une apparence verrouillée ou inconnue est remplacée à la lecture, sans toucher à la partie', () => {
    const save = fresh({ look: { ...defaultLook('lumineux'), model: 'Mage', cape_color: 'or', pet_fur: 'inconnu' } })
    const look = lookOf(save, 'lumineux')
    expect(look.model).toBe('Knight') // le Mage demande le niveau 5
    expect(look.cape_color).toBe('origine') // l'or demande trois lieux
    expect(look.pet_fur).toBe(PET_FURS[0]!.id)
    expect(save.look.model).toBe('Mage') // la partie n'est pas modifiée sur place
  })

  it('ce qu’on a débloqué est gardé : le niveau 5 donne le Mage, trois lieux la cape d’or', () => {
    const mage = SILHOUETTES.find((s) => s.model === 'Mage')!
    const save = fresh({ xp: xpForLevel(mage.level ?? 1), places: places(3), look: { ...defaultLook('lumineux'), model: 'Mage', cape_color: 'or' } })
    expect(progressOf(save)).toEqual({ level: mage.level, dungeons: 3 })
    expect(lookOf(save, 'lumineux')).toMatchObject({ model: 'Mage', cape_color: 'or' })
    // Les pièces du Mage ne sont pas celles du Chevalier : la silhouette prend les siennes.
    expect(PARTS.Mage!.main.map(([id]) => id)).toContain(lookOf(save, 'lumineux').main)
  })

  it('dans le Brouillard, le départ est le Rôdeur ; une ancienne partie en Chevalier le reste (niveau 1)', () => {
    expect(lookOf(fresh({ look: defaultLook('brouillard') }), 'brouillard').model).toBe('Rogue_Hooded')
    expect(lookOf(fresh(), 'brouillard').model).toBe('Knight') // la partie par défaut d'avant : on ne change rien à ce que l'enfant voit
  })

  it('withLook range une apparence validée avec ce qui est débloqué', () => {
    const save = fresh()
    const next = withLook(save, { ...defaultLook('lumineux'), cape_color: 'or', model: 'Barbarian' }, 'lumineux')
    expect(next.look.cape_color).toBe('origine')
    expect(next.look.model).toBe('Knight') // le Barbare demande le niveau 3
    expect(save.look).toEqual(defaultLook('lumineux')) // la partie d'origine n'a pas bougé
  })
})

describe('Les déblocages annoncés', () => {
  it('le premier lieu terminé débloque la cape vert forêt ; le niveau 2 la silhouette du Voleur', () => {
    const before = fresh()
    const afterPlace = fresh({ places: places(1) })
    expect(unlockNews(before, afterPlace, 'lumineux')).toContain('Cape : vert forêt')
    const afterLevel = fresh({ xp: xpForLevel(2) })
    expect(unlockNews(before, afterLevel, 'lumineux')).toEqual(['Silhouette : voleur'])
    expect(unlockNews(afterLevel, afterLevel, 'lumineux')).toEqual([]) // rien de nouveau : rien à annoncer
  })

  it('les pelages du compagnon ne s’annoncent que dans le monde lumineux (le renard de Jules)', () => {
    const furs = PET_FURS.filter((f) => (f.dungeons ?? 0) >= 1)
    expect(furs.length).toBeGreaterThan(0)
    const after = fresh({ places: places(Math.max(...furs.map((f) => f.dungeons ?? 0))) })
    expect(unlockNews(fresh(), after, 'lumineux').some((n) => n.startsWith('Pelage'))).toBe(true)
    expect(unlockNews(fresh(), after, 'brouillard').some((n) => n.startsWith('Pelage'))).toBe(false)
  })

  it('le coffre annonce ce qu’il débloque, avec son XP et le lieu terminé', () => {
    const def = { code: 'tour_fractions', chest_xp: 100 }
    const before = fresh()
    const done = completePlace(before, def, () => 0)
    const unlocked = unlockNews(before, done.save, 'lumineux')
    expect(unlocked).toContain('Cape : vert forêt') // le premier lieu terminé
    const text = chestMessage({ title: 'La Tour', page: 'la page des Fractions', page_text: 'Texte.', outro: 'Fin.', chest_xp: 100 }, { first: true, answered: 5, correct: 5, found: [], unlocked }).text
    expect(text).toContain('Nouveau dans ton apparence : ')
    expect(text).toContain('Cape : vert forêt')
    expect(chestMessage({ title: 'La Tour', page: '', page_text: '', outro: 'Fin.', chest_xp: 100 }, { first: false, answered: 5, correct: 5, found: [], unlocked: [] }).text).not.toContain('apparence')
  })
})

describe('La pastille des nouveautés', () => {
  it('au départ rien n’est nouveau ; chaque choix débloqué ensuite l’est, jusqu’à ce que l’écran soit ouvert', () => {
    expect(unseenCount(fresh(), 'lumineux')).toBe(0)
    expect(unseenCount(fresh(), 'brouillard')).toBe(0)
    const progressed = fresh({ places: places(1), xp: xpForLevel(2) })
    const news = unlockNews(fresh(), progressed, 'lumineux').length
    expect(news).toBeGreaterThan(0)
    expect(unseenCount(progressed, 'lumineux')).toBe(news)
    const seen = markSeen(progressed, 'lumineux')
    expect(unseenCount(seen, 'lumineux')).toBe(0)
    expect(progressed.look.seen).toBe(0) // la partie d'origine n'a pas bougé
    // Un choix de plus après l'avoir vu : une seule nouveauté.
    const more = { ...seen, places: places(2) }
    expect(unseenCount(more, 'lumineux')).toBe(unlockNews(seen, more, 'lumineux').length)
    expect(CAPE_COLORS.length).toBeGreaterThan(3)
  })
})
