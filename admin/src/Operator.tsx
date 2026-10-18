import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from './api'
import { formatDate, LinkBox } from './Family'
import { Backups } from './Settings'

// Onglet « Exploitation » (exploitant du serveur seulement) : familles, erreurs du jeu et sauvegardes.
export function Operator() {
  const families = useQuery({ queryKey: ['families'], queryFn: api.families })
  const [note, setNote] = useState('')
  const invite = useMutation({ mutationFn: () => api.inviteFamily(note.trim()), onSuccess: () => setNote('') })
  return (
    <div className="stack">
      <section className="card" id="familles">
        <h2>Familles du serveur</h2>
        <p className="muted small">
          Chaque famille ne voit que ses enfants, ses questions et ses appareils. Vous ne voyez ici que des comptes, jamais leurs données.
        </p>
        <table className="report">
          <thead>
            <tr>
              <th>Famille</th>
              <th>Adultes</th>
              <th>Enfants</th>
              <th>Appareils</th>
              <th>Créée le</th>
              <th>Dernière réponse</th>
              <th>IA ce mois</th>
            </tr>
          </thead>
          <tbody>
            {families.data?.map((f) => (
              <tr key={f.id}>
                <td>{f.name}</td>
                <td>{f.adults}</td>
                <td>{f.children}</td>
                <td>{f.devices}</td>
                <td>{formatDate(f.created_at, false)}</td>
                <td>{formatDate(f.last_activity, false)}</td>
                <td>
                  {f.ai_requests_month} demande{f.ai_requests_month > 1 ? 's' : ''} · ≈ {f.ai_cost_month_usd.toFixed(2)} $
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>Accueillir une nouvelle famille</h3>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            invite.mutate()
          }}
        >
          <label>
            Pour qui ? <input maxLength={80} placeholder="ex. : famille Martin" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button className="primary" type="submit" disabled={invite.isPending}>
            Créer un lien
          </button>
        </form>
        {invite.data && (
          <LinkBox link={invite.data}>
            <p className="small">Le premier adulte de cette famille y crée son compte et le nom de sa famille.</p>
          </LinkBox>
        )}
        <div className="warn">
          <strong>Avant d'accueillir une autre famille.</strong> Vous hébergez alors des données d'enfants qui ne sont pas les vôtres :
          informez les parents (ce qui est enregistré, combien de temps, où), obtenez leur accord, et rappelez-leur qu'ils peuvent tout effacer
          (Famille → Supprimer la famille).
        </div>
      </section>
      <GameErrors />
      <Backups />
    </div>
  )
}

// Erreurs remontées par le jeu sur les appareils (30 derniers jours) : on les voit avant que les enfants les racontent.
function GameErrors() {
  const client = useQueryClient()
  const errors = useQuery({ queryKey: ['client-errors'], queryFn: api.clientErrors })
  const clear = useMutation({
    mutationFn: api.clearClientErrors,
    onSuccess: () => client.invalidateQueries({ queryKey: ['client-errors'] }),
  })
  return (
    <section className="card" id="erreurs">
      <h2>Erreurs du jeu</h2>
      <p className="muted small">
        Le jeu envoie ici chaque erreur rencontrée sur une tablette, un téléphone ou un ordinateur : ce qui s'est passé, où dans le code, sur
        quel écran, avec quelle version du jeu. Jamais le prénom d'un enfant ni ses réponses. Une même erreur n'occupe qu'une ligne, avec le
        nombre de fois où elle s'est produite.
      </p>
      {errors.isPending && <p className="loading">Chargement…</p>}
      {errors.isError && <p className="status-line bad">Liste des erreurs indisponible.</p>}
      {errors.data && errors.data.length === 0 && <p className="status-line ok">Aucune erreur ces 30 derniers jours.</p>}
      {errors.data && errors.data.length > 0 && (
        <>
          <table className="report">
            <thead>
              <tr>
                <th>Dernière fois</th>
                <th>Erreur</th>
                <th>Écran</th>
                <th>Appareil</th>
                <th>Version</th>
                <th>Fois</th>
              </tr>
            </thead>
            <tbody>
              {errors.data.map((e) => (
                <tr key={e.id}>
                  <td>{formatDate(e.last_seen)}</td>
                  <td>
                    {e.message}
                    {e.location && <div className="muted small">{e.location}</div>}
                  </td>
                  <td>{e.scene.replace('res://scenes/', '').replace('.tscn', '')}</td>
                  <td>
                    {e.platform}
                    <div className="muted small">
                      {e.family}
                      {e.device && ` · ${e.device}`}
                    </div>
                  </td>
                  <td>{e.version}</td>
                  <td>{e.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row">
            <button type="button" onClick={() => clear.mutate()} disabled={clear.isPending}>
              Vider la liste
            </button>
            <span className="muted small">Après une correction : une erreur qui revient réapparaît.</span>
          </div>
        </>
      )}
    </section>
  )
}
