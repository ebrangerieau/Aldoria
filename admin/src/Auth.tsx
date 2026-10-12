import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from './api'

// Connexion d'un adulte : e-mail et mot de passe (comptes propres à Aldoria).
export function Login() {
  const client = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const mutation = useMutation({
    mutationFn: () => api.login(email, password),
    onSuccess: (me) => {
      setPassword('')
      client.setQueryData(['me'], me)
      client.invalidateQueries()
    },
  })
  return (
    <div className="app narrow">
      <h1>Les Chroniques d'Aldoria</h1>
      <p className="subtitle">Espace parent</p>
      <form
        className="card stack-form"
        onSubmit={(e) => {
          e.preventDefault()
          mutation.mutate()
        }}
      >
        <h2>Connexion</h2>
        <label>
          E-mail
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Mot de passe
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="primary" type="submit" disabled={mutation.isPending}>
          Se connecter
        </button>
        {mutation.isError && <p className="status-line bad">{(mutation.error as ApiError).message}</p>}
        <p className="muted small">
          Mot de passe oublié ? Demandez à un autre adulte de votre famille un lien de réinitialisation (Famille → Adultes).
        </p>
      </form>
    </div>
  )
}

const TITLES = {
  adulte: 'Rejoindre la famille',
  famille: 'Créer votre famille',
  mot_de_passe: 'Choisir un nouveau mot de passe',
}

// Lien reçu (…/#invitation=…) : rejoindre une famille, en créer une, ou changer de mot de passe.
export function InvitationPage({ token, onDone }: { token: string; onDone: () => void }) {
  const client = useQueryClient()
  const invitation = useQuery({ queryKey: ['invitation', token], queryFn: () => api.invitation(token), retry: false })
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const mutation = useMutation({
    mutationFn: () => api.acceptInvitation(token, { name, email, family_name: familyName, password }),
    onSuccess: (me) => {
      client.setQueryData(['me'], me)
      client.invalidateQueries()
      onDone()
    },
  })
  if (invitation.isPending) return <p className="loading">Chargement…</p>
  if (invitation.isError) {
    return (
      <div className="app narrow">
        <h1>Espace parent</h1>
        <div className="card error">
          <p>{(invitation.error as ApiError).message}</p>
          <button onClick={onDone}>Aller à la connexion</button>
        </div>
      </div>
    )
  }
  const kind = invitation.data.kind
  const mismatch = again.length > 0 && password !== again
  return (
    <div className="app narrow">
      <h1>Les Chroniques d'Aldoria</h1>
      <p className="subtitle">Espace parent</p>
      <form
        className="card stack-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!mismatch) mutation.mutate()
        }}
      >
        <h2>{TITLES[kind]}</h2>
        {kind === 'adulte' && (
          <p>
            Vous êtes invité à suivre les enfants de <strong>{invitation.data.family}</strong>. Créez votre compte :
          </p>
        )}
        {kind === 'famille' && <p>Créez l'espace de votre famille ; vous y ajouterez ensuite vos enfants et vos appareils.</p>}
        {kind === 'mot_de_passe' && (
          <p>
            Compte de <strong>{invitation.data.adult?.name}</strong> ({invitation.data.adult?.email}).
          </p>
        )}
        {kind === 'famille' && (
          <label>
            Nom de la famille
            <input required maxLength={80} value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="Famille Martin" />
          </label>
        )}
        {kind !== 'mot_de_passe' && (
          <>
            <label>
              Votre prénom
              <input required maxLength={60} autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Votre e-mail (pour vous connecter)
              <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          </>
        )}
        <label>
          Mot de passe (10 caractères au moins)
          <input type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label>
          Encore une fois
          <input type="password" required autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </label>
        {mismatch && <p className="status-line bad">Les deux mots de passe sont différents.</p>}
        <button className="primary" type="submit" disabled={mutation.isPending || mismatch}>
          {kind === 'mot_de_passe' ? 'Enregistrer et me connecter' : 'Créer mon compte'}
        </button>
        {mutation.isError && <p className="status-line bad">{(mutation.error as ApiError).message}</p>}
        <p className="muted small">Ce lien ne sert qu'une fois. Astuce : une phrase de quelques mots fait un bon mot de passe.</p>
      </form>
    </div>
  )
}
