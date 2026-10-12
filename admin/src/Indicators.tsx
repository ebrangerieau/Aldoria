import { useQuery } from '@tanstack/react-query'
import { api, type Indicators as IndicatorsData, type Profile } from './api'

// Indicateurs du PRD §2 (envie, régularité, révision, apprentissage, alignement, plaisir)
// comparés aux cibles de départ, et sessions par semaine sur 8 semaines.
export function Indicators({ child }: { child: Profile }) {
  const query = useQuery({ queryKey: ['indicators', child.id], queryFn: () => api.indicators(child.id) })
  if (query.isPending) return <p className="loading">Chargement…</p>
  if (query.isError) return <p className="card error">{query.error.message}</p>
  const d = query.data
  return (
    <section className="card">
      <h2>Objectifs du projet</h2>
      <p className="muted small">Cibles de départ du cahier des charges, à ajuster après un mois de test réel.</p>
      <div className="indicators">
        {d.indicators.map((i) => (
          <div key={i.code} className={`indicator ${i.met === null ? 'unknown' : i.met ? 'met' : 'below'}`}>
            <span className="small">{i.label}</span>
            <span className="big">
              {i.value === null ? '–' : formatValue(i.value)}
              {i.value !== null && i.unit && <span className="unit"> {i.unit}</span>}
            </span>
            <span className="muted small">Cible : {i.target}</span>
            <span className="muted small detail">{i.detail}</span>
          </div>
        ))}
      </div>
      <p className="muted small">Sessions par semaine sur 8 semaines (pointillés : la cible de 3).</p>
      <WeeklySessions weeks={d.weeks} />
    </section>
  )
}

function formatValue(value: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
}

function WeeklySessions({ weeks }: { weeks: IndicatorsData['weeks'] }) {
  const max = Math.max(4, ...weeks.map((w) => w.sessions))
  const width = 110
  const height = 90
  const target = height - Math.round((3 / max) * height)
  return (
    <svg className="chart" viewBox={`0 0 ${weeks.length * width} ${height + 20}`} role="img" aria-label="Sessions par semaine, 8 dernières semaines">
      <line x1={0} x2={weeks.length * width} y1={target} y2={target} className="target" />
      {weeks.map((w, i) => {
        const h = Math.round((w.sessions / max) * height)
        const start = new Date(w.start + 'T12:00:00Z')
        return (
          <g key={w.start}>
            <title>{`Semaine du ${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} : ${w.sessions} session(s)`}</title>
            <rect x={i * width + 20} y={height - h} width={width - 40} height={Math.max(h, 1)} rx={3} className={w.sessions ? 'bar' : 'bar empty'} />
            <text x={i * width + width / 2} y={height + 15} textAnchor="middle" className="axis">
              {start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
