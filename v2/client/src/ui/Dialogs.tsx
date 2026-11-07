import { VERSION } from '../app/buildInfo'
import type { Accommodations } from '../core/accessibility'

export function Dialog({ title, text, actions }: {
  title: string
  text: string
  actions: { label: string; primary?: boolean; run: () => void }[]
}) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="dialogue-titre">
      <section className="panel dialog">
        <h2 id="dialogue-titre">{title}</h2>
        {text.split(/(?<=[.!?])\s+/).map((sentence, i) => <p key={i}>{sentence}</p>)}
        <div className="actions">
          {actions.map((a, i) => (
            <button key={a.label} type="button" className={a.primary ? 'primary' : 'secondary'} autoFocus={i === actions.length - 1} onClick={a.run}>
              {a.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

const SIZES = ['Normal', 'Grand', 'Très grand']

/** Options de l'enfant : il peut agrandir le texte, jamais retirer un aménagement du parent. */
export function Options({ accommodations, textSize, onTextSize, onClose }: {
  accommodations: Accommodations
  textSize: number
  onTextSize: (size: number) => void
  onClose: () => void
}) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="options-titre">
      <section className="panel dialog">
        <h2 id="options-titre">Options</h2>
        <p>Taille du texte</p>
        <div className="actions">
          {SIZES.map((label, size) => (
            <button
              key={label}
              type="button"
              className={Math.max(textSize, accommodations.text_size) === size ? 'primary' : 'secondary'}
              disabled={size < accommodations.text_size}
              onClick={() => onTextSize(size)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="hint">Les autres réglages (police lisible, lecture à voix haute, mode calme…) se choisissent dans l'espace parent.</p>
        <p className="credits">
          Modèles 3D : Kay Lousberg (KayKit) et Quaternius, CC0. Icônes : game-icons.net, CC BY 3.0. Polices : Cinzel et
          Atkinson Hyperlegible, SIL OFL. Voix du serveur : Piper (Rhasspy), CC BY 4.0.
        </p>
        <p className="credits">Version du jeu : {VERSION.slice(0, 7)}</p>
        <div className="actions">
          <button type="button" className="primary" autoFocus onClick={onClose}>Fermer</button>
        </div>
      </section>
    </div>
  )
}
