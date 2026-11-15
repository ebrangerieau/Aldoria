/**
 * Le Pont des fractions (Jules, 6e) : six ravins à franchir, sans chrono. Les planches ont des longueurs fractionnaires ; on les pose bout à bout et le pont
 * ne tient que si leur somme vaut exactement la largeur du ravin, sinon il s'effondre et on corrige. Règles dans core/pont.ts, série et XP dans core/lice.ts
 * (testés) ; ici seulement le dessin (SVG) et l'enchaînement des écrans, comme `DailyChallenge`. Seul le premier pont de chaque ravin compte comme réponse (la
 * somme des planches posées, suivi des notions) ; les essais suivants servent à corriger. Clavier : 1, 2, 3… prennent une planche, Retour arrière la retire,
 * Entrée pose le pont, Échap quitte. Jamais la couleur seule : chaque planche porte sa fraction écrite.
 */
import { useEffect, useRef, useState } from 'react'
import { startLiceSession, type LiceSession } from '../app/liceSession'
import type { Services } from '../app/services'
import type { Accommodations } from '../core/accessibility'
import type { Item } from '../core/items'
import {
  finishRound, finishText, finishTitle, GAME_MODE, isOver, type LiceState, NOT_READY, introText, roundLabel, START, START_LABEL, successText, TITLES,
} from '../core/lice'
import { adviceFor, colorFor, fracValue, type Frac, outcomeOf, pontFrom, remaining, solve, totalOf, writeFrac } from '../core/pont'
import type { SaveData } from '../core/save'
import { afterActivity, passesText, sphinxOf, takePassageNews } from '../core/sphinx/island'
import { E2eQuestion } from './E2eQuestion'

const KIND = 'pont' as const
/** Le dessin : la rive ouest, le ravin (sa largeur remplit toujours `GAP_W`, quelle que soit la fraction), la rive est. */
const BANK_W = 130
const GAP_W = 440
const WIDTH = BANK_W + GAP_W + 190
const GROUND_Y = 118
const HEIGHT = 230
/** Combien de temps le pont raté s'effondre avant que les planches reviennent sur le tas. */
const FALL_MS = 750

type Phase =
  | { kind: 'intro' }
  | { kind: 'preparing' }
  | { kind: 'unavailable' }
  | { kind: 'notready' }
  | { kind: 'play' }
  | { kind: 'finish'; lines: string[] }

type Stage = 'edit' | 'juste' | 'tombe'

function Card({ title, lines, actions, testId = 'pont' }: { title: string; lines: string[]; testId?: string; actions: { label: string; primary?: boolean; run: () => void }[] }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="pont-titre" data-testid={testId}>
      <section className="panel dialog">
        <h2 id="pont-titre">{title}</h2>
        {lines.flatMap((line) => line.split('\n')).map((line, i) => <p key={i}>{line}</p>)}
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

/** Le ravin vu de côté : deux rives, le vide entre elles, les planches posées en partant de la rive ouest, le héros qui traverse quand le pont tient. */
function Chasm({ gap, chosen, stage, scale }: { gap: Frac; chosen: string[]; stage: Stage; scale: number }) {
  let x = BANK_W
  const planks = chosen.map((length, i) => {
    const frac = fracValue(totalOf([length]))
    const width = frac * scale
    const at = x
    x += width
    return { length, at, width, i }
  })
  const measure = `Ravin : ${writeFrac(gap)} de perche`
  return (
    <svg
      className="pont-scene"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`${measure}. ${chosen.length > 0 ? `Planches posées : ${chosen.join(', ')}.` : 'Aucune planche posée.'}`}
      data-testid="pont-ravin"
      data-stage={stage}
    >
      <rect x={BANK_W} y={GROUND_Y} width={GAP_W} height={HEIGHT - GROUND_Y} className="pont-void" />
      <polygon points={`0,${GROUND_Y} ${BANK_W},${GROUND_Y} ${BANK_W - 12},${HEIGHT} 0,${HEIGHT}`} className="pont-rock" />
      <polygon points={`${BANK_W + GAP_W},${GROUND_Y} ${WIDTH},${GROUND_Y} ${WIDTH},${HEIGHT} ${BANK_W + GAP_W + 12},${HEIGHT}`} className="pont-rock" />
      {/* La mesure du ravin, au-dessus : une règle de rive à rive. */}
      <g className="pont-measure">
        <line x1={BANK_W} y1={72} x2={BANK_W + GAP_W} y2={72} />
        <line x1={BANK_W} y1={64} x2={BANK_W} y2={80} />
        <line x1={BANK_W + GAP_W} y1={64} x2={BANK_W + GAP_W} y2={80} />
        <text x={BANK_W + GAP_W / 2} y={58} textAnchor="middle">{measure}</text>
      </g>
      <g className={`pont-planks ${stage}`} data-testid="pont-planches">
        {planks.map((p) => (
          <g key={p.i} data-testid={`planche-${p.i}`}>
            <rect x={p.at + 1} y={GROUND_Y - 9} width={Math.max(2, p.width - 2)} height={18} rx={3} fill={colorFor(p.length)} className="pont-plank" />
            <text x={p.at + p.width / 2} y={GROUND_Y + 4} textAnchor="middle" className="pont-plank-label">{p.length}</text>
          </g>
        ))}
      </g>
      <g className={`pont-hero ${stage === 'juste' ? 'across' : ''}`}>
        <circle cx={62} cy={GROUND_Y - 24} r={11} />
        <rect x={54} y={GROUND_Y - 14} width={16} height={14} rx={4} />
      </g>
    </svg>
  )
}

export function PontBridge({ services, accommodations, demo, data, onSave, onClose }: {
  services: Services
  accommodations: Accommodations
  demo: boolean
  data: SaveData
  /** Range la partie : l'XP de chaque pont réussi, puis le passage du Sphinx à la fin de la série. */
  onSave: (next: SaveData) => void
  onClose: () => void
}) {
  const level = services.session.profile?.level ?? '6e'
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' })
  const [run, setRun] = useState<LiceState>(START)
  const [item, setItem] = useState<Item | null>(null)
  const [chosen, setChosen] = useState<string[]>([])
  const [stage, setStage] = useState<Stage>('edit')
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null)
  const [locked, setLocked] = useState(false)
  const sessionRef = useRef<LiceSession | null>(null)
  const saved = useRef(data)
  saved.current = data
  const state = useRef<LiceState>(START)
  const tries = useRef(0)
  const hintUsed = useRef(false)
  const shownAt = useRef(0)
  const timer = useRef<number | null>(null)
  const closing = useRef(false)
  const spoke = useRef<number | null>(null)
  const e2e = new URLSearchParams(location.search).has('e2e')

  const spec = item ? pontFrom(item.visual) : null
  const scale = spec ? GAP_W / Math.max(fracValue(spec.gap), 0.01) : 1

  /** Referme la série (session du temps de jeu) puis rend l'île. */
  async function leave() {
    if (closing.current) return
    closing.current = true
    const open = sessionRef.current
    sessionRef.current = null
    await open?.end()
    onClose()
  }

  // La série disparaît pendant qu'elle se joue (changement de joueur, fin de séance) : la session ne reste pas ouverte, et aucune voix n'est coupée à tort.
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
      const open = sessionRef.current
      sessionRef.current = null
      void open?.end()
      if (spoke.current !== null) services.voice.stopIf(spoke.current, 'pont des fractions')
    },
    [],
  )

  // Tests dans le navigateur (&e2e) : le ravin en cours et une solution de sa réserve.
  useEffect(() => {
    const handle = (window as unknown as { __aldoria?: Record<string, unknown> }).__aldoria
    if (handle && spec) handle.pont = { gap: writeFrac(spec.gap), stock: spec.stock, solution: solve(spec.stock, spec.gap), round: run.round }
    return () => {
      if (handle) delete handle.pont
    }
  }, [item])

  const say = (text: string) => {
    void services.voice.say([text])
    spoke.current = services.voice.token
  }

  async function begin() {
    setPhase({ kind: 'preparing' })
    const started = await startLiceSession(services, KIND, level, demo)
    if (!started) return setPhase({ kind: 'unavailable' })
    sessionRef.current = started
    nextRound(START)
  }

  function finishSeries(final: LiceState) {
    // Six cibles qui comptent : une activité remplie, donc un passage pour la barque du Sphinx (comme un lieu ou le défi du jour).
    const earned = afterActivity(saved.current, level, 'arene', services.questions.answered)
    const sphinx = earned.gained ? sphinxOf(earned.save, level) : null
    if (earned.gained && sphinx) {
      const next = { ...earned.save, sphinx: takePassageNews(sphinx).state }
      saved.current = next
      onSave(next)
    }
    const lines = [finishText(KIND, final)]
    if (sphinx) lines.push(`Un passage pour la barque du Sphinx ! (${passesText(sphinx.passes)})`)
    services.sfx.play('victory')
    void sessionRef.current?.end().then(() => { sessionRef.current = null })
    setPhase({ kind: 'finish', lines })
  }

  function nextRound(from: LiceState) {
    state.current = from
    setRun(from)
    if (isOver(from) || services.session.timeOver()) return finishSeries(from)
    const next = services.questions.next('enigme')
    if (!next || next.visual?.kind !== 'pont') {
      void sessionRef.current?.end().then(() => { sessionRef.current = null })
      return setPhase({ kind: 'notready' })
    }
    setItem(next)
    setChosen([])
    setStage('edit')
    setFeedback(null)
    setLocked(false)
    tries.current = 0
    hintUsed.current = false
    shownAt.current = performance.now()
    setPhase({ kind: 'play' })
    if (accommodations.auto_read) say(next.prompt)
  }

  const left = spec ? remaining(spec.stock, chosen) : []

  function take(index: number) {
    if (!spec || locked || stage === 'tombe' || (left[index] ?? 0) <= 0) return
    services.sfx.play('click')
    setChosen((c) => [...c, spec.stock[index]!.length])
    setStage('edit')
  }

  function undo() {
    if (locked || stage === 'tombe' || chosen.length === 0) return
    setChosen((c) => c.slice(0, -1))
    setStage('edit')
  }

  function build() {
    if (!item || !spec || locked || stage === 'tombe' || chosen.length === 0) return
    tries.current += 1
    const outcome = outcomeOf(chosen, spec.gap)
    // Seul le premier pont du ravin compte comme réponse : la somme des planches posées.
    if (tries.current === 1) services.questions.submit(item, writeFrac(totalOf(chosen)), performance.now() - shownAt.current, hintUsed.current, GAME_MODE[KIND])
    if (outcome === 'juste') {
      const done = finishRound(state.current, item.difficulty, tries.current)
      state.current = done.state
      setRun(done.state)
      saved.current = { ...saved.current, xp: saved.current.xp + done.gain }
      onSave(saved.current)
      services.sfx.play('crit')
      setStage('juste')
      setLocked(true)
      setFeedback({ text: successText(KIND, done.gain, tries.current, item.explanation), ok: true })
      return
    }
    services.sfx.play('wrong')
    setStage('tombe')
    setLocked(true)
    let advice = adviceFor(chosen, spec.gap, outcome)
    if (tries.current >= 3 && !hintUsed.current) advice += ` ${item.hint}`
    setFeedback({ text: advice, ok: false })
    timer.current = window.setTimeout(() => {
      timer.current = null
      setStage('edit') // les planches reviennent sur le tas : on corrige son choix
      setLocked(false)
    }, FALL_MS)
  }

  function showHint() {
    if (!item) return
    hintUsed.current = true
    setFeedback({ text: item.hint, ok: true })
  }

  const phaseRef = useRef(phase)
  phaseRef.current = phase
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      if (e.key === 'Escape') {
        void leave()
        return
      }
      if (phaseRef.current.kind !== 'play') return
      if (/^[1-9]$/.test(e.key)) take(Number(e.key) - 1)
      else if (e.key === 'Backspace') {
        e.preventDefault()
        undo()
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) build()
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  })

  return (
    <>
      {phase.kind === 'intro' && (
        <Card
          title={TITLES[KIND]}
          lines={[introText(KIND, level)]}
          actions={[{ label: 'Plus tard', run: () => void leave() }, { label: START_LABEL[KIND], primary: true, run: () => void begin() }]}
        />
      )}
      {phase.kind === 'preparing' && (
        <div className="overlay" role="status" data-testid="pont"><section className="panel dialog"><p>Les planches se préparent…</p></section></div>
      )}
      {phase.kind === 'unavailable' && (
        <Card title={TITLES[KIND]} lines={['Il faut une connexion pour préparer les planches.']} actions={[{ label: "Retour à l'île", primary: true, run: () => void leave() }]} />
      )}
      {phase.kind === 'notready' && <Card title={TITLES[KIND]} lines={[NOT_READY[KIND]]} actions={[{ label: 'Retour', primary: true, run: () => void leave() }]} />}
      {phase.kind === 'finish' && <Card title={finishTitle(KIND)} lines={phase.lines} actions={[{ label: "Retour à l'île", primary: true, run: () => void leave() }]} testId="pont-bilan" />}
      {phase.kind === 'play' && item && spec && (
        <div className="overlay pont-overlay" role="dialog" aria-modal="true" aria-labelledby="pont-ravin-titre" data-testid="pont-jeu">
          {e2e && <E2eQuestion item={item} />}
          <section className="panel dialog pont-panel">
            <div className="pont-head">
              <h2 id="pont-ravin-titre">{TITLES[KIND]} · {roundLabel(KIND, { ...run, round: run.round - (stage === 'juste' ? 1 : 0) })}</h2>
              <span className="pont-score" data-testid="pont-score">{run.firstTry} du premier coup</span>
              <button type="button" className="secondary small" onClick={() => say(item.prompt)}>🔊 Écouter</button>
              <button type="button" className="secondary small" data-testid="pont-indice" onClick={showHint}>Indice</button>
              <button type="button" className="secondary small" onClick={() => void leave()}>Quitter <kbd>Échap</kbd></button>
            </div>
            <p className="pont-prompt">{item.prompt}</p>
            <Chasm gap={spec.gap} chosen={chosen} stage={stage} scale={scale} />
            <div className="pont-stock" role="group" aria-label="Planches de la réserve">
              {spec.stock.map((plank, i) => (
                <button
                  key={plank.length}
                  type="button"
                  className="pont-take"
                  data-testid={`pont-prendre-${i}`}
                  disabled={locked || (left[i] ?? 0) <= 0}
                  aria-label={`Planche de ${plank.length} de perche, ${left[i]} restante${(left[i] ?? 0) > 1 ? 's' : ''}`}
                  onClick={() => take(i)}
                >
                  <span className="pont-bar" style={{ width: Math.max(16, fracValue(totalOf([plank.length])) * scale * 0.36), background: colorFor(plank.length) }} aria-hidden="true" />
                  <span className="pont-name">{plank.length}</span>
                  <span className="pont-left">×{left[i]}</span>
                  <kbd>{i + 1}</kbd>
                </button>
              ))}
            </div>
            <p className="pont-choice" data-testid="pont-choix">Ton pont : {chosen.length > 0 ? chosen.join(' + ') : 'aucune planche'}</p>
            <p className={`pont-feedback ${feedback ? (feedback.ok ? 'good' : 'bad') : ''}`} role="status" data-testid="pont-message">{feedback?.text ?? ''}</p>
            <div className="actions">
              {stage === 'juste' ? (
                <button type="button" className="primary" autoFocus data-testid="pont-suite" onClick={() => nextRound(state.current)}>
                  {isOver(state.current) ? 'Voir le bilan' : 'Ravin suivant'}
                </button>
              ) : (
                <>
                  <button type="button" className="secondary" data-testid="pont-retirer" disabled={locked || chosen.length === 0} onClick={undo}>Retirer <kbd>⌫</kbd></button>
                  <button type="button" className="primary" data-testid="pont-poser" disabled={locked || chosen.length === 0} onClick={build}>Poser le pont <kbd>Entrée</kbd></button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
