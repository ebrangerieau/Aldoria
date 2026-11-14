import { describe, expect, it } from 'vitest'
import ile from '@content/monde/ile.json'
import { completePlace, chestMessage } from '../src/core/quest/chest'
import {
  applyHint, CELLS, describeCell, chestRelic, claimTable, clashes, dailySeed, ELEMENTS, grantRelic, hint, holesOf, ISLAND_RELICS, isSolved, knownSquare,
  lift, makePuzzle, MAX_HOLES, MIN_RELICS, normalizeRelics, place, placesDone, type Board, type Puzzle, randomSquare, RELICS, relicOf, seeded, share,
  tableReward, tray,
} from '../src/core/relics'
import { EMPTY_SAVE, normalizeSave, type SaveData } from '../src/core/save'
import { MAX_CLIMB, MAX_WATER_DEPTH } from '../src/core/world/movement'
import { placesFor } from '../src/core/world/places'
import { type IslandLayout, SEA_LEVEL, Terrain } from '../src/core/world/terrain'

const ALL = RELICS.map((r) => r.id)
const fresh = (over: Partial<SaveData> = {}): SaveData => ({ ...structuredClone(EMPTY_SAVE), ...over })

/** Toutes les rangées et toutes les colonnes du carré ont quatre éléments et quatre rangs différents. */
function expectGraecoLatin(square: readonly (string | null)[]): void {
  expect(square).toHaveLength(CELLS)
  expect(new Set(square).size).toBe(CELLS)
  expect(clashes(square)).toEqual([])
  expect(isSolved(square)).toBe(true)
}

describe('Les seize sceaux', () => {
  it('sont un par couple d’un élément et d’un rang, avec un nom et une forme chacun', () => {
    expect(RELICS).toHaveLength(16)
    expect(new Set(RELICS.map((r) => r.id)).size).toBe(16)
    for (const element of ELEMENTS) expect(RELICS.filter((r) => r.element === element.id).map((r) => r.rank).sort()).toEqual([1, 2, 3, 4])
    expect(new Set(ELEMENTS.map((e) => e.forme)).size).toBe(4) // la forme distingue les éléments sans les couleurs
    expect(new Set(ELEMENTS.map((e) => e.couleur)).size).toBe(4)
    expect(relicOf('flamme-1')!.name).toBe('Sceau de Flamme I')
    expect(relicOf('onde-4')!.name).toBe("Sceau d'Onde IV")
    expect(relicOf('etoile-3')!.name).toBe("Sceau d'Étoile III")
    expect(relicOf('inconnue')).toBeNull()
  })

  it('huit dans l’île, huit dans les coffres, un tour de coffre par relique', () => {
    expect(RELICS.filter((r) => r.source.type === 'ile')).toHaveLength(8)
    const tours = RELICS.flatMap((r) => (r.source.type === 'lieu' ? [r.source.apres] : []))
    expect(tours).toHaveLength(8)
    expect(new Set(tours).size).toBe(8)
    expect(Math.min(...tours)).toBe(1) // le tout premier coffre rend déjà une relique
    // Un enfant d’une seule classe termine 15 lieux au plus : tous les tours arrivent.
    expect(Math.max(...tours)).toBeLessThanOrEqual(15)
  })

  it('deux reliques se répondent quand elles partagent un élément ou un rang', () => {
    expect(share('flamme-1', 'flamme-3')).toBe(true)
    expect(share('flamme-1', 'onde-1')).toBe(true)
    expect(share('flamme-1', 'onde-2')).toBe(false)
    expect(share('flamme-1', 'inconnue')).toBe(false)
  })
})

describe('Les reliques de l’île', () => {
  const layout = ile as unknown as IslandLayout
  const terrain = new Terrain(layout)

  /** Les cases de 2 m atteignables à pied depuis le départ, avec la règle de pente et d’eau du déplacement (movement.ts). */
  function reachable(): Set<string> {
    const CELL = 2
    const key = (i: number, j: number): string => `${i},${j}`
    const seen = new Set<string>([key(Math.round(layout.depart.x / CELL), Math.round(layout.depart.z / CELL))])
    const queue: [number, number][] = [[Math.round(layout.depart.x / CELL), Math.round(layout.depart.z / CELL)]]
    while (queue.length > 0) {
      const [i, j] = queue.pop()!
      const h0 = terrain.heightAt(i * CELL, j * CELL)
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        const ni = i + di
        const nj = j + dj
        if (Math.abs(ni * CELL) > 300 || Math.abs(nj * CELL) > 300 || seen.has(key(ni, nj))) continue
        const h = terrain.heightAt(ni * CELL, nj * CELL)
        if (h < SEA_LEVEL - MAX_WATER_DEPTH || (h - h0) / (Math.hypot(di, dj) * CELL) > MAX_CLIMB) continue
        seen.add(key(ni, nj))
        queue.push([ni, nj])
      }
    }
    return seen
  }

  it('sont sur la terre ferme, atteignables à pied depuis le départ, à l’écart de tout bâtiment', () => {
    const walkable = reachable()
    const fixed = [layout.citadelle, layout.village, layout.depart, layout.pierre_eveil, layout.pierre_jour, layout.ysaline]
    const places = [...placesFor('6e', terrain), ...placesFor('2nde', terrain)]
    expect(ISLAND_RELICS).toHaveLength(8)
    expect(new Set(ISLAND_RELICS.map((r) => r.source.region)).size).toBe(8) // une par région
    for (const relic of ISLAND_RELICS) {
      const { x, z, region } = relic.source
      expect(layout.regions[region], region).toBeDefined()
      expect(terrain.heightAt(x, z), `${relic.id} sur l’eau`).toBeGreaterThan(SEA_LEVEL + 2)
      expect(walkable.has(`${x / 2},${z / 2}`), `${relic.id} inatteignable à pied`).toBe(true)
      for (const other of [...fixed, ...places]) expect(Math.hypot(other.x - x, other.z - z), `${relic.id} trop près`).toBeGreaterThan(12)
    }
  })

  it('la Table des Reliques est sur le plateau de la Citadelle : à plat, atteignable à pied, à l’écart de tout', () => {
    const table = layout.table_reliques
    expect(terrain.heightAt(table.x, table.z)).toBeGreaterThan(SEA_LEVEL + 2)
    expect(terrain.slopeAt(table.x, table.z)).toBeLessThan(0.05)
    expect(reachable().has(`${table.x / 2},${table.z / 2}`)).toBe(true)
    for (const other of [layout.depart, layout.pierre_eveil, layout.pierre_jour, layout.ysaline, ...placesFor('6e', terrain), ...placesFor('2nde', terrain)]) {
      expect(Math.hypot(other.x - table.x, other.z - table.z)).toBeGreaterThan(14)
    }
    expect(Math.hypot(layout.citadelle.x - table.x, layout.citadelle.z - table.z)).toBeGreaterThan(18) // pas dans le bâtiment
  })

  it('sont toutes distinctes les unes des autres', () => {
    for (const a of ISLAND_RELICS) {
      for (const b of ISLAND_RELICS) {
        if (a !== b) expect(Math.hypot(a.source.x - b.source.x, a.source.z - b.source.z)).toBeGreaterThan(30)
      }
    }
  })
})

describe('Les reliques d’une partie', () => {
  it('ne gardent que de vrais sceaux, une fois chacun, dans l’ordre où on les a trouvés', () => {
    expect(normalizeRelics(['onde-2', 'x', 'onde-2', 3, 'flamme-1', null])).toEqual(['onde-2', 'flamme-1'])
    expect(normalizeRelics('flamme-1')).toEqual([])
    expect(normalizeRelics(undefined)).toEqual([])
  })

  it('une ancienne partie, sans reliques ni table, se relit avec les valeurs par défaut', () => {
    const old = normalizeSave({ xp: 120, places: { tour_fractions: 1 } })
    expect(old.relics).toEqual([])
    expect(old.table).toBe('')
    expect(normalizeSave({ relics: ['flamme-1', 'zzz'], table: '2026-11-14' })).toMatchObject({ relics: ['flamme-1'], table: '2026-11-14' })
    expect(normalizeSave({ table: 5 as unknown as string }).table).toBe('')
  })

  it('une relique ne se gagne jamais deux fois, et la partie n’est pas modifiée sur place', () => {
    const save = fresh()
    const once = grantRelic(save, 'flamme-1')
    expect(save.relics).toEqual([])
    expect(once.relics).toEqual(['flamme-1'])
    expect(grantRelic(once, 'flamme-1')).toBe(once)
    expect(grantRelic(once, 'inconnue')).toBe(once)
  })
})

describe('Le coffre d’un lieu', () => {
  const def = { code: 'tour_fractions', chest_xp: 100 }

  it('rend la première relique de coffre au premier lieu terminé, puis la suivante au lieu d’après', () => {
    const first = completePlace(fresh(), def, () => 0)
    expect(first.first).toBe(true)
    expect(first.relic?.id).toBe('flamme-2')
    expect(first.save.relics).toEqual(['flamme-2'])
    const second = completePlace(first.save, { code: 'autre', chest_xp: 50 }, () => 0)
    expect(second.relic?.id).toBe('onde-2')
    expect(second.save.relics).toEqual(['flamme-2', 'onde-2'])
  })

  it('n’en rend pas en rejouant un lieu, et ne la rend pas deux fois', () => {
    const first = completePlace(fresh(), def, () => 0)
    const again = completePlace(first.save, def, () => 0)
    expect(again.first).toBe(false)
    expect(again.relic).toBeNull()
    expect(again.save.relics).toEqual(['flamme-2'])
  })

  it('rattrape une ancienne partie : un coffre après l’autre, sans rien perdre', () => {
    // 5 lieux déjà terminés, aucune relique : les tours 1 à 4 sont en retard, puis le 6e arrive.
    const places = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((c) => [c, 1]))
    const got: string[] = []
    let save = fresh({ places })
    for (const code of ['f', 'g', 'h', 'i', 'j']) {
      const done = completePlace(save, { code, chest_xp: 10 }, () => 0)
      if (done.relic) got.push(done.relic.id)
      save = done.save
    }
    expect(got).toEqual(['flamme-2', 'onde-2', 'feuille-2', 'etoile-2', 'flamme-4'])
    expect(placesDone(save)).toBe(10)
    expect(chestRelic(save.relics, 99)?.id).toBe('onde-4') // la suite attend son tour
  })

  it('annonce la relique dans le message du coffre', () => {
    const def2 = { title: 'La Tour', page: 'la page des Fractions', page_text: 'Texte.', outro: 'Fin.', chest_xp: 100 }
    const text = chestMessage(def2, { first: true, answered: 5, correct: 4, found: [], relic: relicOf('flamme-2') }).text
    expect(text).toContain('Relique trouvée : Sceau de Flamme II !')
    expect(chestMessage(def2, { first: true, answered: 5, correct: 4, found: [] }).text).not.toContain('Relique')
  })
})

describe('Le carré', () => {
  it('le carré connu est un vrai carré, et chaque graine en donne un autre qui l’est aussi', () => {
    expectGraecoLatin(knownSquare())
    const seen = new Set<string>()
    for (let seed = 1; seed <= 200; seed += 1) {
      const square = randomSquare(seeded(seed))
      expectGraecoLatin(square)
      seen.add(square.join())
    }
    expect(seen.size).toBeGreaterThan(50) // de la variété d’une table à l’autre
  })

  it('les conflits sont les reliques qui en croisent une autre de leur rangée ou de leur colonne', () => {
    const board = Array<string | null>(CELLS).fill(null)
    board[0] = 'flamme-1'
    board[1] = 'onde-1' // même rang, même rangée
    board[5] = 'feuille-3' // rangée et colonne différentes de la case 0
    board[4] = 'flamme-4' // même élément que la case 0, même colonne
    expect(clashes(board)).toEqual([0, 1, 4])
    expect(clashes(Array<string | null>(CELLS).fill(null))).toEqual([])
    expect(isSolved(board)).toBe(false)
  })

  it('une relique qui se répète dans une autre rangée et une autre colonne n’est pas un conflit', () => {
    const board = Array<string | null>(CELLS).fill(null)
    board[0] = 'flamme-1'
    board[5] = 'flamme-2'
    expect(clashes(board)).toEqual([])
  })
})

describe('La table', () => {
  const owned8 = ALL.slice(0, 8)

  it('exige au moins deux reliques', () => {
    expect(makePuzzle([], 1)).toBeNull()
    expect(makePuzzle(['flamme-1'], 1)).toBeNull()
    expect(makePuzzle(['flamme-1', 'flamme-1'], 1)).toBeNull() // un doublon n’en fait pas deux
    expect(makePuzzle(['flamme-1', 'onde-2'], 1)).not.toBeNull()
    expect(MIN_RELICS).toBe(2)
  })

  it('est soluble par construction, pour toutes les graines et tous les nombres de reliques', () => {
    for (let count = MIN_RELICS; count <= ALL.length; count += 1) {
      for (let seed = 1; seed <= 25; seed += 1) {
        const puzzle = makePuzzle(ALL.slice(0, count), seed)!
        expect(puzzle.pool).toHaveLength(Math.min(count, MAX_HOLES))
        expect(holesOf(puzzle)).toHaveLength(puzzle.pool.length)
        // Les reliques à placer sont celles de l’enfant ; toutes les autres sont gravées à leur place.
        for (const id of puzzle.pool) expect(ALL.slice(0, count)).toContain(id)
        puzzle.fixed.forEach((id, cell) => expect(id === null ? puzzle.pool.includes(puzzle.solution[cell]!) : id === puzzle.solution[cell]).toBe(true))
        expectGraecoLatin(puzzle.solution)
        // La solution remplit exactement les cases ouvertes avec les reliques à placer.
        let board = puzzle.fixed
        for (const cell of holesOf(puzzle)) board = place(puzzle, board, cell, puzzle.solution[cell]!)!
        expect(isSolved(board)).toBe(true)
        expect(tray(puzzle, board)).toEqual([])
      }
    }
  })

  it('est la même pour la même graine, une autre pour une autre', () => {
    const a = makePuzzle(owned8, 7)!
    expect(makePuzzle(owned8, 7)).toEqual(a)
    expect(makePuzzle(owned8, 8)).not.toEqual(a)
    expect(dailySeed('2026-11-14')).toBe(dailySeed('2026-11-14'))
    expect(dailySeed('2026-11-14')).not.toBe(dailySeed('2026-11-15'))
  })

  it('refuse de poser une relique qui n’est pas à soi ou sur une case gravée, et la déplace si elle est déjà posée', () => {
    const puzzle = makePuzzle(owned8, 3)!
    const [first, second] = holesOf(puzzle) as [number, number]
    const mine = puzzle.pool[0]!
    const foreign = ALL.find((id) => !puzzle.pool.includes(id))!
    const gravee = puzzle.fixed.findIndex((id) => id !== null)
    expect(place(puzzle, puzzle.fixed, first, foreign)).toBeNull()
    expect(place(puzzle, puzzle.fixed, gravee, mine)).toBeNull()
    expect(place(puzzle, puzzle.fixed, -1, mine)).toBeNull()
    expect(place(puzzle, puzzle.fixed, CELLS, mine)).toBeNull()
    const placed = place(puzzle, puzzle.fixed, first, mine)!
    expect(placed[first]).toBe(mine)
    expect(puzzle.fixed[first]).toBeNull() // la table de départ n’a pas bougé
    const moved = place(puzzle, placed, second, mine)!
    expect(moved[second]).toBe(mine)
    expect(moved[first]).toBeNull() // une relique ne tient pas deux cases
    expect(tray(puzzle, moved)).not.toContain(mine)
    expect(tray(puzzle, puzzle.fixed)).toEqual([...puzzle.pool])
    expect(lift(puzzle, moved, second)[second]).toBeNull()
    expect(lift(puzzle, moved, gravee)).toBe(moved)
    expect(lift(puzzle, moved, first)).toBe(moved)
  })

  /** Toutes les solutions d'une table, par retour sur trace sur ses cases ouvertes. */
  function solutionsOf(puzzle: Puzzle): Board[] {
    const cells = holesOf(puzzle)
    const out: Board[] = []
    const walk = (index: number, board: Board): void => {
      if (index === cells.length) {
        if (isSolved(board)) out.push(board)
        return
      }
      for (const id of puzzle.pool) {
        const next = place(puzzle, board, cells[index]!, id)
        if (next && clashes(next).length === 0) walk(index + 1, next)
      }
    }
    walk(0, puzzle.fixed)
    return out
  }

  it('a une seule solution jusqu’à huit cases ouvertes, et la règle accepte toute solution au-delà', () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      expect(solutionsOf(makePuzzle(ALL, seed, 8)!)).toHaveLength(1)
    }
    // À neuf cases, quelques tables admettent deux solutions : c'est la règle qui juge, pas le carré d'origine.
    let two: Puzzle | null = null
    for (let seed = 1; seed <= 400 && !two; seed += 1) {
      const puzzle = makePuzzle(ALL, seed, 9)!
      if (solutionsOf(puzzle).length > 1) two = puzzle
    }
    expect(two, 'aucune table à deux solutions trouvée en 400 graines').not.toBeNull()
    for (const board of solutionsOf(two!)) expect(isSolved(board)).toBe(true)
  })

  it('décrit chaque case pour un lecteur d’écran : sa place, sa relique, gravée ou libre', () => {
    const puzzle = makePuzzle(owned8, 9)!
    const hole = holesOf(puzzle)[0]!
    const engraved = puzzle.fixed.findIndex((id) => id !== null)
    expect(describeCell(puzzle, puzzle.fixed, hole)).toBe(`Rangée ${Math.floor(hole / 4) + 1}, colonne ${(hole % 4) + 1} : case libre.`)
    const mine = puzzle.pool[0]!
    expect(describeCell(puzzle, place(puzzle, puzzle.fixed, hole, mine)!, hole)).toContain(relicOf(mine)!.name)
    expect(describeCell(puzzle, puzzle.fixed, engraved)).toMatch(/gravé dans la pierre\.$/)
    expect(describeCell(puzzle, puzzle.fixed, engraved)).toContain(relicOf(puzzle.fixed[engraved]!)!.name)
  })

  it('l’indice met la bonne relique à la bonne case, et mène à la solution en autant d’indices que de cases', () => {
    const puzzle = makePuzzle(owned8, 11)!
    let board = puzzle.fixed
    // Une erreur d’abord : l’indice la corrige aussi.
    const [a, b] = holesOf(puzzle) as [number, number]
    board = place(puzzle, board, a, puzzle.solution[b]!)!
    let used = 0
    for (let guard = 0; guard < 30 && !isSolved(board); guard += 1) {
      const given = hint(puzzle, board)!
      expect(given.id).toBe(puzzle.solution[given.cell])
      board = applyHint(puzzle, board)!
      expect(board[given.cell]).toBe(given.id)
      used += 1
    }
    expect(isSolved(board)).toBe(true)
    expect(used).toBeLessThanOrEqual(puzzle.pool.length + 1)
    expect(hint(puzzle, board)).toBeNull()
    expect(applyHint(puzzle, board)).toBeNull()
  })
})

describe('La récompense du jour', () => {
  const owned = ALL.slice(0, 8)

  it('de l’XP par case ouverte, et un objet du sac à partir de cinq cases', () => {
    expect(tableReward(makePuzzle(['flamme-1', 'onde-2'], 1)!)).toEqual({ xp: 16, items: 0 })
    expect(tableReward(makePuzzle(owned, 1)!)).toEqual({ xp: 64, items: 1 })
    expect(tableReward(makePuzzle(ALL, 1)!)).toEqual({ xp: 72, items: 1 }) // plafonné à neuf cases
  })

  it('le premier carré du jour rapporte, les suivants du même jour sont de l’entraînement', () => {
    const puzzle = makePuzzle(owned, 5)!
    const save = fresh({ xp: 10, relics: owned })
    const claim = claimTable(save, puzzle, '2026-11-14', () => 0)!
    expect(claim.xp).toBe(64)
    expect(claim.found).toHaveLength(1)
    expect(claim.save.xp).toBe(74)
    expect(claim.save.table).toBe('2026-11-14')
    expect(save.xp).toBe(10) // pas modifiée sur place
    expect(save.table).toBe('')
    expect(claimTable(claim.save, puzzle, '2026-11-14')).toBeNull()
    expect(claimTable(claim.save, puzzle, '2026-11-15', () => 0)).not.toBeNull() // demain, elle rapporte de nouveau
  })

  it('sans objet à gagner (petite table), seulement de l’XP', () => {
    const puzzle = makePuzzle(['flamme-1', 'onde-2'], 5)!
    const claim = claimTable(fresh(), puzzle, '2026-11-14', () => 0)!
    expect(claim.found).toEqual([])
    expect(claim.save.items).toEqual({})
    expect(claim.save.xp).toBe(16)
  })
})
