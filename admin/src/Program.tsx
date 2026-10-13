import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, STATUS_LABELS, type Chapter, type ChapterStatus, type Profile } from './api'
import { Stars } from './Stars'

const ORDER: ChapterStatus[] = ['a_venir', 'en_cours', 'controle_bientot', 'termine']

// Statut des chapitres (PRD US-08) : le jeu pioche ses questions « Sort » dans les
// chapitres en cours ; un contrôle annoncé prend 70 % des questions.
export function Program({ child }: { child: Profile }) {
  const query = useQuery({ queryKey: ['chapters', child.id], queryFn: () => api.chapters(child.id) })
  if (query.isPending) return <p className="loading">Chargement…</p>
  if (query.isError) return <p className="card error">{query.error.message}</p>
  return (
    <div className="stack">
      <p className="intro">
        Indiquez où en est {child.name} en classe. Les chapitres <strong>en cours</strong> fournissent la moitié des questions ; un{' '}
        <strong>contrôle bientôt</strong> en fournit 70 %. Le reste : révisions espacées et automatismes.
      </p>
      {query.data.map((chapter, i) => (
        <div key={chapter.code} className="stack">
          {chapter.subject.code !== query.data[i - 1]?.subject.code && <h2 className="subject-title">{chapter.subject.label}</h2>}
          <ChapterCard child={child} chapter={chapter} />
        </div>
      ))}
    </div>
  )
}

function ChapterCard({ child, chapter }: { child: Profile; chapter: Chapter }) {
  const client = useQueryClient()
  const [testDate, setTestDate] = useState(chapter.test_date ?? '')
  const mutation = useMutation({
    mutationFn: ({ status, date }: { status: ChapterStatus; date: string | null }) => api.setChapter(child.id, chapter.code, status, date),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['chapters', child.id] })
      client.invalidateQueries({ queryKey: ['dashboard', child.id] })
    },
  })
  const playable = chapter.notions.filter((n) => n.playable)
  const status = mutation.isPending ? mutation.variables.status : chapter.status

  return (
    <section className={`card chapter ${status}`}>
      <div className="chapter-head">
        <h2>{chapter.title}</h2>
        <div className="statuses" role="radiogroup" aria-label={`Statut de ${chapter.title}`}>
          {ORDER.map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={s === status}
              className={s === status ? `status active ${s}` : 'status'}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ status: s, date: s === 'controle_bientot' ? testDate || null : null })}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
      {status === 'controle_bientot' && (
        <label className="test-date">
          Date du contrôle :{' '}
          <input
            type="date"
            value={testDate}
            onChange={(e) => {
              setTestDate(e.target.value)
              mutation.mutate({ status: 'controle_bientot', date: e.target.value || null })
            }}
          />
        </label>
      )}
      {mutation.isError && <p className="error-text">Enregistrement impossible : {mutation.error.message}</p>}
      {playable.length === 0 ? (
        <p className="muted small">Pas encore de questions dans le jeu pour ce chapitre.</p>
      ) : (
        <ul className="notions">
          {playable.map((n) => (
            <li key={n.code}>
              <span>{n.label}</span>
              <span className="notion-state">
                <Stars count={n.stars} /> <span className="muted small">{n.seen ? `${n.state} · ${n.seen} réponse${n.seen > 1 ? 's' : ''}` : 'non vue'}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
