import { describe, expect, it } from 'vitest'
import { MAX_PER_ITEM } from '../src/core/inventory'
import { enigmaIntro, enigmaXp, ENIGMA_ITEMS, findItems, foundBanner, PEDESTALS, riddleItem } from '../src/core/quest/enigma'
import { MAX_RATING, normalizeRating, RATING_WORDS, ratingWord } from '../src/core/quest/rating'
import { EMPTY_SAVE, type SaveData } from '../src/core/save'
import type { Item } from '../src/core/items'
import {
  CLIMB_RISE, Dungeon, type DungeonDecor, OPEN_KINDS, PEDESTAL_DISTANCE, PEDESTAL_RADIUS, PEDESTAL_REARM, PEDESTAL_SPOTS, ROOM_W, VOID_HEIGHT,
} from '../src/core/world/dungeon'
import { DUNGEONS } from '../src/core/world/places'

const fresh = (): SaveData => structuredClone(EMPTY_SAVE)
const decorOf = (d: unknown) => (d as { v1_decor: DungeonDecor }).v1_decor

describe('énigme à trois piédestaux : règles', () => {
  it('trois piédestaux, un objet trouvé à la fin', () => {
    expect(PEDESTALS).toBe(3)
    expect(PEDESTAL_SPOTS).toHaveLength(PEDESTALS)
    expect(ENIGMA_ITEMS).toBe(1)
  })

  it('une bonne réponse rapporte l’XP du lieu et celle de la question', () => {
    const def = DUNGEONS[0]!
    expect(enigmaXp(def, 3)).toBe(def.enigma.xp + 30)
    expect(enigmaXp({ enigma: { ...def.enigma, xp: -5 } }, 2)).toBe(20) // jamais d'XP négative
    expect(enigmaXp({ enigma: { ...def.enigma, xp: 12.6 } }, 1)).toBe(13 + 10)
  })

  it('l’introduction est celle du lieu, sauf pour la balance géante (pas encore dans la v2) : trois cristaux', () => {
    const tower = DUNGEONS.find((d) => d.code === 'tour_fractions')!
    expect(tower.enigma.mode).toBe('balance')
    expect(enigmaIntro(tower)).toMatch(/^Trois cristaux bloquent la porte/)
    expect(enigmaIntro(tower)).not.toContain('géante')
    const others = DUNGEONS.filter((d) => d.enigma.mode !== 'balance')
    expect(others).toHaveLength(DUNGEONS.length - 1)
    for (const d of others) expect(enigmaIntro(d), d.code).toBe(d.enigma.intro)
  })

  it('la question vient des énigmes de la session, à défaut du chapitre', () => {
    const asked: string[] = []
    const item = { id: 'x' } as Item
    const questions = { next: (role?: string) => { asked.push(String(role)); return role === 'chapitre' ? item : null } }
    expect(riddleItem(questions as never)).toBe(item)
    expect(asked).toEqual(['enigme', 'chapitre'])
    expect(riddleItem({ next: () => null } as never)).toBeNull()
    // Ni énigme ni chapitre dans le paquet : n'importe quelle question, la porte ne reste jamais fermée faute de question.
    const any = { next: (role?: string) => (role === undefined ? item : null) }
    expect(riddleItem(any as never)).toBe(item)
    const direct = { next: (role?: string) => (role === 'enigme' ? item : null) }
    expect(riddleItem(direct as never)).toBe(item)
  })

  it('l’objet trouvé entre au sac sans modifier la partie d’origine ; un sac plein ne gagne rien', () => {
    const save = fresh()
    const got = findItems(save, ENIGMA_ITEMS, () => 0)
    expect(got.found).toHaveLength(1)
    expect(got.save).not.toBe(save)
    expect(save.items).toEqual({})
    expect(foundBanner(got.found)).toMatch(/^Trouvé : .+ !$/)
    const full: SaveData = { ...fresh(), items: { plume: MAX_PER_ITEM, parchemin: MAX_PER_ITEM, bouclier: MAX_PER_ITEM, potion: MAX_PER_ITEM } }
    const none = findItems(full, 1)
    expect(none.found).toEqual([])
    expect(none.save).toBe(full)
    expect(foundBanner(none.found)).toBe('')
  })
})

describe('note de plaisir', () => {
  it('cinq mots, de « Bof » à « Génial ! »', () => {
    expect(MAX_RATING).toBe(5)
    expect(RATING_WORDS[0]).toBe('Bof')
    expect(RATING_WORDS[4]).toBe('Génial !')
    expect([1, 2, 3, 4, 5].map(ratingWord)).toEqual([...RATING_WORDS])
  })

  it('n’envoie que 1 à 5 : le reste est « pas de note » (0)', () => {
    expect([1, 3, 5].map(normalizeRating)).toEqual([1, 3, 5])
    expect([0, 6, -2, 2.4, NaN].map(normalizeRating)).toEqual([0, 0, 0, 2, 0])
    expect(['4', null, undefined, {}].map(normalizeRating)).toEqual([0, 0, 0, 0])
    expect(ratingWord(0)).toBe('')
    expect(ratingWord(9)).toBe('')
  })
})

describe('portes de l’énigme', () => {
  it('l’entrée seule reste ouverte : la porte de la salle-énigme attend les trois cristaux', () => {
    expect([...OPEN_KINDS]).toEqual(['entree'])
    const tower = new Dungeon(6)
    tower.lockDoors(['entree', 'combat', 'combat', 'enigme', 'combat', 'boss'])
    expect(tower.lockedDoors).toEqual([1, 2, 3, 4])
    tower.openDoor(3)
    expect(tower.isDoorOpen(3)).toBe(true)
  })
})

describe('piédestaux des 30 lieux', () => {
  it('sont sur le sol de la salle-énigme, hors des murs, de l’escalier, du décor, et loin les uns des autres', () => {
    for (const place of DUNGEONS) {
      const dungeon = new Dungeon(place.rooms.length, CLIMB_RISE, decorOf(place))
      const room = place.rooms.findIndex((r) => r.kind === 'enigme')
      expect(room, place.code).toBeGreaterThanOrEqual(0)
      const spots = dungeon.pedestalPoints(room)
      expect(spots).toHaveLength(PEDESTALS)
      const left = room * ROOM_W
      for (const [i, s] of spots.entries()) {
        const where = `${place.code} piédestal ${i}`
        expect(dungeon.heightAt(s.x, s.z), where).toBeGreaterThan(VOID_HEIGHT)
        expect(dungeon.roomAt(s.x), where).toBe(room)
        expect(s.x - left, where).toBeGreaterThan(1.5)
        expect(s.x - left, where).toBeLessThan(ROOM_W - 3.9) // hors du pied de l'escalier (contre le mur est)
        for (const c of dungeon.obstacles()) {
          expect(Math.hypot(s.x - c.x, s.z - c.z), `${where} / décor`).toBeGreaterThan(c.r + PEDESTAL_RADIUS)
        }
        for (const [j, o] of spots.entries()) {
          if (j !== i) expect(Math.hypot(s.x - o.x, s.z - o.z), `${where} / ${j}`).toBeGreaterThan(PEDESTAL_REARM) // l'un ne se déclenche pas en passant près de l'autre
        }
      }
    }
  })

  it('se déclenchent avant d’être touchés, et se réarment plus loin qu’ils ne se déclenchent', () => {
    expect(PEDESTAL_DISTANCE).toBeGreaterThan(PEDESTAL_RADIUS + 0.45) // le corps du héros (0,45 m) peut s'en approcher à portée
    expect(PEDESTAL_REARM).toBeGreaterThan(PEDESTAL_DISTANCE)
  })
})
