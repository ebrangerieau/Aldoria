/** Relier l'ordinateur à la famille, choisir son profil, taper son code secret. */
import { useEffect, useState } from 'react'
import type { Services } from '../app/services'
import type { Profile } from '../core/session'

export function PairScreen({ services, onPaired, onBack }: { services: Services; onPaired: () => void; onBack: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const res = await services.api.pair(code.replace(/\D/g, ''))
    if (res.ok) onPaired()
    else setError(res.status === 0 ? 'Le serveur ne répond pas. Vérifie la connexion.' : 'Ce code ne marche pas. Demande un nouveau code à un parent.')
  }
  return (
    <main className="screen">
      <form className="panel narrow" onSubmit={submit}>
        <h2>Relier cet ordinateur</h2>
        <p>Un parent crée un code à 8 chiffres dans l'espace parent, onglet Famille.</p>
        <input
          className="code-input"
          inputMode="numeric"
          autoComplete="off"
          maxLength={9}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-label="Code à 8 chiffres"
          autoFocus
        />
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions">
          <button type="button" className="secondary" onClick={onBack}>Retour</button>
          <button type="submit" className="primary" disabled={code.replace(/\D/g, '').length !== 8}>Relier</button>
        </div>
      </form>
    </main>
  )
}

export function ProfilesScreen({ services, onChoose, onUnpaired, onBack }: {
  services: Services
  onChoose: (p: Profile) => void
  onUnpaired: () => void
  onBack: () => void
}) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    void services.api.get<Profile[]>('/play/profiles', false).then((res) => {
      if (res.ok) setProfiles(res.data)
      else if (res.status === 401 || res.status === 403) {
        services.api.forgetDevice() // appareil retiré par un parent
        onUnpaired()
      } else setError('Le serveur ne répond pas. Réessaie dans un instant.')
    })
  }, [services, onUnpaired])
  return (
    <main className="screen">
      <div className="panel narrow">
        <h2>Qui joue ?</h2>
        {error && <p className="error" role="alert">{error}</p>}
        {!profiles && !error && <p>Chargement…</p>}
        <div className="profiles">
          {profiles?.map((p) => (
            <button key={p.id} type="button" className="profile-card" onClick={() => onChoose(p)}>
              <span className="profile-name">{p.name}</span>
              <span className="profile-level">{p.level_label ?? p.level}</span>
            </button>
          ))}
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={onBack}>Retour</button>
        </div>
      </div>
    </main>
  )
}

export function PinScreen({ services, profile, onLoggedIn, onBack }: {
  services: Services
  profile: Profile
  onLoggedIn: () => void
  onBack: () => void
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  async function submit(value: string) {
    const res = await services.session.login(profile.id, value)
    if (res.ok) onLoggedIn()
    else {
      setPin('')
      setError(res.status === 429 || res.error.code === 'locked' ? 'Trop d’essais. Attends quelques minutes.' : 'Ce n’est pas le bon code. Réessaie.')
    }
  }
  function press(digit: string) {
    const next = (pin + digit).slice(0, 4)
    setPin(next)
    setError('')
    if (next.length === 4) void submit(next)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      if (e.key === 'Backspace') setPin((p) => p.slice(0, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  return (
    <main className="screen">
      <div className="panel narrow">
        <h2>Bonjour {profile.name} !</h2>
        <p>Tape ton code secret.</p>
        <div className="pin-dots" aria-label={`${pin.length} chiffres sur 4`}>
          {[0, 1, 2, 3].map((i) => <span key={i} className={i < pin.length ? 'dot full' : 'dot'} />)}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k) =>
            k === '' ? <span key="vide" /> : (
              <button key={k} type="button" onClick={() => (k === '⌫' ? setPin((p) => p.slice(0, -1)) : press(k))}>{k}</button>
            ),
          )}
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={onBack}>Retour</button>
        </div>
      </div>
    </main>
  )
}
