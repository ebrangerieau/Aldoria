/**
 * Une manche de la balance géante (salle-énigme de la Tour des Fractions) : la question se résout sur la balance elle-même, que la scène dessine derrière ce panneau.
 * L'enfant enlève la même chose des deux côtés (elle reste en équilibre : c'est le raisonnement de la pré-algèbre), puis essaie une masse pour une boîte : le fléau
 * penche, chaque boîte affiche la masse essayée. Règles et textes dans core/balanceEnigma.ts (testés) ; ici l'affichage et le clavier. Seul le premier essai est
 * enregistré comme réponse (suivi des notions) ; les suivants servent à corriger. Clavier : flèches (ou + et −) pour la masse, Entrée pour essayer, Échap pour
 * y revenir plus tard.
 */
import { useEffect, useRef, useState } from 'react'
import type { Services } from '../app/services'
import type { Accommodations } from '../core/accessibility'
import {
  article, attempt, boxesBothSides, canRemoveBoth, canStep, describe, instruction, MAX_GUESS, REMOVED_MESSAGE, removeFromBoth, removeLabel, spoken, startRound,
  stepGuess, useHint, type BalanceRound,
} from '../core/balanceEnigma'
import type { Item } from '../core/items'
import type { RigView } from '../game/balanceRig'

/** Le temps de voir les boîtes en équilibre avant la suite : après une correction, le temps de lire l'explication. */
const SOLVED_MS = 1400
const SOLVED_LONG_MS = 2600

export type BalanceOutcome = { kind: 'solved'; firstTry: boolean } | { kind: 'later' }

export function viewOf(round: BalanceRound): RigView {
  return { state: round.state, names: round.names, heavier: round.heavier, shown: round.shown }
}

export function BalanceEnigma({ services, item, title, accommodations, onShow, onBurst, onDone }: {
  services: Services
  item: Item
  title: string
  accommodations: Accommodations
  /** La scène montre l'état de la manche (boîtes, billes, masse essayée, fléau). */
  onShow: (view: RigView) => void
  /** Une petite gerbe sur les plateaux (la même chose enlevée des deux côtés). */
  onBurst: () => void
  onDone: (outcome: BalanceOutcome) => void
}) {
  const [round, setRound] = useState<BalanceRound>(() => startRound(item.visual))
  const [message, setMessage] = useState<{ text: string; tone: 'good' | 'bad' | 'plain' }>({ text: '', tone: 'plain' })
  const startedAt = useRef(performance.now())
  const timer = useRef<number | null>(null)
  const spoke = useRef<number | null>(null)
  const closing = useRef(false)
  const messageRef = useRef<HTMLParagraphElement>(null)
  /** Les gestes de la manche en cours, pour l'écouteur du clavier posé une seule fois. */
  const me = useRef<{ tryIt: () => void; bump: (delta: number) => void; later: () => void }>({ tryIt: () => {}, bump: () => {}, later: () => {} })

  useEffect(() => {
    onShow(viewOf(round))
  }, [round])

  const say = (text: string) => {
    void services.voice.say([text])
    spoke.current = services.voice.token
  }
  useEffect(() => {
    if (accommodations.auto_read) say(spoken(round))
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
      if (spoke.current !== null) services.voice.stopIf(spoke.current, 'balance géante')
    }
  }, [])

  // À texte agrandi le panneau défile : le retour d'un essai se met en vue au-dessus de la rangée collée en bas (`scroll-padding-bottom` du panneau).
  useEffect(() => {
    if (message.text) messageRef.current?.scrollIntoView({ block: 'nearest' })
  }, [message])

  // Tests dans le navigateur (&e2e) : la question de la manche et la masse à trouver, comme `question` pour une question ordinaire.
  useEffect(() => {
    const handle = (window as unknown as { __aldoria?: Record<string, unknown> }).__aldoria
    if (handle) handle.balance = { item, round }
    return () => {
      if (handle) delete handle.balance
    }
  }, [item, round])

  function remove(what: 'boxes' | 'units') {
    if (!canRemoveBoth(round, what)) return
    services.sfx.play('heal')
    onBurst()
    setRound(removeFromBoth(round, what))
    setMessage({ text: REMOVED_MESSAGE, tone: 'plain' })
  }

  function tryIt() {
    if (round.done || closing.current) return
    const result = attempt(round, item)
    if (result.first) {
      // Première réponse : enregistrée comme une réponse à la question (suivi des notions).
      services.questions.submit(item, String(round.guess), performance.now() - startedAt.current, round.hintUsed, 'enigme')
    }
    services.sfx.play('spell')
    setRound(result.round)
    setMessage({ text: result.message, tone: result.tone })
    if (accommodations.auto_read) say(result.message)
    if (result.balanced) {
      closing.current = true
      timer.current = window.setTimeout(() => onDone({ kind: 'solved', firstTry: result.first }), result.first ? SOLVED_MS : SOLVED_LONG_MS)
    }
  }

  function bump(delta: number) {
    setRound((r) => stepGuess(r, delta))
  }

  function hint() {
    if (round.done) return
    setRound(useHint(round))
    setMessage({ text: item.hint, tone: 'plain' })
  }

  function later() {
    if (closing.current) return
    closing.current = true
    onDone({ kind: 'later' })
  }

  me.current = { tryIt, bump, later }
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      const t = e.target instanceof Element ? e.target : null
      const onButton = t?.closest('button') ?? null
      // Entrée sur un bouton le presse ; sur la masse (− et +), elle essaie, sinon le « + » déjà sélectionné serait pressé de nouveau.
      const stepper = !!onButton && onButton.closest('.balance-stepper') !== null
      if (e.key === 'Enter') {
        if (onButton && !stepper) return
        e.preventDefault()
        me.current.tryIt()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        me.current.later()
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === '+') {
        e.preventDefault()
        me.current.bump(1)
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === '-') {
        e.preventDefault()
        me.current.bump(-1)
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])

  const { names } = round
  return (
    <div className="overlay balance-overlay" role="dialog" aria-modal="true" aria-labelledby="balance-titre" data-testid="balance-enigme">
      <section className="panel balance-panel">
        <header className="question-head">
          <h2 id="balance-titre">{title}</h2>
          <button type="button" className="icon-button" onClick={() => say(spoken(round))} aria-label="Écouter la question">🔊 Écouter</button>
        </header>
        <p className="prompt">{instruction(names)}</p>
        <p className="balance-state" data-testid="balance-etat">{describe(round.state, names)}</p>
        {/* Le retour de l'essai juste sous l'état des plateaux : à texte agrandi le panneau défile, et ce message ne doit jamais tomber sous la rangée collée en bas. */}
        <p ref={messageRef} className={`balance-message ${message.tone}`} role="status" data-testid="balance-message">{message.text}</p>
        <div className="balance-tools">
          <button type="button" className="secondary" data-testid="balance-enlever-unites" disabled={!canRemoveBoth(round, 'units')} onClick={() => remove('units')}>
            {removeLabel(round, 'units')}
          </button>
          {boxesBothSides(round) && (
            <button type="button" className="secondary" data-testid="balance-enlever-boites" disabled={!canRemoveBoth(round, 'boxes')} onClick={() => remove('boxes')}>
              {removeLabel(round, 'boxes')}
            </button>
          )}
          <button type="button" className="secondary" data-testid="balance-indice" disabled={round.done || round.hintUsed} onClick={hint}>Un indice ?</button>
          <button type="button" className="secondary" data-testid="balance-plus-tard" onClick={later}>Plus tard <kbd>Échap</kbd></button>
        </div>
        <div className="balance-controls">
          <span className="balance-label">{article(names)} {names.box[0]} pèse</span>
          <span className="balance-stepper">
            <button type="button" className="secondary" data-testid="balance-moins" aria-label="Moins" disabled={!canStep(round, -1)} onClick={() => bump(-1)}>−</button>
            <output className="balance-value" data-testid="balance-valeur" aria-live="polite">{round.guess}</output>
            <button type="button" className="secondary" data-testid="balance-plus" aria-label="Plus" disabled={!canStep(round, 1)} onClick={() => bump(1)}>+</button>
          </span>
          <span className="balance-label">{names.unit[1]}</span>
          <button type="button" className="primary" data-testid="balance-essayer" disabled={round.done} onClick={tryIt}>
            Essayer sur la balance <kbd>Entrée</kbd>
          </button>
        </div>
        <p className="sr-only">La masse va de 0 à {MAX_GUESS}.</p>
      </section>
    </div>
  )
}
