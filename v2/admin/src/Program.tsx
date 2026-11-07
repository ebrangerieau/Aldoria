import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, STATUS_LABELS, type Chapter, type ChapterStatus, type Notion, type Profile } from './api'
import { Stars } from './Stars'

const ORDER: ChapterStatus[] = ['a_venir', 'en_cours', 'controle_bientot', 'termine']
const ACTIVE: ChapterStatus[] = ['en_cours', 'controle_bientot']

type Subject = { code: string; label: string; chapters: Chapter[] }

// Matière affichée, gardée par enfant dans ce navigateur (peut être indisponible : navigation privée).
const subjectKey = (child: Profile) => `aldoria-programme-${child.id}`

function rememberedSubject(child: Profile): string | null {
  try {
    return localStorage.getItem(subjectKey(child))
  } catch {
    return null
  }
}

function rememberSubject(child: Profile, code: string) {
  try {
    localStorage.setItem(subjectKey(child), code)
  } catch {
    // rien : la première matière s'affichera à la prochaine visite
  }
}

function bySubject(chapters: Chapter[]): Subject[] {
  const subjects: Subject[] = []
  for (const chapter of chapters) {
    const last = subjects[subjects.length - 1]
    if (last?.code === chapter.subject.code) last.chapters.push(chapter)
    else subjects.push({ ...chapter.subject, chapters: [chapter] })
  }
  return subjects
}

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

// Statut des chapitres (PRD US-08) : le jeu pioche ses questions « Sort » dans les
// chapitres en cours ; un contrôle annoncé prend 70 % des questions.
// Une matière à la fois (onglets), avec en tête ce qui est en cours dans toutes les matières.
export function Program({ child }: { child: Profile }) {
  const query = useQuery({ queryKey: ['chapters', child.id], queryFn: () => api.chapters(child.id) })
  const [chosen, setChosen] = useState<string | null>(() => rememberedSubject(child))
  if (query.isPending) return <p className="loading">Chargement…</p>
  if (query.isError) return <p className="card error">{query.error.message}</p>

  const subjects = bySubject(query.data)
  const active = query.data.filter((c) => ACTIVE.includes(c.status))
  const current =
    subjects.find((s) => s.code === chosen) ??
    subjects.find((s) => s.chapters.some((c) => ACTIVE.includes(c.status))) ??
    subjects[0]
  const choose = (code: string) => {
    setChosen(code)
    rememberSubject(child, code)
  }

  return (
    <div className="stack">
      <p className="intro">
        Indiquez où en est {child.name} en classe. Les chapitres <strong>en cours</strong> fournissent la moitié des questions ; un{' '}
        <strong>contrôle bientôt</strong> en fournit 70 %. Le reste : révisions espacées et automatismes. Dans un chapitre, cochez{' '}
        <strong>pas encore vue en classe</strong> pour une notion que {child.name} n'a pas encore apprise : elle n'est plus posée, même
        dans les donjons, jusqu'à ce que vous la décochiez.
      </p>
      <section className="card now">
        <h2>En ce moment</h2>
        {active.length === 0 ? (
          <p className="muted">Aucun chapitre en cours : le jeu pioche dans tout le programme.</p>
        ) : (
          <ul className="now-list">
            {active.map((c) => (
              <li key={c.code}>
                <button className="link" onClick={() => choose(c.subject.code)}>
                  <span className="muted">{c.subject.label} ·</span> {c.title}
                </button>
                <span className={`badge ${c.status}`}>
                  {c.status === 'controle_bientot' && c.test_date ? `Contrôle ${shortDate(c.test_date)}` : STATUS_LABELS[c.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {current && (
        <>
          {subjects.length > 1 && (
            <nav className="subjects" aria-label="Matières">
              {subjects.map((s) => {
                const busy = s.chapters.filter((c) => ACTIVE.includes(c.status)).length
                const done = s.chapters.filter((c) => c.status === 'termine').length
                return (
                  <button
                    key={s.code}
                    className={s.code === current.code ? 'chip active' : 'chip'}
                    aria-pressed={s.code === current.code}
                    onClick={() => choose(s.code)}
                  >
                    {s.label}{' '}
                    <span className="muted">
                      {busy > 0 ? `${busy} en cours` : `${done} / ${s.chapters.length}`}
                    </span>
                  </button>
                )
              })}
            </nav>
          )}
          <h2 className="subject-title">
            {current.label}{' '}
            <span className="muted small">
              {current.chapters.length} chapitre{current.chapters.length > 1 ? 's' : ''},{' '}
              {current.chapters.filter((c) => c.status === 'termine').length} terminé
              {current.chapters.filter((c) => c.status === 'termine').length > 1 ? 's' : ''}
            </span>
          </h2>
          {current.chapters.map((chapter) => (
            <ChapterCard key={chapter.code} child={child} chapter={chapter} />
          ))}
        </>
      )}
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
  const stars = playable.reduce((sum, n) => sum + n.stars, 0)

  return (
    <section className={`card chapter ${status}`}>
      <div className="chapter-head">
        <h3>{chapter.title}</h3>
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
        // Notions dépliées pour les chapitres du moment, repliées pour les autres.
        <details className="notions-fold" open={ACTIVE.includes(status)}>
          <summary>
            {playable.length} notion{playable.length > 1 ? 's' : ''}{' '}
            <span className="muted small">
              · {stars} étoile{stars > 1 ? 's' : ''} sur {playable.length * 3}
            </span>
          </summary>
          <ul className="notions">
            {playable.map((n) => (
              <li key={n.code} className={n.set_aside ? 'notion-aside' : undefined}>
                <span>
                  {n.label}
                  <NotionAside child={child} notion={n} />
                </span>
                <span className="notion-state">
                  <Stars count={n.stars} />{' '}
                  <span className="muted small">{n.seen ? `${n.state} · ${n.seen} réponse${n.seen > 1 ? 's' : ''}` : 'non vue'}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

// Case « pas encore vue en classe » d'une notion : cochée, la notion n'est plus posée. Une notion mise
// de côté par l'enfant dans le jeu est signalée ; la case la réactive.
export function NotionAside({ child, notion }: { child: Profile; notion: Pick<Notion, 'code' | 'label' | 'set_aside'> }) {
  const client = useQueryClient()
  // La case suit le clic tout de suite ; l'état du serveur reprend la main une fois relu.
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const mutation = useMutation({
    mutationFn: (aside: boolean) => api.setNotionAside(child.id, notion.code, aside),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['chapters', child.id] }),
        client.invalidateQueries({ queryKey: ['dashboard', child.id] }),
      ]),
    onSettled: () => setOptimistic(null),
  })
  const checked = optimistic ?? notion.set_aside !== null
  return (
    <span className="aside-control">
      <label className="small">
        <input
          type="checkbox"
          checked={checked}
          disabled={mutation.isPending}
          onChange={(e) => {
            setOptimistic(e.target.checked)
            mutation.mutate(e.target.checked)
          }}
        />{' '}
        pas encore vue en classe
      </label>
      {notion.set_aside === 'enfant' && (
        <>
          <span className="badge aside-child">mise de côté par {child.name}</span>
          <button className="link small" disabled={mutation.isPending} onClick={() => mutation.mutate(true)}>
            C'est exact
          </button>
        </>
      )}
      {mutation.isError && <span className="error-text small"> Enregistrement impossible.</span>}
    </span>
  )
}
