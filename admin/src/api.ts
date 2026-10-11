// Accès à l'API parent (/api/v1/admin), servie sur la même origine que cette page.
// L'authentification est faite en amont par TinyAuth (cookie SSO) : rien à gérer ici.

export type Level = '6e' | '2nde'
export type ChapterStatus = 'a_venir' | 'en_cours' | 'controle_bientot' | 'termine'
export type NotionState = 'acquise' | 'fragile' | 'non acquise' | 'non vue'

export interface Week {
  sessions: number
  minutes: number
  answers: number
  correct: number
  last_played: string | null
}

export interface Profile {
  id: number
  name: string
  level: Level
  world: string
  avatar: string
  session_max_minutes: number
  week?: Week
}

export interface Notion {
  code: string
  label: string
  playable: boolean
  stars: number
  state: NotionState
  mastery: number
  seen: number
}

export interface Chapter {
  code: string
  title: string
  status: ChapterStatus
  test_date: string | null
  notions: Notion[]
}

export interface Dashboard {
  profile: Profile
  counts: Record<NotionState, number>
  playable: number
  week: Week
  days: { date: string; minutes: number }[]
  recent_sessions: { started_at: string; minutes: number; questions: number; correct: number; finished: boolean }[]
  weak_notions: (Notion & { chapter: string })[]
}

export interface NotionToValidate {
  code: string
  label: string
  level: Level
  chapter: string
  in_program: boolean | null
}

export interface Parent {
  user: string
  email: string
  name: string
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/admin${path}`, {
    method,
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  })
  const text = await response.text()
  const data = text ? safeJson(text) : null
  if (!response.ok) {
    const error = (data as { error?: { code: string; message: string; details?: Record<string, unknown> } })?.error
    throw new ApiError(response.status, error?.code ?? `http_${response.status}`, error?.message ?? 'Erreur du serveur.', error?.details)
  }
  return data as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export const api = {
  me: () => request<Parent>('GET', '/me'),
  profiles: () => request<Profile[]>('GET', '/profiles'),
  dashboard: (id: number) => request<Dashboard>('GET', `/profiles/${id}/dashboard`),
  chapters: (id: number) => request<Chapter[]>('GET', `/profiles/${id}/chapters`),
  setChapter: (id: number, code: string, status: ChapterStatus, test_date: string | null) =>
    request<{ code: string; status: ChapterStatus; test_date: string | null }>('PUT', `/profiles/${id}/chapters/${encodeURIComponent(code)}`, {
      status,
      test_date,
    }),
  setMaxMinutes: (id: number, session_max_minutes: number) => request<Profile>('PATCH', `/profiles/${id}`, { session_max_minutes }),
  toValidate: () => request<NotionToValidate[]>('GET', '/notions/to-validate'),
  decideNotion: (code: string, in_program: boolean) =>
    request<{ code: string; in_program: boolean }>('PUT', `/notions/${encodeURIComponent(code)}`, { in_program }),
}

export const STATUS_LABELS: Record<ChapterStatus, string> = {
  a_venir: 'À venir',
  en_cours: 'En cours en classe',
  controle_bientot: 'Contrôle bientôt',
  termine: 'Terminé',
}
