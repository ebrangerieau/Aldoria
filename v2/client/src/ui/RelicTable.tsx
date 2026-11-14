/**
 * La Table des Reliques (décision D13 ; règles et récompense dans core/relics.ts, testées) : un carré de 4 × 4 où chaque rangée et chaque colonne
 * ne doit répéter ni un élément ni un rang. Les reliques de l'enfant sont à placer, les autres sont gravées dans la pierre. On choisit une relique en
 * bas puis une case libre ; toucher une relique posée la reprend. Les cases en conflit portent un « ! » (jamais la couleur seule), chaque élément a sa
 * forme. Au clavier : flèches pour se déplacer sur la table, Entrée ou Espace pour poser ou reprendre, 1 à 9 pour choisir une relique, Échap pour fermer.
 * Un indice coûte un parchemin du sac. Le premier carré du jour rapporte de l'XP et parfois un objet (`claimTable`) ; les suivants sont de l'entraînement.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { today as localDay } from '../core/dailyChallenge'
import { count, foundText, use as spend } from '../core/inventory'
import { levelForXp } from '../core/progression'
import {
  applyHint, type Board, CELLS, claimTable, clashes, columnOf, dailySeed, describeCell, ELEMENTS, elementOf, hint, holesOf, isSolved, lift, makePuzzle,
  MIN_RELICS, place, type Puzzle, relicOf, RELICS, rowOf, SIZE, tableReward, tray, type Relic, type Shape,
} from '../core/relics'
import type { SaveData } from '../core/save'

const STAR = `${Array.from({ length: 10 }, (_, i) => {
  const angle = -Math.PI / 2 + (i * Math.PI) / 5
  const radius = i % 2 === 0 ? 10.5 : 4.4
  return `${i === 0 ? 'M' : 'L'}${(Math.cos(angle) * radius).toFixed(1)} ${(Math.sin(angle) * radius).toFixed(1)}`
}).join(' ')} Z`

const PATHS: Record<Exclude<Shape, 'cercle'>, string> = {
  triangle: 'M0 -10.5 L10.5 8.5 L-10.5 8.5 Z',
  losange: 'M0 -11.5 L9 0 L0 11.5 L-9 0 Z',
  etoile: STAR,
}

/** Le jeton d'une relique : la forme et la couleur de son élément, son rang en chiffres romains. */
export function RelicToken({ relic }: { relic: Relic }) {
  const element = elementOf(relic)
  return (
    <svg className="relic-token" viewBox="-12 -12 24 24" aria-hidden="true" focusable="false">
      {element.forme === 'cercle' ? (
        <circle r="10" fill={element.couleur} stroke="#2b2118" strokeWidth="1.2" />
      ) : (
        <path d={PATHS[element.forme]} fill={element.couleur} stroke="#2b2118" strokeWidth="1.2" strokeLinejoin="round" />
      )}
      <text x="0" y={element.forme === 'triangle' ? 5.6 : 3.2} textAnchor="middle" className="relic-rank">{relic.roman}</text>
    </svg>
  )
}

export function RelicLegend() {
  return (
    <ul className="relic-legend" aria-label="Les quatre éléments et les quatre rangs">
      {ELEMENTS.map((element) => {
        const sample = RELICS.find((r) => r.element === element.id)!
        return (
          <li key={element.id}>
            <RelicToken relic={{ ...sample, roman: '' }} /> {element.nom}
          </li>
        )
      })}
      <li className="relic-ranks">Rangs : I à IV</li>
    </ul>
  )
}

interface Report {
  title: string
  lines: string[]
}

function Board4({ puzzle, data, onSave, onClose, onAnother, practice }: {
  puzzle: Puzzle
  data: SaveData
  onSave: (next: SaveData) => void
  onClose: () => void
  onAnother: () => void
  practice: boolean
}) {
  const latest = useRef(data)
  latest.current = data
  const day = localDay()
  // Fixé à l'ouverture : une fois la récompense prise, `practice` passerait à vrai et la table en cours changerait de discours.
  const [practiceNow] = useState(practice)
  const [board, setBoard] = useState<Board>(puzzle.fixed)
  const [selected, setSelected] = useState<string | null>(null)
  const [cursor, setCursor] = useState(() => holesOf(puzzle)[0] ?? 0)
  const [message, setMessage] = useState('Choisis une relique en bas, puis la case libre où la poser.')
  const [report, setReport] = useState<Report | null>(null)
  const cells = useRef<(HTMLButtonElement | null)[]>([])
  const solved = isSolved(board)
  const bad = clashes(board)
  const waiting = tray(puzzle, board)
  const parchemins = count(data.items, 'parchemin')
  const reward = tableReward(puzzle)

  useEffect(() => {
    cells.current[cursor]?.focus({ preventScroll: true })
    // Une seule fois, à l'ouverture : ensuite la main est à l'enfant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // La table est résolue : la récompense du jour (une fois), sinon de l'entraînement.
  useEffect(() => {
    if (!solved || report) return
    const before = latest.current
    const claim = practiceNow ? null : claimTable(before, puzzle, day)
    if (claim) {
      onSave(claim.save)
      const level = levelForXp(claim.save.xp)
      const lines = [`+${claim.xp} XP.`, foundText(claim.found)]
      if (level > levelForXp(before.xp)) lines.push(`Niveau ${level} !`)
      setReport({ title: 'Table résolue !', lines: lines.filter(Boolean) })
    } else {
      setReport({ title: 'Bien joué !', lines: ['Cette table était un entraînement : la récompense du jour est déjà prise.'] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved])

  useEffect(() => {
    const down = (e: globalThis.KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return
      if (e.key === 'Escape') {
        onClose()
        return
      }
      const pick = waiting[Number(e.key) - 1]
      if (pick && !solved) choose(pick)
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  })

  function choose(id: string) {
    if (solved) return
    setSelected((current) => (current === id ? null : id))
    const relic = relicOf(id)
    setMessage(relic ? `${relic.name} choisi : touche une case libre.` : '')
  }

  function touchCell(cell: number) {
    if (solved) return
    setCursor(cell)
    if (puzzle.fixed[cell] !== null) {
      setMessage('Cette case est gravée dans la pierre : on n’y touche pas.')
      return
    }
    const here = board[cell]
    if (selected) {
      const next = place(puzzle, board, cell, selected)
      if (!next) return
      setBoard(next)
      setSelected(null)
      const relic = relicOf(selected)!
      setMessage(
        clashes(next).includes(cell)
          ? `${relic.name} croise une autre relique de sa rangée ou de sa colonne : même élément ou même rang.`
          : `${relic.name} posé.`,
      )
    } else if (here) {
      setBoard(lift(puzzle, board, cell))
      setSelected(here)
      setMessage(`${relicOf(here)!.name} repris : choisis une autre case.`)
    } else {
      setMessage('Case libre : choisis d’abord une relique en bas.')
    }
  }

  function move(e: KeyboardEvent, cell: number) {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
    if (!step) return
    e.preventDefault()
    const column = Math.min(SIZE - 1, Math.max(0, columnOf(cell) + step[0]!))
    const row = Math.min(SIZE - 1, Math.max(0, rowOf(cell) + step[1]!))
    const next = row * SIZE + column
    setCursor(next)
    cells.current[next]?.focus()
  }

  function askHint() {
    const given = hint(puzzle, board)
    const next = applyHint(puzzle, board)
    const spent = spend(latest.current.items, 'parchemin')
    if (!given || !next || !spent) return
    onSave({ ...latest.current, items: spent })
    setBoard(next)
    setSelected(null)
    setCursor(given.cell)
    cells.current[given.cell]?.focus()
    setMessage(`Indice : ${relicOf(given.id)!.name} va rangée ${rowOf(given.cell) + 1}, colonne ${columnOf(given.cell) + 1}.`)
  }

  function restart() {
    setBoard(puzzle.fixed)
    setSelected(null)
    setMessage('Table remise à zéro : les reliques sont de nouveau en bas.')
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="table-titre" data-testid="table-reliques">
      <section className="panel dialog relic-table">
        <h2 id="table-titre">La Table des Reliques</h2>
        <p>
          Chaque rangée et chaque colonne ne doit répéter ni un élément ni un rang. Les sceaux gravés restent en place : place les tiens.
          {practiceNow ? ' Cette table est un entraînement.' : ` Résolue, elle rapporte ${reward.xp} XP${reward.items > 0 ? ' et un objet' : ''}.`}
        </p>
        <RelicLegend />
        <div className="relic-layout">
        <div className="relic-board" role="group" aria-label="La table, quatre rangées de quatre cases">
          {Array.from({ length: CELLS }, (_, cell) => {
            const id = board[cell]
            const relic = id ? relicOf(id) : null
            const engraved = puzzle.fixed[cell] !== null
            const clash = bad.includes(cell)
            return (
              <button
                key={cell}
                ref={(el) => {
                  cells.current[cell] = el
                }}
                type="button"
                className={`relic-cell${engraved ? ' engraved' : relic ? ' placed' : ' free'}${clash ? ' clash' : ''}${selected && !engraved ? ' target' : ''}`}
                tabIndex={cell === cursor ? 0 : -1}
                data-testid={`case-${cell}`}
                data-cell={cell}
                data-state={engraved ? 'grave' : relic ? 'posee' : 'libre'}
                data-clash={clash ? 'oui' : 'non'}
                aria-label={`${describeCell(puzzle, board, cell)}${clash ? ' Cette relique croise une autre.' : ''}`}
                onClick={() => touchCell(cell)}
                onKeyDown={(e) => move(e, cell)}
              >
                {relic && <RelicToken relic={relic} />}
                {clash && <span className="relic-alert" aria-hidden="true">!</span>}
              </button>
            )
          })}
        </div>
        <div className="relic-side">
        <p className="relic-status" role="status" data-testid="table-message">
          {report ? '' : message}
          {!report && bad.length > 0 && ` ${bad.length} case${bad.length > 1 ? 's' : ''} en conflit.`}
        </p>
        {report ? (
          <div className="relic-result" data-testid="table-resolue">
            <h3>{report.title}</h3>
            {report.lines.map((line) => <p key={line}>{line}</p>)}
          </div>
        ) : (
          <div className="relic-tray" aria-label="Reliques à placer">
            {waiting.length === 0 && <p className="hint">Toutes tes reliques sont posées. Il reste à les ranger autrement si une case est en conflit.</p>}
            {waiting.map((id, i) => {
              const relic = relicOf(id)!
              return (
                <button
                  key={id}
                  type="button"
                  className={`secondary relic-pick${selected === id ? ' chosen' : ''}`}
                  aria-pressed={selected === id}
                  data-testid={`relique-${id}`}
                  onClick={() => choose(id)}
                >
                  <RelicToken relic={relic} />
                  <span>{i < 9 && <kbd>{i + 1}</kbd>} {relic.name}</span>
                </button>
              )
            })}
          </div>
        )}
        <div className="actions">
          {!report && (
            <>
              <button type="button" className="secondary" data-testid="table-indice" disabled={parchemins < 1 || solved} onClick={askHint}>
                Indice ({parchemins > 0 ? `1 parchemin sur ${parchemins}` : 'plus de parchemin'})
              </button>
              <button type="button" className="secondary" onClick={restart}>Recommencer</button>
            </>
          )}
          {report && <button type="button" className="secondary" data-testid="table-autre" onClick={onAnother}>Une autre table</button>}
          <button type="button" className="primary" autoFocus={!!report} onClick={onClose}>{report ? 'Fermer' : 'Quitter la table'}</button>
        </div>
        </div>
        </div>
      </section>
    </div>
  )
}

export function RelicTable({ data, onSave, onClose }: { data: SaveData; onSave: (next: SaveData) => void; onClose: () => void }) {
  const day = localDay()
  // La récompense du jour déjà prise : on ouvre directement une table d'entraînement.
  const [offset, setOffset] = useState(data.table === day ? 1 : 0)
  const ownedKey = data.relics.join(',')
  const puzzle = useMemo(() => makePuzzle(data.relics, dailySeed(day) + offset), [ownedKey, day, offset]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handle = (window as unknown as { __aldoria?: Record<string, unknown> }).__aldoria
    if (handle) handle.table = puzzle
    return () => {
      if (handle) delete handle.table
    }
  }, [puzzle])

  useEffect(() => {
    if (puzzle) return
    const down = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [puzzle, onClose])

  if (!puzzle) {
    return (
      <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="table-titre" data-testid="table-reliques">
        <section className="panel dialog relic-table">
          <h2 id="table-titre">La Table des Reliques</h2>
          <p>
            Seize sceaux de la Grande Chronique ont été dispersés : quatre éléments, quatre rangs. Rapporte-les ici et range-les sur la table, sans
            répéter un élément ni un rang dans une rangée ou une colonne.
          </p>
          <p data-testid="table-vide">
            Il en faut au moins {MIN_RELICS} pour commencer, tu en as {data.relics.length}. Cherche des éclats qui brillent dans l’île, et ouvre les
            coffres des premiers lieux.
          </p>
          <RelicLegend />
          <div className="actions">
            <button type="button" className="primary" autoFocus onClick={onClose}>Fermer</button>
          </div>
        </section>
      </div>
    )
  }
  return <Board4 key={puzzle.seed} puzzle={puzzle} data={data} onSave={onSave} onClose={onClose} onAnother={() => setOffset((n) => n + 1)} practice={data.table === day || offset > 0} />
}
