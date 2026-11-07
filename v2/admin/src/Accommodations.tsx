import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, type Accommodations as Settings, type Profile } from './api'

// Aménagements de l'enfant (troubles « dys », attention, couleurs), comme ceux d'un PAP
// en classe. Préréglages cumulables, puis réglage fin case par case.

type BoolKey = Exclude<keyof Settings, 'text_size' | 'pause_minutes'>

const PRESETS: { id: string; label: string; hint: string; apply: Partial<Settings> }[] = [
  {
    id: 'dyslexie',
    label: 'Dyslexie',
    hint: 'lecture à voix haute, texte plus grand et aéré, police très lisible',
    apply: { read_aloud: true, spacing: true, readable_font: true, text_size: 1 },
  },
  {
    id: 'dyscalculie',
    label: 'Dyscalculie',
    hint: 'aucune pénalité de lenteur, outils de calcul, départ plus doux',
    apply: { no_speed: true, math_tools: true, easy_start: true },
  },
  {
    id: 'dyspraxie',
    label: 'Dyspraxie',
    hint: 'déplacement au toucher, boutons agrandis, aucune pénalité de lenteur',
    apply: { tap_only: true, big_targets: true, no_speed: true },
  },
  {
    id: 'attention',
    label: 'Attention',
    hint: 'mode calme, rappel de pause toutes les 15 minutes',
    apply: { calm: true, pause_minutes: 15 },
  },
]

const GROUPS: { title: string; items: { key: BoolKey; label: string; help: string }[] }[] = [
  {
    title: 'Lecture',
    items: [
      { key: 'read_aloud', label: 'Lecture à voix haute', help: 'Un bouton « Écouter » lit l’énoncé, les propositions, l’explication et les dialogues.' },
      { key: 'auto_read', label: 'Lire automatiquement chaque question', help: 'Sans avoir à toucher « Écouter » (l’enfant peut le désactiver dans ses Options).' },
      { key: 'spacing', label: 'Texte aéré', help: 'Lettres, mots et lignes plus espacés : l’aménagement le plus utile en cas de dyslexie.' },
      { key: 'readable_font', label: 'Police très lisible', help: 'Atkinson Hyperlegible : lettres faciles à distinguer (b/d, l/I/1, O/0).' },
    ],
  },
  {
    title: 'Calcul',
    items: [
      { key: 'no_speed', label: 'Aucune pénalité de lenteur', help: 'Le temps ne compte plus ni dans les étoiles, ni dans les combats, ni dans le défi du jour.' },
      { key: 'math_tools', label: 'Outils de calcul', help: 'Un bouton « Outils » affiche la table de multiplication et un tableau de numération.' },
      { key: 'easy_start', label: 'Départ plus doux', help: 'Chaque session commence un cran plus facile, puis s’adapte comme d’habitude.' },
    ],
  },
  {
    title: 'Gestes',
    items: [
      { key: 'tap_only', label: 'Déplacement au toucher', help: 'Pas de joystick : toucher un endroit (un habitant, un ennemi) suffit pour y aller.' },
      { key: 'big_targets', label: 'Boutons agrandis', help: 'Tous les boutons sont plus hauts, plus faciles à toucher.' },
    ],
  },
  {
    title: 'Attention et confort',
    items: [
      { key: 'calm', label: 'Mode calme', help: 'Ni secousses d’écran, ni ralentis, moins d’étincelles, sons plus doux.' },
      { key: 'colorblind', label: 'Couleurs adaptées (daltonisme)', help: 'Juste en bleu et faux en orange, au lieu du vert et du rouge ; le défi du jour ajoute ✓ et ✗.' },
    ],
  },
]

export function Accommodations({ child }: { child: Profile }) {
  const client = useQueryClient()
  const [settings, setSettings] = useState<Settings>(child.accommodations)
  const mutation = useMutation({
    mutationFn: (value: Settings) => api.setAccommodations(child.id, value),
    onSuccess: () => client.invalidateQueries({ queryKey: ['profiles'] }),
  })
  const changed = JSON.stringify(settings) !== JSON.stringify(child.accommodations)
  const set = (patch: Partial<Settings>) => setSettings({ ...settings, ...patch })
  const active = (preset: (typeof PRESETS)[number]) =>
    Object.entries(preset.apply).every(([k, v]) => settings[k as keyof Settings] === v)

  return (
    <section className="card" id="amenagements">
      <h2>Aménagements</h2>
      <p className="muted small">
        Pour un enfant dyslexique, dyscalculique, dyspraxique, ou qui a du mal à rester concentré : choisissez un ou plusieurs profils, puis
        ajustez case par case. Seuls ces réglages sont enregistrés, jamais de diagnostic. Ils s'appliquent sur tous les appareils au prochain
        retour au camp.
      </p>
      <div className="presets">
        {PRESETS.map((p) => (
          <button key={p.id} className={active(p) ? 'preset active' : 'preset'} onClick={() => set(p.apply)}>
            <strong>{p.label}</strong>
            <span className="small">{p.hint}</span>
          </button>
        ))}
      </div>
      {GROUPS.map((group) => (
        <fieldset key={group.title} className="accommodations">
          <legend>{group.title}</legend>
          {group.title === 'Lecture' && (
            <label className="setting">
              <span>
                <strong>Taille du texte</strong>
                <span className="muted small">L'enfant peut l'agrandir encore, pas la réduire.</span>
              </span>
              <select value={settings.text_size} onChange={(e) => set({ text_size: Number(e.target.value) })}>
                <option value={0}>Normale</option>
                <option value={1}>Grande</option>
                <option value={2}>Très grande</option>
              </select>
            </label>
          )}
          {group.items.map((item) => (
            <label key={item.key} className="setting">
              <span>
                <strong>{item.label}</strong>
                <span className="muted small">{item.help}</span>
              </span>
              <input type="checkbox" checked={settings[item.key]} onChange={(e) => set({ [item.key]: e.target.checked })} />
            </label>
          ))}
          {group.title === 'Attention et confort' && (
            <label className="setting">
              <span>
                <strong>Rappel de pause</strong>
                <span className="muted small">Propose une pause après ce temps de jeu, sans l'imposer (la durée maximale reste réglée plus haut).</span>
              </span>
              <select value={settings.pause_minutes} onChange={(e) => set({ pause_minutes: Number(e.target.value) })}>
                <option value={0}>Jamais</option>
                {[10, 15, 20, 30].map((m) => (
                  <option key={m} value={m}>
                    Toutes les {m} minutes
                  </option>
                ))}
              </select>
            </label>
          )}
        </fieldset>
      ))}
      <div className="row">
        <button className="primary" disabled={!changed || mutation.isPending} onClick={() => mutation.mutate(settings)}>
          Enregistrer
        </button>
        <button onClick={() => setSettings(EMPTY)}>Tout désactiver</button>
        {mutation.isSuccess && !changed && <span className="ok">Enregistré ✓</span>}
        {mutation.isError && <span className="error-text">{mutation.error.message}</span>}
      </div>
    </section>
  )
}

const EMPTY: Settings = {
  read_aloud: false,
  auto_read: false,
  text_size: 0,
  spacing: false,
  readable_font: false,
  no_speed: false,
  math_tools: false,
  easy_start: false,
  tap_only: false,
  big_targets: false,
  calm: false,
  pause_minutes: 0,
  colorblind: false,
}
