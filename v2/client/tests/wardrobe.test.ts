import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  attacksFor, CAPE_COLORS, defaultLook, fur, newlyUnlocked, PARTS, PET_FURS, PET_NAMES, requirementMet, requirementText, sanitizeLook,
  SILHOUETTES, unlockedCount,
} from '../src/core/wardrobe'

const START = { level: 1, dungeons: 0 }

describe('apparence par défaut', () => {
  it('est celle du héros d’avant la personnalisation, selon le monde', () => {
    const bright = defaultLook('lumineux')
    expect(bright).toMatchObject({ model: 'Knight', main: '1H_Sword', off: 'Round_Shield', pet_fur: 'roux', pet_name: 'Roux', cape_color: 'origine', seen: 0 })
    expect(defaultLook('brouillard').model).toBe('Rogue_Hooded')
  })
})

describe('sanitizeLook', () => {
  it('refuse l’inconnu et le verrouillé, et rend l’apparence par défaut', () => {
    const look = sanitizeLook({ model: 'Dragon', main: 'Bazooka' }, 'lumineux', START)
    expect(look.model).toBe('Knight')
    expect(look.main).toBe('1H_Sword')
    // Mage : niveau 5 ; cape or : trois lieux ; pelage arctique : un lieu.
    const wanted = { model: 'Mage', cape_color: 'or', pet_fur: 'arctique', pet_name: 'Inconnu' }
    const locked = sanitizeLook(wanted, 'lumineux', START)
    expect([locked.model, locked.cape_color, locked.pet_fur, locked.pet_name]).toEqual(['Knight', 'origine', 'roux', 'Roux'])
    const open = sanitizeLook(wanted, 'lumineux', { level: 5, dungeons: 3 })
    expect(open).toMatchObject({ model: 'Mage', main: '1H_Wand', cape_color: 'or', pet_fur: 'arctique' }) // une nouvelle silhouette prend ses pièces par défaut
    expect(sanitizeLook('pas un objet', 'brouillard', START).model).toBe('Rogue_Hooded')
    expect(sanitizeLook(null, 'lumineux', START)).toEqual(defaultLook('lumineux'))
    expect(sanitizeLook([1, 2], 'lumineux', START)).toEqual(defaultLook('lumineux'))
  })

  it('une arme à deux mains libère la main gauche, et le voleur n’a pas de couvre-chef', () => {
    const look = sanitizeLook({ model: 'Knight', main: '2H_Sword', off: 'Spike_Shield' }, 'lumineux', START)
    expect(look.off).toBe('')
    expect(attacksFor(look)[0]).toBe('2H_Melee_Attack_Chop')
    expect(sanitizeLook({ model: 'Rogue', head: true }, 'brouillard', { level: 2, dungeons: 0 }).head).toBe(false)
    expect(sanitizeLook({ model: 'Knight', head: false, cape: false }, 'lumineux', START)).toMatchObject({ head: false, cape: false })
  })

  it('une arme ou une main gauche d’une autre silhouette n’est pas acceptée', () => {
    const look = sanitizeLook({ model: 'Knight', main: '1H_Wand', off: 'Spellbook' }, 'lumineux', START)
    expect([look.main, look.off]).toEqual(['1H_Sword', 'Round_Shield'])
  })

  it('garde le nombre de nouveautés vues, jamais négatif', () => {
    expect(sanitizeLook({ seen: 7.9 }, 'lumineux', START).seen).toBe(7)
    expect(sanitizeLook({ seen: -3 }, 'lumineux', START).seen).toBe(0)
  })
})

describe('attaque selon l’arme', () => {
  it('suit l’arme tenue en main droite', () => {
    expect(attacksFor({ main: '1H_Wand' })[0]).toBe('Spellcast_Shoot')
    expect(attacksFor({ main: '1H_Crossbow' })[0]).toBe('1H_Ranged_Shoot')
    expect(attacksFor({ main: '2H_Crossbow' })[0]).toBe('2H_Ranged_Shoot')
    expect(attacksFor({ main: 'Knife', off: 'Knife_Offhand' })[0]).toBe('Dualwield_Melee_Attack_Chop')
    expect(attacksFor({ main: 'Mug' })[0]).toBe('Unarmed_Melee_Attack_Punch_A')
    expect(attacksFor({ main: '1H_Sword', off: 'Round_Shield' })[0]).toBe('1H_Melee_Attack_Chop')
  })
})

describe('déblocages', () => {
  it('s’annoncent une seule fois, et pas de pelage sans compagnon', () => {
    const names = newlyUnlocked({ level: 1, dungeons: 0 }, { level: 3, dungeons: 1 }, true)
    expect(names).toContain('Silhouette : voleur')
    expect(names).toContain('Silhouette : barbare')
    expect(names).toContain('Cape : vert forêt')
    expect(names).toContain('Pelage : arctique')
    expect(names).not.toContain('Silhouette : mage')
    expect(newlyUnlocked({ level: 3, dungeons: 1 }, { level: 3, dungeons: 1 }, true)).toEqual([])
    expect(newlyUnlocked({ level: 1, dungeons: 0 }, { level: 1, dungeons: 1 }, false)).not.toContain('Pelage : arctique')
    expect(unlockedCount({ level: 5, dungeons: 3 }, true)).toBeGreaterThan(unlockedCount(START, true))
    expect(unlockedCount({ level: 5, dungeons: 3 }, true)).toBe(SILHOUETTES.length + CAPE_COLORS.length + PET_FURS.length)
  })

  it('disent ce qu’il faut faire, en français', () => {
    expect(requirementText({ dungeons: 1 })).toBe('Termine 1 lieu')
    expect(requirementText({ dungeons: 3 })).toBe('Termine 3 lieux')
    expect(requirementText({ level: 5 })).toBe('Niveau 5')
    expect(requirementMet({ level: 2 }, START)).toBe(false)
    expect(requirementMet({ level: 2 }, { level: 2, dungeons: 0 })).toBe(true)
  })
})

describe('données de l’apparence (content/monde/apparence.json)', () => {
  const models = fileURLToPath(new URL('../public/ressources/models/kaykit/characters/', import.meta.url))

  it('chaque silhouette a ses pièces et son modèle livré ; la première pièce de chaque main existe', () => {
    for (const s of SILHOUETTES) {
      expect(PARTS[s.model], s.model).toBeDefined()
      expect(existsSync(`${models}${s.model}.glb`), `${s.model}.glb`).toBe(true)
      const p = PARTS[s.model]!
      expect(p.main.length).toBeGreaterThan(0)
      expect(p.off.map(([id]) => id)).toContain(p.default_off)
    }
  })

  it('les choix de départ sont libres, les noms et les couleurs sont valides', () => {
    expect(CAPE_COLORS[0]!.id).toBe('origine')
    expect(PET_FURS[0]).toMatchObject({ id: 'roux', dungeons: 0 })
    for (const c of [...CAPE_COLORS.map((x) => x.color), ...PET_FURS.flatMap((f) => [f.main, f.light])]) expect(c).toMatch(/^#[0-9a-f]{6}$/i)
    expect(new Set(PET_NAMES).size).toBe(PET_NAMES.length)
    expect(fur('inconnu').id).toBe('roux')
    expect(fur('dore').main).toBe('#f0b52e')
  })
})
