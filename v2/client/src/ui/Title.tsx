export function Title({ onPlay, onDiscover, playerName }: { onPlay: () => void; onDiscover: () => void; playerName?: string }) {
  return (
    <main className="screen title-screen">
      <div className="panel title-panel">
        <p className="kicker">Les Chroniques</p>
        <h1 className="game-title">d'Aldoria</h1>
        <p className="subtitle">Les pages de la Grande Chronique ont été volées. L'île t'attend, Archiviste.</p>
        <div className="actions column">
          <button type="button" className="primary big" onClick={onPlay} data-testid="jouer">
            {playerName ? `Continuer, ${playerName}` : 'Jouer'}
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
