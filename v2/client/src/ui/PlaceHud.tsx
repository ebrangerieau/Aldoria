/**
 * Interface d'un lieu de quête : barres de vie, bandeau de salle, menu d'actions du combat, sac, bulle du
 * héros, textes qui montent, note de fin. Présentation seulement : PlaceScreen tient l'état et rend la
 * main au contrôleur (core/quest/controller.ts). Tout le texte est du vrai texte (zoom, lecteur d'écran).
 */
import { useState } from 'react'
import type { Action } from '../core/combat/encounter'
import type { Tone } from '../core/quest/controller'
import { ITEMS, type ItemId, type Owned } from '../core/progression/inventory'
import { count } from '../core/progression/inventory'
import type { FloatingText } from '../game/interior/InteriorWorld'

export interface Gauge {
  name: string
  hp: number
  max: number
}

export function HpBar({ gauge, tone, testId }: { gauge: Gauge; tone: 'hero' | 'enemy'; testId: string }) {
  const percent = Math.max(0, Math.min(100, Math.round((gauge.hp / Math.max(1, gauge.max)) * 100)))
  return (
    <div className={`gauge ${tone}`} data-testid={testId}>
      <div className="gauge-label">
        <strong>{gauge.name}</strong>
        <span>{gauge.hp} / {gauge.max} PV</span>
      </div>
      <div className="gauge-track" role="progressbar" aria-label={`Points de vie de ${gauge.name}`} aria-valuemin={0} aria-valuemax={gauge.max} aria-valuenow={gauge.hp}>
        <div className="gauge-fill" data-percent={Math.round(percent / 5) * 5} />
      </div>
    </div>
  )
}

/** Bandeau de la salle et de l'étage (« Salle 3 sur 6 »). */
export function RoomBanner({ title, floor }: { title: string; floor: string }) {
  return (
    <div className="room-status" data-testid="salle">
      <strong>{title}</strong>
      <span>{floor}</span>
    </div>
  )
}

export function Banner({ text, tone, id }: { text: string; tone: Tone; id: number }) {
  return <div key={id} className={`place-banner ${tone}`} role="status" data-testid="bandeau">{text}</div>
}

export function HeroBubble({ text }: { text: string }) {
  return <p className="hero-bubble" data-testid="heros-parle">{text}</p>
}

export function FloatingTexts({ items }: { items: (FloatingText & { id: number })[] }) {
  return (
    <>
      {items.map((f) => (
        <span key={f.id} className={`float-text ${f.tone}`} style={{ left: f.x, top: f.y }} aria-hidden="true">{f.text}</span>
      ))}
    </>
  )
}

/** Choix du tour : Frappe, Sort, Soin (si blessé), Sac. Aucune de ces actions n'est contre la montre. */
export function ActionMenu({ names, canHeal, bag, onChoose, onLeave }: {
  names: Record<Action, string>
  canHeal: boolean
  bag: Owned
  onChoose: (choice: { kind: 'action'; action: Action } | { kind: 'bag'; item: ItemId }) => void
  onLeave: () => void
}) {
  const [bagOpen, setBagOpen] = useState(false)
  if (bagOpen) {
    return (
      <div className="action-menu" role="group" aria-label="Ton sac" data-testid="sac">
        {(['potion', 'bouclier'] as ItemId[]).map((id) => (
          <button key={id} type="button" className="secondary" disabled={count(bag, id) <= 0} onClick={() => { setBagOpen(false); onChoose({ kind: 'bag', item: id }) }}>
            {ITEMS[id].name} ×{count(bag, id)}
            <small>{ITEMS[id].help}</small>
          </button>
        ))}
        <button type="button" className="secondary" onClick={() => setBagOpen(false)}>Fermer le sac</button>
      </div>
    )
  }
  return (
    <div className="action-menu" role="group" aria-label="Ton tour" data-testid="actions">
      <button type="button" className="primary" onClick={() => onChoose({ kind: 'action', action: 'automatisme' })}>
        {names.automatisme}
        <small>Question rapide</small>
      </button>
      <button type="button" className="primary" onClick={() => onChoose({ kind: 'action', action: 'chapitre' })}>
        {names.chapitre}
        <small>Question du chapitre</small>
      </button>
      {canHeal && (
        <button type="button" className="secondary" onClick={() => onChoose({ kind: 'action', action: 'soin' })}>
          {names.soin}
          <small>Reprendre des forces</small>
        </button>
      )}
      <button type="button" className="secondary" onClick={() => setBagOpen(true)}>Sac</button>
      <button type="button" className="quiet" onClick={onLeave}>Quitter le lieu</button>
    </div>
  )
}

/** Note de plaisir de fin de lieu : de 1 à 5, ou passer. */
export function RatingPanel({ title, onRate }: { title: string; onRate: (rating: number) => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="note-titre">
      <section className="panel dialog" data-testid="note">
        <h2 id="note-titre">{title}</h2>
        <p>Ça t'a plu ? Donne une note de 1 à 5.</p>
        <div className="rating" role="group" aria-label="Note de 1 à 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className="secondary star" onClick={() => onRate(n)} aria-label={`${n} sur 5`}>
              {'★'.repeat(n)}
            </button>
          ))}
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={() => onRate(0)}>Passer</button>
        </div>
      </section>
    </div>
  )
}
