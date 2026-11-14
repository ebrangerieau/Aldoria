/**
 * La note de plaisir de fin de lieu (v1 : ui/hud/rating_panel.gd) : « Comment as-tu trouvé ce lieu ? », cinq étoiles. Facultative :
 * « Passer » ne note rien (0). Au clavier, les touches 1 à 5 notent et Échap passe. La note s'envoie avec la fin de la session.
 */
import { useEffect, useRef, useState } from 'react'
import { MAX_RATING, RATING_WORDS, ratingWord } from '../core/quest/rating'

/** Le temps de voir les étoiles s'allumer avant de rendre la main. */
export const RATING_SETTLE_MS = 700

export function Rating({ title, onRated }: { title: string; onRated: (value: number) => void }) {
  const [chosen, setChosen] = useState(0)
  const done = useRef(false)

  function finish(value: number) {
    if (done.current) return
    done.current = true
    setChosen(value)
    if (value > 0) window.setTimeout(() => onRated(value), RATING_SETTLE_MS)
    else onRated(0)
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(0)
      else if (/^[1-5]$/.test(e.key)) finish(Number(e.key))
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="note-titre" data-testid="note">
      <section className="panel dialog rating">
        <h2 id="note-titre">{title}</h2>
        <p>Comment as-tu trouvé ce lieu ?</p>
        <div className="stars" role="group" aria-label="Ta note, de 1 à 5 étoiles">
          {Array.from({ length: MAX_RATING }, (_, i) => i + 1).map((value) => (
            <button
              key={value}
              type="button"
              className={`star ${value <= chosen ? 'lit' : ''}`}
              aria-label={`${value} étoile${value > 1 ? 's' : ''} : ${RATING_WORDS[value - 1]}`}
              aria-pressed={value <= chosen}
              data-testid={`etoile-${value}`}
              disabled={done.current}
              onClick={() => finish(value)}
            >
              <span aria-hidden="true">★</span>
            </button>
          ))}
        </div>
        <p className="rating-word" role="status" data-testid="note-mot">{ratingWord(chosen) || ' '}</p>
        <div className="actions">
          <button type="button" className="secondary" disabled={done.current} onClick={() => finish(0)}>Passer</button>
        </div>
      </section>
    </div>
  )
}
