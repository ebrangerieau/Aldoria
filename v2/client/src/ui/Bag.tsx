/**
 * Le sac en plein combat (v1 : Encounter._open_bag) : « Ton sac », la potion et le bouclier avec ce qui reste, et ce qui empêche
 * de s'en servir (plus d'objet, vie pleine, bouclier déjà levé). Choisir un objet le dépense sans perdre son tour ; « Fermer »
 * (ou Échap) revient aux actions. Les touches 1 et 2 choisissent aussi.
 */
import { useEffect } from 'react'
import type { BagEntry } from '../core/bag'
import type { ItemId } from '../core/inventory'

const ICONS: Record<ItemId, string> = { plume: '🪶', parchemin: '📜', bouclier: '🛡️', potion: '🧪' }

export function BagPanel({ entries, onUse, onClose }: { entries: BagEntry[]; onUse: (id: ItemId) => void; onClose: () => void }) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return
      if (e.key === 'Escape') {
        onClose()
        return
      }
      const entry = entries[Number(e.key) - 1]
      if (entry?.usable) onUse(entry.id)
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [entries, onUse, onClose])
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="sac-titre" data-testid="sac">
      <section className="panel dialog bag">
        <h2 id="sac-titre">Ton sac</h2>
        {entries.map((entry, i) => (
          <button
            key={entry.id}
            type="button"
            className="primary bag-item"
            disabled={!entry.usable}
            data-testid={`sac-${entry.id}`}
            onClick={() => onUse(entry.id)}
          >
            <span className="bag-icon" aria-hidden="true">{ICONS[entry.id]}</span>
            <span className="bag-text">
              <span className="bag-name"><kbd>{i + 1}</kbd> {entry.name} ×{entry.count}</span>
              <span className="bag-help">{entry.usable ? entry.help : entry.why}</span>
            </span>
          </button>
        ))}
        <div className="actions">
          <button type="button" className="secondary" autoFocus onClick={onClose}>Fermer</button>
        </div>
      </section>
    </div>
  )
}
