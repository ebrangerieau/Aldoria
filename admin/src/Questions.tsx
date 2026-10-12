import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  api,
  ApiError,
  type BankRow,
  type BankStatus,
  type GameItem,
  type ImportReport,
  type Level,
  type Profile,
  type QuestionIn,
  type QuestionType,
  TYPE_LABELS,
} from './api'
import { QuestionPreview } from './QuestionPreview'

type View = 'bank' | 'import' | 'generators'

// Questions du niveau de l'enfant choisi : banque rédigée (jouée une fois publiée),
// import d'un fichier, aperçu des générateurs.
export function Questions({ child, openItem }: { child: Profile; openItem?: number | null }) {
  const [view, setView] = useState<View>('bank')
  const [editing, setEditing] = useState<number | 'new' | null>(openItem ?? null)
  const notions = useNotions(child)
  return (
    <div className="stack">
      <nav className="subtabs" aria-label="Questions">
        {(
          [
            ['bank', 'Banque'],
            ['import', 'Importer'],
            ['generators', 'Générateurs'],
          ] as [View, string][]
        ).map(([id, label]) => (
          <button key={id} className={id === view ? 'chip active' : 'chip'} onClick={() => setView(id)}>
            {label}
          </button>
        ))}
      </nav>
      {view === 'bank' && editing === null && <BankList level={child.level} notions={notions} onEdit={setEditing} />}
      {view === 'bank' && editing !== null && (
        <Editor key={String(editing)} level={child.level} id={editing === 'new' ? null : editing} notions={notions} onClose={() => setEditing(null)} />
      )}
      {view === 'import' && <Import level={child.level} onDone={() => setView('bank')} />}
      {view === 'generators' && <Generators level={child.level} />}
    </div>
  )
}

type NotionOption = { code: string; label: string; chapter: string }

function useNotions(child: Profile): NotionOption[] {
  const query = useQuery({ queryKey: ['chapters', child.id], queryFn: () => api.chapters(child.id) })
  return useMemo(
    () => (query.data ?? []).flatMap((ch) => ch.notions.map((n) => ({ code: n.code, label: n.label, chapter: ch.title }))),
    [query.data],
  )
}

// --- Banque ---------------------------------------------------------------------------

function BankList({ level, notions, onEdit }: { level: Level; notions: NotionOption[]; onEdit: (id: number | 'new') => void }) {
  const query = useQuery({ queryKey: ['bank', level], queryFn: () => api.bank(level) })
  const [status, setStatus] = useState<BankStatus | 'tout'>('tout')
  const labels = new Map(notions.map((n) => [n.code, n.label]))
  const rows = (query.data ?? []).filter((r) => status === 'tout' || r.status === status)
  return (
    <section className="card">
      <div className="row spread">
        <h2>Banque de questions</h2>
        <button className="primary" onClick={() => onEdit('new')}>
          Nouvelle question
        </button>
      </div>
      <p className="muted small">
        Une question publiée entre dans les paquets de jeu de la notion choisie (environ 4 fois sur 10 face aux générateurs, au plus une fois par
        session). Les brouillons ne sont jamais joués.
      </p>
      <div className="row">
        {(['tout', 'brouillon', 'publie'] as const).map((s) => (
          <button key={s} className={s === status ? 'choice active' : 'choice'} onClick={() => setStatus(s)}>
            {s === 'tout' ? 'Toutes' : s === 'publie' ? 'Publiées' : 'Brouillons'}
          </button>
        ))}
      </div>
      {query.isPending && <p className="loading">Chargement…</p>}
      {query.isSuccess && rows.length === 0 && <p className="muted">Aucune question pour l'instant : créez-en une ou importez un fichier.</p>}
      {rows.length > 0 && (
        <table className="bank">
          <thead>
            <tr>
              <th>Notion</th>
              <th>Énoncé</th>
              <th>Type</th>
              <th>Niv.</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: BankRow) => (
              <tr key={r.id} className="clickable" onClick={() => onEdit(r.id)}>
                <td>{labels.get(r.notion) ?? r.notion}</td>
                <td>{r.summary}</td>
                <td>{TYPE_LABELS[r.type] ?? r.type}</td>
                <td>{r.difficulty}</td>
                <td>
                  <span className={r.status === 'publie' ? 'badge good' : 'badge'}>{r.status === 'publie' ? 'Publiée' : 'Brouillon'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

interface Form {
  notion: string
  type: QuestionType
  difficulty: number
  prompt: string
  latex: string
  choices: string
  index: number
  value: string
  verdict: boolean
  reason: number
  hint: string
  explanation: string
  status: BankStatus
}

const EMPTY: Form = {
  notion: '',
  type: 'mcq',
  difficulty: 2,
  prompt: '',
  latex: '',
  choices: '',
  index: 0,
  value: '',
  verdict: true,
  reason: 0,
  hint: '',
  explanation: '',
  status: 'brouillon',
}

function lines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

// Ordre : le parent saisit les éléments dans le bon ordre ; ils sont mélangés de façon
// stable (même texte, même mélange) et la réponse attendue est recalculée.
function stableShuffle(items: string[]): number[] {
  const order = items.map((_, i) => i)
  let seed = items.join('|').split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 2147483647, 7)
  for (let i = order.length - 1; i > 0; i--) {
    seed = (seed * 48271) % 2147483647
    const j = seed % (i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  if (order.every((v, i) => v === i) && order.length > 1) order.reverse()
  return order
}

function toQuestion(f: Form): QuestionIn {
  const base = {
    notion: f.notion,
    type: f.type,
    difficulty: f.difficulty,
    prompt: f.prompt,
    latex: f.latex.trim() || null,
    hint: f.hint,
    explanation: f.explanation,
  }
  const choices = lines(f.choices)
  switch (f.type) {
    case 'mcq':
      return { ...base, choices, answer: { kind: 'choice', index: f.index } }
    case 'true_false':
      return { ...base, choices, answer: { kind: 'true_false', value: f.verdict, reason: f.reason } }
    case 'order': {
      const shown = stableShuffle(choices) // shown[k] = indice d'origine affiché en position k
      return {
        ...base,
        choices: shown.map((i) => choices[i]),
        answer: { kind: 'order', value: choices.map((_, original) => shown.indexOf(original)) },
      }
    }
    case 'expression':
      return { ...base, choices: null, answer: { kind: 'expression', value: f.value.trim() } }
    default:
      return { ...base, choices: null, answer: { kind: f.value.includes('/') ? 'fraction' : 'number', value: f.value.trim() } }
  }
}

function fromRow(row: BankRow): Form {
  const q = row.question!
  const a = q.answer
  const choices = q.choices ?? []
  return {
    ...EMPTY,
    notion: q.notion,
    type: q.type as QuestionType,
    difficulty: row.difficulty,
    prompt: q.prompt,
    latex: q.latex ?? '',
    choices: (a.kind === 'order' ? (a.value as number[]).map((i) => choices[i]) : choices).join('\n'),
    index: a.kind === 'choice' ? Number(a.index) : 0,
    value: ['number', 'fraction', 'expression'].includes(a.kind) ? String(a.value) : '',
    verdict: a.kind === 'true_false' ? Boolean(a.value) : true,
    reason: a.kind === 'true_false' ? Number(a.reason) : 0,
    hint: q.hint ?? '',
    explanation: q.explanation ?? '',
    status: row.status,
  }
}

function Editor({ level, id, notions, onClose }: { level: Level; id: number | null; notions: NotionOption[]; onClose: () => void }) {
  const client = useQueryClient()
  const existing = useQuery({ queryKey: ['bank-item', id], queryFn: () => api.bankItem(id!), enabled: id !== null })
  const [form, setForm] = useState<Form | null>(id === null ? EMPTY : null)
  const [preview, setPreview] = useState<{ item: GameItem; formulas: Record<string, string> } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  if (form === null && existing.data) setForm(fromRow(existing.data))

  const save = useMutation({
    mutationFn: (f: Form) => api.saveBankItem(id, level, f.status, toQuestion(f)),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['bank', level] })
      onClose()
    },
    onError: (e) => setErrors(e instanceof ApiError ? ((e.details.errors as string[]) ?? [e.message]) : [String(e)]),
  })
  const remove = useMutation({
    mutationFn: () => api.deleteBankItem(id!),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['bank', level] })
      onClose()
    },
  })
  const check = useMutation({
    mutationFn: (f: Form) => api.previewQuestion(level, toQuestion(f)),
    onSuccess: (r) => {
      setErrors(r.errors)
      setPreview(r.ok && r.item ? { item: r.item, formulas: r.formulas ?? {} } : null)
    },
  })

  if (form === null) return <p className="loading">Chargement…</p>
  const set = (patch: Partial<Form>) => {
    setForm({ ...form, ...patch })
    setPreview(null)
  }
  const choiceLines = lines(form.choices)
  const byChapter = new Map<string, NotionOption[]>()
  for (const n of notions) byChapter.set(n.chapter, [...(byChapter.get(n.chapter) ?? []), n])

  return (
    <section className="card">
      <div className="row spread">
        <h2>{id === null ? 'Nouvelle question' : 'Modifier la question'}</h2>
        <button onClick={onClose}>Retour à la liste</button>
      </div>
      <form
        className="editor"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate(form)
        }}
      >
        <label>
          Notion
          <select value={form.notion} onChange={(e) => set({ notion: e.target.value })} required>
            <option value="">— choisir —</option>
            {[...byChapter].map(([chapter, list]) => (
              <optgroup key={chapter} label={chapter}>
                {list.map((n) => (
                  <option key={n.code} value={n.code}>
                    {n.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="row">
          <label>
            Type
            <select value={form.type} onChange={(e) => set({ type: e.target.value as QuestionType })}>
              {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Difficulté
            <select value={form.difficulty} onChange={(e) => set({ difficulty: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  {'★'.repeat(d)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Énoncé
          <textarea rows={3} value={form.prompt} onChange={(e) => set({ prompt: e.target.value })} required />
        </label>
        <label>
          Formule (LaTeX, facultative)
          <input value={form.latex} onChange={(e) => set({ latex: e.target.value })} placeholder="\frac{3}{4} + \frac{1}{8}" />
        </label>
        {(form.type === 'mcq' || form.type === 'true_false' || form.type === 'order') && (
          <label>
            {form.type === 'mcq' ? 'Propositions (une par ligne)' : form.type === 'order' ? 'Éléments, dans le bon ordre (un par ligne)' : 'Trois justifications (une par ligne)'}
            <textarea rows={4} value={form.choices} onChange={(e) => set({ choices: e.target.value })} />
          </label>
        )}
        {form.type === 'order' && <p className="muted small">Le jeu les présentera mélangés ; l'enfant doit retrouver cet ordre.</p>}
        {form.type === 'mcq' && (
          <label>
            Bonne réponse
            <select value={form.index} onChange={(e) => set({ index: Number(e.target.value) })}>
              {choiceLines.map((c, i) => (
                <option key={i} value={i}>
                  {i + 1}. {c}
                </option>
              ))}
            </select>
          </label>
        )}
        {form.type === 'true_false' && (
          <div className="row">
            <label>
              Verdict
              <select value={form.verdict ? 'vrai' : 'faux'} onChange={(e) => set({ verdict: e.target.value === 'vrai' })}>
                <option value="vrai">Vrai</option>
                <option value="faux">Faux</option>
              </select>
            </label>
            <label>
              Bonne justification
              <select value={form.reason} onChange={(e) => set({ reason: Number(e.target.value) })}>
                {choiceLines.map((c, i) => (
                  <option key={i} value={i}>
                    {i + 1}. {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {(form.type === 'numeric' || form.type === 'expression') && (
          <label>
            Réponse attendue
            <input
              value={form.value}
              onChange={(e) => set({ value: e.target.value })}
              placeholder={form.type === 'numeric' ? '12,5 ou 3/4 (fractions équivalentes acceptées)' : 'x^2+6x+9'}
              required
            />
          </label>
        )}
        <label>
          Indice (facultatif)
          <input value={form.hint} onChange={(e) => set({ hint: e.target.value })} />
        </label>
        <label>
          Explication (affichée après une erreur)
          <textarea rows={2} value={form.explanation} onChange={(e) => set({ explanation: e.target.value })} required />
        </label>
        <label className="inline">
          <input type="checkbox" checked={form.status === 'publie'} onChange={(e) => set({ status: e.target.checked ? 'publie' : 'brouillon' })} />
          Publiée (jouée dans le jeu)
        </label>
        {errors.length > 0 && (
          <ul className="error-text">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <div className="row">
          <button type="button" onClick={() => check.mutate(form)} disabled={check.isPending}>
            Aperçu
          </button>
          <button className="primary" disabled={save.isPending}>
            Enregistrer
          </button>
          {id !== null && (
            <button type="button" className="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
              Supprimer
            </button>
          )}
        </div>
      </form>
      {preview && (
        <div className="preview">
          <h3>Aperçu</h3>
          <QuestionPreview item={preview.item} formulas={preview.formulas} />
        </div>
      )}
    </section>
  )
}

// --- Import -----------------------------------------------------------------------------

const CSV_EXAMPLE = `notion;type;difficulte;enonce;formule;choix;reponse;indice;explication
6e.maths.fractions.addition;nombre;2;Calcule.;\\frac{1}{4}+\\frac{2}{4};;3/4;Même dénominateur;On ajoute les numérateurs : 1 + 2 = 3.
6e.maths.mediatrice.definition;qcm;1;La médiatrice d'un segment est…;;une droite|un segment|un cercle;1;;C'est une droite perpendiculaire au segment en son milieu.
6e.maths.angles.vocabulaire;vrai_faux;2;Un angle de 90° est obtus.;;il est droit|il dépasse 90°|il est aigu;faux | 1;;Un angle de 90° est un angle droit.`

function Import({ level, onDone }: { level: Level; onDone: () => void }) {
  const client = useQueryClient()
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [content, setContent] = useState('')
  const [report, setReport] = useState<ImportReport | null>(null)
  const [error, setError] = useState('')
  const run = useMutation({
    mutationFn: (commit: boolean) => api.importQuestions(level, format, content, commit),
    onSuccess: (r, commit) => {
      setError('')
      setReport(r)
      if (commit) {
        client.invalidateQueries({ queryKey: ['bank', level] })
        onDone()
      }
    },
    onError: (e) => {
      setReport(null)
      setError(e instanceof Error ? e.message : String(e))
    },
  })
  const readFile = (file: File | undefined) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Fichier trop lourd (5 Mo au maximum).')
      return
    }
    setFormat(file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv')
    file.text().then((text) => {
      setContent(text)
      setReport(null)
    })
  }
  return (
    <section className="card stack">
      <h2>Importer des questions ({level === '6e' ? '6ème' : 'Seconde'})</h2>
      <p className="muted small">
        Le fichier est d'abord vérifié ligne par ligne, sans rien enregistrer. Les questions valides sont ensuite ajoutées en brouillon : relisez-les
        et publiez-les depuis la banque.
      </p>
      <div className="row">
        <input type="file" accept=".csv,.json,.txt" onChange={(e) => readFile(e.target.files?.[0])} aria-label="Fichier à importer" />
        {(['csv', 'json'] as const).map((f) => (
          <button key={f} className={f === format ? 'choice active' : 'choice'} onClick={() => setFormat(f)}>
            {f.toUpperCase()}
          </button>
        ))}
      </div>
      <textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} placeholder="… ou collez le contenu ici" aria-label="Contenu à importer" />
      <details>
        <summary>Format CSV (tableur, séparateur « ; »)</summary>
        <pre className="example">{CSV_EXAMPLE}</pre>
        <p className="muted small">
          Types : qcm, nombre, expression, vrai_faux, ordre. Choix séparés par « | ». Réponse : numéro du bon choix (QCM), nombre ou fraction,
          expression, « vrai | 2 » (verdict | numéro de la justification), ou numéros dans l'ordre (« 3 | 1 | 2 »). Le code de chaque notion figure
          dans l'onglet Générateurs et dans l'éditeur.
        </p>
      </details>
      <div className="row">
        <button onClick={() => run.mutate(false)} disabled={!content.trim() || run.isPending}>
          Vérifier
        </button>
        {report && report.valid > 0 && (
          <button className="primary" onClick={() => run.mutate(true)} disabled={run.isPending}>
            Ajouter {report.valid} question{report.valid > 1 ? 's' : ''} en brouillon
          </button>
        )}
      </div>
      {error && <p className="error-text">{error}</p>}
      {report && (
        <table className="report">
          <thead>
            <tr>
              <th>Ligne</th>
              <th>Question</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {report.lines.map((l) => (
              <tr key={l.line}>
                <td>{l.line}</td>
                <td>{l.summary}</td>
                <td className={l.ok ? 'ok' : 'error-text'}>{l.ok ? 'Valide' : l.errors.join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

// --- Générateurs ---------------------------------------------------------------------------

function Generators({ level }: { level: Level }) {
  const list = useQuery({ queryKey: ['generators', level], queryFn: () => api.generators(level) })
  const [code, setCode] = useState('')
  const [difficulty, setDifficulty] = useState(2)
  const [round, setRound] = useState(0)
  const selected = code || list.data?.[0]?.code || ''
  const preview = useQuery({
    queryKey: ['generator-preview', selected, difficulty, round],
    queryFn: () => api.previewGenerator(selected, difficulty),
    enabled: !!selected,
  })
  const info = list.data?.find((g) => g.code === selected)
  return (
    <section className="card stack">
      <h2>Générateurs</h2>
      <p className="muted small">Dix questions tirées au hasard, telles que le jeu les reçoit. Chaque niveau de difficulté a ses propres formes.</p>
      <div className="row">
        <select value={selected} onChange={(e) => setCode(e.target.value)} aria-label="Générateur">
          {(list.data ?? []).map((g) => (
            <option key={g.code} value={g.code}>
              {g.notion_label} — {g.title}
            </option>
          ))}
        </select>
        <span className="row">
          {[1, 2, 3, 4, 5].map((d) => (
            <button key={d} className={d === difficulty ? 'choice active' : 'choice'} onClick={() => setDifficulty(d)}>
              {'★'.repeat(d)}
            </button>
          ))}
        </span>
        <button onClick={() => setRound(round + 1)}>Autres exemples</button>
      </div>
      {info && (
        <p className="muted small">
          Notion <code>{info.notion}</code> · {info.role === 'automatisme' ? 'automatisme (Frappe)' : 'chapitre (Sort)'} · usage : {info.use}
        </p>
      )}
      {preview.isPending && <p className="loading">Chargement…</p>}
      <ol className="previews">
        {(preview.data?.items ?? []).map((item) => (
          <li key={item.id} className="card">
            <QuestionPreview item={item} formulas={preview.data!.formulas} />
          </li>
        ))}
      </ol>
    </section>
  )
}
