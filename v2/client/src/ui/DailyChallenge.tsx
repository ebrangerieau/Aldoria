/**
 * Défi du jour (Pierre du Jour), repris de la v1 : dix automatismes d'affilée, sans compte à rebours ; bilan avec record, série et
 * coffre de la semaine. Le déroulé et les textes sont dans core/dailyRun.ts (testé) ; ici, seulement l'enchaînement des écrans.
 * « Quitter » ramène à l'île à tout moment : un défi interrompu ne compte pas.
 */
import { useEffect, useRef, useState } from 'react'
import { startDailySession, type DailySession } from '../app/dailySession'
import type { Services } from '../app/services'
import type { Accommodations } from '../core/accessibility'
import { countedDay, QUESTIONS, today as localDay } from '../core/dailyChallenge'
import { DailyRun, GAME_MODE, introText, openChest, pips, titleFor, type DailyReport } from '../core/dailyRun'
import type { Item } from '../core/items'
import { answerXp } from '../core/progression'
import type { SaveData } from '../core/save'
import { E2eQuestion } from './E2eQuestion'
import { QuestionPanel, type QuestionOutcome } from './QuestionPanel'

type Phase =
  | { kind: 'intro' }
  | { kind: 'preparing' }
  | { kind: 'unavailable' }
  | { kind: 'question'; item: Item }
  | { kind: 'results'; report: DailyReport }
  | { kind: 'chest'; title: string; lines: string[] }

function Card({ title, lines, actions }: { title: string; lines: string[]; actions: { label: string; primary?: boolean; run: () => void }[] }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="defi-titre" data-testid="defi">
      <section className="panel dialog">
        <h2 id="defi-titre">{title}</h2>
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

export function DailyChallenge({ services, accommodations, demo, data, onSave, onClose }: {
  services: Services
  accommodations: Accommodations
  demo: boolean
  data: SaveData
  /** Range la partie après le bilan (XP, série, record) puis après le coffre. */
  onSave: (next: SaveData) => void
  onClose: () => void
}) {
  const today = localDay()
  const [run] = useState(() => new DailyRun(countedDay(data.daily.days, today), today))
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' })
  const [version, setVersion] = useState(0) // pastilles à jour après chaque réponse
  const sessionRef = useRef<DailySession | null>(null)
  const savedRef = useRef(data) // la partie la plus récente, même entre deux rendus
  savedRef.current = data
  const noSpeed = accommodations.no_speed

  // Le défi interrompu (Quitter, changement d'écran) referme sa session et rouvre celle de l'île.
  useEffect(
    () => () => {
      void sessionRef.current?.end()
      sessionRef.current = null
    },
    [],
  )

  async function begin() {
    setPhase({ kind: 'preparing' })
    const started = await startDailySession(services, demo)
    if (!started) return setPhase({ kind: 'unavailable' })
    sessionRef.current = started
    nextQuestion()
  }

  function nextQuestion() {
    const item = services.questions.next('automatisme')
    if (!item) return setPhase({ kind: 'unavailable' })
    setPhase({ kind: 'question', item })
  }

  function answered(outcome: QuestionOutcome) {
    if (outcome.result === null) return nextQuestion() // « Pas vu en classe » sans remplaçante : on en prend une autre, rien n'est compté
    const { item, result } = outcome
    run.answer(result.correct, outcome.timeMs ?? 0, Math.round(answerXp(item.difficulty) * result.rewardFactor))
    setVersion((v) => v + 1)
    if (!run.complete) return nextQuestion()
    const report = run.finish(savedRef.current.daily, noSpeed)
    if (!report) return setPhase({ kind: 'unavailable' })
    onSave({ ...savedRef.current, daily: report.state, xp: savedRef.current.xp + report.xp })
    services.sfx.play('victory')
    setPhase({ kind: 'results', report })
  }

  function openTheChest(report: DailyReport) {
    const chest = openChest(report.state, savedRef.current.items, today)
    onSave({ ...savedRef.current, daily: chest.state, items: chest.owned, xp: savedRef.current.xp + chest.xp })
    services.sfx.play('victory')
    setPhase({ kind: 'chest', title: chest.title, lines: chest.lines })
  }

  const title = titleFor(run.day, today)
  const index = run.results.length

  return (
    <>
      {phase.kind === 'intro' && (
        <Card
          title={title}
          lines={[introText(run.day, today, noSpeed)]}
          actions={[{ label: 'Plus tard', run: onClose }, { label: "C'est parti !", primary: true, run: () => void begin() }]}
        />
      )}
      {phase.kind === 'preparing' && (
        <div className="overlay" role="status" data-testid="defi">
          <section className="panel dialog"><p>Préparation du défi…</p></section>
        </div>
      )}
      {phase.kind === 'unavailable' && (
        <Card title="Défi indisponible" lines={['Il faut une connexion pour préparer le défi du jour.']} actions={[{ label: "Retour à l'île", primary: true, run: onClose }]} />
      )}
      {phase.kind === 'question' && (
        <>
          {new URLSearchParams(location.search).has('e2e') && <E2eQuestion item={phase.item} />}
          <QuestionPanel
            key={`${version}-${phase.item.id}`}
            services={services}
            item={phase.item}
            title={`${title} · question ${index + 1} sur ${QUESTIONS}`}
            gameMode={GAME_MODE}
            success="Bien joué !"
            accommodations={accommodations}
            onDone={answered}
          />
          <div className="daily-bar" data-testid="defi-barre">
            <ol aria-label={`Question ${index + 1} sur ${QUESTIONS}, ${run.correct} réussie${run.correct > 1 ? 's' : ''}`}>
              {pips(run.results).map((state, i) => (
                <li key={i} className={`pip ${state}`} aria-hidden="true">{state === 'juste' ? '✓' : state === 'faux' ? '✗' : ''}</li>
              ))}
            </ol>
            <button type="button" className="secondary small" onClick={onClose}>Quitter</button>
          </div>
        </>
      )}
      {phase.kind === 'results' && (
        <Card
          title={phase.report.title}
          lines={phase.report.lines}
          actions={
            phase.report.chestReady
              ? [{ label: 'Ouvrir le coffre de la semaine', primary: true, run: () => openTheChest(phase.report) }]
              : [{ label: "Retour à l'île", primary: true, run: onClose }]
          }
        />
      )}
      {phase.kind === 'chest' && <Card title={phase.title} lines={phase.lines} actions={[{ label: "Retour à l'île", primary: true, run: onClose }]} />}
    </>
  )
}
