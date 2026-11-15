/**
 * Le prologue (core/prologue.ts : cinq tableaux, un texte par monde) : la caméra quitte le héros et cadre, tour à tour, la Citadelle, la tour de Malvrek, le Brouillard de l'Oubli,
 * Maître Ysaline puis le héros prêt à partir (`GameWorld.setCinematic`) ; chaque tableau est lu de la voix enregistrée du narrateur ou de Maître Ysaline. Le texte est caché d'abord (un
 * bouton « Texte » l'affiche) et s'affiche d'office quand la voix n'a rien dit ; sans clic, le tableau suivant vient seul après la voix. « Suite » avance, « Passer » ou Échap termine.
 * Le texte reste dans la page même caché (lecteurs d'écran).
 */
import { useEffect, useRef, useState } from 'react'
import type { Services } from '../app/services'
import { PAUSE_AFTER_VOICE, readingTime, SILENT_BELOW, type Tableau } from '../core/prologue'
import type { GameWorld } from '../game/GameWorld'

export function Prologue({ services, world, list, onDone }: { services: Services; world: GameWorld; list: Tableau[]; onDone: () => void }) {
  const [index, setIndex] = useState(0)
  const [showText, setShowText] = useState(false)
  const [silent, setSilent] = useState(false)
  const done = useRef(false)
  const tableau = list[index]!
  const last = index === list.length - 1

  /** Termine une seule fois (Échap, « Passer », fin du dernier tableau). */
  function finish() {
    if (done.current) return
    done.current = true
    onDone()
  }

  function next() {
    if (last) finish()
    else setIndex((i) => i + 1)
  }

  // La page se met en mode cinéma (barre du haut, mini-carte et aides cachées) le temps du prologue ; la caméra revient derrière le héros à la fin.
  useEffect(() => {
    document.documentElement.classList.add('en-prologue')
    return () => {
      document.documentElement.classList.remove('en-prologue')
      world.setCinematic(null)
    }
  }, [world])

  // Un tableau : la caméra glisse vers son plan, la voix lit son texte ; après la voix (ou le temps de lire, si elle n'a rien dit), le suivant vient seul.
  useEffect(() => {
    world.setCinematic(tableau.plan)
    setSilent(false)
    let cancelled = false
    let timer: number | undefined
    const started = performance.now()
    void services.voice.say([tableau.texte]).then(() => {
      if (cancelled) return
      const elapsed = performance.now() - started
      const mute = elapsed < SILENT_BELOW // la voix s'est arrêtée tout de suite : rien n'a été dit, le texte s'affiche d'office
      if (mute) setSilent(true)
      timer = window.setTimeout(next, mute ? Math.max(0, readingTime(tableau.texte) - elapsed) : PAUSE_AFTER_VOICE)
    })
    const token = services.voice.token
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      services.voice.stopIf(token, 'prologue')
    }
  }, [index])

  // Échap termine, la flèche droite avance (le clic sur un bouton garde son rôle).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  })

  const visible = showText || silent
  return (
    <div className="prologue" role="dialog" aria-label="Prologue" data-testid="prologue" data-tableau={tableau.id}>
      <div className="prologue-bar top" aria-hidden="true" />
      <div className="prologue-bar bottom" aria-hidden="true" />
      <section className="panel prologue-panel">
        <header className="prologue-head">
          <h2 data-testid="prologue-titre">{tableau.titre}</h2>
          <span className="prologue-who">{tableau.qui}</span>
          <ol className="prologue-dots" aria-label={`Tableau ${index + 1} sur ${list.length}`} data-testid="prologue-points">
            {list.map((t, i) => (
              <li key={t.id} className={i === index ? 'on' : i < index ? 'past' : ''} aria-hidden="true" />
            ))}
          </ol>
        </header>
        <p className={visible ? 'prologue-text' : 'sr-only'} data-testid="prologue-texte" data-visible={visible ? 'oui' : 'non'}>{tableau.texte}</p>
        <div className="prologue-actions">
          <button type="button" className="secondary small" aria-pressed={visible} disabled={silent} data-testid="prologue-bouton-texte" onClick={() => setShowText((v) => !v)}>
            {visible ? 'Cacher le texte' : 'Texte'}
          </button>
          <button type="button" className="secondary small" data-testid="prologue-passer" onClick={finish}>Passer <kbd>Échap</kbd></button>
          <button type="button" className="primary small" autoFocus data-testid="prologue-suite" onClick={next}>{last ? 'En route !' : 'Suite'}</button>
        </div>
      </section>
    </div>
  )
}
