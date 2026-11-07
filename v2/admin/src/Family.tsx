import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError, type Level, type Link, type Me, type Profile, type World } from './api'

// Onglet « Famille » : enfants, adultes, appareils reliés, mon compte, suppression.
export function Family({ me, children }: { me: Me; children: Profile[] }) {
  return (
    <div className="stack">
      <FamilyName me={me} />
      <Children children={children} />
      <Adults />
      <Devices />
      <MyAccount />
      {!me.adult.is_operator && <DeleteFamily me={me} />}
    </div>
  )
}

// Déconnexion ou famille supprimée : on recharge la page (plus rien en mémoire), qui
// affiche alors l'écran de connexion.
export function leave() {
  window.location.reload()
}

export function formatDate(iso: string | null, withTime = true): string {
  if (!iso) return 'jamais'
  return new Date(iso).toLocaleString('fr-FR', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' })
}

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Le serveur ne répond pas.'
}

// Lien à transmettre (invitation, mot de passe) : affiché une seule fois, avec un bouton Copier.
export function LinkBox({ link, children }: { link: Link; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="link-box">
      {children}
      <div className="row">
        <input readOnly value={link.link} aria-label="Lien à transmettre" onFocus={(e) => e.target.select()} />
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link.link)
              setCopied(true)
            } catch {
              setCopied(false)
            }
          }}
        >
          {copied ? 'Copié ✓' : 'Copier'}
        </button>
      </div>
      <p className="muted small">
        Valable jusqu'au {formatDate(link.expires_at, false)}, une seule fois. Envoyez-le par le moyen de votre choix (SMS, messagerie…) : il
        n'apparaîtra plus ici.
      </p>
    </div>
  )
}

function FamilyName({ me }: { me: Me }) {
  const client = useQueryClient()
  const [name, setName] = useState(me.family.name)
  const mutation = useMutation({
    mutationFn: () => api.renameFamily(name.trim()),
    onSuccess: (data) => client.setQueryData(['me'], data),
  })
  return (
    <section className="card">
      <h2>Votre famille</h2>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          mutation.mutate()
        }}
      >
        <label>
          Nom{' '}
          <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" disabled={!name.trim() || name.trim() === me.family.name || mutation.isPending}>
          Renommer
        </button>
        {mutation.isSuccess && name.trim() === me.family.name && <span className="ok">Enregistré ✓</span>}
      </form>
    </section>
  )
}

function Children({ children }: { children: Profile[] }) {
  const client = useQueryClient()
  const [name, setName] = useState('')
  const info = useQuery({ queryKey: ['levels'], queryFn: api.levels })
  const [level, setLevel] = useState<Level>('6e')
  const [world, setWorld] = useState<World | ''>('')
  const [pin, setPin] = useState('')
  const [again, setAgain] = useState('')
  const [removing, setRemoving] = useState<number | null>(null)
  const [confirm, setConfirm] = useState('')
  const digits = (value: string) => value.replace(/[^0-9]/g, '').slice(0, 4)
  const create = useMutation({
    // Monde par défaut selon le cycle : lumineux au collège, Brouillard au lycée.
    mutationFn: () => api.createChild(name.trim(), level, world || (['2nde', '1ere', 'term'].includes(level) ? 'brouillard' : 'lumineux'), pin),
    onSuccess: () => {
      setName('')
      setPin('')
      setAgain('')
      client.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteChild(id, confirm),
    onSuccess: () => {
      setRemoving(null)
      setConfirm('')
      client.invalidateQueries()
    },
  })
  const mismatch = pin.length === 4 && again.length === 4 && pin !== again
  return (
    <section className="card" id="enfants">
      <h2>Enfants</h2>
      {children.length === 0 && <p>Aucun enfant pour l'instant : ajoutez-en un ci-dessous.</p>}
      <ul className="plain-list">
        {children.map((p) => (
          <li key={p.id}>
            <div className="row spread">
              <span>
                <strong>{p.name}</strong> <span className="muted">· {p.level_label}</span>
              </span>
              {removing !== p.id && (
                <button
                  className="danger-link"
                  onClick={() => {
                    setRemoving(p.id)
                    setConfirm('')
                  }}
                >
                  Supprimer…
                </button>
              )}
            </div>
            {removing === p.id && (
              <form
                className="row danger-zone"
                onSubmit={(e) => {
                  e.preventDefault()
                  remove.mutate(p.id)
                }}
              >
                <span className="small">Efface {p.name} et toutes ses données (réponses, partie). Irréversible.</span>
                <input placeholder={`Écrivez « ${p.name} »`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                <button className="danger" type="submit" disabled={confirm.trim().toLowerCase() !== p.name.toLowerCase() || remove.isPending}>
                  Supprimer
                </button>
                <button type="button" onClick={() => setRemoving(null)}>
                  Annuler
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {remove.isError && <p className="status-line bad">{errorText(remove.error)}</p>}
      <h3>Ajouter un enfant</h3>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          if (!mismatch) create.mutate()
        }}
      >
        <label>
          Prénom <input required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Classe{' '}
          <select value={level} onChange={(e) => setLevel(e.target.value as Level)}>
            {info.data?.levels.map((l) => (
              <option key={l.code} value={l.code} disabled={!l.available}>
                {l.label}
                {l.available ? '' : ' (bientôt)'}
              </option>
            ))}
          </select>
        </label>
        <label>
          Monde{' '}
          <select value={world} onChange={(e) => setWorld(e.target.value as World | '')}>
            <option value="">Selon la classe</option>
            {info.data?.worlds.map((w) => (
              <option key={w.code} value={w.code}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Code secret (4 chiffres){' '}
          <input className="pin" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(digits(e.target.value))} />
        </label>
        <label>
          Encore une fois{' '}
          <input className="pin" type="password" inputMode="numeric" autoComplete="off" value={again} onChange={(e) => setAgain(digits(e.target.value))} />
        </label>
        <button className="primary" type="submit" disabled={!name.trim() || pin.length !== 4 || pin !== again || create.isPending}>
          Ajouter
        </button>
      </form>
      {mismatch && <p className="status-line bad">Les deux codes sont différents.</p>}
      {create.isError && <p className="status-line bad">{errorText(create.error)}</p>}
      {create.isSuccess && <p className="status-line ok">Enfant ajouté ✓ Il apparaît dans le jeu sur les appareils de la famille.</p>}
      <p className="muted small">
        La classe fixe les questions, les donjons et le village ; le monde ne change que l'ambiance (Aldoria lumineuse avec un renard
        compagnon, ou le Brouillard, plus sombre). Par défaut : lumineux au collège, Brouillard au lycée ; modifiable dans Réglages.
      </p>
    </section>
  )
}

function Adults() {
  const client = useQueryClient()
  const adults = useQuery({ queryKey: ['adults'], queryFn: api.adults })
  const [note, setNote] = useState('')
  const [links, setLinks] = useState<Record<string, Link>>({})
  const invite = useMutation({
    mutationFn: () => api.inviteAdult(note.trim()),
    onSuccess: (link) => {
      setLinks((l) => ({ ...l, invite: link }))
      setNote('')
      client.invalidateQueries({ queryKey: ['adults'] })
    },
  })
  const reset = useMutation({
    mutationFn: (id: number) => api.passwordLink(id),
    onSuccess: (link, id) => setLinks((l) => ({ ...l, [`reset-${id}`]: link })),
  })
  const remove = useMutation({
    mutationFn: (id: number) => api.removeAdult(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['adults'] }),
  })
  const cancel = useMutation({
    mutationFn: (id: string) => api.cancelInvitation(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['adults'] }),
  })
  return (
    <section className="card" id="adultes">
      <h2>Adultes</h2>
      <p className="muted small">Chaque adulte a son propre compte et voit tous les enfants de la famille.</p>
      {adults.isPending && <p className="loading">Chargement…</p>}
      <ul className="plain-list">
        {adults.data?.adults.map((a) => (
          <li key={a.id}>
            <div className="row spread">
              <span>
                <strong>{a.name}</strong> <span className="muted">· {a.email}</span>
                {a.is_me && <span className="badge">vous</span>} {a.is_operator && <span className="badge">exploitant</span>}
                <br />
                <span className="muted small">Dernière connexion : {formatDate(a.last_login_at)}</span>
              </span>
              {!a.is_me && (
                <span className="row">
                  <button onClick={() => reset.mutate(a.id)}>Lien « mot de passe oublié »</button>
                  {!a.is_operator && (
                    <button className="danger-link" onClick={() => remove.mutate(a.id)}>
                      Retirer
                    </button>
                  )}
                </span>
              )}
            </div>
            {links[`reset-${a.id}`] && (
              <LinkBox link={links[`reset-${a.id}`]}>
                <p className="small">Lien pour que {a.name} choisisse un nouveau mot de passe :</p>
              </LinkBox>
            )}
          </li>
        ))}
      </ul>
      {remove.isError && <p className="status-line bad">{errorText(remove.error)}</p>}
      {(adults.data?.invitations.length ?? 0) > 0 && (
        <>
          <h3>Invitations en attente</h3>
          <ul className="plain-list">
            {adults.data!.invitations.map((i) => (
              <li key={i.id} className="row spread">
                <span>
                  {i.note || 'Invitation'} <span className="muted small">· valable jusqu'au {formatDate(i.expires_at, false)}</span>
                </span>
                <button onClick={() => cancel.mutate(i.id)}>Annuler</button>
              </li>
            ))}
          </ul>
        </>
      )}
      <h3>Inviter un adulte</h3>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          invite.mutate()
        }}
      >
        <label>
          Pour qui ? <input maxLength={80} placeholder="ex. : Karine" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button className="primary" type="submit" disabled={invite.isPending}>
          Créer un lien d'invitation
        </button>
      </form>
      {links.invite && (
        <LinkBox link={links.invite}>
          <p className="small">
            Envoyez ce lien à la personne invitée : elle y choisit son e-mail et son mot de passe, puis arrive dans l'espace parent.
          </p>
        </LinkBox>
      )}
    </section>
  )
}

function Devices() {
  const client = useQueryClient()
  const devices = useQuery({ queryKey: ['devices'], queryFn: api.devices })
  const [name, setName] = useState('')
  const code = useMutation({
    mutationFn: () => api.deviceCode(name.trim()),
    onSuccess: () => setName(''),
  })
  const remove = useMutation({
    mutationFn: (id: number) => api.removeDevice(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['devices'] }),
  })
  return (
    <section className="card" id="appareils">
      <h2>Appareils</h2>
      <p className="muted small">
        Le jeu n'affiche les enfants que sur un appareil relié à la famille (tablette, ordinateur). Un appareil se relie une seule fois.
      </p>
      <ul className="plain-list">
        {devices.data?.length === 0 && <li>Aucun appareil relié.</li>}
        {devices.data?.map((d) => (
          <li key={d.id} className="row spread">
            <span>
              <strong>{d.name}</strong>{' '}
              <span className="muted small">
                · relié le {formatDate(d.created_at, false)} · dernière utilisation : {formatDate(d.last_seen_at)}
              </span>
            </span>
            <button className="danger-link" onClick={() => remove.mutate(d.id)}>
              Retirer
            </button>
          </li>
        ))}
      </ul>
      <h3>Relier un appareil</h3>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          code.mutate()
        }}
      >
        <label>
          Nom de l'appareil <input required maxLength={60} placeholder="ex. : Tablette du salon" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="primary" type="submit" disabled={!name.trim() || code.isPending}>
          Créer un code
        </button>
      </form>
      {code.data && (
        <div className="link-box">
          <p>
            Sur l'appareil, ouvrez le jeu : il demande un code. Tapez :
          </p>
          <p className="pairing-code">{code.data.code.replace(/(\d{4})(\d{4})/, '$1 $2')}</p>
          <p className="muted small">Valable 30 minutes, une seule fois. L'appareil reste ensuite relié, sans rien à refaire.</p>
        </div>
      )}
      {code.isError && <p className="status-line bad">{errorText(code.error)}</p>}
    </section>
  )
}

function MyAccount() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const change = useMutation({
    mutationFn: () => api.changePassword(current, next),
    onSuccess: () => {
      setCurrent('')
      setNext('')
      setAgain('')
    },
  })
  const others = useMutation({ mutationFn: api.logoutOthers })
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: leave,
  })
  const mismatch = again.length > 0 && next !== again
  return (
    <section className="card" id="compte">
      <h2>Mon compte</h2>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          if (!mismatch) change.mutate()
        }}
      >
        <label>
          Mot de passe actuel{' '}
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <label>
          Nouveau (10 caractères au moins){' '}
          <input type="password" autoComplete="new-password" minLength={10} value={next} onChange={(e) => setNext(e.target.value)} />
        </label>
        <label>
          Encore une fois <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </label>
        <button type="submit" disabled={!current || next.length < 10 || mismatch || change.isPending}>
          Changer le mot de passe
        </button>
      </form>
      {mismatch && <p className="status-line bad">Les deux mots de passe sont différents.</p>}
      {change.isError && <p className="status-line bad">{errorText(change.error)}</p>}
      {change.isSuccess && <p className="status-line ok">Mot de passe changé ✓ Vos autres appareils devront se reconnecter.</p>}
      <div className="row section-foot">
        <button onClick={() => others.mutate()} disabled={others.isPending}>
          Déconnecter mes autres appareils
        </button>
        {others.isSuccess && <span className="ok">{others.data.closed} session(s) fermée(s) ✓</span>}
        <button onClick={() => logout.mutate()}>Se déconnecter</button>
      </div>
    </section>
  )
}

function DeleteFamily({ me }: { me: Me }) {
  const [confirm, setConfirm] = useState('')
  const mutation = useMutation({
    mutationFn: () => api.deleteFamily(confirm),
    onSuccess: leave,
  })
  return (
    <section className="card danger-zone">
      <h2>Supprimer la famille</h2>
      <p className="muted small">
        Efface définitivement la famille, ses enfants et toutes leurs données, ses questions, ses appareils et les comptes de ses adultes.
        Irréversible.
      </p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          mutation.mutate()
        }}
      >
        <input placeholder={`Écrivez « ${me.family.name} » pour confirmer`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <button className="danger" type="submit" disabled={confirm.trim().toLowerCase() !== me.family.name.toLowerCase() || mutation.isPending}>
          Tout effacer
        </button>
      </form>
      {mutation.isError && <p className="status-line bad">{errorText(mutation.error)}</p>}
    </section>
  )
}
