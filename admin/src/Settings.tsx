import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, type NotionToValidate, type Profile } from './api'

export function Settings({ child }: { child: Profile }) {
  return (
    <div className="stack">
      <PlayTimeLimit key={child.id} child={child} />
      <NotionsToValidate level={child.level} />
    </div>
  )
}

// Durée maximale d'une session (PRD US-11) : le jeu propose une pause une fois atteinte.
function PlayTimeLimit({ child }: { child: Profile }) {
  const client = useQueryClient()
  const [minutes, setMinutes] = useState(child.session_max_minutes)
  const mutation = useMutation({
    mutationFn: (value: number) => api.setMaxMinutes(child.id, value),
    onSuccess: () => client.invalidateQueries({ queryKey: ['profiles'] }),
  })
  const changed = minutes !== child.session_max_minutes
  return (
    <section className="card">
      <h2>Durée de jeu</h2>
      <p className="muted">
        Au-delà, le jeu félicite {child.name} et propose une pause (temps actif seulement : une page en arrière-plan ne compte pas).
      </p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          mutation.mutate(minutes)
        }}
      >
        <input type="range" min={5} max={120} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-label="Minutes par session" />
        <strong className="minutes">{minutes} min</strong>
        <button className="primary" disabled={!changed || mutation.isPending}>
          Enregistrer
        </button>
        {mutation.isSuccess && !changed && <span className="ok">Enregistré ✓</span>}
      </form>
    </section>
  )
}

// Contenus de programme incertains (sources contradictoires sur le programme 2026).
function NotionsToValidate({ level }: { level: Profile['level'] }) {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['to-validate'], queryFn: api.toValidate })
  const mutation = useMutation({
    mutationFn: ({ code, inProgram }: { code: string; inProgram: boolean }) => api.decideNotion(code, inProgram),
    onSuccess: () => client.invalidateQueries({ queryKey: ['to-validate'] }),
  })
  const notions = (query.data ?? []).filter((n) => n.level === level)
  return (
    <section className="card">
      <h2>Notions à confirmer</h2>
      <p className="muted">
        Les sources se contredisent sur ces points du programme. Vérifiez-les dans le manuel ou le cahier de votre enfant : une notion « hors
        programme » n'apparaîtra jamais dans le jeu.
      </p>
      {query.isPending && <p className="loading">Chargement…</p>}
      {query.isSuccess && notions.length === 0 && <p className="muted">Aucune notion à confirmer pour ce niveau.</p>}
      <ul className="decisions">
        {notions.map((n: NotionToValidate) => (
          <li key={n.code}>
            <span>
              {n.label}
              <span className="muted small"> · {n.chapter}</span>
            </span>
            <span className="row">
              <button className={n.in_program === true ? 'choice active' : 'choice'} onClick={() => mutation.mutate({ code: n.code, inProgram: true })}>
                Au programme
              </button>
              <button className={n.in_program === false ? 'choice active off' : 'choice'} onClick={() => mutation.mutate({ code: n.code, inProgram: false })}>
                Hors programme
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
