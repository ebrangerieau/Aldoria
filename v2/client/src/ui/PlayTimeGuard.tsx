/**
 * Fin de séance et rappel de pause (limite fixée par le parent, PRD US-11 ; core/playTime.ts). Vérifie une
 * fois par seconde, jamais au milieu d'une phrase : le panneau s'affiche par-dessus le jeu et fige le monde.
 * La progression est déjà sauvegardée. Aucune question n'est coupée : celle qui est ouverte reste derrière.
 */
import { useEffect, useRef, useState } from 'react'
import type { Services } from '../app/services'
import { Dialog } from './Dialogs'

type State = 'ok' | 'pause' | 'over'

export function PlayTimeGuard({ services, pauseMinutes, onBlock, onEnd }: {
  services: Services
  /** Rappel de pause réglé par le parent, en minutes (0 : aucun). */
  pauseMinutes: number
  /** Le monde 3D doit se figer (true) ou reprendre (false). */
  onBlock: (blocked: boolean) => void
  onEnd: () => void
}) {
  const [state, setState] = useState<State>('ok')
  const previous = useRef<State>('ok')

  useEffect(() => {
    const timer = window.setInterval(() => {
      const { session } = services
      if (session.timeOver()) setState('over')
      else if (session.clock.pauseDue(pauseMinutes)) setState((s) => (s === 'ok' ? 'pause' : s))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [services, pauseMinutes])

  // On ne touche aux commandes du monde que lorsque l'état change (un panneau déjà ouvert garde la main).
  useEffect(() => {
    if (previous.current !== state) onBlock(state !== 'ok')
    previous.current = state
  }, [state, onBlock])

  if (state === 'ok') return null
  if (state === 'over') {
    const text = services.session.clock.restText()
    return (
      <div data-testid="fin-seance">
        <Dialog
          title="Belle séance !"
          text={text}
          actions={[
            { label: '🔊 Écouter', run: () => void services.voice.say([text]) },
            { label: 'Terminer', primary: true, run: onEnd },
          ]}
        />
      </div>
    )
  }
  return (
    <div data-testid="rappel-pause">
      <Dialog
        title="Une petite pause ?"
        text="Tu joues depuis un moment. Une pause fait du bien : tu peux continuer ou t'arrêter quand tu veux."
        actions={[
          {
            label: 'Continuer',
            run: () => {
              services.session.clock.snoozePause(pauseMinutes)
              setState('ok')
            },
          },
          { label: 'Faire une pause', primary: true, run: onEnd },
        ]}
      />
    </div>
  )
}
