/**
 * L'île : le canevas 3D et, par-dessus, l'interface HTML (bandeau de la région, invite
 * « E : … », XP, questions, dialogues de Maître Ysaline et des seuils, options). Le monde
 * annonce ce qui se passe (WorldEvents), l'interface décide et lui rend la main.
 */
import { useEffect, useRef, useState } from 'react'
import type { Services } from '../app/services'
import { type Accommodations, applyToDocument, fromServer, withChildPrefs } from '../core/accessibility'
import type { Item } from '../core/items'
import type { PerfReport } from '../core/perf'
import lignes from '@content/voix/lignes.json'
import type { QuestResult } from '../core/quest/controller'
import { EMPTY_SAVE, SaveGame, type SaveData } from '../core/save'
import { MemoryStore } from '../core/storage'
import { DUNGEONS, type DungeonData, regionTitle } from '../core/world/places'
import type { GameWorld, Interactable, WorldEvents } from '../game/GameWorld'
import type { WorldName } from '../game/theme'
import { QuestionPanel, type QuestionOutcome } from './QuestionPanel'
import { Dialog, Options } from './Dialogs'
import { MeasurePanel, MeasureProgress } from './Measure'
import { PlaceScreen } from './PlaceScreen'

const STONE_XP = 15
/** Durée du banc de mesure sans valeur (`?mesure`) : quatre secondes par arrêt du tour. */
const MEASURE_SECONDS = 40
const today = (): string => new Date().toISOString().slice(0, 10)

type Modal =
  | { kind: 'question'; item: Item; target: Interactable }
  | { kind: 'dialog'; title: string; text: string; note?: string; actions: { label: string; primary?: boolean; run: () => void }[] }
  | { kind: 'options' }
  | null

const WELCOME =
  "Te voilà enfin, Archiviste ! Malvrek a volé les pages de la Grande Chronique. Ses Effaceurs les gardent dans les lieux de l'île. Cherche les pierres de savoir qui brillent : chacune s'éveille quand tu réponds juste. Et quand tu te sens prêt, approche-toi d'un lieu qui brille."

export function GameScreen({ services, demo, onQuit }: { services: Services; demo: boolean; onQuit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<GameWorld | null>(null)
  const saveRef = useRef<SaveGame | null>(null)
  const [data, setData] = useState<SaveData>(() => structuredClone(EMPTY_SAVE))
  const [loading, setLoading] = useState<{ label: string; ratio: number } | null>({ label: 'Préparation', ratio: 0 })
  const [failure, setFailure] = useState('')
  const [region, setRegion] = useState<WorldEvents['region'] | null>(null)
  const [focus, setFocus] = useState<Interactable | null>(null)
  const [modal, setModal] = useState<Modal>(null)
  const [stats, setStats] = useState<WorldEvents['stats'] | null>(null)
  const [online, setOnline] = useState(services.api.online)
  const [helpVisible, setHelpVisible] = useState(true)
  const [measure, setMeasure] = useState<{ ratio: number } | { report: PerfReport } | null>(null)
  /** Lieu de quête en cours (son intérieur remplace l'île à l'écran). */
  const [place, setPlace] = useState<DungeonData | null>(null)
  const placeSave = useRef<SaveGame | null>(null)
  const startPlaceRef = useRef<(def: DungeonData) => void>(() => {})
  const profile = services.session.profile!
  const prefsKey = `prefs.${profile.id}`
  const [prefs, setPrefs] = useState<{ text_size?: number }>(() => services.store.get(prefsKey, {}))
  const accommodations: Accommodations = withChildPrefs(fromServer(profile.accommodations), prefs)
  const params = new URLSearchParams(location.search)

  useEffect(() => applyToDocument(accommodations), [accommodations])
  useEffect(() => {
    services.api.onOnlineChange = setOnline
    services.voice.warm()
    const timer = window.setTimeout(() => setHelpVisible(false), 14_000)
    return () => window.clearTimeout(timer)
  }, [services])

  // Création du monde 3D (une fois ; en mode strict de React, le premier montage est annulé).
  useEffect(() => {
    let cancelled = false
    let created: GameWorld | null = null
    void (async () => {
      let save = structuredClone(EMPTY_SAVE)
      if (!demo) {
        const game = new SaveGame(services.api, services.store, profile.id)
        await game.load()
        saveRef.current = game
        save = game.data
      }
      setData(save)
      try {
        const { GameWorld } = await import('../game/GameWorld') // Babylon.js : chargé à l'entrée dans l'île
        if (cancelled || !canvasRef.current) return
        const world = await GameWorld.create(canvasRef.current, {
          level: profile.level,
          world: (profile.world as WorldName) ?? 'lumineux',
          save,
          calm: accommodations.calm,
          onProgress: (label, ratio) => {
            if (!cancelled) setLoading(ratio >= 1 ? null : { label, ratio })
          },
        })
        created = world
        if (cancelled) {
          world.dispose()
          return
        }
        worldRef.current = world
        world.events.on('region', setRegion)
        world.events.on('focus', setFocus)
        world.events.on('stats', setStats)
        world.events.on('interact', (target) => interactRef.current(target))
        setLoading(null)
        // Entrée directe dans un lieu (essais, captures, tests) : ?lieu=<code>.
        const direct = DUNGEONS.find((d) => d.code === params.get('lieu'))
        if (direct) startPlaceRef.current(direct)
        if (params.has('e2e')) (window as unknown as { __aldoria: unknown }).__aldoria = { world, services }
        if (params.has('mesure')) void runMeasure(world)
      } catch (error) {
        console.error(error)
        setFailure("L'île n'a pas pu se charger. Vérifie que le navigateur est à jour (WebGL 2), puis recharge la page.")
      }
    })()
    return () => {
      cancelled = true
      created?.dispose()
      worldRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Le temps de jeu actif (onglet visible) est compté pour la limite du parent.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') services.session.tick(1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [services])

  /** Banc de mesure : l'avancement change par dixièmes (un rendu React par image fausserait la mesure). */
  async function runMeasure(world: GameWorld) {
    setHelpVisible(false)
    setMeasure({ ratio: 0 })
    await new Promise((resolve) => window.setTimeout(resolve, 1500)) // ombres et shaders prêts
    let shown = 0
    const report = await world.measure(Number(params.get('mesure')) || MEASURE_SECONDS, (ratio) => {
      const tenth = Math.floor(ratio * 10) / 10
      if (tenth !== shown) {
        shown = tenth
        setMeasure({ ratio: tenth })
      }
    })
    const handle = (window as unknown as { __aldoria?: Record<string, unknown> }).__aldoria
    if (handle) handle.mesure = report
    setMeasure({ report })
  }

  function close() {
    setModal(null)
    worldRef.current?.setInputEnabled(true)
  }

  /** Entre dans l'intérieur d'un lieu. En mode découverte, la partie vit en mémoire : rien n'est enregistré. */
  function startPlace(def: DungeonData) {
    const game = saveRef.current ?? new SaveGame(services.api, new MemoryStore(), 0)
    if (!saveRef.current) game.data = structuredClone(data)
    placeSave.current = game
    setModal(null)
    worldRef.current?.setInputEnabled(false)
    setHelpVisible(false)
    setPlace(def)
  }
  startPlaceRef.current = startPlace

  /** Retour à l'île : la partie a avancé (XP, sac, lieu terminé), les seuils suivants s'ouvrent, et Maître Ysaline salue la page rapportée. */
  async function onPlaceExit(result: QuestResult) {
    const game = placeSave.current
    const def = place
    setPlace(null)
    if (!game || !def) return
    const before = data.story
    const next = structuredClone(game.data)
    setData(next)
    worldRef.current?.refreshPlaces(next)
    // La session de l'île reprend (les pierres de savoir enregistrent leurs réponses).
    if (!demo) {
      await services.session.start('monde')
      services.questions.reset(fromServer(services.session.profile?.accommodations).easy_start)
    } else {
      services.session.mode = 'monde'
    }
    const step = `page-${def.code}`
    const line = lignes.find((l) => l.id === step)
    if (result.status === 'completed' && !before.includes(step) && next.story.includes(step) && line) {
      // Les phrases enregistrées de Maître Ysaline parlent encore d'une « carte » : à réenregistrer (docs/decisions.md D12).
      setModal({
        kind: 'dialog',
        title: 'Maître Ysaline',
        text: line.texte,
        actions: [
          { label: '🔊 Écouter', run: () => void services.voice.say([line.texte]) },
          { label: 'Merci !', primary: true, run: close },
        ],
      })
      if (accommodations.auto_read) void services.voice.say([line.texte])
    } else {
      worldRef.current?.setInputEnabled(true)
    }
  }

  function persist(next: SaveData) {
    setData({ ...next })
    const game = saveRef.current
    if (game) {
      game.data = next
      void game.save()
    }
  }

  function onInteract(target: Interactable) {
    if (target.kind === 'pierre') {
      if (!target.open) {
        setModal({ kind: 'dialog', title: target.label, text: 'Cette pierre brille déjà. Elle se rendormira demain : reviens la réveiller !', actions: [{ label: 'D’accord', primary: true, run: close }] })
        return
      }
      const role = services.questions.answered % 3 === 2 ? 'chapitre' : 'automatisme'
      const item = services.questions.next(role) ?? services.questions.next()
      if (!item) {
        setModal({ kind: 'dialog', title: target.label, text: 'La pierre reste muette : aucune question disponible pour l’instant.', actions: [{ label: 'D’accord', primary: true, run: close }] })
        return
      }
      setModal({ kind: 'question', item, target })
    } else if (target.kind === 'ysaline') {
      setModal({
        kind: 'dialog',
        title: 'Maître Ysaline',
        text: WELCOME,
        actions: [
          { label: '🔊 Écouter', run: () => void services.voice.say([WELCOME]) },
          { label: 'En route !', primary: true, run: close },
        ],
      })
      if (accommodations.auto_read) void services.voice.say([WELCOME])
    } else if (target.place) {
      const place = target.place
      // Le texte du seuil est celui que Maître Ysaline a enregistré (ElevenLabs) : il se lit seul et à l'identique.
      // L'indication du nombre d'étapes s'affiche dessous sans être lue : elle n'a pas de voix enregistrée, et
      // la lire avec Piper mettrait deux voix différentes dans une même réplique.
      const text = target.open
        ? place.dungeon.threshold
        : `Ce chemin est encore fermé. Il s'ouvrira quand tu auras rapporté la page du lieu précédent de ${regionTitle(place.dungeon.region)}.`
      const note = target.open ? `${place.dungeon.rooms.length} étapes, une énigme, et un Effaceur à vaincre.` : undefined
      setModal({
        kind: 'dialog',
        title: place.dungeon.title,
        text,
        note,
        actions: target.open
          ? [
              { label: '🔊 Écouter', run: () => void services.voice.say([text]) },
              { label: 'Pas maintenant', run: close },
              {
                label: "J'y vais",
                primary: true,
                run: () => startPlace(place.dungeon),
              },
            ]
          : [{ label: 'D’accord', primary: true, run: close }],
      })
    }
  }

  // Le monde garde ce gestionnaire depuis sa création : on passe par une référence à jour.
  const interactRef = useRef(onInteract)
  interactRef.current = onInteract

  function onQuestionDone(outcome: QuestionOutcome, target: Interactable) {
    const correct = outcome.result?.correct ?? false
    if (outcome.result) {
      worldRef.current?.stoneAnswered(target.id, correct)
      if (correct) {
        const next = structuredClone(data)
        next.stones[target.id] = today()
        next.xp += Math.round(STONE_XP * outcome.result.rewardFactor)
        persist(next)
      }
    }
    close()
  }

  return (
    <div className={place ? 'game place-mode' : 'game'}>
      <canvas ref={canvasRef} className="world-canvas" tabIndex={-1} aria-label="L'île d'Aldoria" data-testid="monde" />

      <div className="hud-top">
        <div className="badge">
          <strong>{profile.name}</strong> · {data.xp} XP{demo && ' · découverte'}
          {!online && <span className="offline" title="Les réponses partiront au retour du réseau"> · hors connexion</span>}
        </div>
        <div className="hud-buttons">
          <button type="button" className="secondary small" onClick={() => { worldRef.current?.setInputEnabled(false); setModal({ kind: 'options' }) }}>Options</button>
          <button type="button" className="secondary small" onClick={onQuit}>Quitter</button>
        </div>
      </div>

      {region?.title && <div key={region.title} className="region-banner" data-testid="region">{region.title}</div>}

      {focus && !modal && (
        <div className="prompt-bar" data-testid="invite">
          <kbd>E</kbd> {focus.kind === 'pierre' ? `Toucher ${focus.label.toLowerCase()}` : focus.kind === 'ysaline' ? 'Parler à Maître Ysaline' : `Approcher : ${focus.label}`}
        </div>
      )}

      {helpVisible && !loading && !modal && (
        <div className="controls-help">
          <span><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> ou flèches : avancer</span>
          <span>Souris : regarder</span>
          <span><kbd>E</kbd> : agir</span>
          <span>Clic sur le sol : y aller</span>
        </div>
      )}

      {place && placeSave.current && worldRef.current && (
        <PlaceScreen
          services={services}
          world={worldRef.current}
          def={place}
          save={placeSave.current}
          demo={demo}
          accommodations={accommodations}
          profileName={profile.name}
          worldName={(profile.world as WorldName) ?? 'lumineux'}
          onExit={(result) => void onPlaceExit(result)}
        />
      )}

      {params.has('perf') && stats && (
        <div className="perf">{stats.fps} i/s · {stats.drawCalls} appels · {Math.round(stats.triangles / 1000)} k triangles · {worldRef.current?.quality.name} · {stats.engine}</div>
      )}
      {measure && 'ratio' in measure && <MeasureProgress ratio={measure.ratio} />}
      {measure && 'report' in measure && (
        <MeasurePanel
          report={measure.report}
          onAgain={() => worldRef.current && void runMeasure(worldRef.current)}
          onClose={() => setMeasure(null)}
        />
      )}

      {loading && (
        <div className="loading" role="status">
          <p className="game-title small">Aldoria</p>
          <p>{loading.label}…</p>
          <div className="bar"><div className="bar-fill" data-ratio={Math.round(loading.ratio * 10)} /></div>
        </div>
      )}
      {failure && <div className="loading error" role="alert">{failure}</div>}

      {modal?.kind === 'question' && params.has('e2e') && <E2eQuestion item={modal.item} />}
      {modal?.kind === 'question' && (
        <QuestionPanel
          services={services}
          item={modal.item}
          title={modal.target.label}
          gameMode="monde"
          success="Bravo ! La pierre s’éveille."
          accommodations={accommodations}
          onDone={(outcome) => onQuestionDone(outcome, modal.target)}
        />
      )}
      {modal?.kind === 'dialog' && <Dialog title={modal.title} text={modal.text} note={modal.note} actions={modal.actions} />}
      {modal?.kind === 'options' && (
        <Options
          accommodations={accommodations}
          textSize={prefs.text_size ?? 0}
          onTextSize={(size) => {
            const next = { ...prefs, text_size: size }
            setPrefs(next)
            services.store.set(prefsKey, next)
          }}
          onClose={close}
        />
      )}
    </div>
  )
}

/** Tests dans le navigateur (?e2e) : la question affichée, pour y répondre juste. */
function E2eQuestion({ item }: { item: Item }) {
  useEffect(() => {
    const handle = (window as unknown as { __aldoria?: Record<string, unknown> }).__aldoria
    if (handle) handle.question = item
  }, [item])
  return null
}
