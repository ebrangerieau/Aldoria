import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError, type Profile } from './api'
import { Dashboard } from './Dashboard'
import { Program } from './Program'
import { Questions } from './Questions'
import { Reports } from './Reports'
import { Settings } from './Settings'

type Page = 'dashboard' | 'program' | 'questions' | 'reports' | 'settings'

const PAGES: { id: Page; label: string }[] = [
  { id: 'dashboard', label: 'Tableau de bord' },
  { id: 'program', label: 'Programme' },
  { id: 'questions', label: 'Questions' },
  { id: 'reports', label: 'Signalements' },
  { id: 'settings', label: 'Réglages' },
]

export function App() {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me, retry: false })
  const profiles = useQuery({ queryKey: ['profiles'], queryFn: api.profiles, enabled: me.isSuccess })
  const [childId, setChildId] = useState<number | null>(null)
  const [page, setPage] = useState<Page>('dashboard')
  const [openItem, setOpenItem] = useState<number | null>(null)
  const reportCount = useQuery({ queryKey: ['report-count'], queryFn: api.reportCount, enabled: me.isSuccess })

  if (me.isError) return <AccessError error={me.error} />
  if (me.isPending || profiles.isPending) return <p className="loading">Chargement…</p>
  if (profiles.isError) return <AccessError error={profiles.error} />

  const children = profiles.data
  const child: Profile | undefined = children.find((p) => p.id === childId) ?? children[0]

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Les Chroniques d'Aldoria</h1>
          <p className="subtitle">Espace parent · {me.data.name}</p>
        </div>
        <nav className="children" aria-label="Enfant">
          {children.map((p) => (
            <button key={p.id} className={p.id === child?.id ? 'chip active' : 'chip'} onClick={() => setChildId(p.id)}>
              {p.name} <span className="muted">{p.level === '6e' ? '6ème' : 'Seconde'}</span>
            </button>
          ))}
        </nav>
      </header>
      <nav className="tabs" aria-label="Rubrique">
        {PAGES.map((p) => (
          <button
            key={p.id}
            className={p.id === page ? 'tab active' : 'tab'}
            onClick={() => {
              setOpenItem(null)
              setPage(p.id)
            }}
          >
            {p.label}
            {p.id === 'reports' && (reportCount.data?.open ?? 0) > 0 && <span className="count">{reportCount.data!.open}</span>}
          </button>
        ))}
      </nav>
      <main>
        {!child && <p>Aucun profil enfant.</p>}
        {child && page === 'dashboard' && <Dashboard child={child} />}
        {child && page === 'program' && <Program child={child} />}
        {child && page === 'questions' && <Questions key={`${child.level}-${openItem}`} child={child} openItem={openItem} />}
        {child && page === 'reports' && (
          <Reports
            onEditBankItem={(id) => {
              setOpenItem(id)
              setPage('questions')
            }}
          />
        )}
        {child && page === 'settings' && <Settings child={child} />}
      </main>
    </div>
  )
}

function AccessError({ error }: { error: Error }) {
  const apiError = error instanceof ApiError ? error : null
  const identity = apiError?.details?.identity as string | undefined
  return (
    <div className="app">
      <h1>Espace parent</h1>
      <div className="card error">
        <p>{apiError?.message ?? 'Le serveur ne répond pas.'}</p>
        {identity && (
          <p>
            Identité reçue : <strong>{identity}</strong>. Elle doit figurer dans <code>ALDORIA_ADMIN_USERS</code> sur le serveur.
          </p>
        )}
      </div>
    </div>
  )
}
