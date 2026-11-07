/**
 * Format d'une question (item) tel que l'API le renvoie dans un paquet de session
 * (api/app/engine/items.py). Le gameplay ne lit jamais ces champs lui-même : il passe par
 * QuestionService (règle héritée de la v1, TRD §2.3).
 */

export type ItemType =
  | 'mcq'
  | 'numeric'
  | 'expression'
  | 'vector'
  | 'number_line'
  | 'order'
  | 'true_false'
  | 'sign_table'
  | 'text'

export type Role = 'automatisme' | 'chapitre' | 'enigme'

export type Answer =
  | { kind: 'choice'; index: number }
  | { kind: 'number'; value: string; tolerance?: number }
  | { kind: 'fraction'; value: string; accept_equivalent?: boolean; require_irreducible?: boolean }
  | { kind: 'expression'; value: string; variable?: string; form?: 'expanded' | 'factored' | null }
  | { kind: 'vector'; value: [string, string] }
  | { kind: 'order'; value: number[] }
  | { kind: 'true_false'; value: boolean; reason: number }
  | { kind: 'signs'; value: string[] }
  | { kind: 'text'; value: string[]; accents?: boolean }

export interface Speech {
  prompt?: string
  choices?: string[]
  hint?: string
  explanation?: string
}

export interface Item {
  id: string
  type: ItemType
  difficulty: number
  notions: string[]
  role: Role
  prompt: string
  latex?: string | null
  latex_hash?: string | null
  choices?: string[] | null
  answer: Answer
  hint: string
  explanation: string
  time_target_ms: number
  game_modes?: string[]
  visual?: Record<string, unknown> | null
  listen?: { text: string; lang: string } | null
  choices_lang?: string | null
  generator?: string | null
  seed?: number | null
  category?: string
  speech?: Speech
}

/** Réponse donnée par l'enfant, selon le widget. */
export type UserInput =
  | number
  | string
  | number[]
  | string[]
  | { value: boolean; reason: number }

export interface Pack {
  session_id: string
  items: Item[]
  formulas: Record<string, string>
  start_levels: Partial<Record<'automatisme' | 'chapitre', number>>
  settings: {
    session_max_minutes?: number
    play_time?: Record<string, number>
    accommodations?: Record<string, unknown>
  }
  context?: Record<string, unknown>
}
