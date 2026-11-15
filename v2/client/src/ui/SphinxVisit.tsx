/**
 * Une traversée de l'île du Sphinx (idée de Jules ; jeux de logique, aucune question de leçon) : la barque (un passage), l'accueil du Sphinx, trois
 * énigmes de blocs, le bilan, le retour. Les règles, les textes et l'état sont dans core/sphinx/ (testés) ; ici, seulement l'enchaînement des
 * écrans, comme `DailyChallenge`. « Quitter l'île » ramène à tout moment : le passage est dépensé, les énigmes déjà résolues comptent.
 */
import { useEffect, useRef, useState } from 'react'
import { startSphinxSession, type SphinxSession } from '../app/sphinxSession'
import type { Services } from '../app/services'
import type { SaveData } from '../core/save'
import {
  nextPuzzle, levelAt, passesText, recordSolved, spendPassage, sphinxOf, THRESHOLD, VISIT_PUZZLES, type SphinxLevel, type SphinxState,
} from '../core/sphinx/island'
import { celebrateLines, finishText, noPassageText, STORY_KEY, welcomeText } from '../core/sphinx/visit'
import { SphinxPuzzle, type Played } from './SphinxPuzzle'

type Phase =
  | { kind: 'dock' }
  | { kind: 'welcome'; first: boolean }
  | { kind: 'puzzle'; round: number; tier: number; level: SphinxLevel }
  | { kind: 'celebrate'; round: number; lines: string[] }
  | { kind: 'finish' }

function Card({ title, lines, actions, note }: { title: string; lines: string[]; note?: string; actions: { label: string; primary?: boolean; run: () => void }[] }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="sphinx-carte-titre" data-testid="sphinx-carte">
      <section className="panel dialog">
        <h2 id="sphinx-carte-titre">{title}</h2>
        {lines.flatMap((line) => line.split('\n')).map((line, i) => <p key={i}>{line}</p>)}
        {note && <p className="hint">{note}</p>}
        <div className="actions">
          {actions.map((a, i) => (
            <button key={a.label} type="button" className={a.primary ? 'primary' : 'secondary'} autoFocus={i === actions.length - 1} onClick={a.run}>
              {a.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

export function SphinxVisit({ services, data, demo, onSave, onClose }: {
  services: Services
  data: SaveData
  demo: boolean
  onSave: (next: SaveData) => void
  onClose: () => void
}) {
  const level = services.session.profile?.level ?? '6e'
  const [phase, setPhase] = useState<Phase>({ kind: 'dock' })
  const saved = useRef(data)
  saved.current = data
  const state = useRef<SphinxState>(sphinxOf(data, level))
  const solvedNow = useRef(0)
  const session = useRef<SphinxSession | null>(null)
  const closing = useRef(false)

  const passes = sphinxOf(data, level).passes
  const store = (next: SphinxState, story?: string[]) => {
    state.current = next
    const base = { ...saved.current, sphinx: next, ...(story ? { story } : {}) }
    saved.current = base
    onSave(base)
  }

  /** Referme la traversée (session du temps de jeu) puis rend l'île. */
  async function leave() {
    if (closing.current) return
    closing.current = true
    const open = session.current
    session.current = null
    await open?.end()
    onClose()
  }

  // Le composant disparaît pendant une traversée (changement de joueur, fin de séance) : la session ne reste pas ouverte.
  useEffect(
    () => () => {
      const open = session.current
      session.current = null
      void open?.end()
    },
    [],
  )

  async function cross() {
    const spent = spendPassage(state.current)
    if (!spent.ok) return
    store(spent.state)
    session.current = await startSphinxSession(services, demo)
    const first = !saved.current.story.includes(STORY_KEY)
    setPhase({ kind: 'welcome', first })
  }

  function startRound(round: number) {
    if (round >= VISIT_PUZZLES || services.session.timeOver()) return setPhase({ kind: 'finish' })
    const pick = nextPuzzle(state.current)
    store(pick.state)
    setPhase({ kind: 'puzzle', round, tier: pick.tier, level: levelAt(pick.tier, pick.index) })
  }

  function solved(round: number, puzzle: SphinxLevel, played: Played) {
    services.sfx.play('victory')
    solvedNow.current += 1
    const result = recordSolved(state.current, played.hints > 0)
    store(result.state)
    const lines = celebrateLines({ moves: played.moves, pushes: played.pushes, hints: played.hints, best: puzzle.pushes, up: result.up, tier: result.state.tier })
    setPhase({ kind: 'celebrate', round, lines })
  }

  if (phase.kind === 'dock') {
    const none = passes <= 0
    return (
      <Card
        title="La barque du Sphinx"
        lines={none ? [THRESHOLD, noPassageText()] : [THRESHOLD, `La barque t'y conduit : ${passesText(passes)} en réserve, la traversée en coûte un.`]}
        actions={
          none
            ? [{ label: 'Retour à l’île', primary: true, run: onClose }]
            : [{ label: 'Pas maintenant', run: onClose }, { label: 'Traverser', primary: true, run: () => void cross() }]
        }
      />
    )
  }
  if (phase.kind === 'welcome') {
    const { first } = phase
    return (
      <Card
        title="Le Sphinx"
        lines={[welcomeText(first)]}
        actions={[
          { label: '🔊 Écouter', run: () => void services.voice.say([welcomeText(first)]) },
          {
            label: first ? 'Au premier bloc !' : 'J’entre',
            primary: true,
            run: () => {
              services.voice.stop('accueil du Sphinx')
              if (first) store(state.current, [...saved.current.story, STORY_KEY])
              startRound(0)
            },
          },
        ]}
      />
    )
  }
  if (phase.kind === 'puzzle') {
    const { round, tier, level: puzzle } = phase
    return <SphinxPuzzle key={round} level={puzzle} tier={tier} round={round} onSolved={(played) => solved(round, puzzle, played)} onQuit={() => void leave()} />
  }
  if (phase.kind === 'celebrate') {
    const last = phase.round >= VISIT_PUZZLES - 1
    return (
      <Card
        title="Énigme résolue !"
        lines={phase.lines}
        actions={[{ label: last ? 'Terminer' : 'Énigme suivante', primary: true, run: () => startRound(phase.round + 1) }]}
      />
    )
  }
  return (
    <Card
      title="Le Sphinx"
      lines={[finishText(solvedNow.current, state.current.solved)]}
      actions={[{ label: 'Retour à l’île', primary: true, run: () => void leave() }]}
    />
  )
}
