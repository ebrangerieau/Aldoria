import { useQuery } from '@tanstack/react-query'
import { api, type Dashboard as DashboardData, type Profile } from './api'
import { Stars } from './Stars'

const STATES = [
  { key: 'acquise', label: 'Acquises', hint: '3 étoiles', tone: 'good' },
  { key: 'fragile', label: 'Fragiles', hint: '2 étoiles', tone: 'warn' },
  { key: 'non acquise', label: 'En cours', hint: '1 étoile', tone: 'info' },
  { key: 'non vue', label: 'Jamais vues', hint: 'pas encore rencontrées', tone: 'muted' },
] as const

export function Dashboard({ child }: { child: Profile }) {
  const query = useQuery({ queryKey: ['dashboard', child.id], queryFn: () => api.dashboard(child.id) })
  if (query.isPending) return <p className="loading">Chargement…</p>
  if (query.isError) return <p className="card error">{query.error.message}</p>
  const d = query.data
  const rate = d.week.answers ? Math.round((100 * d.week.correct) / d.week.answers) : null

  return (
    <div className="stack">
      <section className="grid4">
        {STATES.map((s) => (
          <div key={s.key} className={`card stat ${s.tone}`}>
            <span className="big">{d.counts[s.key]}</span>
            <span>{s.label}</span>
            <span className="muted small">{s.hint}</span>
          </div>
        ))}
      </section>
      <p className="muted small">Sur {d.playable} notions déjà jouables dans le jeu (les autres arrivent avec les prochains générateurs).</p>

      <section className="grid2">
        <div className="card">
          <h2>Les 7 derniers jours</h2>
          <ul className="facts">
            <li>
              <strong>{d.week.minutes} min</strong> de jeu actif, {d.week.sessions} session{d.week.sessions > 1 ? 's' : ''}
            </li>
            <li>
              <strong>{d.week.answers}</strong> réponses{rate !== null && <>, dont {rate} % justes</>}
            </li>
            <li>Dernière partie : {d.week.last_played ? formatDateTime(d.week.last_played) : 'jamais'}</li>
          </ul>
          <PlayTime days={d.days} />
        </div>
        <div className="card">
          <h2>À retravailler</h2>
          {d.weak_notions.length === 0 ? (
            <p className="muted">Rien à signaler pour l'instant.</p>
          ) : (
            <ul className="notions">
              {d.weak_notions.map((n) => (
                <li key={n.code}>
                  <span>
                    {n.label}
                    <span className="muted small"> · {n.chapter}</span>
                  </span>
                  <Stars count={n.stars} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Dernières sessions</h2>
        <RecentSessions sessions={d.recent_sessions} />
      </section>
    </div>
  )
}

function PlayTime({ days }: { days: DashboardData['days'] }) {
  const max = Math.max(30, ...days.map((d) => d.minutes))
  const width = 28
  const height = 90
  return (
    <svg className="chart" viewBox={`0 0 ${days.length * width} ${height + 18}`} role="img" aria-label="Minutes de jeu par jour, 14 derniers jours">
      {days.map((d, i) => {
        const h = Math.round((d.minutes / max) * height)
        const day = new Date(d.date + 'T12:00:00Z')
        return (
          <g key={d.date}>
            <title>{`${day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} : ${d.minutes} min`}</title>
            <rect x={i * width + 4} y={height - h} width={width - 8} height={Math.max(h, 1)} rx={3} className={d.minutes ? 'bar' : 'bar empty'} />
            <text x={i * width + width / 2} y={height + 14} textAnchor="middle" className="axis">
              {day.toLocaleDateString('fr-FR', { weekday: 'narrow' })}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function RecentSessions({ sessions }: { sessions: DashboardData['recent_sessions'] }) {
  if (sessions.length === 0) return <p className="muted">Aucune session.</p>
  return (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Durée</th>
          <th>Réponses</th>
          <th>Justes</th>
        </tr>
      </thead>
      <tbody>
        {sessions.map((s) => (
          <tr key={s.started_at}>
            <td>{formatDateTime(s.started_at)}</td>
            <td>{s.finished ? `${s.minutes} min` : <span className="muted">non terminée</span>}</td>
            <td>{s.questions}</td>
            <td>{s.questions ? `${Math.round((100 * s.correct) / s.questions)} %` : '–'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
