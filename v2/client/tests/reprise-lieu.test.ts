import { describe, expect, it } from 'vitest'
import {
  checkpointOf, MAX_CHECKPOINTS, MAX_CODE, MAX_ROOM, normalizeCheckpoints, resumeBanner, resumeText, withCheckpoint, withoutCheckpoint,
} from '../src/core/checkpoint'
import { completePlace } from '../src/core/quest/chest'
import { EMPTY_SAVE, normalizeSave, type SaveData } from '../src/core/save'
import { DUNGEONS } from '../src/core/world/places'

const fresh = (): SaveData => structuredClone(EMPTY_SAVE)
const ROOMS = 6

describe('La reprise d’un lieu : les points de reprise de la partie', () => {
  it('une partie neuve, ou ancienne (sans le champ), n’a aucune reprise', () => {
    expect(EMPTY_SAVE.checkpoints).toEqual({})
    const old = { xp: 12, places: { tour_fractions: 1 } } as Partial<SaveData>
    expect(normalizeSave(old).checkpoints).toEqual({})
    expect(normalizeSave(null).checkpoints).toEqual({})
  })

  it('relit une partie abîmée : seuls les codes non vides et les salles entières de 1 à 20 restent', () => {
    expect(normalizeCheckpoints(null)).toEqual({})
    expect(normalizeCheckpoints([1, 2])).toEqual({})
    expect(normalizeCheckpoints('x')).toEqual({})
    const out = normalizeCheckpoints({
      tour_fractions: 3,
      atelier_balances: 2.9, // entière : 2
      vide: 0,
      negatif: -2,
      '': 4,
      '   ': 4,
      texte: '3',
      nan: Number.NaN,
      infini: Number.POSITIVE_INFINITY,
      trop_loin: MAX_ROOM + 1,
      limite: MAX_ROOM,
    })
    expect(out).toEqual({ tour_fractions: 3, atelier_balances: 2, limite: MAX_ROOM })
    const long = 'x'.repeat(MAX_CODE + 40)
    expect(Object.keys(normalizeCheckpoints({ [long]: 2 }))[0]!.length).toBe(MAX_CODE)
  })

  it('garde au plus 100 lieux (une partie abîmée ne grossit pas sans fin)', () => {
    const many: Record<string, number> = {}
    for (let i = 0; i < MAX_CHECKPOINTS + 50; i += 1) many[`lieu-${i}`] = 2
    expect(Object.keys(normalizeCheckpoints(many))).toHaveLength(MAX_CHECKPOINTS)
    // Un lieu déjà gardé se met à jour, même au plafond.
    const full = fresh()
    full.checkpoints = normalizeCheckpoints(many)
    expect(withCheckpoint(full, 'lieu-0', 4, ROOMS).checkpoints['lieu-0']).toBe(4)
    // Un nouveau lieu, au plafond, ne rentre pas : la partie reste la même.
    expect(withCheckpoint(full, 'nouveau', 2, ROOMS)).toBe(full)
  })

  it('la salle de reprise : 0 sans point, jamais au-delà de la dernière salle', () => {
    const save = fresh()
    expect(checkpointOf(save, 'tour_fractions', ROOMS)).toBe(0)
    save.checkpoints = { tour_fractions: 3, ancien: 9, bizarre: -1 }
    expect(checkpointOf(save, 'tour_fractions', ROOMS)).toBe(3)
    expect(checkpointOf(save, 'ancien', ROOMS)).toBe(ROOMS - 1) // un lieu qui a perdu des salles : la dernière
    expect(checkpointOf(save, 'bizarre', ROOMS)).toBe(0)
    expect(checkpointOf(save, 'tour_fractions', 0)).toBe(0)
  })
})

describe('La reprise d’un lieu : poser et effacer un point', () => {
  it('une salle atteinte devient le point de reprise, sans toucher la partie d’avant', () => {
    const before = fresh()
    const after = withCheckpoint(before, 'tour_fractions', 2, ROOMS)
    expect(after.checkpoints).toEqual({ tour_fractions: 2 })
    expect(before.checkpoints).toEqual({}) // jamais modifiée sur place
    expect(after.xp).toBe(before.xp)
  })

  it('jamais en arrière, jamais 0, jamais après la dernière salle ; rien ne change : la même partie', () => {
    let save = withCheckpoint(fresh(), 'tour_fractions', 3, ROOMS)
    expect(withCheckpoint(save, 'tour_fractions', 2, ROOMS)).toBe(save)
    expect(withCheckpoint(save, 'tour_fractions', 3, ROOMS)).toBe(save)
    expect(withCheckpoint(save, 'tour_fractions', 0, ROOMS)).toBe(save)
    expect(withCheckpoint(save, 'tour_fractions', -4, ROOMS)).toBe(save)
    save = withCheckpoint(save, 'tour_fractions', 99, ROOMS)
    expect(save.checkpoints.tour_fractions).toBe(ROOMS - 1)
    expect(withCheckpoint(fresh(), 'x', 1, 1)).toEqual(fresh()) // un lieu d'une seule salle : rien à reprendre
  })

  it('chaque lieu a son point', () => {
    let save = withCheckpoint(fresh(), 'tour_fractions', 2, ROOMS)
    save = withCheckpoint(save, 'forge_algebre', 4, ROOMS)
    expect(save.checkpoints).toEqual({ tour_fractions: 2, forge_algebre: 4 })
    const less = withoutCheckpoint(save, 'tour_fractions')
    expect(less.checkpoints).toEqual({ forge_algebre: 4 })
    expect(save.checkpoints.tour_fractions).toBe(2) // jamais modifiée sur place
    expect(withoutCheckpoint(less, 'tour_fractions')).toBe(less)
  })

  it('terminer le lieu (le coffre) efface son point : il se rejoue depuis l’entrée, les autres restent', () => {
    let save = withCheckpoint(fresh(), 'tour_fractions', 5, ROOMS)
    save = withCheckpoint(save, 'forge_algebre', 3, ROOMS)
    const done = completePlace(save, { code: 'tour_fractions', chest_xp: 100 }, () => 0.5)
    expect(done.save.checkpoints).toEqual({ forge_algebre: 3 })
    expect(done.save.places.tour_fractions).toBe(1)
    expect(save.checkpoints.tour_fractions).toBe(5)
    // Terminer un lieu sans reprise ne change rien aux autres.
    expect(completePlace(done.save, { code: 'atelier_balances', chest_xp: 0 }, () => 0.5).save.checkpoints).toEqual({ forge_algebre: 3 })
  })
})

describe('La reprise d’un lieu : les mots', () => {
  it('« Tu reprendras à l’étage N. » au seuil, rien quand on entre par la porte', () => {
    expect(resumeText(0)).toBe('')
    expect(resumeText(2)).toBe("Tu reprendras à l'étage 3.")
    expect(resumeText(5)).toBe("Tu reprendras à l'étage 6.")
  })

  it('le bandeau d’entrée nomme la salle de chaque lieu, des 30 lieux', () => {
    for (const place of DUNGEONS) {
      const titles = place.rooms.map((r) => r.title)
      expect(resumeBanner(0, titles), place.code).toBe('')
      for (let room = 1; room < titles.length; room += 1) {
        const banner = resumeBanner(room, titles)
        expect(banner, `${place.code} salle ${room}`).toBe(`Reprise : ${titles[room]}`)
        expect(titles[room], `${place.code} salle ${room}`).toBeTruthy()
      }
      expect(resumeBanner(titles.length + 3, titles)).toBe('') // une salle qui n'existe plus : pas de bandeau
    }
  })
})
