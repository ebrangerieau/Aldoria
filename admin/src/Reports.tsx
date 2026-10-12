import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, REASON_LABELS, type ReportRow } from './api'
import { QuestionPreview } from './QuestionPreview'

// Questions signalées par les enfants depuis le jeu (« Signaler une erreur »), avec la
// réponse qu'ils avaient donnée. Une question de la banque s'ouvre dans l'éditeur.
export function Reports({ onEditBankItem }: { onEditBankItem: (id: number) => void }) {
  const client = useQueryClient()
  const [status, setStatus] = useState<'ouvert' | 'traite'>('ouvert')
  const query = useQuery({ queryKey: ['reports', status], queryFn: () => api.reports(status) })
  const mutation = useMutation({
    mutationFn: ({ id, next }: { id: number; next: 'ouvert' | 'traite' }) => api.setReport(id, next),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['reports'] })
      client.invalidateQueries({ queryKey: ['report-count'] })
    },
  })
  return (
    <div className="stack">
      <section className="card">
        <h2>Signalements</h2>
        <p className="muted small">
          Quand un enfant pense qu'une question est fausse, il la signale depuis l'explication. Une question générée fausse est un défaut du jeu
          (à corriger dans le code) ; une question de la banque se corrige ici.
        </p>
        <div className="row">
          {(['ouvert', 'traite'] as const).map((s) => (
            <button key={s} className={s === status ? 'choice active' : 'choice'} onClick={() => setStatus(s)}>
              {s === 'ouvert' ? 'À traiter' : 'Traités'}
            </button>
          ))}
        </div>
        {query.isPending && <p className="loading">Chargement…</p>}
        {query.isSuccess && query.data.length === 0 && <p className="muted">Aucun signalement {status === 'ouvert' ? 'à traiter' : 'traité'}.</p>}
      </section>
      {(query.data ?? []).map((r: ReportRow) => (
        <section key={r.id} className="card">
          <div className="row spread">
            <span>
              <strong>{r.child}</strong> · {REASON_LABELS[r.reason]}
              <span className="muted small"> · {new Date(r.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </span>
            <span className="row">
              {r.bank_id !== null && <button onClick={() => onEditBankItem(r.bank_id!)}>Corriger dans la banque</button>}
              <button
                className={status === 'ouvert' ? 'primary' : undefined}
                onClick={() => mutation.mutate({ id: r.id, next: status === 'ouvert' ? 'traite' : 'ouvert' })}
              >
                {status === 'ouvert' ? 'Marquer traité' : 'Rouvrir'}
              </button>
            </span>
          </div>
          <p className="muted small">
            {r.bank_id !== null ? 'Question de la banque' : `Question générée (${r.item.generator ?? r.item_id})`}
          </p>
          <QuestionPreview item={r.item} formulas={{}} given={r.user_input} />
        </section>
      ))}
    </div>
  )
}
