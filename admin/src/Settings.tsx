import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Accommodations } from './Accommodations'
import { api, ApiError, type BackupStatus, type NotionToValidate, type Profile } from './api'

export function Settings({ child }: { child: Profile }) {
  return (
    <div className="stack">
      <PlayTimeLimit key={child.id} child={child} />
      <ChildPin key={`pin-${child.id}`} child={child} />
      <Accommodations key={`acc-${child.id}`} child={child} />
      <SessionMix key={`mix-${child.id}`} child={child} />
      <NotionsToValidate level={child.level} />
      <Backups />
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

// Code secret de l'enfant (4 chiffres) : saisi deux fois, jamais réaffiché.
function ChildPin({ child }: { child: Profile }) {
  const [pin, setPin] = useState('')
  const [again, setAgain] = useState('')
  const mutation = useMutation({
    mutationFn: () => api.setPin(child.id, pin),
    onSuccess: () => {
      setPin('')
      setAgain('')
    },
  })
  const digits = (value: string) => value.replace(/[^0-9]/g, '').slice(0, 4)
  const complete = pin.length === 4 && again.length === 4
  const mismatch = complete && pin !== again
  return (
    <section className="card" id="code">
      <h2>Code secret de {child.name}</h2>
      <p className="muted small">
        Les 4 chiffres que {child.name} tape pour entrer dans le jeu. Le nouveau code sert dès la prochaine connexion, et débloque le profil
        s'il est bloqué après 5 erreurs. Il doit être différent de celui des autres enfants.
      </p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          if (complete && !mismatch) mutation.mutate()
        }}
      >
        <label>
          Nouveau code{' '}
          <input
            className="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => {
              setPin(digits(e.target.value))
              mutation.reset()
            }}
          />
        </label>
        <label>
          Encore une fois{' '}
          <input
            className="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={again}
            onChange={(e) => {
              setAgain(digits(e.target.value))
              mutation.reset()
            }}
          />
        </label>
        <button className="primary" type="submit" disabled={!complete || mismatch || mutation.isPending}>
          Changer le code
        </button>
      </form>
      {mismatch && <p className="status-line bad">Les deux codes sont différents.</p>}
      {mutation.isError && <p className="status-line bad">{(mutation.error as ApiError).message}</p>}
      {mutation.isSuccess && (
        <p className="status-line ok">Code changé ✓ Donnez-le à {child.name} : il sert dès sa prochaine connexion.</p>
      )}
    </section>
  )
}

// Sauvegardes de la base (toute la famille) : nuit sur le serveur, puis copie à la maison.
function Backups() {
  const query = useQuery({ queryKey: ['backups'], queryFn: api.backups })
  return (
    <section className="card" id="sauvegardes">
      <h2>Sauvegardes</h2>
      <p className="muted small">
        Chaque nuit, le serveur copie toutes les données du jeu (pour tous les enfants) et garde les 14 dernières copies. L'ordinateur de la
        maison récupère ensuite ces copies : si le serveur tombe en panne, rien n'est perdu.
      </p>
      {query.isPending && <p className="loading">Chargement…</p>}
      {query.isError && <p className="status-line bad">État des sauvegardes indisponible.</p>}
      {query.data && <BackupLines status={query.data} />}
    </section>
  )
}

function BackupLines({ status }: { status: BackupStatus }) {
  if (!status.configured) return <p className="status-line">Sauvegardes non installées sur ce serveur (installation de test).</p>
  const last = status.last ? `${when(status.last.date)} (${size(status.last.bytes)})` : ''
  return (
    <>
      {status.state === 'ok' && (
        <p className="status-line ok">
          ✓ Dernière sauvegarde : {last}. {status.copies} copie{status.copies > 1 ? 's' : ''} sur le serveur.
        </p>
      )}
      {status.state === 'none' && (
        <p className="status-line">Pas encore de sauvegarde : la première se fait dans les minutes qui suivent l'installation, puis chaque nuit.</p>
      )}
      {status.state === 'late' && (
        <p className="status-line late">
          ⚠ La dernière sauvegarde date de {last} : le service de sauvegarde semble arrêté sur le serveur.
        </p>
      )}
      {status.state === 'failed' && (
        <p className="status-line bad">
          ✗ La dernière tentative a échoué{status.attempt ? ` (${when(status.attempt)})` : ''} : « {status.error} ». Le serveur réessaie toutes
          les 10 minutes.{status.last ? ` Dernière sauvegarde réussie : ${last}.` : ''}
        </p>
      )}
      {status.home_state === 'ok' && status.home && <p className="status-line ok">✓ Copie à la maison : {when(status.home.date)}.</p>}
      {status.home_state === 'late' && status.home && (
        <p className="status-line late">
          ⚠ Dernière copie à la maison : {when(status.home.date)}. L'ordinateur de la maison n'a rien récupéré depuis plus d'une semaine :
          allumez-le, ou vérifiez sa tâche planifiée (voir le guide).
        </p>
      )}
      {status.home_state === 'none' && (
        <p className="status-line late">⚠ Aucune copie à la maison pour l'instant : les sauvegardes ne sont que sur le serveur.</p>
      )}
    </>
  )
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

function size(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
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
