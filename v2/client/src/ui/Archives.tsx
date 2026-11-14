/**
 * Les Archives (repris de la v1) : une étoile de maîtrise par notion, groupées par matière puis par chapitre. Le serveur donne la
 * maîtrise (core/archives.ts), l'écran la montre : jamais de note, jamais de comparaison, seulement « acquise », « fragile »,
 * « en cours », « à découvrir ». Hors connexion, le dernier état connu s'affiche.
 */
import { useEffect, useState } from 'react'
import type { Services } from '../app/services'
import { bySubject, countStars, loadArchives, playableNotions, starsText, STATUS_TEXT, summaryText, type ArchivesView } from '../core/archives'

export function Archives({ services, onClose }: { services: Services; onClose: () => void }) {
  // undefined : en cours de chargement ; null : ni serveur ni état gardé.
  const [view, setView] = useState<ArchivesView | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    void loadArchives(services.api, services.store, services.session.profile?.id ?? 0).then((v) => alive && setView(v))
    return () => {
      alive = false
    }
  }, [services])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const summary = view === undefined ? 'Ouverture des Archives…' : view === null ? 'Les Archives sont hors de portée : pas de connexion au serveur.' : summaryText(countStars(view.chapters))

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="archives-titre" data-testid="archives">
      <section className="panel archives">
        <header className="archives-head">
          <h2 id="archives-titre">Les Archives</h2>
          <button type="button" className="secondary" autoFocus onClick={onClose}>Fermer</button>
        </header>
        <p className="archives-summary" role="status">{summary}</p>
        {view?.cached && <p className="hint">Dernier état connu : tu n'es pas connecté au serveur.</p>}
        {view && <ArchivesList view={view} />}
      </section>
    </div>
  )
}

/** Les chapitres et leurs notions (sans chargement : l'écran et les captures s'en servent). */
export function ArchivesList({ view }: { view: ArchivesView }) {
  return (
    <>
      {view.chapters.length === 0 && <p>Aucune notion au programme pour l'instant.</p>}
      {bySubject(view.chapters).map((group) => (
        <div key={group.subject} className="archives-subject">
          {group.subject && <h3>{group.subject}</h3>}
          {group.chapters.map((chapter) => {
            const notions = playableNotions(chapter)
            const status = STATUS_TEXT[chapter.status]
            return (
              <article key={chapter.code || chapter.title} className="archives-chapter">
                <header>
                  <h4>{chapter.title}</h4>
                  {status && <span className={chapter.status === 'en_cours' ? 'archives-status good' : 'archives-status bad'}>{status}</span>}
                </header>
                {notions.length === 0 ? (
                  <p className="hint">Archive encore scellée : ses épreuves arrivent bientôt.</p>
                ) : (
                  <ul>
                    {notions.map((n) => (
                      <li key={n.code || n.label}>
                        <span className="archives-label">{n.label}</span>
                        <span className={n.stars > 0 ? 'archives-stars on' : 'archives-stars'} role="img" aria-label={`${n.stars} étoile${n.stars > 1 ? 's' : ''} sur 3`}>{starsText(n.stars)}</span>
                        <span className="archives-state">{n.state}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            )
          })}
        </div>
      ))}
    </>
  )
}
