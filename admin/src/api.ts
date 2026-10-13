// Accès à l'API parent (/api/v1/admin), servie sur la même origine que cette page.
// Connexion d'un adulte : cookie de session posé par l'API (HttpOnly, envoyé tout seul).

// Classes de la 6e à la terminale (api/app/engine/levels.py) ; une classe n'est proposée
// que si son programme est dans le jeu (`available`).
export type Level = '6e' | '5e' | '4e' | '3e' | '2nde' | '1ere' | 'term'
export type World = 'lumineux' | 'brouillard'
export const LEVEL_LABELS: Record<string, string> = {
  '6e': '6ème',
  '5e': '5ème',
  '4e': '4ème',
  '3e': '3ème',
  '2nde': 'Seconde',
  '1ere': 'Première',
  term: 'Terminale',
}

export interface LevelsInfo {
  levels: { code: Level; label: string; available: boolean }[]
  worlds: { code: World; label: string }[]
}
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
  level_label: string
  world: World
  avatar: string
  session_max_minutes: number
  ratios: Ratios
  accommodations: Accommodations
  week?: Week
}

// Aménagements (accessibilité, troubles « dys ») : api/app/engine/accommodations.py.
export interface Accommodations {
  read_aloud: boolean
  auto_read: boolean
  text_size: number
  spacing: boolean
  readable_font: boolean
  no_speed: boolean
  math_tools: boolean
  easy_start: boolean
  tap_only: boolean
  big_targets: boolean
  calm: boolean
  pause_minutes: number
  colorblind: boolean
}

export interface Ratios {
  chapter: number
  review: number
  automatisms: number
}

export interface Indicator {
  code: string
  label: string
  value: number | null
  unit: string
  target: string
  met: boolean | null
  detail: string
}

export interface Indicators {
  weeks: { start: string; sessions: number }[]
  indicators: Indicator[]
}

export type QuestionType = 'mcq' | 'numeric' | 'expression' | 'true_false' | 'order' | 'text'
// Langues de l'écoute (synthèse vocale de l'appareil).
export type ListenLang = 'en-GB' | 'en-US' | 'es-ES' | 'de-DE' | 'fr-FR'
export const LISTEN_LANGS: Record<ListenLang, string> = {
  'en-GB': 'anglais (britannique)',
  'en-US': 'anglais (américain)',
  'es-ES': 'espagnol',
  'de-DE': 'allemand',
  'fr-FR': 'français',
}

// Question telle que le jeu la reçoit (aperçu, signalement).
export interface GameItem {
  id?: string
  type: string
  difficulty?: number
  notions?: string[]
  prompt: string
  latex?: string | null
  latex_hash?: string
  choices?: string[] | null
  answer: Record<string, unknown> & { kind: string }
  listen?: { text: string; lang: string } | null
  hint?: string
  explanation?: string
  visual?: Record<string, unknown> | null
  generator?: string | null
}

export interface Preview {
  items: GameItem[]
  formulas: Record<string, string>
}

// Question saisie dans la banque (format d'import JSON).
export interface QuestionIn {
  notion: string
  type: QuestionType
  difficulty: number
  prompt: string
  latex?: string | null
  choices?: string[] | null
  answer: Record<string, unknown> & { kind: string }
  hint?: string
  explanation: string
  listen?: { text: string; lang: ListenLang } | null
}

export type BankStatus = 'brouillon' | 'publie'

export interface BankRow {
  id: number
  level: Level
  notion: string
  type: QuestionType
  difficulty: number
  status: BankStatus
  source: 'parent' | 'import' | 'ia'
  summary: string
  updated_at: string | null
  question?: GameItem & { notion: string }
}

export interface ImportReport {
  lines: { line: number; ok: boolean; errors: string[]; summary: string }[]
  valid: number
  invalid: number
  created: number
}

export interface GeneratorInfo {
  code: string
  title: string
  notion: string
  notion_label: string
  role: string
  use: string
}

export interface ReportRow {
  id: number
  child: string
  item_id: string
  bank_id: number | null
  item: GameItem
  user_input: string | null
  reason: 'enonce' | 'reponse' | 'incomprehensible' | 'autre'
  status: 'ouvert' | 'traite'
  created_at: string
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
  subject: { code: string; label: string }
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
  recent_sessions: {
    started_at: string
    minutes: number
    questions: number
    correct: number
    finished: boolean
    mode: 'arene' | 'donjon' | 'defi' | 'village' | null
    rating: number | null
  }[]
  weak_notions: (Notion & { chapter: string })[]
}

export interface NotionToValidate {
  code: string
  label: string
  level: Level
  chapter: string
  in_program: boolean | null
}

// Adulte connecté et sa famille (comptes propres à Aldoria, cookie de session).
export interface Me {
  adult: { id: number; name: string; email: string; is_operator: boolean }
  family: { id: number; name: string }
}

export interface Invitation {
  kind: 'adulte' | 'famille' | 'mot_de_passe'
  family: string | null
  adult: { name: string; email: string } | null
  expires_at: string
}

export interface Adults {
  adults: { id: number; name: string; email: string; is_me: boolean; is_operator: boolean; last_login_at: string | null }[]
  invitations: { id: string; note: string; expires_at: string }[]
}

export interface Device {
  id: number
  name: string
  created_at: string
  last_seen_at: string | null
}

export interface FamilyRow {
  id: number
  name: string
  created_at: string
  adults: number
  children: number
  devices: number
  last_activity: string | null
  ai_requests_month: number
  ai_cost_month_usd: number
}

export interface AiResult {
  created: BankRow[]
  rejected: { summary: string; errors: string[] }[]
  remaining: number
}

export interface Link {
  link: string
  expires_at: string
}

// État des sauvegardes de la base (service backup sur le VPS, copie à la maison).
export type BackupStatus =
  | { configured: false }
  | {
      configured: true
      state: 'ok' | 'late' | 'failed' | 'none'
      last: { file: string; bytes: number; date: string } | null
      copies: number
      error: string | null
      attempt: string | null
      home: { file: string; date: string } | null
      home_state: 'ok' | 'late' | 'none'
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
    // X-Requested-With : exigé par l'API pour toute modification (protection CSRF).
    headers: { Accept: 'application/json', 'X-Requested-With': 'aldoria', ...(body ? { 'Content-Type': 'application/json' } : {}) },
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
  me: () => request<Me>('GET', '/me'),
  login: (email: string, password: string) => request<Me>('POST', '/login', { email, password }),
  logout: () => request<null>('POST', '/logout'),
  invitation: (token: string) => request<Invitation>('GET', `/invitations/${encodeURIComponent(token)}`),
  acceptInvitation: (token: string, form: { password: string; name?: string; email?: string; family_name?: string }) =>
    request<Me>('POST', `/invitations/${encodeURIComponent(token)}/accept`, form),
  changePassword: (current: string, next: string) => request<null>('PUT', '/me/password', { current, new: next }),
  logoutOthers: () => request<{ closed: number }>('POST', '/me/logout-others'),
  adults: () => request<Adults>('GET', '/adults'),
  inviteAdult: (note: string) => request<Link>('POST', '/adults/invitations', { note }),
  cancelInvitation: (id: string) => request<null>('DELETE', `/adults/invitations/${id}`),
  passwordLink: (id: number) => request<Link>('POST', `/adults/${id}/password-link`),
  removeAdult: (id: number) => request<null>('DELETE', `/adults/${id}`),
  renameFamily: (name: string) => request<Me>('PUT', '/family', { name }),
  deleteFamily: (confirm: string) => request<null>('POST', '/family/delete', { confirm }),
  createChild: (name: string, level: Level, world: World, pin: string) => request<Profile>('POST', '/profiles', { name, level, world, pin }),
  deleteChild: (id: number, confirm: string) => request<null>('POST', `/profiles/${id}/delete`, { confirm }),
  devices: () => request<Device[]>('GET', '/devices'),
  deviceCode: (name: string) => request<{ code: string; expires_at: string }>('POST', '/devices/code', { name }),
  removeDevice: (id: number) => request<null>('DELETE', `/devices/${id}`),
  families: () => request<FamilyRow[]>('GET', '/families'),
  aiStatus: () => request<{ enabled: boolean; limit: number; remaining: number }>('GET', '/ai-questions'),
  aiPropose: (body: {
    level: Level
    notion: string
    count: number
    difficulty: number | null
    instructions: string
    material_text: string
    image_base64: string
    image_type: string
  }) => request<AiResult>('POST', '/ai-questions', body),
  inviteFamily: (note: string) => request<Link>('POST', '/families/invitations', { note }),
  backups: () => request<BackupStatus>('GET', '/backups'),
  profiles: () => request<Profile[]>('GET', '/profiles'),
  dashboard: (id: number) => request<Dashboard>('GET', `/profiles/${id}/dashboard`),
  chapters: (id: number) => request<Chapter[]>('GET', `/profiles/${id}/chapters`),
  setChapter: (id: number, code: string, status: ChapterStatus, test_date: string | null) =>
    request<{ code: string; status: ChapterStatus; test_date: string | null }>('PUT', `/profiles/${id}/chapters/${encodeURIComponent(code)}`, {
      status,
      test_date,
    }),
  levels: () => request<LevelsInfo>('GET', '/levels'),
  setLevel: (id: number, level: Level) => request<Profile>('PATCH', `/profiles/${id}`, { level }),
  setWorld: (id: number, world: World) => request<Profile>('PATCH', `/profiles/${id}`, { world }),
  setMaxMinutes: (id: number, session_max_minutes: number) => request<Profile>('PATCH', `/profiles/${id}`, { session_max_minutes }),
  setRatios: (id: number, ratios: Ratios) => request<Profile>('PATCH', `/profiles/${id}`, { ratios }),
  setAccommodations: (id: number, accommodations: Accommodations) =>
    request<Profile>('PUT', `/profiles/${id}/accommodations`, accommodations),
  setPin: (id: number, pin: string) => request<null>('PUT', `/profiles/${id}/pin`, { pin }),
  reset: (id: number, confirm: string) => request<Record<string, number>>('POST', `/profiles/${id}/reset`, { confirm }),
  indicators: (id: number) => request<Indicators>('GET', `/profiles/${id}/indicators`),
  bank: (level: Level) => request<BankRow[]>('GET', `/bank?level=${level}`),
  bankItem: (id: number) => request<BankRow>('GET', `/bank/${id}`),
  saveBankItem: (id: number | null, level: Level, status: BankStatus, question: QuestionIn) =>
    request<BankRow>(id === null ? 'POST' : 'PUT', id === null ? '/bank' : `/bank/${id}`, { level, status, question }),
  deleteBankItem: (id: number) => request<null>('DELETE', `/bank/${id}`),
  previewQuestion: (level: Level, question: QuestionIn) =>
    request<{ ok: boolean; errors: string[]; item?: GameItem; formulas?: Record<string, string> }>('POST', '/bank/preview', { level, question }),
  importQuestions: (level: Level, format: 'csv' | 'json', content: string, commit: boolean) =>
    request<ImportReport>('POST', '/bank/import', { level, format, content, commit }),
  generators: (level: Level) => request<GeneratorInfo[]>('GET', `/generators?level=${level}`),
  previewGenerator: (code: string, difficulty: number) =>
    request<Preview>('GET', `/generators/${encodeURIComponent(code)}/preview?difficulty=${difficulty}`),
  reports: (status: 'ouvert' | 'traite') => request<ReportRow[]>('GET', `/reports?status=${status}`),
  reportCount: () => request<{ open: number }>('GET', '/reports/count'),
  setReport: (id: number, status: 'ouvert' | 'traite') => request<{ id: number; status: string }>('PUT', `/reports/${id}`, { status }),
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

export const TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'QCM',
  numeric: 'Nombre ou fraction',
  expression: 'Expression',
  true_false: 'Vrai ou faux justifié',
  order: "Remettre dans l'ordre",
  text: 'Réponse écrite',
}

export const REASON_LABELS: Record<ReportRow['reason'], string> = {
  enonce: "L'énoncé est faux",
  reponse: 'La réponse attendue est fausse',
  incomprehensible: 'Je ne comprends pas la question',
  autre: 'Autre',
}
