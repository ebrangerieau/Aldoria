import { describe, expect, it } from 'vitest'
import type { Item } from '../src/core/items'
import {
  article, attempt, BALANCE_ROUNDS, boxesBothSides, canRemoveBoth, describe as describeSides, instruction, isBalanceItem, massOf, MAX_GUESS, removeFromBoth,
  removeLabel, roundXp, spoken, startRound, stepGuess, useHint, weigh,
} from '../src/core/balanceEnigma'
import {
  ARM, boxSpots, BOX, elasticOut, HANG, marbleSpots, MARBLE_R, MAX_TILT, PIVOT_H, PLATE_R, platePositions, plateLabel, sineInOut, tiltAt, tiltFor,
} from '../src/core/balanceRig'
import {
  BALANCE_AT, BALANCE_DISTANCE, BALANCE_REARM, BALANCE_SPOT, CLIMB_RISE, Dungeon, type DungeonDecor, ROOM_W, VOID_HEIGHT,
} from '../src/core/world/dungeon'
import { DUNGEONS } from '../src/core/world/places'
import { PACK_6E } from './support'

/** De vraies questions de balance, tirées du générateur de l'API (paquet de test). */
const BALANCES = PACK_6E.items.filter((i) => i.generator === '6e.prealgebre.balance')
const mass = (item: Item): number => Number((item.answer as { value: string }).value)

describe('La balance géante : une manche', () => {
  it('le paquet de test a de vraies balances (boîtes ou sacs, billes ou pièces)', () => {
    expect(BALANCES.length).toBeGreaterThan(3)
    for (const item of BALANCES) expect(isBalanceItem(item), item.id).toBe(true)
  })

  it('une question sans visuel de balance ne se joue pas sur la balance', () => {
    expect(isBalanceItem({ visual: null })).toBe(false)
    expect(isBalanceItem({})).toBe(false)
    expect(isBalanceItem({ visual: { kind: 'balance' } })).toBe(false) // pas de plateaux
    expect(isBalanceItem({ visual: { kind: 'grid', left: {}, right: {} } })).toBe(false)
  })

  it('la balance de départ est en équilibre avec la vraie masse, et le reste après tout retrait des deux côtés', () => {
    for (const item of BALANCES) {
      const x = mass(item)
      let round = startRound(item.visual)
      expect(weigh(round.state, x), item.id).toBe(0)
      for (const what of ['units', 'boxes'] as const) {
        while (canRemoveBoth(round, what)) {
          round = removeFromBoth(round, what)
          expect(weigh(round.state, x), `${item.id} après avoir enlevé des ${what}`).toBe(0)
        }
      }
      // Rien de plus à enlever : « enlever » ne fait plus rien.
      expect(removeFromBoth(round, 'boxes')).toBe(round)
      expect(removeFromBoth(round, 'units')).toBe(round)
    }
  })

  it('enlever la même chose des deux côtés redresse le fléau et efface l’essai montré', () => {
    const item = BALANCES.find((i) => (i.visual as { left: { units: number } }).left.units > 0 && (i.visual as { right: { units: number } }).right.units > 0)!
    let round = startRound(item.visual)
    round = { ...round, heavier: 1, shown: 4, tries: 2 }
    const next = removeFromBoth(round, 'units')
    expect(next.heavier).toBe(0)
    expect(next.shown).toBeNull()
    expect(next.tries).toBe(2) // les essais déjà faits restent comptés
    expect(next.state.left.units).toBe(round.state.left.units - 1)
    expect(next.state.right.units).toBe(round.state.right.units - 1)
    expect(round.state.left.units).toBeGreaterThan(next.state.left.units) // jamais modifié sur place
  })

  it('« enlever une boîte de chaque côté » ne sert que s’il y en a des deux côtés', () => {
    for (const item of BALANCES) {
      const v = item.visual as { right: { boxes: number } }
      expect(boxesBothSides(startRound(item.visual)), item.id).toBe(v.right.boxes > 0)
    }
  })

  it('la masse proposée reste de 0 à 40, et une manche finie ne bouge plus', () => {
    let round = startRound(BALANCES[0]!.visual)
    expect(round.guess).toBe(1)
    expect(stepGuess(round, -5).guess).toBe(0)
    expect(stepGuess(round, 100).guess).toBe(MAX_GUESS)
    round = stepGuess(round, 3)
    expect(round.guess).toBe(4)
    const done = { ...round, done: true }
    expect(stepGuess(done, 1)).toBe(done)
    expect(removeFromBoth(done, 'units')).toBe(done)
  })

  it('le bon essai met la balance en équilibre : manche gagnée, premier essai reconnu', () => {
    for (const item of BALANCES) {
      const round = { ...startRound(item.visual), guess: mass(item) }
      const result = attempt(round, item)
      expect(result.balanced, item.id).toBe(true)
      expect(result.first).toBe(true)
      expect(result.round.done).toBe(true)
      expect(result.round.tries).toBe(1)
      expect(result.heavier).toBe(0)
      expect(result.tone).toBe('good')
      expect(result.message).toMatch(/^En équilibre !/)
      expect(result.message).not.toContain(item.explanation) // du premier coup : pas d'explication
    }
  })

  it('un essai à côté penche du bon côté et dit le sens de la correction, sans donner la réponse', () => {
    for (const item of BALANCES) {
      const x = mass(item)
      const start = startRound(item.visual)
      // Trop peu : la balance penche du côté des boîtes (le plus de boîtes, donc le plus léger) à tort…
      const low = attempt({ ...start, guess: x - 1 }, item)
      const high = attempt({ ...start, guess: x + 1 }, item)
      expect(low.balanced || high.balanced, item.id).toBe(false)
      expect(low.round.tries).toBe(1)
      expect(low.message).toContain('Essaie plus')
      expect(low.message).toMatch(/trop (légère|léger)/)
      expect(high.message).toContain('Essaie moins')
      expect(high.message).toMatch(/trop (lourde|lourd)/)
      // La balance penche du côté qui a le plus de boîtes quand la masse est trop grande, de l'autre quand elle est trop petite.
      expect(high.heavier).toBe(-low.heavier)
      // La réponse n'est jamais écrite : seulement la masse essayée.
      expect(low.message).not.toContain(`${x} ${start.names.unit[1]}`)
      expect(low.round.shown).toBe(x - 1)
      expect(low.round.done).toBe(false)
      expect(low.tone).toBe('bad')
    }
  })

  it('l’indice sort au troisième essai (une seule fois), l’explication seulement après une correction', () => {
    const item = BALANCES[0]!
    const x = mass(item)
    let round = startRound(item.visual)
    const messages: string[] = []
    for (let i = 0; i < 3; i += 1) {
      const a = attempt({ ...round, guess: x + 2 }, item)
      messages.push(a.message)
      round = a.round
    }
    expect(messages[0]).not.toContain(item.hint)
    expect(messages[1]).not.toContain(item.hint)
    expect(messages[2]).toContain(item.hint)
    expect(round.tries).toBe(3)
    // Un indice déjà demandé ne se répète pas.
    const asked = useHint({ ...round, tries: 2 })
    expect(attempt({ ...asked, guess: x + 2 }, item).message).not.toContain(item.hint)
    // Trouvé après des essais : l'explication de la question s'ajoute.
    const fixed = attempt({ ...round, guess: x }, item)
    expect(fixed.first).toBe(false)
    expect(fixed.message).toContain(item.explanation)
  })

  it('une masse trouvée du premier coup rapporte toute l’XP, la moitié (arrondie au-dessus) après correction', () => {
    expect(roundXp(40, true)).toBe(40)
    expect(roundXp(40, false)).toBe(20)
    expect(roundXp(45, false)).toBe(23)
    expect(BALANCE_ROUNDS).toBe(3)
  })
})

describe('La balance géante : les mots', () => {
  it('le genre suit le mot : une boîte, un sac', () => {
    const boite = startRound({ kind: 'balance', left: { boxes: 1, units: 0 }, right: { boxes: 0, units: 4 } })
    const sac = startRound({ kind: 'balance', left: { boxes: 1, units: 0 }, right: { boxes: 0, units: 4 }, box: ['sac', 'sacs'], unit: ['pièce', 'pièces'] })
    expect(article(boite.names)).toBe('Une')
    expect(article(sac.names)).toBe('Un')
    expect(instruction(boite.names)).toBe('Au départ, la balance est en équilibre. Toutes les boîtes ont la même masse. Combien de billes pèse une boîte ?')
    expect(instruction(sac.names)).toBe('Au départ, la balance est en équilibre. Tous les sacs ont la même masse. Combien de pièces pèse un sac ?')
    const high = attempt({ ...sac, guess: 9 }, { hint: '', explanation: '' })
    expect(high.message).toMatch(/le sac est trop (lourd|léger)\./)
    expect(attempt({ ...boite, guess: 9 }, { hint: '', explanation: '' }).message).toMatch(/la boîte est trop (lourde|légère)\./)
  })

  it('la phrase lue décrit les plateaux puis pose la question ; les boutons disent ce qu’ils enlèvent', () => {
    const round = startRound({ kind: 'balance', left: { boxes: 2, units: 3 }, right: { boxes: 1, units: 7 } })
    expect(describeSides(round.state, round.names)).toBe('À gauche : 2 boîtes et 3 billes. À droite : 1 boîte et 7 billes.')
    expect(spoken(round)).toBe('À gauche : 2 boîtes et 3 billes. À droite : 1 boîte et 7 billes. Combien de billes pèse une boîte ?')
    expect(removeLabel(round, 'units')).toBe('Enlever 1 bille de chaque côté')
    expect(removeLabel(round, 'boxes')).toBe('Enlever 1 boîte de chaque côté')
    expect(massOf(round.state.left, 5)).toBe(13)
    expect(massOf(round.state.right, 5)).toBe(12)
  })
})

describe('La balance géante : la géométrie', () => {
  it('le fléau penche du côté le plus lourd : ce plateau descend, l’autre monte', () => {
    expect(tiltFor(-1)).toBe(MAX_TILT)
    expect(tiltFor(1)).toBe(-MAX_TILT)
    expect(Math.abs(tiltFor(0))).toBe(0)
    const left = platePositions(tiltFor(-1))
    expect(left.left.y).toBeLessThan(left.right.y)
    const right = platePositions(tiltFor(1))
    expect(right.right.y).toBeLessThan(right.left.y)
    const flat = platePositions(0)
    expect(flat.left.y).toBeCloseTo(PIVOT_H - HANG)
    expect(flat.left.y).toBeCloseTo(flat.right.y)
    expect(flat.left.x).toBeCloseTo(-ARM)
    expect(flat.right.x).toBeCloseTo(ARM)
    expect(flat.leftChain.y).toBeCloseTo(PIVOT_H - HANG / 2)
    // Le plateau pend sous le bout du fléau : jamais plus bas que le sol.
    expect(left.left.y).toBeGreaterThan(0.5)
  })

  it('les boîtes tiennent sur le plateau, sans se chevaucher', () => {
    for (let n = 0; n <= 12; n += 1) {
      const spots = boxSpots(n)
      expect(spots).toHaveLength(n)
      for (const s of spots) expect(Math.hypot(s.x, s.z) + BOX / 2, `${n} boîtes`).toBeLessThanOrEqual(PLATE_R + 0.2)
      for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
          const a = spots[i]!
          const b = spots[j]!
          expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z)), `${n} boîtes`).toBeGreaterThanOrEqual(BOX - 1e-6)
        }
      }
    }
  })

  it('les billes tiennent sur le plateau, sans se chevaucher et sous l’étiquette, même pour les plus gros plateaux du générateur', () => {
    const biggest = Math.max(...BALANCES.flatMap((i) => [(i.visual as { left: { units: number } }).left.units, (i.visual as { right: { units: number } }).right.units]))
    for (const count of [0, 1, 7, 40, biggest, 100, 130]) {
      for (const withBoxes of [true, false]) {
        const spots = marbleSpots(count, withBoxes)
        expect(spots, `${count} billes`).toHaveLength(count)
        for (const s of spots) {
          expect(Math.hypot(s.x, s.z)).toBeLessThanOrEqual(PLATE_R - MARBLE_R + 1e-6)
          expect(s.y).toBeLessThan(0.78) // l'étiquette flotte au-dessus
          if (withBoxes) expect(s.z).toBeGreaterThanOrEqual(0.25 - 1e-6) // devant les boîtes
        }
        for (let i = 0; i < spots.length; i += 1) {
          for (let j = i + 1; j < Math.min(spots.length, i + 80); j += 1) {
            const a = spots[i]!
            const b = spots[j]!
            expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeGreaterThan(MARBLE_R * 1.2)
          }
        }
      }
    }
  })

  it('l’étiquette d’un plateau dit son contenu', () => {
    const box = ['boîte', 'boîtes'] as const
    const unit = ['bille', 'billes'] as const
    expect(plateLabel({ boxes: 1, units: 4 }, box, unit)).toBe('1 boîte + 4 billes')
    expect(plateLabel({ boxes: 3, units: 0 }, box, unit)).toBe('3 boîtes')
    expect(plateLabel({ boxes: 0, units: 1 }, box, unit)).toBe('1 bille')
    expect(plateLabel({ boxes: 0, units: 0 }, box, unit)).toBe('vide')
  })

  it('le fléau part de sa position, arrive au but, et ne rebondit pas en mode calme', () => {
    for (const calm of [false, true]) {
      expect(tiltAt(0, 12, 0, calm)).toBeCloseTo(0)
      expect(tiltAt(0, 12, 5, calm)).toBeCloseTo(12)
      expect(tiltAt(-12, 0, 5, calm)).toBeCloseTo(0)
    }
    const values = (calm: boolean) => Array.from({ length: 91 }, (_, i) => tiltAt(0, 12, i / 100, calm))
    expect(Math.max(...values(false))).toBeGreaterThan(12) // un rebond avant de se poser
    expect(Math.max(...values(true))).toBeLessThanOrEqual(12 + 1e-9) // en douceur : jamais au-delà du but
    expect(elasticOut(0.5)).toBeGreaterThan(0.9)
    expect(sineInOut(0.5)).toBeCloseTo(0.5)
  })
})

describe('La balance géante : sa place dans la salle-énigme', () => {
  const decorOf = (d: unknown) => (d as { v1_decor: DungeonDecor }).v1_decor
  const tower = DUNGEONS.find((d) => d.enigma.mode === 'balance')!
  const dungeon = new Dungeon(tower.rooms.length, CLIMB_RISE, decorOf(tower))
  const room = tower.rooms.findIndex((r) => r.kind === 'enigme')
  const at = dungeon.balancePoint(room)
  const feet = [-ARM, 0, ARM].map((dx, i) => ({ x: at.x + dx, z: at.z, r: i === 1 ? 0.9 : PLATE_R }))

  it('une seule salle-énigme est une balance : la Tour des Fractions', () => {
    expect(DUNGEONS.filter((d) => d.enigma.mode === 'balance').map((d) => d.code)).toEqual(['tour_fractions'])
    expect(tower.enigma.generator).toBe('6e.prealgebre.balance')
  })

  it('le pied de la balance et ses plateaux sont sur le sol, dans la salle, loin de l’escalier et du décor', () => {
    expect(dungeon.roomAt(at.x)).toBe(room)
    expect(BALANCE_AT).toEqual([7, 5])
    const left = room * ROOM_W
    for (const f of feet) {
      expect(dungeon.heightAt(f.x, f.z)).toBeGreaterThan(VOID_HEIGHT)
      expect(f.x - left - f.r).toBeGreaterThan(0.75) // pas dans le mur ouest
      expect(f.x - left + f.r).toBeLessThan(ROOM_W - 3.9) // hors du pied de l'escalier, contre le mur est
      for (const c of dungeon.obstacles()) expect(Math.hypot(f.x - c.x, f.z - c.z), 'décor').toBeGreaterThan(c.r + f.r - 0.2)
    }
  })

  it('le héros peut l’aborder de tous les côtés praticables, se tient à l’ouest pendant l’énigme, et se réarme plus loin qu’il ne se déclenche', () => {
    expect(BALANCE_REARM).toBeGreaterThan(BALANCE_DISTANCE)
    const spot = dungeon.balanceSpot(room)
    expect(spot.x).toBeCloseTo(at.x + BALANCE_SPOT[0])
    expect(spot.x).toBeLessThan(at.x) // à l'ouest : la caméra du sud voit la balance et le héros
    expect(dungeon.heightAt(spot.x, spot.z)).toBeGreaterThan(VOID_HEIGHT)
    for (const f of feet) expect(Math.hypot(spot.x - f.x, spot.z - f.z)).toBeGreaterThan(f.r + 0.45) // pas dans un plateau
    // Plus loin que la distance de déclenchement : revenir sur ses pas après avoir renoncé ne relance pas la manche tout de suite.
    expect(Math.hypot(spot.x - at.x, spot.z - at.z)).toBeGreaterThan(BALANCE_DISTANCE)
    // On l'atteint depuis la porte : le sol est libre sur l'arc de déclenchement côté porte (ouest) et côté fond.
    const walkable = [Math.PI, Math.PI * 1.25, Math.PI * 0.75, Math.PI / 2].map((a) => ({ x: at.x + Math.cos(a) * (BALANCE_DISTANCE - 0.2), z: at.z + Math.sin(a) * (BALANCE_DISTANCE - 0.2) }))
    for (const p of walkable) expect(dungeon.heightAt(p.x, p.z)).toBeGreaterThan(VOID_HEIGHT)
  })
})
