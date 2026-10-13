import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError, TYPE_LABELS, type AiResult, type Level } from './api'

type NotionOption = { code: string; label: string; chapter: string }

// La photo est réduite (1 600 px de côté au plus, JPEG) avant l'envoi : plus légère pour la
// tablette et moins coûteuse pour l'IA, sans perte de lisibilité pour une leçon.
async function shrink(file: File): Promise<{ data: string; type: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const url = canvas.toDataURL('image/jpeg', 0.85)
  return { data: url.slice(url.indexOf(',') + 1), type: 'image/jpeg' }
}

// Questions proposées par l'IA : elles arrivent en brouillon, le parent les relit et les publie.
export function AiQuestions({ level, notions, onEdit }: { level: Level; notions: NotionOption[]; onEdit: (id: number) => void }) {
  const client = useQueryClient()
  const status = useQuery({ queryKey: ['ai-status'], queryFn: api.aiStatus })
  const [notion, setNotion] = useState('')
  const [count, setCount] = useState(5)
  const [difficulty, setDifficulty] = useState<number | null>(null)
  const [instructions, setInstructions] = useState('')
  const [lesson, setLesson] = useState('')
  const [photo, setPhoto] = useState<{ data: string; type: string; name: string } | null>(null)
  const [photoError, setPhotoError] = useState('')
  const propose = useMutation({
    mutationFn: () =>
      api.aiPropose({
        level,
        notion,
        count,
        difficulty,
        instructions,
        material_text: lesson,
        image_base64: photo?.data ?? '',
        image_type: photo?.type ?? '',
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['bank', level] })
      client.invalidateQueries({ queryKey: ['ai-status'] })
    },
  })
  const byChapter = new Map<string, NotionOption[]>()
  for (const n of notions) byChapter.set(n.chapter, [...(byChapter.get(n.chapter) ?? []), n])

  if (status.isPending) return <p className="loading">Chargement…</p>
  if (!status.data?.enabled) {
    return (
      <section className="card">
        <h2>Proposer des questions avec l'IA</h2>
        <p>
          L'IA n'est pas activée sur ce serveur : l'exploitant doit y poser une clé d'API Anthropic (voir le guide d'exploitation). En
          attendant, rédigez vos questions dans la banque ou importez un fichier.
        </p>
      </section>
    )
  }
  return (
    <section className="card" id="ia">
      <h2>Proposer des questions avec l'IA</h2>
      <p className="muted small">
        L'IA (Claude, d'Anthropic) rédige des questions sur la notion choisie, en s'appuyant sur la leçon si vous la joignez. Elles arrivent{' '}
        <strong>en brouillon</strong> : relisez-les, corrigez si besoin, puis publiez. Seuls la classe, la notion, votre consigne et la leçon
        sont envoyés ; jamais le prénom ni les réponses de votre enfant. Encore {status.data.remaining} demande
        {status.data.remaining > 1 ? 's' : ''} aujourd'hui.
      </p>
      <form
        className="editor"
        onSubmit={(e) => {
          e.preventDefault()
          propose.mutate()
        }}
      >
        <label>
          Notion
          <select value={notion} onChange={(e) => setNotion(e.target.value)} required>
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
            Nombre de questions
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[3, 5, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Difficulté
            <select value={difficulty ?? ''} onChange={(e) => setDifficulty(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Variée</option>
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  {'★'.repeat(d)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Consigne (facultative)
          <input
            maxLength={1000}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="ex. : surtout des questions d'écoute ; vocabulaire de la ferme"
          />
        </label>
        <label>
          Texte de la leçon (facultatif)
          <textarea rows={4} maxLength={20000} value={lesson} onChange={(e) => setLesson(e.target.value)} />
        </label>
        <label>
          Photo de la leçon (facultative)
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              setPhotoError('')
              if (!file) return setPhoto(null)
              try {
                setPhoto({ ...(await shrink(file)), name: file.name })
              } catch {
                setPhoto(null)
                setPhotoError('Photo illisible : essayez une autre image (JPEG ou PNG).')
              }
            }}
          />
        </label>
        {photo && <p className="muted small">Photo prête : {photo.name}.</p>}
        {photoError && <p className="status-line bad">{photoError}</p>}
        <p className="muted small">Photographiez seulement la leçon : ni prénom, ni visage, ni copie notée.</p>
        <div className="row">
          <button className="primary" type="submit" disabled={!notion || propose.isPending || status.data.remaining === 0}>
            {propose.isPending ? "L'IA rédige… (jusqu'à une minute)" : 'Proposer des questions'}
          </button>
        </div>
      </form>
      {propose.isError && <p className="status-line bad">{(propose.error as ApiError).message}</p>}
      {propose.data && <Result result={propose.data} onEdit={onEdit} />}
    </section>
  )
}

function Result({ result, onEdit }: { result: AiResult; onEdit: (id: number) => void }) {
  return (
    <div className="link-box">
      <p>
        <strong>
          {result.created.length} question{result.created.length > 1 ? 's' : ''} ajoutée{result.created.length > 1 ? 's' : ''} en brouillon.
        </strong>{' '}
        Relisez-les, puis cochez « Publiée » pour qu'elles entrent dans le jeu.
      </p>
      <ul className="plain-list">
        {result.created.map((row) => (
          <li key={row.id} className="row spread">
            <span>
              <span className="badge">{TYPE_LABELS[row.type] ?? row.type}</span> {row.summary}
            </span>
            <button onClick={() => onEdit(row.id)}>Relire</button>
          </li>
        ))}
      </ul>
      {result.rejected.length > 0 && (
        <>
          <p className="small">
            {result.rejected.length} proposition{result.rejected.length > 1 ? 's' : ''} écartée{result.rejected.length > 1 ? 's' : ''} (incohérente
            {result.rejected.length > 1 ? 's' : ''}) :
          </p>
          <ul className="plain-list small">
            {result.rejected.map((r, i) => (
              <li key={i}>
                {r.summary} <span className="muted">— {r.errors.join(' ; ')}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
