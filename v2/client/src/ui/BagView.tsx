/**
 * Le sac, consulté sur l'île (bouton « Sac » de la barre) : les quatre objets avec ce qu'il en reste, ce qu'ils font et où ils servent.
 * En lecture seule : rien ne se dépense ici, la potion et le bouclier se prennent en combat, la plume et le parchemin sous une question
 * (core/bag.ts). Échap ferme.
 */
import { useEffect } from 'react'
import { BAG_SOURCES, bagOverview, isBagEmpty } from '../core/bag'
import type { ItemId, Owned } from '../core/inventory'

const ICONS: Record<ItemId, string> = { plume: '🪶', parchemin: '📜', bouclier: '🛡️', potion: '🧪' }

export function BagView({ owned, onClose }: { owned: Owned; onClose: () => void }) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [onClose])
  const lines = bagOverview(owned)
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="sac-ile-titre" data-testid="sac-ile">
      <section className="panel dialog bag">
        <h2 id="sac-ile-titre">Ton sac</h2>
        {isBagEmpty(owned) && <p data-testid="sac-ile-vide">Ton sac est vide pour l’instant. {BAG_SOURCES}</p>}
        <ul className="bag-list">
          {lines.map((line) => (
            <li key={line.id} className={`bag-line${line.count === 0 ? ' empty' : ''}`} data-testid={`sac-ile-${line.id}`} data-count={line.count}>
              <span className="bag-icon" aria-hidden="true">{ICONS[line.id]}</span>
              <span className="bag-text">
                <span className="bag-name">{line.name} ×{line.count}</span>
                <span className="bag-help">{line.help}</span>
                <span className="bag-where">{line.where}</span>
              </span>
            </li>
          ))}
        </ul>
        {!isBagEmpty(owned) && <p className="hint">{BAG_SOURCES}</p>}
        <div className="actions">
          <button type="button" className="secondary" autoFocus onClick={onClose}>Fermer <kbd>Échap</kbd></button>
        </div>
      </section>
    </div>
  )
}
