/**
 * Interface d'un combat dans l'intérieur d'un lieu : barres de PV (l'ennemi en haut, le héros en bas à gauche), barre
 * d'actions (Frappe, Sort, Soin : chacune demande une question), nombres flottants (dégâts, soin) et bandeau
 * d'annonce. Le déroulé est mené par core/combat/flow.ts depuis ui/GameScreen.tsx ; ici, on ne fait qu'afficher.
 */
import { useEffect } from 'react'
import { type Action, BOSS_HITS, sealsLeft } from '../core/combat/encounter'
import type { FightView } from '../core/combat/flow'
import { combatTexts } from '../core/combat/texts'
import type { FloatTone } from '../game/interior'
import type { WorldName } from '../game/theme'

export interface Floating {
  id: number
  text: string
  tone: FloatTone
  x: number
  y: number
}

const percent = (hp: number, max: number): number => Math.round((100 * Math.max(0, hp)) / Math.max(1, max))

function Bar({ label, hp, max, tone, testId }: { label: string; hp: number; max: number; tone: 'foe' | 'hero'; testId: string }) {
  const part = percent(hp, max)
  return (
    <div className={`hp-bar hp-${tone}`} data-testid={testId} role="meter" aria-label={`${label} : ${hp} points de vie sur ${max}`} aria-valuenow={hp} aria-valuemin={0} aria-valuemax={max}>
      <span className="hp-name">{label}</span>
      <span className="hp-track">
        <span className="hp-fill" data-part={Math.round(part / 5) * 5} />
      </span>
      <span className="hp-count">{Math.max(0, hp)} / {max}</span>
    </div>
  )
}

/** Les sceaux d'un Effaceur : un par bonne réponse, au plus (losange plein : intact, vide : brisé : lisible sans les couleurs). */
export function Seals({ left }: { left: number }) {
  return (
    <div className="seals" data-testid="sceaux" data-left={left} role="img" aria-label={`Sceaux de l'Effaceur : ${left} sur ${BOSS_HITS}`}>
      <span className="seals-name">Sceaux</span>
      {Array.from({ length: BOSS_HITS }, (_, i) => (
        <span key={i} className={i < left ? 'seal on' : 'seal off'} aria-hidden="true">{i < left ? '◆' : '◇'}</span>
      ))}
    </div>
  )
}

/** Barres de PV : l'ennemi en haut au centre (avec ses sceaux s'il est un Effaceur), le héros en bas à gauche. */
export function FightBars({ view, heroName }: { view: FightView; heroName: string }) {
  return (
    <>
      <div className="fight-foe">
        <Bar label={view.foe.name} hp={view.foe.hp} max={view.foe.maxHp} tone="foe" testId="pv-ennemi" />
        {view.boss && <Seals left={sealsLeft(view.foe.hp, view.foe.maxHp)} />}
      </div>
      <div className="fight-hero">
        <Bar label={heroName} hp={view.hero.hp} max={view.hero.maxHp} tone="hero" testId="pv-heros" />
      </div>
    </>
  )
}

const ACTIONS: { action: Action; key: string; hint: string }[] = [
  { action: 'automatisme', key: '1', hint: 'question rapide' },
  { action: 'chapitre', key: '2', hint: 'question du chapitre' },
  { action: 'soin', key: '3', hint: 'reprendre des forces' },
]

/** Les trois actions ; les touches 1, 2 et 3 les choisissent aussi. */
export function ActionBar({ world, canHeal, onChoose }: { world: WorldName; canHeal: boolean; onChoose: (action: Action) => void }) {
  const names = combatTexts(world).actions
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return
      const found = ACTIONS.find((a) => a.key === e.key)
      if (!found || (found.action === 'soin' && !canHeal)) return
      onChoose(found.action)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canHeal, onChoose])
  return (
    <div className="fight-actions" role="group" aria-label="Que fais-tu ?" data-testid="actions">
      {ACTIONS.map(({ action, key, hint }) => (
        <button
          key={action}
          type="button"
          className="primary action"
          disabled={action === 'soin' && !canHeal}
          data-testid={`action-${action}`}
          onClick={() => onChoose(action)}
        >
          <span className="action-name"><kbd>{key}</kbd> {names[action]}</span>
          <span className="action-hint">{hint}</span>
        </button>
      ))}
    </div>
  )
}

/** Nombres qui montent au-dessus des combattants (l'animation s'éteint en mode calme : le nombre reste lisible). */
export function Floats({ items }: { items: Floating[] }) {
  return (
    <div className="floats" aria-hidden="true">
      {items.map((f) => (
        <span key={f.id} className={`float-text float-${f.tone}`} style={{ left: f.x, top: f.y }}>
          {f.text}
        </span>
      ))}
    </div>
  )
}
