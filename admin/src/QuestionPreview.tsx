import type { GameItem } from './api'

// Aperçu d'une question telle que le jeu la reçoit : énoncé, formule (SVG rendu par
// l'API, affiché en image : la CSP interdit les styles en ligne du SVG), propositions,
// réponse attendue, indice, explication. Les illustrations du jeu (carte, balance,
// tableau…) sont résumées en une ligne.
export function QuestionPreview({ item, formulas, given }: { item: GameItem; formulas: Record<string, string>; given?: string | null }) {
  const svg = item.latex_hash ? formulas[item.latex_hash] : undefined
  const correct = expectedIndex(item)
  return (
    <div className="question">
      <p className="prompt">{item.prompt}</p>
      {svg && <img className="formula" alt={item.latex ?? 'formule'} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} />}
      {!svg && item.latex && <code>{item.latex}</code>}
      {item.visual && <VisualNote visual={item.visual} />}
      {item.listen && (
        <p className="small">
          <span className="muted">Écoute (prononcé, pas affiché) : </span>« {item.listen.text} » ({item.listen.lang})
        </p>
      )}
      {item.choices && item.choices.length > 0 && (
        <ol className="choices">
          {item.choices.map((c, i) => (
            <li key={i} className={i === correct ? 'correct' : undefined}>
              {c}
            </li>
          ))}
        </ol>
      )}
      <p>
        <span className="muted">Réponse attendue : </span>
        <strong>{answerText(item)}</strong>
      </p>
      {given !== undefined && given !== null && (
        <p>
          <span className="muted">Réponse donnée : </span>
          <strong>{given}</strong>
        </p>
      )}
      {item.hint && <p className="small"><span className="muted">Indice : </span>{item.hint}</p>}
      {item.explanation && <p className="small"><span className="muted">Explication : </span>{item.explanation}</p>}
    </div>
  )
}

function expectedIndex(item: GameItem): number | null {
  if (item.answer.kind === 'choice') return Number(item.answer.index)
  if (item.answer.kind === 'true_false') return Number(item.answer.reason)
  return null
}

export function answerText(item: GameItem): string {
  const a = item.answer
  const choices = item.choices ?? []
  switch (a.kind) {
    case 'choice':
      return choices[Number(a.index)] ?? `choix n°${Number(a.index) + 1}`
    case 'true_false':
      return `${a.value ? 'Vrai' : 'Faux'}, car ${choices[Number(a.reason)] ?? '?'}`
    case 'order':
      return (a.value as number[]).map((i) => choices[i]).join(' → ')
    case 'vector':
      return `(${(a.value as string[]).join(' ; ')})`
    case 'signs':
      return (a.value as string[]).join(' ')
    case 'text':
      return (a.value as string[]).join(' ou ') + (a.accents === false ? ' (accents facultatifs)' : '')
    default:
      return String(a.value)
  }
}

const VISUALS: Record<string, string> = {
  balance: 'une balance à équilibrer',
  grid: 'un repère avec le rayon et les miroirs',
  number_line: 'une droite graduée',
  graph: 'une courbe à lire',
  sign_table: 'un tableau de signes à compléter',
  robot: 'la grille du robot',
  map: 'une carte quadrillée avec son échelle',
  table: 'un tableau de données',
}

function VisualNote({ visual }: { visual: Record<string, unknown> }) {
  const kind = String(visual.kind ?? '')
  const rows = kind === 'table' ? (visual.rows as string[][] | undefined) : undefined
  return (
    <div className="visual-note">
      <span className="muted small">Dans le jeu : {VISUALS[kind] ?? 'une illustration'}.</span>
      {rows && (
        <table className="doc">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (r === 0 || c === 0 ? <th key={c}>{cell}</th> : <td key={c}>{cell}</td>))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
