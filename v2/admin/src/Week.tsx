import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api, type Profile, type WeekSummary } from './api'

// Résumé d'une semaine (lundi à dimanche) : ce que l'enfant a fait, dans quelles matières, ce qui
// marche et ce qui reste à revoir, comparé à la semaine précédente. On remonte semaine par semaine.
export function Week({ child }: { child: Profile }) {
  const [offset, setOffset] = useState(0)
  const query = useQuery({ queryKey: ['week', child.id, offset], queryFn: () => api.week(child.id, offset) })

  return (
    <div className="stack">
      <section className="card">
        <div className="row spread">
          <button onClick={() => setOffset(offset + 1)} disabled={offset >= 104}>
            ← Semaine précédente
          </button>
          <h2 className="week-title">{query.data ? (query.data.current ? 'Cette semaine' : `Semaine ${query.data.label}`) : 'Semaine'}</h2>
          <span className="row">
            {offset > 1 && <button onClick={() => setOffset(0)}>Cette semaine</button>}
            <button onClick={() => setOffset(offset - 1)} disabled={offset === 0}>
              Semaine suivante →
            </button>
          </span>
        </div>
        {query.data && <p className="muted small">{query.data.current ? `Semaine ${query.data.label}, en cours.` : 'Semaine terminée.'}</p>}
        {query.isPending && <p className="loading">Chargement…</p>}
        {query.isError && <p className="error-text">{query.error.message}</p>}
        {query.data && <p className="tip week-sentence">{query.data.sentence}</p>}
      </section>
      {query.data && query.data.activity.answers > 0 && <WeekDetail child={child} w={query.data} />}
    </div>
  )
}

function WeekDetail({ child, w }: { child: Profile; w: WeekSummary }) {
  const a = w.activity
  const p = w.previous
  return (
    <>
      <section className="grid4">
        <Stat value={`${a.minutes} min`} label="de jeu actif" before={p.answers ? `${p.minutes} min la semaine d'avant` : null} />
        <Stat value={String(a.sessions)} label={a.sessions > 1 ? 'séances' : 'séance'} before={p.answers ? `${p.sessions} la semaine d'avant` : null} />
        <Stat value={`${a.days_played} / 7`} label="jours joués" before={p.answers ? `${p.days_played} / 7 la semaine d'avant` : null} />
        <Stat
          value={String(a.answers)}
          label={a.rate !== null ? `réponses, ${a.rate} % justes` : 'réponses'}
          before={p.answers ? `${p.answers} réponses, ${p.rate} % justes la semaine d'avant` : null}
        />
      </section>

      <section className="grid2">
        <div className="card">
          <h2>Jour par jour</h2>
          <Days days={w.days} />
          <p className="muted small">
            {w.new_notions > 0
              ? `${w.new_notions} notion${w.new_notions > 1 ? 's' : ''} rencontrée${w.new_notions > 1 ? 's' : ''} pour la première fois.`
              : 'Aucune notion nouvelle : des révisions.'}
            {w.rating !== null && ` Note de plaisir en fin de donjon : ${w.rating} / 5.`}
          </p>
        </div>
        <div className="card">
          <h2>Matières travaillées</h2>
          <ul className="notions">
            {w.subjects.map((s) => (
              <li key={s.code}>
                <span>{s.label}</span>
                <span className="muted">
                  {s.answers} réponse{s.answers > 1 ? 's' : ''} · {s.rate} % justes
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid2">
        <div className="card">
          <h2>Ce qui marche</h2>
          <NotionList items={w.successes} empty="Pas encore de notion réussie à 80 % (il faut au moins 3 réponses sur une notion dans la semaine)." />
        </div>
        <div className="card">
          <h2>À revoir</h2>
          <NotionList items={w.struggles} empty="Aucune notion ratée plus d'une fois sur deux cette semaine." />
          {w.struggles.length > 0 && (
            <p className="muted small">
              Le jeu les repose de lui-même. Pour l'aider, revoyez la leçon avec {child.name}, ou passez le chapitre en « Contrôle bientôt »
              dans Programme.
            </p>
          )}
        </div>
      </section>

      {(w.set_aside.length > 0 || w.reports > 0) && (
        <section className="card">
          <h2>À regarder</h2>
          <ul className="bullets">
            {w.set_aside.map((n) => (
              <li key={n.label}>
                {n.label} : mise de côté{n.source === 'enfant' ? ` par ${child.name} (« Pas vu en classe »)` : ' depuis Programme'}
              </li>
            ))}
            {w.reports > 0 && (
              <li>
                {w.reports} question{w.reports > 1 ? 's' : ''} signalée{w.reports > 1 ? 's' : ''} par {child.name} : voir l'onglet Signalements.
              </li>
            )}
          </ul>
        </section>
      )}
    </>
  )
}

function Stat({ value, label, before }: { value: string; label: string; before: string | null }) {
  return (
    <div className="card stat info">
      <span className="big">{value}</span>
      <span>{label}</span>
      <span className="muted small">{before ?? 'rien la semaine d’avant'}</span>
    </div>
  )
}

function NotionList({ items, empty }: { items: WeekSummary['successes']; empty: string }) {
  if (items.length === 0) return <p className="muted">{empty}</p>
  return (
    <ul className="notions">
      {items.map((n) => (
        <li key={n.code}>
          <span>
            {n.label}
            <span className="muted small"> · {n.subject}</span>
          </span>
          <span className="muted">
            {n.correct} / {n.answers} justes
          </span>
        </li>
      ))}
    </ul>
  )
}

function Days({ days }: { days: WeekSummary['days'] }) {
  const max = Math.max(20, ...days.map((d) => d.minutes))
  const width = 48
  const height = 90
  return (
    <svg className="chart" viewBox={`0 0 ${days.length * width} ${height + 18}`} role="img" aria-label="Minutes de jeu par jour de la semaine">
      {days.map((d, i) => {
        const h = Math.round((d.minutes / max) * height)
        const day = new Date(d.date + 'T12:00:00Z')
        return (
          <g key={d.date}>
            <title>{`${day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} : ${d.minutes} min, ${d.answers} réponses`}</title>
            <rect x={i * width + 8} y={height - h} width={width - 16} height={Math.max(h, 1)} rx={3} className={d.minutes ? 'bar' : 'bar empty'} />
            <text x={i * width + width / 2} y={height + 14} textAnchor="middle" className="axis">
              {day.toLocaleDateString('fr-FR', { weekday: 'short' })}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
