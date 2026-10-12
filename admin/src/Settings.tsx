import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Accommodations } from './Accommodations'
import { api, ApiError, type NotionToValidate, type Profile } from './api'

export function Settings({ child }: { child: Profile }) {
  return (
    <div className="stack">
      <PlayTimeLimit key={child.id} child={child} />
      <Accommodations key={`acc-${child.id}`} child={child} />
      <SessionMix key={`mix-${child.id}`} child={child} />
      <NotionsToValidate level={child.level} />
      <ResetProfile key={`reset-${child.id}`} child={child} />
    </div>
  )
}

// Mélange d'une session (TRD §5.5) : chapitre en cours, révision espacée, automatismes.
function SessionMix({ child }: { child: Profile }) {
  const client = useQueryClient()
  const [chapter, setChapter] = useState(Math.round(child.ratios.chapter * 100))
  const [review, setReview] = useState(Math.round(child.ratios.review * 100))
  const automatisms = 100 - chapter - review
  const mutation = useMutation({
    mutationFn: () => api.setRatios(child.id, { chapter: chapter / 100, review: review / 100, automatisms: automatisms / 100 }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['profiles'] }),
  })
  const changed = chapter !== Math.round(child.ratios.chapter * 100) || review !== Math.round(child.ratios.review * 100)
  return (
    <section className="card">
      <h2>Mélange des questions</h2>
      <p className="muted small">
        Part de chaque famille dans une session d'arène ou de village. Un chapitre « contrôle bientôt » prend de toute façon 70 % des questions ;
        les donjons gardent leur propre chapitre.
      </p>
      <div className="mix">
        <label>
          Chapitre en cours : <strong>{chapter} %</strong>
          <input type="range" min={0} max={100 - review} step={5} value={chapter} onChange={(e) => setChapter(Number(e.target.value))} />
        </label>
        <label>
          Révision des notions à revoir : <strong>{review} %</strong>
          <input type="range" min={0} max={100 - chapter} step={5} value={review} onChange={(e) => setReview(Number(e.target.value))} />
        </label>
        <p>
          Automatismes (calcul rapide{child.level === '2nde' ? ", format de l'épreuve anticipée" : ''}) : <strong>{automatisms} %</strong>
        </p>
      </div>
      <div className="row">
        <button className="primary" disabled={!changed || mutation.isPending} onClick={() => mutation.mutate()}>
          Enregistrer
        </button>
        {mutation.isSuccess && !changed && <span className="ok">Enregistré ✓</span>}
      </div>
    </section>
  )
}

// Réinitialisation (droit à l'effacement) : progression, réponses et sauvegardes.
function ResetProfile({ child }: { child: Profile }) {
  const client = useQueryClient()
  const [confirm, setConfirm] = useState('')
  const mutation = useMutation({
    mutationFn: () => api.reset(child.id, confirm),
    onSuccess: () => {
      setConfirm('')
      client.invalidateQueries()
    },
  })
  return (
    <section className="card danger-zone">
      <h2>Réinitialiser la progression de {child.name}</h2>
      <p className="muted small">
        Efface toutes les réponses, les sessions, les étoiles des Archives et la partie (niveau, donjons, défis). Le profil, son code et le
        programme restent. Irréversible.
      </p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          mutation.mutate()
        }}
      >
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={`Écrivez « ${child.name} » pour confirmer`} aria-label="Confirmation" />
        <button className="danger" disabled={confirm.trim().toLowerCase() !== child.name.toLowerCase() || mutation.isPending}>
          Tout effacer
        </button>
        {mutation.isSuccess && <span className="ok">Progression effacée ✓</span>}
        {mutation.isError && <span className="error-text">{mutation.error instanceof ApiError ? mutation.error.message : 'Erreur'}</span>}
      </form>
    </section>
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
