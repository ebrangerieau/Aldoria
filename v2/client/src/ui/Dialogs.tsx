import { VERSION } from '../app/buildInfo'
import type { Accommodations } from '../core/accessibility'
import { creditLines, TRACKS } from '../core/music'

export function Dialog({ title, text, note, actions }: {
  title: string
  text: string
  /** Précision affichée sous le texte, jamais lue par la voix de Maître Ysaline. */
  note?: string
  actions: { label: string; primary?: boolean; run: () => void }[]
}) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="dialogue-titre">
      <section className="panel dialog">
        <h2 id="dialogue-titre">{title}</h2>
        {text.split(/(?<=[.!?])\s+/).map((sentence, i) => <p key={i}>{sentence}</p>)}
        {note && <p className="hint">{note}</p>}
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
export function Options({ accommodations, textSize, onTextSize, musicVolume, onMusicVolume, onClose }: {
  accommodations: Accommodations
  textSize: number
  onTextSize: (size: number) => void
  /** Volume de la musique (0 à 1), ou null quand elle est désactivée (`?musique=0`). */
  musicVolume: number | null
  onMusicVolume: (volume: number) => void
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
        {musicVolume !== null && (
          <>
            <p id="volume-musique-titre">Volume de la musique</p>
            <div className="music-volume">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(musicVolume * 100)}
                aria-labelledby="volume-musique-titre"
                data-testid="volume-musique"
                onChange={(e) => onMusicVolume(Number(e.target.value) / 100)}
              />
              <output>{Math.round(musicVolume * 100)} %</output>
            </div>
          </>
        )}
        <p className="hint">Les autres réglages (police lisible, lecture à voix haute, mode calme…) se choisissent dans l'espace parent.</p>
        <p className="credits">
          Modèles 3D : Kay Lousberg (KayKit) et Quaternius, CC0. Icônes : game-icons.net, CC BY 3.0. Polices : Cinzel et
          Atkinson Hyperlegible, SIL OFL. Voix du serveur : Piper (Rhasspy), CC BY 4.0. Voix de Maître Ysaline et du narrateur :
          ElevenLabs.
        </p>
        <p className="credits">Musique : {creditLines(TRACKS).join(' ')}</p>
        <p className="credits">Version du jeu : {VERSION.slice(0, 7)}</p>
        <div className="actions">
          <button type="button" className="primary" autoFocus onClick={onClose}>Fermer</button>
        </div>
      </section>
    </div>
  )
}
