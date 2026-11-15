import { describe, expect, it } from 'vitest'
import { choose, companionLabel, lookOf, markSeen, menuOf, normalizeLook, progressOf, unlockNews, unseenCount, withLook } from '../src/core/appearance'
import { chestMessage, completePlace } from '../src/core/quest/chest'
import { EMPTY_SAVE, normalizeSave, type SaveData } from '../src/core/save'
import { CAPE_COLORS, defaultLook, isTwoHanded, PARTS, PET_FURS, PET_NAMES, SILHOUETTES } from '../src/core/wardrobe'
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

describe('Les choix de l’écran d’apparence', () => {
  const start = progressOf(fresh())
  const far = progressOf(fresh({ places: places(5), xp: xpForLevel(8) }))
  const knight = defaultLook('lumineux')

  it('un choix libre est pris, un choix verrouillé ou inconnu ne change rien', () => {
    expect(choose(knight, { cape_color: 'rouge' }, 'lumineux', start).cape_color).toBe('rouge')
    expect(choose(knight, { cape_color: 'or' }, 'lumineux', start)).toEqual(knight) // trois lieux demandés
    expect(choose(knight, { model: 'Mage' }, 'lumineux', start)).toEqual(knight) // niveau 5
    expect(choose(knight, { pet_fur: 'dore' }, 'lumineux', start)).toEqual(knight)
    expect(choose(knight, { pet_name: 'Inconnu' }, 'lumineux', start)).toEqual(knight)
    expect(choose(knight, { main: '1H_Wand' }, 'lumineux', far)).toEqual(knight) // une arme d'une autre silhouette
  })

  it('une autre silhouette reprend ses pièces par défaut et garde la couleur de cape, la cape et le compagnon', () => {
    const red = choose(knight, { cape_color: 'rouge', pet_fur: 'sable', pet_name: 'Filou' }, 'lumineux', start)
    const mage = choose({ ...red, seen: 4 }, { model: 'Mage' }, 'lumineux', far)
    expect(mage).toMatchObject({ model: 'Mage', main: '1H_Wand', off: 'Spellbook', head: true, cape: true, cape_color: 'rouge', pet_fur: 'sable', pet_name: 'Filou', seen: 4 })
    const back = choose(mage, { model: 'Knight' }, 'lumineux', far)
    expect(back).toMatchObject({ model: 'Knight', main: '1H_Sword', off: 'Round_Shield' })
  })

  it('une arme à deux mains libère la main gauche et la ferme ; une à une main la rouvre', () => {
    const big = choose(knight, { main: '2H_Sword' }, 'lumineux', start)
    expect(big.off).toBe('')
    expect(choose(big, { off: 'Round_Shield' }, 'lumineux', start).off).toBe('') // impossible tant que la grande épée est tenue
    const again = choose(big, { main: '1H_Sword' }, 'lumineux', start)
    expect(isTwoHanded(again.main)).toBe(false)
    expect(choose(again, { off: 'Spike_Shield' }, 'lumineux', start).off).toBe('Spike_Shield')
  })

  it('le couvre-chef et la cape se retirent (le Rôdeur n’a pas de couvre-chef à retirer)', () => {
    expect(choose(knight, { head: false, cape: false }, 'lumineux', start)).toMatchObject({ head: false, cape: false })
    const rogue = choose(knight, { model: 'Rogue' }, 'lumineux', far)
    expect(choose(rogue, { head: true }, 'lumineux', far).head).toBe(false)
  })

  it('le choix ne modifie jamais l’apparence d’origine et garde le compte des nouveautés vues', () => {
    const before = structuredClone(knight)
    const next = choose({ ...knight, seen: 7 }, { cape_color: 'bleu' }, 'lumineux', start)
    expect(knight).toEqual(before)
    expect(next.seen).toBe(7)
  })

  it('le menu dit ce qui est choisi, ce qui est verrouillé (et ce qu’il faut faire) et ce qui est impossible', () => {
    const menu = menuOf(knight, 'lumineux', start)
    expect(menu.silhouettes.filter((s) => s.selected).map((s) => s.id)).toEqual(['Knight'])
    const mage = menu.silhouettes.find((s) => s.id === 'Mage')!
    expect(mage.locked).toBe('Niveau 5')
    expect(menu.silhouettes.find((s) => s.id === 'Knight')!.locked).toBeUndefined()
    expect(menu.capeColors.find((c) => c.id === 'or')!.locked).toBe('Termine 3 lieux')
    expect(menu.capeColors.find((c) => c.id === 'vert')!.locked).toBe('Termine 1 lieu')
    expect(menu.capeColors.filter((c) => c.id !== 'origine').every((c) => c.swatch?.startsWith('#'))).toBe(true)
    expect(menu.capeColors.find((c) => c.id === 'origine')!.swatch).toBeUndefined() // la cape d'origine n'est pas « blanche »
    expect(menu.pet!.names.map((n) => n.id)).toEqual(PET_NAMES)
    expect(menu.pet!.furs.filter((f) => f.selected)).toHaveLength(1)
    expect(menu.hasHead).toBe(true)
    expect(menu.off.every((o) => o.unavailable === undefined)).toBe(true)
    const big = menuOf(choose(knight, { main: '2H_Sword' }, 'lumineux', start), 'lumineux', start)
    expect(big.off.find((o) => o.id === '')!.unavailable).toBeUndefined() // « Rien » reste possible
    expect(big.off.filter((o) => o.id !== '').every((o) => o.unavailable)).toBe(true)
  })

  it('tout est débloqué plus loin ; une entrée verrouillée l’est toujours par la même condition que sanitizeLook', () => {
    const menu = menuOf(knight, 'lumineux', far)
    const all = [...menu.silhouettes, ...menu.capeColors, ...menu.pet!.furs]
    expect(all.every((e) => e.locked === undefined)).toBe(true)
    const low = menuOf(knight, 'lumineux', start)
    for (const e of [...low.silhouettes, ...low.capeColors, ...low.pet!.furs].filter((x) => x.locked)) {
      const chosen = e.id in Object.fromEntries(SILHOUETTES.map((s) => [s.model, 1])) ? { model: e.id } : CAPE_COLORS.some((c) => c.id === e.id) ? { cape_color: e.id } : { pet_fur: e.id }
      expect(choose(knight, chosen, 'lumineux', start)).toEqual(knight)
    }
  })

  it('dans le Brouillard : pas de compagnon dans le menu, le Rôdeur est choisi au départ', () => {
    const menu = menuOf(defaultLook('brouillard'), 'brouillard', start)
    expect(menu.pet).toBeNull()
    expect(menu.silhouettes.find((s) => s.selected)!.id).toBe('Rogue_Hooded')
    expect(menu.hasHead).toBe(false)
    expect(Object.keys(PARTS)).toContain('Rogue_Hooded')
  })
})

describe('Le compagnon dans la barre du haut', () => {
  it('montre le nom que l’enfant a choisi pour son renard, dans le monde lumineux seulement', () => {
    const name = PET_NAMES[1]!
    const save = fresh({ look: { ...defaultLook('lumineux'), pet_name: name } })
    expect(companionLabel(save, 'lumineux')).toBe(name)
    expect(companionLabel(save, 'brouillard')).toBe('') // pas de renard dans le monde Brouillard
  })

  it('un nom inconnu (partie abîmée) reprend le nom par défaut, jamais une chaîne vide dans le monde lumineux', () => {
    const save = fresh({ look: { ...defaultLook('lumineux'), pet_name: 'Nom inventé' } })
    expect(companionLabel(save, 'lumineux')).toBe(PET_NAMES[0])
    expect(companionLabel(fresh(), 'lumineux')).toBe(PET_NAMES[0])
  })

  it('suit le choix tout de suite : renommer le renard change le nom affiché', () => {
    const before = fresh()
    const after = withLook(before, { ...before.look, pet_name: PET_NAMES[2]! }, 'lumineux')
    expect(companionLabel(after, 'lumineux')).toBe(PET_NAMES[2])
    expect(companionLabel(before, 'lumineux')).toBe(PET_NAMES[0])
  })
})
