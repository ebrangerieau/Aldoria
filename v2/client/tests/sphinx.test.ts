import { describe, expect, it } from 'vitest'
import niveaux from '@content/monde/sphinx_niveaux.json'
import { SphinxBoard } from '../src/core/sphinx/board'
import {
  earnPassage, earnsPassage, HOW_TO_EARN, helpSteps, initialSphinx, levelAt, MAX_PASSES, nextPuzzle, normalizeSphinx, PASS_ANSWERS,
  passesText, recordSolved, spendPassage, startTier, takePassageNews, TIER_UP, tierCount, VISIT_PUZZLES,
} from '../src/core/sphinx/island'

const ROWS = ['######', '#@ $.#', '#    #', '######']

describe('SphinxBoard : les règles', () => {
  it('pousse un bloc et résout l’énigme', () => {
    const board = SphinxBoard.fromRows(ROWS)
    expect(board.player).toEqual({ x: 1, y: 1 })
    expect(board.boxes).toEqual([{ x: 3, y: 1 }])
    expect(board.goals).toEqual([{ x: 4, y: 1 }])
    expect(board.isSolved()).toBe(false)
    expect(board.step('r')).toEqual({ moved: true, box: -1 })
    expect(board.step('r')).toEqual({ moved: true, box: 0 }) // le bloc avance avec le héros
    expect(board.isSolved()).toBe(true)
    expect([board.moves, board.pushes]).toEqual([2, 1])
  })

  it('refuse un mur, et un bloc contre un mur', () => {
    const board = SphinxBoard.fromRows(ROWS)
    expect(board.step('l').moved).toBe(false)
    expect(board.step('u').moved).toBe(false)
    board.play('rr') // le bloc est sur la dalle gravée, contre le mur
    expect(board.step('r').moved).toBe(false)
    expect(board.moves).toBe(2)
  })

  it('refuse de pousser un bloc contre un autre bloc', () => {
    const board = SphinxBoard.fromRows(['#######', '#@$$ .#', '#######'])
    expect(board.step('r').moved).toBe(false)
    expect(board.moves).toBe(0)
  })

  it('annule un pas (le bloc recule avec le héros) et recommence', () => {
    const board = SphinxBoard.fromRows(ROWS)
    board.play('rr')
    const back = board.undo()
    expect(back).toEqual({ undone: true, dir: 'r', box: 0 })
    expect(board.boxes[0]).toEqual({ x: 3, y: 1 })
    expect(board.player).toEqual({ x: 2, y: 1 })
    expect([board.moves, board.pushes]).toEqual([1, 0])
    board.play('d')
    board.restart()
    expect(board.player).toEqual({ x: 1, y: 1 })
    expect(board.boxes[0]).toEqual({ x: 3, y: 1 })
    expect(board.canUndo()).toBe(false)
    expect(board.undo()).toEqual({ undone: false, dir: null, box: -1 })
  })

  it('marche jusqu’à une dalle sans pousser, jamais sur un bloc ni dans un mur', () => {
    const board = SphinxBoard.fromRows(ROWS)
    expect(board.pathTo({ x: 4, y: 2 })).toHaveLength(4) // par en dessous du bloc
    expect(board.pathTo({ x: 3, y: 1 })).toEqual([])
    expect(board.pathTo({ x: 0, y: 0 })).toEqual([])
    expect(board.pathTo({ x: 1, y: 1 })).toEqual([]) // déjà là
    const path = board.pathTo({ x: 4, y: 2 })
    expect(board.play(path.join(''))).toBe(true)
    expect(board.pushes).toBe(0)
    expect(board.player).toEqual({ x: 4, y: 2 })
  })

  it('repère un bloc coincé dans un coin, hors d’une dalle gravée', () => {
    const board = SphinxBoard.fromRows(['#####', '#  .#', '# $ #', '#@  #', '#####'])
    expect(board.stuckBox()).toBe(-1)
    board.play('ur')
    expect(board.boxes[0]).toEqual({ x: 3, y: 2 })
    expect(board.stuckBox()).toBe(-1) // contre un seul mur, il peut encore glisser
    board.play('urd')
    expect(board.boxes[0]).toEqual({ x: 3, y: 3 })
    expect(board.stuckBox()).toBe(0)
  })

  it('lit le sable, le héros et les blocs sur une dalle gravée', () => {
    const board = SphinxBoard.fromRows(['~###', '#+*#', '####'])
    expect(board.sand).toEqual([{ x: 0, y: 0 }])
    expect(board.player).toEqual({ x: 1, y: 1 })
    expect(board.goals).toHaveLength(2)
    expect(board.boxes).toEqual([{ x: 2, y: 1 }])
    expect(board.isFree({ x: 0, y: 0 })).toBe(false) // le sable n’est pas une dalle
  })

  it('play rend faux sur un pas impossible ou une lettre inconnue', () => {
    expect(SphinxBoard.fromRows(ROWS).play('lrx')).toBe(false)
    expect(SphinxBoard.fromRows(ROWS).play('RR')).toBe(true) // majuscules acceptées
  })
})

describe('niveaux générés (tools/make_sphinx_levels.py)', () => {
  it('chaque palier a ses 30 énigmes, et chacune se résout par sa solution', () => {
    expect(niveaux.tiers).toHaveLength(tierCount())
    let count = 0
    for (const tier of niveaux.tiers) {
      expect(tier.length).toBeGreaterThan(9)
      for (const level of tier) {
        const board = SphinxBoard.fromRows(level.rows)
        expect(board.boxes.length).toBe(board.goals.length)
        expect(board.boxes.length).toBeGreaterThan(0)
        expect(board.isSolved()).toBe(false) // rien n’est en place au départ
        expect(board.play(level.solution)).toBe(true)
        expect(board.isSolved()).toBe(true)
        expect(board.pushes).toBe(level.pushes)
        count += 1
      }
    }
    expect(count).toBe(180)
  })

  it('les majuscules de la solution sont exactement les pas qui poussent un bloc', () => {
    for (const tier of niveaux.tiers) {
      for (const level of tier) {
        const board = SphinxBoard.fromRows(level.rows)
        for (const c of level.solution) {
          const result = board.step(c.toLowerCase() as 'l' | 'r' | 'u' | 'd')
          expect(result.moved).toBe(true)
          expect(result.box >= 0).toBe(c !== c.toLowerCase())
        }
      }
    }
  })

  it('les paliers sont de plus en plus difficiles', () => {
    let before = 0
    for (const tier of niveaux.tiers) {
      const mean = tier.reduce((sum, l) => sum + l.pushes, 0) / tier.length
      expect(mean).toBeGreaterThan(before)
      before = mean
    }
  })

  it('aucune énigme n’est en double, et chaque salle est fermée de murs ou de sable', () => {
    const seen = new Set<string>()
    for (const tier of niveaux.tiers) {
      for (const level of tier) {
        const layout = level.rows.join('\n')
        expect(seen.has(layout)).toBe(false)
        seen.add(layout)
        const board = SphinxBoard.fromRows(level.rows)
        // Un héros qui marche partout où il peut ne sort jamais de la grille : toutes ses voisines sont des dalles, murs ou sable.
        for (let y = 0; y < board.height; y++) {
          for (let x = 0; x < board.width; x++) {
            if (!board.isTile({ x, y })) continue
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
              const nx = x + dx
              const ny = y + dy
              expect(nx >= 0 && ny >= 0 && nx < board.width && ny < board.height).toBe(true)
            }
          }
        }
      }
    }
  })
})

describe('île du Sphinx : niveaux et paliers', () => {
  it('la 6e commence au palier 1, la seconde un cran plus haut', () => {
    expect(startTier('6e')).toBe(1)
    expect(startTier('5e')).toBe(1)
    expect(startTier('2nde')).toBe(2)
    expect(initialSphinx('2nde').tier).toBe(2)
  })

  it('l’indice tourne quand le palier est épuisé, le palier reste dans ses bornes', () => {
    expect(levelAt(1, 0)).toBe(levelAt(1, 30))
    expect(levelAt(1, -1)).toBe(levelAt(1, 29))
    expect(levelAt(0, 0)).toBe(levelAt(1, 0))
    expect(levelAt(99, 0)).toBe(levelAt(tierCount(), 0))
  })

  it('compte les passages en français', () => {
    expect(passesText(0)).toBe('Aucun passage')
    expect(passesText(1)).toBe('1 passage')
    expect(passesText(3)).toBe('3 passages')
    expect(HOW_TO_EARN).toContain(String(PASS_ANSWERS))
  })
})

describe('île du Sphinx : passages', () => {
  it('une activité assez remplie rapporte un passage, l’île elle-même non', () => {
    expect(earnsPassage('donjon', PASS_ANSWERS - 1)).toBe(false) // à peine commencée
    expect(earnsPassage('defi', PASS_ANSWERS)).toBe(true)
    expect(earnsPassage('sphinx', 40)).toBe(false)
  })

  it('la réserve est limitée, les gains sont annoncés une seule fois', () => {
    let s = initialSphinx('6e')
    for (let i = 0; i < MAX_PASSES + 2; i++) s = earnPassage(s).state
    expect(s.passes).toBe(MAX_PASSES)
    expect(earnPassage(s).gained).toBe(false)
    const first = takePassageNews(s)
    expect(first.news).toBe(MAX_PASSES)
    expect(takePassageNews(first.state).news).toBe(0)
  })

  it('la barque coûte un passage, refusée sans passage ; l’état n’est jamais modifié sur place', () => {
    const none = initialSphinx('6e')
    expect(spendPassage(none)).toEqual({ state: none, ok: false })
    const one = earnPassage(none).state
    expect(none.passes).toBe(0)
    const left = spendPassage(one)
    expect(left.ok).toBe(true)
    expect(left.state.passes).toBe(0)
    expect(one.passes).toBe(1)
  })
})

describe('île du Sphinx : énigmes et paliers', () => {
  it('propose les énigmes d’un palier l’une après l’autre', () => {
    let s = initialSphinx('6e')
    const a = nextPuzzle(s)
    s = a.state
    const b = nextPuzzle(s)
    expect([a.tier, a.index, b.tier, b.index]).toEqual([1, 0, 1, 1])
  })

  it('trois énigmes de suite sans aide font monter d’un palier ; l’aide ne casse pas la suite mais ne compte pas', () => {
    let s = initialSphinx('6e')
    for (let i = 0; i < TIER_UP - 1; i++) {
      const r = recordSolved(s, false)
      expect(r.up).toBe(false)
      s = r.state
    }
    const helped = recordSolved(s, true)
    expect(helped.up).toBe(false)
    expect(helped.state.streak).toBe(TIER_UP - 1)
    expect(helped.state.solved).toBe(TIER_UP)
    const up = recordSolved(helped.state, false)
    expect(up.up).toBe(true)
    expect(up.state.tier).toBe(2)
    expect(up.state.streak).toBe(0)
  })

  it('ne dépasse pas le dernier palier', () => {
    let s = { ...initialSphinx('6e'), tier: tierCount() }
    for (let i = 0; i < TIER_UP * 2; i++) s = recordSolved(s, false).state
    expect(s.tier).toBe(tierCount())
  })

  it('la prochaine énigme suit le palier atteint', () => {
    const s = { ...initialSphinx('6e'), tier: 3, next: { '3': 4 } }
    const r = nextPuzzle(s)
    expect([r.tier, r.index, r.state.next['3']]).toEqual([3, 4, 5])
  })
})

describe('l’aide du Sphinx', () => {
  const solution = 'rdddllUluRRlddrruU' // 4 poussées
  const pushes = (s: string) => [...s].filter((c) => c !== c.toLowerCase()).length

  it('rejoue un tiers de plus de la solution à chaque appel, toute la solution au troisième', () => {
    expect(pushes(helpSteps(solution, 1))).toBe(2) // ceil(4 / 3)
    expect(pushes(helpSteps(solution, 2))).toBe(3) // ceil(8 / 3)
    expect(helpSteps(solution, 3)).toBe(solution)
    expect(helpSteps(solution, 7)).toBe(solution)
    expect(helpSteps(solution, 0)).toBe('')
  })

  it('s’arrête sur une poussée, jamais au milieu d’une marche, et reste un début de la solution', () => {
    for (const hints of [1, 2, 3]) {
      const shown = helpSteps(solution, hints)
      expect(solution.startsWith(shown)).toBe(true)
      expect(shown === '' || shown.at(-1) !== shown.at(-1)!.toLowerCase()).toBe(true)
    }
  })

  it('l’aide rejouée sur chaque niveau est jouable', () => {
    for (const tier of niveaux.tiers) {
      for (const level of tier) {
        for (const hints of [1, 2, 3]) {
          expect(SphinxBoard.fromRows(level.rows).play(helpSteps(level.solution, hints))).toBe(true)
        }
      }
    }
  })
})

describe('état relu de la partie', () => {
  it('prend les valeurs par défaut quand la partie n’a rien', () => {
    expect(normalizeSphinx(undefined, '6e')).toEqual(initialSphinx('6e'))
    expect(normalizeSphinx('x', '2nde')).toEqual(initialSphinx('2nde'))
    expect(normalizeSphinx([], '6e')).toEqual(initialSphinx('6e'))
  })

  it('garde ce qui est valide, corrige le reste', () => {
    const s = normalizeSphinx({ passes: 9, tier: 99, streak: 1, solved: 12.7, next: { '2': 3, x: 5, '1': -1 }, news: 'beaucoup' }, '6e')
    expect(s).toEqual({ passes: MAX_PASSES, tier: tierCount(), streak: 1, solved: 12, next: { '2': 3 }, news: 0 })
  })

  it('une énigme proposée existe toujours pour tout palier relu', () => {
    for (const tier of [-5, 0, 1, 4, 6, 99]) {
      const s = normalizeSphinx({ tier }, '6e')
      const p = nextPuzzle(s)
      expect(levelAt(p.tier, p.index).rows.length).toBeGreaterThan(0)
    }
    expect(VISIT_PUZZLES).toBe(3)
  })
})
