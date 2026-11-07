/**
 * Une façon de répondre par type de question. Chaque widget rend une réponse (`onAnswer`)
 * au format attendu par core/answers.ts ; aucun ne valide lui-même. Tout se fait au clavier
 * ou à la souris, sans glisser-déposer (aménagement « gestes »).
 */
import { useState } from 'react'
import type { Item, UserInput } from '../../core/items'

type Props = { item: Item; onAnswer: (input: UserInput) => void; disabled: boolean }

export function Choices({ item, onAnswer, disabled }: Props) {
  return (
    <div className="choices" role="group" aria-label="Propositions">
      {(item.choices ?? []).map((choice, i) => (
        <button key={i} type="button" className="choice" disabled={disabled} onClick={() => onAnswer(i)} lang={item.choices_lang ?? undefined}>
          <span className="choice-key">{i + 1}</span> {choice}
        </button>
      ))}
    </div>
  )
}

const NUMBER_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '−', '0', ',', '/']
const EXPRESSION_KEYS = ['x', '²', '(', ')', '+', '−', '×', '/', '√']
const FRENCH_LETTERS = ['é', 'è', 'ê', 'à', 'â', 'ç', 'ù', 'î', 'ô', 'œ']
const SPANISH_LETTERS = ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡']

/** Saisie au clavier, avec des touches à l'écran pour les signes difficiles à trouver. */
export function Typed({ item, onAnswer, disabled }: Props) {
  const [value, setValue] = useState('')
  const kind = item.type === 'expression' ? 'expression' : item.type === 'text' ? 'text' : 'number'
  const spanish = item.notions.some((n) => n.includes('.espagnol.'))
  const keys = kind === 'number' ? NUMBER_KEYS : kind === 'expression' ? [...NUMBER_KEYS.slice(0, 11), ...EXPRESSION_KEYS] : spanish ? SPANISH_LETTERS : FRENCH_LETTERS
  const insert = (k: string) => setValue((v) => v + (k === '−' && kind !== 'text' ? '-' : k))
  return (
    <form
      className="typed"
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) onAnswer(value)
      }}
    >
      <input
        className={`answer-input ${kind}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        inputMode={kind === 'number' ? 'decimal' : 'text'}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="Ta réponse"
        disabled={disabled}
        autoFocus
        lang={kind === 'text' && item.choices_lang ? item.choices_lang : undefined}
      />
      <div className={`keys ${kind}`}>
        {keys.map((k) => (
          <button key={k} type="button" disabled={disabled} onClick={() => insert(k)}>{k}</button>
        ))}
        <button type="button" disabled={disabled} onClick={() => setValue((v) => v.slice(0, -1))} aria-label="Effacer">⌫</button>
      </div>
      <button type="submit" className="primary" disabled={disabled || !value.trim()}>Valider</button>
    </form>
  )
}

/** Remettre dans l'ordre : on touche les éléments l'un après l'autre (plus sûr qu'un glisser). */
export function Order({ item, onAnswer, disabled }: Props) {
  const [picked, setPicked] = useState<number[]>([])
  const choices = item.choices ?? []
  const done = picked.length === choices.length
  return (
    <div className="order">
      <ol className="order-picked" aria-label="Ton ordre">
        {picked.map((i) => <li key={i}>{choices[i]}</li>)}
      </ol>
      <div className="choices">
        {choices.map((choice, i) => (
          <button key={i} type="button" className="choice" disabled={disabled || picked.includes(i)} onClick={() => setPicked((p) => [...p, i])}>
            {choice}
          </button>
        ))}
      </div>
      <div className="actions">
        <button type="button" className="secondary" disabled={disabled || picked.length === 0} onClick={() => setPicked((p) => p.slice(0, -1))}>
          Annuler le dernier
        </button>
        <button type="button" className="primary" disabled={disabled || !done} onClick={() => onAnswer(picked)}>Valider</button>
      </div>
    </div>
  )
}

/** Vrai ou faux, puis la justification : le hasard ne suffit pas. */
export function TrueFalse({ item, onAnswer, disabled }: Props) {
  const [verdict, setVerdict] = useState<boolean | null>(null)
  if (verdict === null) {
    return (
      <div className="choices two">
        <button type="button" className="choice" disabled={disabled} onClick={() => setVerdict(true)}>Vrai</button>
        <button type="button" className="choice" disabled={disabled} onClick={() => setVerdict(false)}>Faux</button>
      </div>
    )
  }
  return (
    <div>
      <p className="step">Tu as choisi « {verdict ? 'Vrai' : 'Faux'} ». Pourquoi ?</p>
      <div className="choices">
        {(item.choices ?? []).map((reason, i) => (
          <button key={i} type="button" className="choice" disabled={disabled} onClick={() => onAnswer({ value: verdict, reason: i })}>
            {reason}
          </button>
        ))}
      </div>
      <button type="button" className="secondary" disabled={disabled} onClick={() => setVerdict(null)}>Changer d'avis</button>
    </div>
  )
}

export function widgetFor(item: Item) {
  switch (item.type) {
    case 'mcq':
      return Choices
    case 'numeric':
    case 'expression':
    case 'text':
      return Typed
    case 'order':
      return Order
    case 'true_false':
      return TrueFalse
    default:
      return null
  }
}
