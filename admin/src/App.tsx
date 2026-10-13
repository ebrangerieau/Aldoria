import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError, type Profile } from './api'
import { InvitationPage, Login } from './Auth'
import { Dashboard } from './Dashboard'
import { Family, leave } from './Family'
import { Guide, type GuideTarget } from './Guide'
import { Operator } from './Operator'
import { Program } from './Program'
import { Questions, type View } from './Questions'
import { Reports } from './Reports'
import { Settings } from './Settings'

type Page = GuideTarget | 'guide' | 'operator'

const PAGES: { id: Page; label: string; operator?: boolean; needsChild?: boolean }[] = [
  { id: 'dashboard', label: 'Tableau de bord', needsChild: true },
  { id: 'program', label: 'Programme', needsChild: true },
  { id: 'questions', label: 'Questions', needsChild: true },
  { id: 'reports', label: 'Signalements', needsChild: true },
  { id: 'settings', label: 'Réglages', needsChild: true },
  { id: 'family', label: 'Famille' },
  { id: 'guide', label: 'Guide' },
  { id: 'operator', label: 'Exploitation', operator: true },
]

const WELCOME_KEY = 'aldoria-guide-vu'

// Mémoire du navigateur : peut être indisponible (navigation privée) sans gêner la page.
function guideSeen(): boolean {
  try {
    return localStorage.getItem(WELCOME_KEY) === '1'
  } catch {
    return false
  }
}

function rememberGuideSeen() {
  try {
    localStorage.setItem(WELCOME_KEY, '1')
  } catch {
    // rien : le bandeau reviendra à la prochaine visite
  }
}

// Lien d'invitation (…/#invitation=…) : le jeton est lu puis retiré de l'adresse.
function invitationToken(): string | null {
  const match = window.location.hash.match(/^#invitation=([A-Za-z0-9_-]+)$/)
  return match ? match[1] : null
}

export function App() {
  const [invitation, setInvitation] = useState(invitationToken)
  const me = useQuery({ queryKey: ['me'], queryFn: api.me, retry: false, enabled: invitation === null })
  if (invitation !== null) {
    return (
      <InvitationPage
        token={invitation}
        onDone={() => {
          window.history.replaceState(null, '', window.location.pathname)
          setInvitation(null)
        }}
      />
    )
  }
  if (me.isPending) return <p className="loading">Chargement…</p>
  if (me.isError) {
    if (me.error instanceof ApiError && me.error.status === 401) return <Login />
    return <AccessError error={me.error} />
  }
  return <Space />
}

function Space() {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me, retry: false })
  const profiles = useQuery({ queryKey: ['profiles'], queryFn: api.profiles })
  const [childId, setChildId] = useState<number | null>(null)
  const [page, setPage] = useState<Page>('dashboard')
  const [openItem, setOpenItem] = useState<number | null>(null)
  const [welcome, setWelcome] = useState(!guideSeen())
  const [questionsView, setQuestionsView] = useState<View>('bank')
  const logout = useMutation({ mutationFn: api.logout, onSuccess: leave })
  const go = (target: Page, view: View = 'bank') => {
    setOpenItem(null)
    setQuestionsView(view)
    setPage(target)
    if (target === 'guide') {
      rememberGuideSeen()
      setWelcome(false)
    }
    window.scrollTo(0, 0)
  }
  const reportCount = useQuery({ queryKey: ['report-count'], queryFn: api.reportCount })

  if (me.isPending || profiles.isPending) return <p className="loading">Chargement…</p>
  if (me.isError) return <AccessError error={me.error} />
  if (profiles.isError) return <AccessError error={profiles.error} />

  const children = profiles.data
  const child: Profile | undefined = children.find((p) => p.id === childId) ?? children[0]
  const pages = PAGES.filter((p) => !p.operator || me.data.adult.is_operator)
  // Sans enfant (nouvelle famille), on commence par l'onglet Famille.
  const current: Page = !child && PAGES.find((p) => p.id === page)?.needsChild ? 'family' : page

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Les Chroniques d'Aldoria</h1>
          <p className="subtitle">
            Espace parent · {me.data.family.name} · {me.data.adult.name}{' '}
            <button className="link" onClick={() => logout.mutate()}>
              Se déconnecter
            </button>
          </p>
        </div>
        <nav className="children" aria-label="Enfant">
          {children.map((p) => (
            <button key={p.id} className={p.id === child?.id ? 'chip active' : 'chip'} onClick={() => setChildId(p.id)}>
              {p.name} <span className="muted">{p.level_label}</span>
            </button>
          ))}
        </nav>
      </header>
      <nav className="tabs" aria-label="Rubrique">
        {pages.map((p) => (
          <button
            key={p.id}
            className={p.id === current ? 'tab active' : 'tab'}
            disabled={p.needsChild && !child}
            onClick={() => go(p.id)}
          >
            {p.label}
            {p.id === 'reports' && (reportCount.data?.open ?? 0) > 0 && <span className="count">{reportCount.data!.open}</span>}
          </button>
        ))}
      </nav>
      <main>
        {welcome && current !== 'guide' && (
          <div className="card welcome">
            <span>
              <strong>Première visite ?</strong> Le guide explique pas à pas tout ce que vous pouvez faire ici.
            </span>
            <span className="row">
              <button className="primary" onClick={() => go('guide')}>
                Lire le guide
              </button>
              <button
                onClick={() => {
                  rememberGuideSeen()
                  setWelcome(false)
                }}
              >
                Masquer
              </button>
            </span>
          </div>
        )}
        {!child && current === 'family' && (
          <div className="card tip">
            <strong>Bienvenue !</strong> Commencez par ajouter vos enfants, puis reliez la tablette ou l'ordinateur où ils joueront.
          </div>
        )}
        {child && current === 'dashboard' && <Dashboard child={child} />}
        {child && current === 'program' && <Program child={child} />}
        {child && current === 'questions' && (
          <Questions key={`${child.level}-${openItem}-${questionsView}`} child={child} openItem={openItem} initialView={questionsView} />
        )}
        {child && current === 'reports' && (
          <Reports
            onEditBankItem={(id) => {
              setOpenItem(id)
              setPage('questions')
            }}
          />
        )}
        {child && current === 'settings' && <Settings child={child} />}
        {current === 'family' && <Family me={me.data} children={children} />}
        {current === 'guide' && <Guide child={child} onOpen={go} />}
        {current === 'operator' && me.data.adult.is_operator && <Operator />}
      </main>
    </div>
  )
}

function AccessError({ error }: { error: Error }) {
  const apiError = error instanceof ApiError ? error : null
  return (
    <div className="app">
      <h1>Espace parent</h1>
      <div className="card error">
        <p>{apiError?.message ?? 'Le serveur ne répond pas.'}</p>
      </div>
    </div>
  )
}
