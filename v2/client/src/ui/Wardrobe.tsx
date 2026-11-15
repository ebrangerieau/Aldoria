/**
 * L'écran d'apparence (PRD V2-08 ; règles et validation dans core/appearance.ts et core/wardrobe.ts, testées) : un panneau à droite de l'écran, le héros
 * reste visible à gauche (la caméra passe devant lui : `GameWorld.setShowcase`) et change à chaque choix. Silhouette, arme, main gauche, couvre-chef,
 * cape et sa couleur, et dans le monde lumineux le renard (nom, pelage). Purement cosmétique.
 *
 * Un choix verrouillé reste visible avec ce qu'il faut faire pour l'avoir (« Niveau 5 », « Termine 2 lieux ») : le toucher l'explique, sans rien changer.
 * Rien ne dépend de la couleur seule : chaque choix porte son nom, le choix actuel une coche, une couleur son nom à côté de sa pastille. Au clavier :
 * Tab et Entrée ou Espace pour choisir, Échap pour fermer.
 */
import { useEffect, useRef, useState } from 'react'
import { type LookChoice, lookOf, type MenuEntry, menuOf, progressOf } from '../core/appearance'
import type { SaveData } from '../core/save'
import type { WorldName } from '../game/theme'

interface GroupProps {
  id: string
  title: string
  entries: MenuEntry[]
  /** Le choix qu'une entrée représente. */
  choice: (entry: MenuEntry) => LookChoice
  onPick: (choice: LookChoice, entry: MenuEntry) => void
  onLocked: (entry: MenuEntry) => void
  hint?: string
}

function Group({ id, title, entries, choice, onPick, onLocked, hint }: GroupProps) {
  return (
    <fieldset className="wardrobe-group" data-testid={`apparence-${id}`}>
      <legend>{title}</legend>
      {hint && <p className="hint wardrobe-hint">{hint}</p>}
      <div className="wardrobe-choices">
        {entries.map((entry) => {
          const blocked = entry.locked !== undefined || entry.unavailable !== undefined
          return (
            <button
              key={entry.id || 'rien'}
              type="button"
              className={`wardrobe-choice${entry.selected ? ' selected' : ''}${blocked ? ' locked' : ''}`}
              aria-pressed={entry.selected}
              aria-disabled={blocked || undefined}
              data-testid={`apparence-${id}-${entry.id || 'rien'}`}
              data-state={entry.selected ? 'choisi' : entry.locked !== undefined ? 'verrouille' : entry.unavailable !== undefined ? 'impossible' : 'libre'}
              onClick={() => (blocked ? onLocked(entry) : onPick(choice(entry), entry))}
            >
              {entry.swatch && <span className="wardrobe-swatch" style={{ background: entry.swatch }} aria-hidden="true" />}
              <span className="wardrobe-name">{entry.name}</span>
              {entry.selected && <span className="wardrobe-check" aria-hidden="true"> ✓</span>}
              {entry.selected && <span className="sr-only"> (choisi)</span>}
              {entry.locked !== undefined && <small className="wardrobe-lock">{entry.locked}</small>}
              {entry.locked !== undefined && <span className="sr-only"> (verrouillé : {entry.locked})</span>}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

const yesNo = (on: boolean, yes: string, no: string): MenuEntry[] => [
  { id: 'oui', name: yes, selected: on },
  { id: 'non', name: no, selected: !on },
]

export function Wardrobe({ data, world, onPick, onClose }: {
  data: SaveData
  world: WorldName
  /** Un choix de plus : l'appelant le valide (`choose`), le range dans la partie et habille le héros. */
  onPick: (choice: LookChoice) => void
  onClose: () => void
}) {
  const progress = progressOf(data)
  const look = lookOf(data, world)
  const menu = menuOf(look, world, progress)
  const title = useRef<HTMLHeadingElement>(null)
  const [note, setNote] = useState('')

  useEffect(() => title.current?.focus(), [])
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  })

  const picked = (label: string) => (_: LookChoice, entry: MenuEntry) => setNote(`${label} : ${entry.name.toLowerCase()}.`)
  const props = (id: string, label: string, choice: (entry: MenuEntry) => LookChoice) => ({
    id,
    choice,
    onPick: (c: LookChoice, entry: MenuEntry) => {
      onPick(c)
      picked(label)(c, entry)
    },
    onLocked: (entry: MenuEntry) => setNote(entry.locked !== undefined ? `${entry.name} : ${entry.locked.toLowerCase().replace(/^./, (c) => c.toUpperCase())} pour le débloquer.` : `${entry.name} : ${entry.unavailable ?? ''}`),
  })

  return (
    <div className="wardrobe-layer">
      <aside className="panel wardrobe" role="dialog" aria-modal="true" aria-labelledby="apparence-titre" data-testid="apparence">
        <h2 id="apparence-titre" tabIndex={-1} ref={title}>Apparence</h2>
        <p className="hint">Choisis ton allure. Les nouveautés se débloquent en montant de niveau et en terminant des lieux.</p>
        <p className="wardrobe-note" role="status" data-testid="apparence-message">{note}</p>

        <Group {...props('silhouette', 'Silhouette', (e) => ({ model: e.id }))} title="Silhouette" entries={menu.silhouettes} />
        <Group {...props('arme', 'Arme', (e) => ({ main: e.id }))} title="Arme (main droite)" entries={menu.main} />
        <Group
          {...props('main-gauche', 'Main gauche', (e) => ({ off: e.id }))}
          title="Main gauche"
          entries={menu.off}
          hint={menu.off.some((e) => e.unavailable) ? 'Une arme à deux mains occupe les deux mains.' : undefined}
        />
        <div className="wardrobe-pair">
          {menu.hasHead && <Group {...props('couvre-chef', 'Couvre-chef', (e) => ({ head: e.id === 'oui' }))} title="Couvre-chef" entries={yesNo(look.head, 'Porté', 'Retiré')} />}
          <Group {...props('cape', 'Cape', (e) => ({ cape: e.id === 'oui' }))} title="Cape" entries={yesNo(look.cape, 'Portée', 'Retirée')} />
        </div>
        <Group {...props('cape-couleur', 'Couleur de la cape', (e) => ({ cape_color: e.id, cape: true }))} title="Couleur de la cape" entries={menu.capeColors} />
        {menu.pet && (
          <>
            <Group {...props('renard-pelage', 'Pelage du renard', (e) => ({ pet_fur: e.id }))} title="Pelage du renard" entries={menu.pet.furs} />
            <Group {...props('renard-nom', 'Nom du renard', (e) => ({ pet_name: e.id }))} title="Nom du renard" entries={menu.pet.names} />
          </>
        )}

        <div className="actions">
          <button type="button" className="primary" data-testid="apparence-fermer" onClick={onClose}>Terminé <kbd>Échap</kbd></button>
        </div>
      </aside>
    </div>
  )
}
