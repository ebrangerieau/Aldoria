/**
 * Panneau d'une question (repris de la v1, en HTML) : énoncé, formule, réponse, indice,
 * « Écouter », « Pas vu en classe » (deux appuis), puis la correction avec l'explication.
 * Une erreur n'est jamais punie : elle montre la méthode, et la notion reviendra plus tard.
 */
import { useEffect, useRef, useState } from 'react'
import type { Services } from '../app/services'
import type { Accommodations } from '../core/accessibility'
import { answerText } from '../core/answerText'
import type { Item, UserInput } from '../core/items'
import type { SubmitResult } from '../core/questionService'
import { Formula } from './Formula'
import { VisualFor } from './widgets/Visuals'
import { widgetFor } from './widgets/Widgets'

export interface QuestionOutcome {
  item: Item
  result: SubmitResult | null // null : question mise de côté sans réponse
}

export function QuestionPanel({ services, item: first, title, gameMode, accommodations, success = 'Bravo !', onDone }: {
  services: Services
  item: Item
  title: string
  gameMode: string
  /** Ce que la bonne réponse déclenche dans le jeu (« la pierre s'éveille »). */
  success?: string
  accommodations: Accommodations
  onDone: (outcome: QuestionOutcome) => void
}) {
  const [item, setItem] = useState(first)
  const [hintShown, setHintShown] = useState(false)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [asideArmed, setAsideArmed] = useState(false)
  const shownAt = useRef(performance.now())
  const Widget = widgetFor(item)
  const speech = item.speech ?? {}

  const listen = () => {
    if (item.listen) void services.voice.say([item.listen.text], item.listen.lang)
    else void services.voice.say([speech.prompt ?? item.prompt, ...(speech.choices ?? item.choices ?? [])])
  }

  useEffect(() => {
    shownAt.current = performance.now()
    if (accommodations.auto_read || item.listen) listen()
    return () => services.voice.stop()
  }, [item])

  function answer(input: UserInput) {
    const elapsed = performance.now() - shownAt.current
    const res = services.questions.submit(item, input, elapsed, hintShown, gameMode)
    setResult(res)
    if (!res.correct && accommodations.auto_read) void services.voice.say([speech.explanation ?? item.explanation])
  }

  function setAside() {
    if (!asideArmed) {
      setAsideArmed(true)
      return
    }
    for (const notion of item.notions) services.session.setAside(notion)
    const replacement = services.questions.next(item.role)
    if (replacement && !services.session.isSetAside(replacement)) {
      setItem(replacement)
      setHintShown(false)
      setAsideArmed(false)
    } else {
      onDone({ item, result: null })
    }
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="question-titre">
      <section className="panel question-panel">
        <header className="question-head">
          <h2 id="question-titre">{title}</h2>
          <button type="button" className="icon-button" onClick={listen} aria-label="Écouter la question">🔊 Écouter</button>
        </header>
        <p className="prompt">{item.prompt}</p>
        {item.latex && <Formula latex={item.latex} svg={item.latex_hash ? services.session.pack?.formulas[item.latex_hash] : undefined} />}

        <VisualFor key={`visuel-${item.id}`} item={item} revealed={result ? { correct: result.correct, answer: answerText(item) } : null} />

        {!result && Widget && <Widget key={item.id} item={item} onAnswer={answer} disabled={false} />}
        {!result && !Widget && <p className="error">Ce type de question arrivera bientôt.</p>}

        {!result && (
          <footer className="question-tools">
            <button type="button" className="secondary" disabled={hintShown} onClick={() => setHintShown(true)}>Un indice ?</button>
            <button type="button" className={asideArmed ? 'warning' : 'secondary'} onClick={setAside}>
              {asideArmed ? 'Sûr ? Appuie encore' : 'Pas vu en classe'}
            </button>
          </footer>
        )}
        {!result && hintShown && <p className="hint-text" role="note">💡 {item.hint}</p>}

        {result && (
          <div className={result.correct ? 'feedback good' : 'feedback bad'} role="status">
            <p className="verdict">
              <span aria-hidden="true">{result.correct ? '✓' : '✗'}</span>{' '}
              {result.correct ? success : `Presque ! La réponse : ${answerText(item)}`}
            </p>
            {!result.correct && (
              <>
                <p className="explanation">{item.explanation}</p>
                <button type="button" className="icon-button" onClick={() => void services.voice.say([speech.explanation ?? item.explanation])}>
                  🔊 Écouter l'explication
                </button>
                <p className="hint">Pas de souci : cette notion reviendra un peu plus tard.</p>
              </>
            )}
            <div className="actions">
              <button type="button" className="primary" autoFocus onClick={() => onDone({ item, result })}>Continuer</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
