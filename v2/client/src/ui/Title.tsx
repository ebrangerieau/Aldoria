export function Title({ onPlay, onDiscover, playerName, busy = false, notice = '' }: {
  onPlay: () => void
  onDiscover: () => void
  playerName?: string
  /** L'ouverture de la partie est en cours : le bouton le dit et ne se laisse pas appuyer deux fois. */
  busy?: boolean
  /** Ce qui a empêché de jouer (serveur injoignable…) : jamais un bouton qui ne répond pas, sans un mot. */
  notice?: string
}) {
  return (
    <main className="screen title-screen">
      <div className="panel title-panel">
        <p className="kicker">Les Chroniques</p>
        <h1 className="game-title">d'Aldoria</h1>
        <p className="subtitle">Les pages de la Grande Chronique ont été volées. L'île t'attend, Archiviste.</p>
        {notice && <p className="error" role="alert" data-testid="titre-avis">{notice}</p>}
        <div className="actions column">
          <button type="button" className="primary big" onClick={onPlay} disabled={busy} aria-busy={busy} data-testid="jouer">
            {busy ? 'Un instant…' : playerName ? `Continuer, ${playerName}` : 'Jouer'}
          </button>
          <button type="button" className="secondary" onClick={onDiscover} data-testid="decouvrir">
            Découvrir l'île (sans compte)
          </button>
        </div>
        <p className="hint">Ordinateur et navigateur récent (Chrome, Edge, Firefox). Clavier et souris.</p>
      </div>
    </main>
  )
}
