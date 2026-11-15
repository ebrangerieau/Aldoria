/**
 * Les Archives (repris de la v1) : une étoile de maîtrise par notion, groupées par matière puis par chapitre. Le serveur donne la
 * maîtrise (core/archives.ts), l'écran la montre : jamais de note, jamais de comparaison, seulement « acquise », « fragile »,
 * « en cours », « à découvrir ». Hors connexion, le dernier état connu s'affiche.
 */
import { useEffect, useState } from 'react'
import type { Services } from '../app/services'
import { bySubject, countStars, loadArchives, playableNotions, starsText, STATUS_TEXT, summaryText, type ArchivesView } from '../core/archives'
import { type Beasts, bestiaryLines, bestiarySummary } from '../core/bestiary'

export function Archives({ services, beasts, onClose }: { services: Services; beasts: Beasts; onClose: () => void }) {
  const [tab, setTab] = useState<'notions' | 'bestiaire'>('notions')
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

  const notionsSummary = view === undefined ? 'Ouverture des Archives…' : view === null ? 'Les Archives sont hors de portée : pas de connexion au serveur.' : summaryText(countStars(view.chapters))

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="archives-titre" data-testid="archives">
      <section className="panel archives">
        <header className="archives-head">
          <h2 id="archives-titre">Les Archives</h2>
          <button type="button" className="secondary" autoFocus onClick={onClose}>Fermer</button>
        </header>
        <div className="archives-tabs" role="group" aria-label="Que veux-tu voir ?">
          <button type="button" className="secondary small" aria-pressed={tab === 'notions'} data-testid="archives-notions" onClick={() => setTab('notions')}>Notions</button>
          <button type="button" className="secondary small" aria-pressed={tab === 'bestiaire'} data-testid="archives-bestiaire" onClick={() => setTab('bestiaire')}>Bestiaire</button>
        </div>
        <p className="archives-summary" role="status" data-testid="archives-resume">{tab === 'notions' ? notionsSummary : bestiarySummary(beasts)}</p>
        {tab === 'notions' && view?.cached && <p className="hint">Dernier état connu : tu n'es pas connecté au serveur.</p>}
        {tab === 'notions' && view && <ArchivesList view={view} />}
        {tab === 'bestiaire' && <BestiaryList beasts={beasts} />}
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

/** Les créatures vaincues, les plus souvent d'abord : leur nom et le nombre de victoires (jamais la couleur seule). */
export function BestiaryList({ beasts }: { beasts: Beasts }) {
  const lines = bestiaryLines(beasts)
  if (lines.length === 0) return null
  return (
    <ul className="bestiary" data-testid="bestiaire-liste">
      {lines.map((line) => (
        <li key={line.name} className="bestiary-line" data-count={line.count}>
          <span className="bestiary-icon" aria-hidden="true">🐉</span>
          <span className="bestiary-name">{line.name}</span>
          <span className="bestiary-count" aria-label={`${line.count} victoire${line.count > 1 ? 's' : ''}`}>× {line.count}</span>
        </li>
      ))}
    </ul>
  )
}
