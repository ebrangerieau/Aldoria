/**
 * Une énigme de blocs du temple du Sphinx (type Sokoban ; règles dans core/sphinx/board.ts, textes dans core/sphinx/visit.ts) : pousser chaque bloc
 * sur une dalle gravée, sans jamais en tirer un. Au clavier : flèches ou Z, Q, S, D (position des touches) pour marcher, Retour arrière ou U pour
 * annuler, R pour recommencer, H pour l'aide du Sphinx, Échap pour quitter l'île. À la souris : toucher une dalle libre y mène sans pousser de
 * bloc. L'aide du Sphinx remet la salle au départ et rejoue un tiers de plus de la solution à chaque appel. Rien ne dépend de la couleur seule :
 * une dalle gravée est un losange creux, un bloc porte une croix et un coche une fois posé, un bloc coincé un « ! ».
 */
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { type Cell, type Dir } from '../core/sphinx/board'
import { helpSteps, type SphinxLevel } from '../core/sphinx/island'
import { boardFor, boardSummary, statusLine, stepMessage } from '../core/sphinx/visit'

const SIZE = 44
const HELP_STEP_MS = 260
const WALK_STEP_MS = 110
/** Le temps de voir les blocs sur leurs dalles avant que le Sphinx ne parle. */
const CELEBRATE_MS = 900

const KEYS: Record<string, Dir> = {
  ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd',
}

export interface Played {
  moves: number
  pushes: number
  /** Aides du Sphinx demandées. */
  hints: number
}

const key = (c: Cell): string => `${c.x},${c.y}`

export function SphinxPuzzle({ level, tier, round, onSolved, onQuit }: {
  level: SphinxLevel
  tier: number
  /** Rang de l'énigme dans la traversée (0, 1, 2). */
  round: number
  onSolved: (played: Played) => void
  onQuit: () => void
}) {
  const board = useRef(boardFor(level))
  const [, setVersion] = useState(0)
  const refresh = () => setVersion((v) => v + 1)
  const [hints, setHints] = useState(0)
  const [facing, setFacing] = useState<Dir>('r')
  const [message, setMessage] = useState('Pousse chaque bloc sur une dalle gravée.')
  const [solved, setSolved] = useState(false)
  const timer = useRef<number | null>(null)
  const busy = useRef(false)
  const hintsRef = useRef(0)
  const b = board.current

  const walls = useMemo(() => new Set(b.walls.map(key)), [b])
  const sand = useMemo(() => new Set(b.sand.map(key)), [b])
  const goals = useMemo(() => new Set(b.goals.map(key)), [b])

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
  }, [])

  // Tests dans le navigateur (&e2e) : l'énigme en cours et sa solution, comme `table` pour la Table des Reliques.
  useEffect(() => {
    const handle = (window as unknown as { __aldoria?: Record<string, unknown> }).__aldoria
    if (handle) handle.sphinx = { rows: level.rows, solution: level.solution, tier, round }
    return () => {
      if (handle) delete handle.sphinx
    }
  }, [level, tier, round])

  /** Le plateau est résolu : le Sphinx attend un instant, puis l'énigme est rendue. */
  function finishIfSolved(): boolean {
    if (!board.current.isSolved()) return false
    setSolved(true)
    setMessage('Énigme résolue !')
    timer.current = window.setTimeout(() => onSolved({ moves: board.current.moves, pushes: board.current.pushes, hints: hintsRef.current }), CELEBRATE_MS)
    return true
  }

  function step(dir: Dir): boolean {
    if (solved || busy.current) return false
    setFacing(dir)
    const result = board.current.step(dir)
    setMessage(stepMessage(result.moved, result.box >= 0, board.current.stuckBox()))
    refresh()
    if (result.moved) finishIfSolved()
    return result.moved
  }

  function undo() {
    if (solved || busy.current) return
    board.current.undo()
    setMessage('')
    refresh()
  }

  function restart() {
    if (solved || busy.current) return
    board.current.restart()
    setMessage('Le temple est remis comme au départ.')
    refresh()
  }

  /** Rejoue `steps` pas à pas (marche vers une dalle, ou aide du Sphinx) : la main revient à la fin. */
  function replay(steps: string, delay: number, after: () => void) {
    busy.current = true
    let i = 0
    const next = () => {
      const c = steps[i]
      if (c === undefined) {
        busy.current = false
        after()
        return
      }
      i += 1
      const dir = c.toLowerCase() as Dir
      setFacing(dir)
      const moved = board.current.step(dir).moved
      refresh()
      if (!moved) {
        busy.current = false
        after()
        return
      }
      timer.current = window.setTimeout(next, delay)
    }
    next()
  }

  function help() {
    if (solved || busy.current) return
    const asked = hintsRef.current + 1
    hintsRef.current = asked
    setHints(asked)
    board.current.restart()
    setMessage('Regarde : voici le début de ma solution.')
    replay(helpSteps(level.solution, asked), HELP_STEP_MS, () => {
      if (!finishIfSolved()) setMessage('À toi de continuer. Si tu sèches encore, redemande-moi.')
    })
  }

  function walkTo(cell: Cell) {
    if (solved || busy.current) return
    const path = board.current.pathTo(cell)
    if (path.length === 0) return
    replay(path.join(''), WALK_STEP_MS, () => setMessage(''))
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      const dir = KEYS[e.code]
      if (dir) {
        e.preventDefault()
        step(dir)
      } else if (e.code === 'Backspace' || e.code === 'KeyU') {
        e.preventDefault()
        undo()
      } else if (e.code === 'KeyR' && !e.repeat) restart()
      else if (e.code === 'KeyH' && !e.repeat) help()
      else if (e.key === 'Escape') onQuit()
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  })

  const status = statusLine(round, tier, b)
  const stuck = b.stuckBox()
  const cells: ReactNode[] = []
  for (let y = 0; y < b.height; y += 1) {
    for (let x = 0; x < b.width; x += 1) {
      const id = `${x},${y}`
      if (sand.has(id)) continue
      if (walls.has(id)) {
        cells.push(
          <g key={id} className="sphinx-wall" transform={`translate(${x * SIZE} ${y * SIZE})`}>
            <rect width={SIZE} height={SIZE} />
            <path d={`M0 ${SIZE / 2} H${SIZE} M${SIZE / 2} 0 V${SIZE / 2} M${SIZE / 4} ${SIZE / 2} V${SIZE} M${(SIZE * 3) / 4} ${SIZE / 2} V${SIZE}`} />
          </g>,
        )
        continue
      }
      if (!b.isTile({ x, y })) continue
      cells.push(
        <g key={id} transform={`translate(${x * SIZE} ${y * SIZE})`} data-testid={`dalle-${x}-${y}`} onClick={() => walkTo({ x, y })}>
          <rect className="sphinx-tile" width={SIZE} height={SIZE} />
          {goals.has(id) && <path className="sphinx-goal" d={`M${SIZE / 2} 7 L${SIZE - 7} ${SIZE / 2} L${SIZE / 2} ${SIZE - 7} L7 ${SIZE / 2} Z`} />}
        </g>,
      )
    }
  }
  const pieces = b.boxes.map((box, i) => {
    const onGoal = goals.has(key(box))
    return (
      <g key={`b${i}`} className={`sphinx-box${onGoal ? ' placed' : ''}${i === stuck ? ' stuck' : ''}`} transform={`translate(${box.x * SIZE} ${box.y * SIZE})`} data-testid={`bloc-${i}`} data-state={onGoal ? 'pose' : i === stuck ? 'coince' : 'libre'}>
        <rect x="5" y="5" width={SIZE - 10} height={SIZE - 10} rx="4" />
        <path d={`M9 9 L${SIZE - 9} ${SIZE - 9} M${SIZE - 9} 9 L9 ${SIZE - 9}`} />
        {onGoal && <path className="sphinx-check" d={`M${SIZE * 0.27} ${SIZE * 0.52} L${SIZE * 0.44} ${SIZE * 0.7} L${SIZE * 0.75} ${SIZE * 0.3}`} />}
        {i === stuck && (
          <text x={SIZE - 8} y="14" textAnchor="middle" className="sphinx-alert">!</text>
        )}
      </g>
    )
  })
  const nose = { l: '-15,0 -4,-6 -4,6', r: '15,0 4,-6 4,6', u: '0,-15 -6,-4 6,-4', d: '0,15 -6,4 6,4' }[facing]

  return (
    <div className="overlay sphinx-overlay" role="dialog" aria-modal="true" aria-labelledby="sphinx-titre" data-testid="sphinx-enigme">
      <section className="panel dialog sphinx-panel">
        <h2 id="sphinx-titre">{status.title}</h2>
        <p className="sphinx-detail" data-testid="sphinx-detail">{status.detail}</p>
        <svg
          className="sphinx-board"
          viewBox={`0 0 ${b.width * SIZE} ${b.height * SIZE}`}
          style={{ maxWidth: `${b.width * 3.3}rem` }}
          role="img"
          aria-label={boardSummary(b)}
          data-testid="sphinx-plateau"
        >
          {cells}
          {pieces}
          <g className="sphinx-hero" transform={`translate(${b.player.x * SIZE + SIZE / 2} ${b.player.y * SIZE + SIZE / 2})`} data-testid="sphinx-heros" data-x={b.player.x} data-y={b.player.y}>
            <circle r="13" />
            <polygon points={nose} />
          </g>
        </svg>
        <p className="sphinx-status" role="status" data-testid="sphinx-message">{message}</p>
        <div className="actions">
          <button type="button" className="secondary" data-testid="sphinx-annuler" disabled={!b.canUndo() || solved} onClick={undo}>
            Annuler <kbd>⌫</kbd>
          </button>
          <button type="button" className="secondary" data-testid="sphinx-recommencer" disabled={!b.canUndo() || solved} onClick={restart}>
            Recommencer <kbd>R</kbd>
          </button>
          <button type="button" className="secondary" data-testid="sphinx-aide" disabled={solved} onClick={help}>
            Aide du Sphinx{hints > 0 ? ` (${hints})` : ''} <kbd>H</kbd>
          </button>
          <button type="button" className="primary" onClick={onQuit}>Quitter l’île <kbd>Échap</kbd></button>
        </div>
      </section>
    </div>
  )
}
