/**
 * Le stand de tir de la Lice : six tirs calculés, sans réflexe ni chrono. Jules (6e) mesure un angle sur un rapporteur géant peint au sol ; Tom (2nde) donne le
 * coefficient directeur de la droite de son arbalète. Le tir part **exactement** dans la direction choisie : on voit où il va et on corrige soi-même. Règles
 * dans core/tir.ts, série et XP dans core/lice.ts (testés) ; ici le dessin (SVG, vu d'en haut pour le rapporteur, de face pour le repère) et l'enchaînement des
 * écrans, comme `PontBridge`. Seul le premier tir de chaque cible compte comme réponse ; les suivants servent à corriger. Clavier : flèches pour changer la
 * valeur (angle ou numérateur), Entrée pour tirer, Échap pour quitter.
 */
import { useEffect, useRef, useState } from 'react'
import { startLiceSession, type LiceSession } from '../app/liceSession'
import type { Services } from '../app/services'
import type { Accommodations } from '../core/accessibility'
import type { Item } from '../core/items'
import {
  finishRound, finishText, finishTitle, GAME_MODE, introText, isOver, type LiceState, NOT_READY, roundLabel, START, START_LABEL, successText, TITLES,
} from '../core/lice'
import type { SaveData } from '../core/save'
import { afterActivity, passesText, sphinxOf, takePassageNews } from '../core/sphinx/island'
import {
  angleAdvice, directionOf, hitsAngle, lineAdvice, lineFrom, lineHits, type LineSpec, protractorFrom, type ProtractorSpec, rangeOf, shotEnd, slopeText, stepAngle,
  stepDenominator, stepNumerator, ticksOf,
} from '../core/tir'
import { E2eQuestion } from './E2eQuestion'
import { LiceCard } from './LiceCard'

const KIND = 'tir' as const
/** Le temps de voir partir la flèche avant que le stand ne dise où elle est allée. */
const FLIGHT_MS = 700

type Phase =
  | { kind: 'intro' }
  | { kind: 'preparing' }
  | { kind: 'unavailable' }
  | { kind: 'notready' }
  | { kind: 'play' }
  | { kind: 'finish'; lines: string[] }

/** Un tir déjà parti dans cette cible (le rapporteur garde ses flèches, le repère ses traces). */
type Shot = { angle: number } | { n: number; d: number }

// --- Le rapporteur vu d'en haut -------------------------------------------------------------------------------------------------------------------------
const PS = 48 // pixels par mètre
const PR = 4.2 * PS // rayon de l'arc gradué
const PCX = 350
const PCY = 362

function ProtractorView({ spec, shots, hit, flying }: { spec: ProtractorSpec; shots: { angle: number; hit: boolean }[]; hit: boolean; flying: boolean }) {
  const at = (measured: number, radius: number, fromReference = false) => {
    const d = directionOf(measured, fromReference ? spec.referenceLeft : false)
    return { x: PCX + d.x * radius, y: PCY - d.y * radius }
  }
  const target = at(spec.angle, spec.distance * PS, true)
  const dense = spec.labels < 30
  const side = spec.referenceLeft ? -1 : 1
  return (
    <svg
      className="tir-scene"
      viewBox="0 0 700 400"
      role="img"
      aria-label={`Rapporteur géant de 0 à 180 degrés, ligne de départ à ${spec.referenceLeft ? 'gauche' : 'droite'}. Une cible est posée au-delà de l'arc : mesure son angle depuis la ligne de départ.${
        shots.length > 0 ? ` Tirs déjà partis : ${shots.map((s) => `${s.angle} degrés, ${s.hit ? 'dans la cible' : 'manqué'}`).join(' ; ')}.` : ''
      }`}
      data-testid="tir-rapporteur"
    >
      <rect x={0} y={0} width={700} height={400} className="tir-ground" />
      <path d={`M ${PCX - PR} ${PCY} A ${PR} ${PR} 0 0 1 ${PCX + PR} ${PCY} Z`} className="tir-disc" />
      <path d={`M ${PCX - PR} ${PCY} A ${PR} ${PR} 0 0 1 ${PCX + PR} ${PCY}`} className="tir-rim" />
      {ticksOf(spec).map((t) => {
        const from = at(t.k, PR)
        const to = at(t.k, PR - (t.long ? 0.6 : 0.3) * PS)
        return <line key={t.k} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="tir-tick" />
      })}
      <line x1={PCX - PR - 14} y1={PCY} x2={PCX + PR + 14} y2={PCY} className="tir-diameter" />
      <line x1={PCX} y1={PCY} x2={PCX + side * (PR + 1.2 * PS)} y2={PCY} className="tir-start" data-testid="tir-ligne-depart" />
      <text x={PCX + side * (PR - 1.6 * PS)} y={PCY + 26} textAnchor="middle" className="tir-start-label">ligne de départ</text>
      <g className="tir-target" data-testid="tir-cible" data-hit={hit ? 'oui' : undefined}>
        <circle cx={target.x} cy={target.y} r={26} className="ring-a" />
        <circle cx={target.x} cy={target.y} r={19.5} className="ring-b" />
        <circle cx={target.x} cy={target.y} r={13} className="ring-a" />
        <circle cx={target.x} cy={target.y} r={6.5} className="ring-c" />
      </g>
      {shots.map((s, i) => {
        const dir = directionOf(s.angle, spec.referenceLeft)
        const reach = s.hit ? spec.distance - 0.08 : spec.distance + 0.4
        const from = { x: PCX + dir.x * 0.6 * PS, y: PCY - dir.y * 0.6 * PS }
        const to = { x: PCX + dir.x * reach * PS, y: PCY - dir.y * reach * PS }
        const fresh = i === shots.length - 1 && flying
        return (
          <g key={i} className={`tir-shot ${s.hit ? 'hit' : 'miss'}${fresh ? ' fresh' : ''}`} data-testid={`tir-fleche-${i}`}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} pathLength={1} />
            <circle cx={to.x} cy={to.y} r={5} />
            {!s.hit && <text x={to.x + dir.x * 22} y={to.y - dir.y * 22 + 5} textAnchor="middle" className="tir-shot-label">{s.angle}°</text>}
          </g>
        )
      })}
      {ticksOf(spec).filter((t) => t.long).map((t) => {
        // Les nombres passent au-dessus des flèches (une flèche juste traverse la graduation de la cible) ; 0 et 180 se lisent sous la ligne, pas dessus.
        const edge = t.k === 0 || t.k === 180
        const outer = at(t.k, PR + 0.45 * PS)
        const inner = at(t.k, PR - 1.0 * PS)
        return (
          <g key={t.k} className="tir-numbers">
            <text x={outer.x} y={outer.y + (edge ? 20 : 5)} textAnchor="middle" className={`tir-number${dense ? ' dense' : ''}`}>{t.k}</text>
            {spec.doubleScale && <text x={inner.x} y={inner.y + 4} textAnchor="middle" className="tir-number second">{180 - t.k}</text>}
          </g>
        )
      })}
      <g className="tir-archer">
        <circle cx={PCX} cy={PCY} r={11} />
        <circle cx={PCX} cy={PCY} r={4} className="core" />
      </g>
    </svg>
  )
}

// --- Le repère de l'arbalète, de face -------------------------------------------------------------------------------------------------------------------
const U = 44 // pixels par unité du repère
const OX = 84
const OY = 392

function LineView({ spec, shots, hit, flying }: { spec: LineSpec; shots: { n: number; d: number; hit: boolean }[]; hit: boolean; flying: boolean }) {
  const px = (x: number) => OX + x * U
  const py = (y: number) => OY - y * U
  return (
    <svg
      className="tir-scene"
      viewBox="0 0 640 440"
      role="img"
      aria-label={`Repère de ${spec.width} sur ${spec.height}. L'arbalète est sur l'axe des ordonnées, au point (0 ; ${spec.start.y}). La cible est au point (${spec.target.x} ; ${spec.target.y}).${
        shots.length > 0 ? ` Tirs déjà partis : ${shots.map((s) => `coefficient ${slopeText(s.n, s.d)}, ${s.hit ? 'dans la cible' : 'manqué'}`).join(' ; ')}.` : ''
      }`}
      data-testid="tir-repere"
    >
      <rect x={30} y={14} width={580} height={414} rx={10} className="tir-board" />
      {Array.from({ length: spec.width + 1 }, (_, x) => <line key={`gx${x}`} x1={px(x)} y1={py(0)} x2={px(x)} y2={py(spec.height)} className="tir-grid" />)}
      {Array.from({ length: spec.height + 1 }, (_, y) => <line key={`gy${y}`} x1={px(0)} y1={py(y)} x2={px(spec.width)} y2={py(y)} className="tir-grid" />)}
      <line x1={px(0)} y1={py(0)} x2={px(spec.width) + 16} y2={py(0)} className="tir-axis" />
      <line x1={px(0)} y1={py(0)} x2={px(0)} y2={py(spec.height) - 16} className="tir-axis" />
      {Array.from({ length: spec.width }, (_, i) => <text key={`lx${i}`} x={px(i + 1)} y={py(0) + 20} textAnchor="middle" className="tir-number axis">{i + 1}</text>)}
      {Array.from({ length: spec.height + 1 }, (_, y) => <text key={`ly${y}`} x={px(0) - 12} y={py(y) + 5} textAnchor="end" className="tir-number axis">{y}</text>)}
      <text x={px(spec.width) + 24} y={py(0) + 5} className="tir-number">x</text>
      <text x={px(0) - 5} y={py(spec.height) - 22} textAnchor="end" className="tir-number">y</text>
      {shots.map((s, i) => {
        const end = shotEnd(s.n, s.d, spec)
        const fresh = i === shots.length - 1 && flying
        return (
          <g key={i} className={`tir-shot ${s.hit ? 'hit' : 'miss'}${fresh ? ' fresh' : ''}`} data-testid={`tir-trace-${i}`}>
            <line x1={px(0)} y1={py(spec.start.y)} x2={px(end.x)} y2={py(end.y)} pathLength={1} />
            <circle cx={px(end.x)} cy={py(end.y)} r={5} />
          </g>
        )
      })}
      <g className="tir-bow">
        <rect x={px(0) - 24} y={py(spec.start.y) - 4} width={30} height={8} rx={2} className="body" />
        <rect x={px(0) - 3} y={py(spec.start.y) - 17} width={6} height={34} rx={2} className="arc" />
      </g>
      <text x={px(0) + 14} y={py(spec.start.y) - 22} className="tir-point-label">(0 ; {spec.start.y})</text>
      <g className="tir-target" data-testid="tir-cible" data-hit={hit ? 'oui' : undefined}>
        <circle cx={px(spec.target.x)} cy={py(spec.target.y)} r={17} className="ring-a" />
        <circle cx={px(spec.target.x)} cy={py(spec.target.y)} r={12.5} className="ring-b" />
        <circle cx={px(spec.target.x)} cy={py(spec.target.y)} r={8} className="ring-a" />
        <circle cx={px(spec.target.x)} cy={py(spec.target.y)} r={4} className="ring-c" />
      </g>
      <text x={px(spec.target.x)} y={py(spec.target.y) - 26} textAnchor="middle" className="tir-point-label">({spec.target.x} ; {spec.target.y})</text>
    </svg>
  )
}

function Stepper({ label, value, onChange, testId }: { label: string; value: string; onChange: (direction: -1 | 1) => void; testId: string }) {
  return (
    <span className="tir-stepper">
      <button type="button" className="secondary" aria-label={`Diminuer ${label}`} data-testid={`${testId}-moins`} onClick={() => onChange(-1)}>−</button>
      <output className="tir-value" aria-label={label} data-testid={testId}>{value}</output>
      <button type="button" className="secondary" aria-label={`Augmenter ${label}`} data-testid={`${testId}-plus`} onClick={() => onChange(1)}>+</button>
    </span>
  )
}

export function TirRange({ services, accommodations, demo, data, onSave, onClose }: {
  services: Services
  accommodations: Accommodations
  demo: boolean
  data: SaveData
  /** Range la partie : l'XP de chaque cible touchée, puis le passage du Sphinx à la fin de la série. */
  onSave: (next: SaveData) => void
  onClose: () => void
}) {
  const level = services.session.profile?.level ?? '6e'
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' })
  const [run, setRun] = useState<LiceState>(START)
  const [item, setItem] = useState<Item | null>(null)
  const [shots, setShots] = useState<(Shot & { hit: boolean })[]>([])
  const [angle, setAngle] = useState(0)
  const [numerator, setNumerator] = useState(1)
  const [denominator, setDenominator] = useState(1)
  const [flying, setFlying] = useState(false)
  const [done, setDone] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null)
  const sessionRef = useRef<LiceSession | null>(null)
  const ending = useRef<Promise<void> | null>(null)
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

  const mode = item ? rangeOf(item.visual) : null
  const protractor = mode === 'angle' ? protractorFrom(item!.visual) : null
  const line = mode === 'droite' ? lineFrom(item!.visual) : null
  const locked = flying || done

  /** Referme la session de la série, une seule fois : la référence est vidée tout de suite (un « Retour à l'île » rapide ne la referme pas deux fois). */
  function closeSeries(): Promise<void> {
    if (ending.current) return ending.current
    const open = sessionRef.current
    sessionRef.current = null
    ending.current = open ? open.end() : Promise.resolve()
    return ending.current
  }

  /** Referme la série (session du temps de jeu) puis rend l'île. */
  async function leave() {
    if (closing.current) return
    closing.current = true
    await closeSeries() // si la fin de la série a déjà lancé la fermeture, on l'attend au lieu de la refaire
    onClose()
  }

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
      void closeSeries()
      if (spoke.current !== null) services.voice.stopIf(spoke.current, 'stand de tir')
    },
    [],
  )

  // Tests dans le navigateur (&e2e) : la cible en cours et de quoi la viser juste (l'angle, ou un coefficient atteignable avec les pas permis).
  useEffect(() => {
    const handle = (window as unknown as { __aldoria?: Record<string, unknown> }).__aldoria
    if (handle && item) {
      if (protractor) handle.tir = { mode: 'angle', angle: protractor.angle, minor: protractor.minor, round: run.round }
      else if (line) {
        let found: [number, number] | null = null
        for (let d = 1; d <= 6 && !found; d += 1) for (let n = -12; n <= 12 && !found; n += 1) if (lineHits(n, d, line)) found = [n, d]
        handle.tir = { mode: 'droite', n: found?.[0] ?? 0, d: found?.[1] ?? 1, round: run.round }
      }
    }
    return () => {
      if (handle) delete handle.tir
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
    // Six cibles qui comptent : une activité remplie, donc un passage pour la barque du Sphinx.
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
    void closeSeries()
    setPhase({ kind: 'finish', lines })
  }

  function nextRound(from: LiceState) {
    state.current = from
    setRun(from)
    if (isOver(from) || services.session.timeOver()) return finishSeries(from)
    const next = services.questions.next('enigme')
    if (!next || rangeOf(next.visual) === null) {
      void closeSeries()
      return setPhase({ kind: 'notready' })
    }
    setItem(next)
    setShots([])
    setAngle(0)
    setNumerator(1)
    setDenominator(1)
    setFlying(false)
    setDone(false)
    setFeedback(null)
    tries.current = 0
    hintUsed.current = false
    shownAt.current = performance.now()
    setPhase({ kind: 'play' })
    if (accommodations.auto_read) say(next.speech?.prompt ?? next.prompt)
  }

  function fire() {
    if (!item || locked) return
    tries.current += 1
    const first = tries.current === 1
    const hit = protractor ? hitsAngle(angle, protractor) : lineHits(numerator, denominator, line!)
    const value = protractor ? String(angle) : slopeText(numerator, denominator)
    // Seul le premier tir de la cible compte comme réponse (suivi des notions) ; les suivants servent à corriger.
    if (first) services.questions.submit(item, value, performance.now() - shownAt.current, hintUsed.current, GAME_MODE[KIND])
    setShots((s) => [...s, protractor ? { angle, hit } : { n: numerator, d: denominator, hit }])
    setFlying(true)
    setFeedback(null)
    services.sfx.play('spell')
    timer.current = window.setTimeout(() => {
      timer.current = null
      setFlying(false)
      if (hit) {
        const finished = finishRound(state.current, item.difficulty, tries.current)
        state.current = finished.state
        setRun(finished.state)
        saved.current = { ...saved.current, xp: saved.current.xp + finished.gain }
        onSave(saved.current)
        services.sfx.play('crit')
        setDone(true)
        setFeedback({ text: successText(KIND, finished.gain, tries.current, item.explanation), ok: true })
        return
      }
      services.sfx.play('wrong')
      let advice = protractor ? angleAdvice(angle, protractor) : lineAdvice(numerator, denominator, line!)
      // L'indice sort une fois, au troisième essai raté ; le bouton « Indice » le remontre.
      if (tries.current >= 3 && !hintUsed.current) {
        advice += ` ${item.hint}`
        hintUsed.current = true
      }
      setFeedback({ text: advice, ok: false })
    }, FLIGHT_MS)
  }

  function showHint() {
    if (!item) return
    hintUsed.current = true
    setFeedback({ text: item.hint, ok: true })
  }

  const changeMain = (direction: -1 | 1) => {
    if (locked) return
    if (protractor) setAngle((a) => stepAngle(a, direction, protractor.minor))
    else setNumerator((n) => stepNumerator(n, direction))
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
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault()
        changeMain(1)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault()
        changeMain(-1)
      } else if (e.key === 'Enter') {
        // Entrée tire, même juste après un clic sur « − » ou « + » (le bouton garde le focus : sans cela, Entrée le presserait encore) ; sur les autres boutons, elle les active.
        const stepper = e.target instanceof Element && e.target.closest('.tir-stepper') !== null
        if (stepper) e.preventDefault()
        if (stepper || !(e.target instanceof HTMLButtonElement)) fire()
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  })

  const hit = done
  return (
    <>
      {phase.kind === 'intro' && (
        <LiceCard
          testId="tir"
          title={TITLES[KIND]}
          lines={[introText(KIND, level)]}
          actions={[{ label: 'Plus tard', run: () => void leave() }, { label: START_LABEL[KIND], primary: true, run: () => void begin() }]}
        />
      )}
      {phase.kind === 'preparing' && <div className="overlay" role="status" data-testid="tir"><section className="panel dialog"><p>Les cibles se préparent…</p></section></div>}
      {phase.kind === 'unavailable' && (
        <LiceCard testId="tir" title={TITLES[KIND]} lines={['Il faut une connexion pour préparer les cibles.']} actions={[{ label: "Retour à l'île", primary: true, run: () => void leave() }]} />
      )}
      {phase.kind === 'notready' && <LiceCard testId="tir" title={TITLES[KIND]} lines={[NOT_READY[KIND]]} actions={[{ label: 'Retour', primary: true, run: () => void leave() }]} />}
      {phase.kind === 'finish' && <LiceCard testId="tir-bilan" title={finishTitle(KIND)} lines={phase.lines} actions={[{ label: "Retour à l'île", primary: true, run: () => void leave() }]} />}
      {phase.kind === 'play' && item && (protractor || line) && (
        <div className="overlay tir-overlay" role="dialog" aria-modal="true" aria-labelledby="tir-cible-titre" data-testid="tir-jeu">
          {e2e && <E2eQuestion item={item} />}
          <section className="panel dialog tir-panel">
            <div className="pont-head">
              <h2 id="tir-cible-titre">{TITLES[KIND]} · {roundLabel(KIND, { ...run, round: run.round - (done ? 1 : 0) })}</h2>
              <span className="pont-score" data-testid="tir-score">{run.firstTry} du premier coup</span>
              <button type="button" className="secondary small" onClick={() => say(item.speech?.prompt ?? item.prompt)}>🔊 Écouter</button>
              <button type="button" className="secondary small" data-testid="tir-indice" onClick={showHint}>Indice</button>
              <button type="button" className="secondary small" onClick={() => void leave()}>Quitter <kbd>Échap</kbd></button>
            </div>
            <p className="pont-prompt">{item.prompt}</p>
            {protractor && <ProtractorView spec={protractor} shots={shots.map((s) => ({ angle: (s as { angle: number }).angle, hit: s.hit }))} hit={hit} flying={flying} />}
            {line && <LineView spec={line} shots={shots.map((s) => ({ n: (s as { n: number }).n, d: (s as { d: number }).d, hit: s.hit }))} hit={hit} flying={flying} />}
            <div className="tir-controls">
              {protractor ? (
                <>
                  <span className="tir-label">Angle :</span>
                  <Stepper label="l’angle" value={`${angle}°`} onChange={changeMain} testId="tir-valeur" />
                </>
              ) : (
                <>
                  <span className="tir-label">a =</span>
                  <Stepper label="le numérateur" value={String(numerator)} onChange={changeMain} testId="tir-num" />
                  <span className="tir-label">/</span>
                  <Stepper label="le dénominateur" value={String(denominator)} onChange={(d) => !locked && setDenominator((v) => stepDenominator(v, d))} testId="tir-den" />
                </>
              )}
              {done ? (
                <button type="button" className="primary" autoFocus data-testid="tir-suite" onClick={() => nextRound(state.current)}>
                  {isOver(state.current) ? 'Voir le bilan' : 'Cible suivante'}
                </button>
              ) : (
                <button type="button" className="primary" data-testid="tir-tirer" disabled={locked} onClick={fire}>Tirer <kbd>Entrée</kbd></button>
              )}
            </div>
            <p className={`pont-feedback ${feedback ? (feedback.ok ? 'good' : 'bad') : ''}`} role="status" data-testid="tir-message">{feedback?.text ?? ''}</p>
          </section>
        </div>
      )}
    </>
  )
}
