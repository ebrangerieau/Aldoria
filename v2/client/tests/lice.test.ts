import { describe, expect, it } from 'vitest'
import ile from '@content/monde/ile.json'
import { type IslandLayout, SEA_LEVEL, Terrain } from '../src/core/world/terrain'
import { cellKey, reachableOnFoot } from './walk'
import {
  finishRound, finishText, generatorFor, introText, isOver, roundGain, roundLabel, ROUNDS, sessionParams, START, statusLine, successText,
} from '../src/core/lice'

describe('Les générateurs de la Lice', () => {
  it('le pont n’existe que pour la 6e ; le tir a un générateur par classe', () => {
    expect(generatorFor('pont', '6e')).toBe('6e.fractions.pont')
    expect(generatorFor('pont', '2nde')).toBeNull()
    expect(generatorFor('tir', '6e')).toBe('6e.angles.tir')
    expect(generatorFor('tir', '2nde')).toBe('2nde.droites.tir')
    expect(generatorFor('tir', '5e')).toBeNull()
  })

  it('le serveur compose deux cibles d’avance ; rien à demander pour une classe sans ce jeu', () => {
    expect(sessionParams('pont', '6e')).toEqual({ enigma: { generator: '6e.fractions.pont', count: ROUNDS + 2 } })
    expect(sessionParams('tir', '2nde')).toEqual({ enigma: { generator: '2nde.droites.tir', count: 8 } })
    expect(sessionParams('pont', '2nde')).toBeNull()
  })
})

describe('Une série de six', () => {
  it('XP : 15 plus 10 par cran de difficulté, moitié moins (arrondi au-dessus) après un premier essai raté', () => {
    expect(roundGain(1, 1)).toBe(25)
    expect(roundGain(5, 1)).toBe(65)
    expect(roundGain(1, 2)).toBe(13) // 25 / 2 arrondi au-dessus
    expect(roundGain(3, 5)).toBe(23)
  })

  it('compte les cibles réussies du premier coup, l’XP gagnée, et se termine à la sixième', () => {
    let state = START
    const tries = [1, 2, 1, 1, 3, 1]
    for (const [i, n] of tries.entries()) {
      expect(isOver(state)).toBe(false)
      const done = finishRound(state, 2, n)
      expect(done.gain).toBe(roundGain(2, n))
      state = done.state
      expect(state.round).toBe(i + 1)
    }
    expect(isOver(state)).toBe(true)
    expect(state.firstTry).toBe(4)
    expect(state.xp).toBe(4 * 35 + 2 * 18)
    expect(START).toEqual({ round: 0, firstTry: 0, xp: 0 }) // l'état de départ n'a pas bougé
  })

  it('les textes : « Ravin 2 / 6 · 1 du premier coup », jamais « 7 / 6 »', () => {
    const one = finishRound(START, 1, 1).state
    expect(roundLabel('pont', one)).toBe('Ravin 2 / 6')
    expect(statusLine('tir', one)).toBe('Cible 2 / 6 · 1 du premier coup')
    expect(roundLabel('pont', { round: ROUNDS, firstTry: 6, xp: 0 })).toBe('Ravin 6 / 6')
  })

  it('la réussite ajoute l’explication seulement après plusieurs essais', () => {
    expect(successText('pont', 25, 1, 'parce que')).toBe('Le pont tient ! +25 XP.')
    expect(successText('pont', 13, 2, 'parce que')).toBe('Le pont tient ! +13 XP. parce que')
    expect(successText('tir', 25, 3, '')).toBe('En plein cœur ! +25 XP.')
  })

  it('le bilan dit combien du premier coup et l’XP', () => {
    expect(finishText('pont', { round: 6, firstTry: 4, xp: 190 })).toBe('Ravins franchis du premier coup : 4. +190 XP.')
    expect(finishText('tir', { round: 6, firstTry: 5, xp: 200 })).toBe('Cibles touchées du premier coup : 5. +200 XP.')
  })

  it('l’introduction du tir dépend de la classe (rapporteur en 6e, droite de l’arbalète en 2nde)', () => {
    expect(introText('tir', '6e')).toContain('rapporteur')
    expect(introText('tir', '2nde')).toContain('coefficient directeur')
    expect(introText('pont', '6e')).toContain('ni plus court, ni plus long')
  })
})

describe('Le pont et le stand de tir dans l’île', () => {
  const layout = ile as unknown as IslandLayout
  const terrain = new Terrain(layout)
  const { x, z } = layout.pont

  it('il se tient sur le plateau de la Citadelle : sur la terre ferme, à plat, atteignable à pied', () => {
    expect(terrain.heightAt(x, z)).toBeGreaterThan(SEA_LEVEL + 0.5)
    const around = [[x - 4, z], [x + 4, z], [x, z + 4], [x, z - 4]].map(([px, pz]) => terrain.heightAt(px!, pz!))
    for (const h of around) expect(Math.abs(h - terrain.heightAt(x, z)), 'le sol est plat sous la passerelle').toBeLessThan(0.3)
    expect(reachableOnFoot(layout, terrain).has(cellKey(x, z))).toBe(true)
  })

  it('il est loin du château, de la Table des Reliques, de la Pierre du Jour et de Maître Ysaline (rien ne se chevauche)', () => {
    const far = (other: { x: number; z: number }, min: number) => Math.hypot(x - other.x, z - other.z) >= min
    expect(far(layout.citadelle, 20)).toBe(true)
    expect(far(layout.table_reliques, 10)).toBe(true)
    expect(far(layout.pierre_jour, 10)).toBe(true)
    expect(far(layout.ysaline, 10)).toBe(true)
    expect(far(layout.depart, 10)).toBe(true)
  })

  it('le stand de tir se tient lui aussi sur le plateau : à plat (comptoir et cible), atteignable à pied, loin de tout le reste', () => {
    const { x: sx, z: sz } = layout.stand_tir
    expect(terrain.heightAt(sx, sz)).toBeGreaterThan(SEA_LEVEL + 0.5)
    // Le comptoir (z) et la cible (7 m au nord) sont sur le même replat.
    for (const [px, pz] of [[sx, sz], [sx - 2, sz], [sx + 2, sz], [sx, sz - 3], [sx, sz + 7]]) {
      expect(Math.abs(terrain.heightAt(px!, pz!) - terrain.heightAt(sx, sz)), `sol plat en (${px}, ${pz})`).toBeLessThan(0.3)
    }
    expect(reachableOnFoot(layout, terrain).has(cellKey(sx, sz - 1.8))).toBe(true)
    const far = (other: { x: number; z: number }, min: number) => Math.hypot(sx - other.x, sz - other.z) >= min
    expect(far(layout.citadelle, 20)).toBe(true)
    expect(far(layout.pont, 40)).toBe(true)
    expect(far(layout.table_reliques, 10)).toBe(true)
    expect(far(layout.pierre_jour, 10)).toBe(true)
    expect(far(layout.ysaline, 10)).toBe(true)
    expect(far(layout.depart, 10)).toBe(true)
  })
})
