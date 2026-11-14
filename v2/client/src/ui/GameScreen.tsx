/**
 * L'île : le canevas 3D et, par-dessus, l'interface HTML (bandeau de la région, invite
 * « E : … », XP, mini-carte, questions, dialogues de Maître Ysaline et des seuils, options). Le monde
 * annonce ce qui se passe (WorldEvents), l'interface décide et lui rend la main.
 */
import { useEffect, useRef, useState } from 'react'
import type { Services } from '../app/services'
import { prefetchPlace } from '../app/prefetch'
import { reloadPending } from '../app/staleBuild'
import { type Accommodations, applyToDocument, fromServer, withChildPrefs } from '../core/accessibility'
import type { Item } from '../core/items'
import lignes from '@content/voix/lignes.json'
import { today as localDay } from '../core/dailyChallenge'
import { DEFAULT_VOLUME, volumeOf } from '../core/music'
import { levelForXp } from '../core/progression'
import { EMPTY_SAVE, SaveGame, type SaveData } from '../core/save'
import { pageGreeting } from '../core/quest/chest'
import { regionTitle } from '../core/world/places'
import type { GameWorld, Interactable, WorldEvents } from '../game/GameWorld'
import type { WorldName } from '../game/theme'
import { PlayTimeGuard } from './PlayTimeGuard'
import { Archives } from './Archives'
import { DailyChallenge } from './DailyChallenge'
import { E2eQuestion } from './E2eQuestion'
import { QuestionPanel, type QuestionOutcome } from './QuestionPanel'
import { Dialog, Options } from './Dialogs'
import { Minimap } from './Minimap'
import { useFight } from './useFight'

const STONE_XP = 15
/** Préférences gardées sur le poste, pour chaque enfant : taille du texte, carte affichée, musique. */
type ChildPrefs = { text_size?: number; map?: boolean; music?: number; music_off?: boolean }
const today = (): string => new Date().toISOString().slice(0, 10)

type Modal =
  | { kind: 'question'; item: Item; target: Interactable }
  | { kind: 'dialog'; title: string; text: string; note?: string; actions: { label: string; primary?: boolean; run: () => void }[] }
  | { kind: 'options' }
  | { kind: 'archives' }
  | { kind: 'daily' }
  | null

/** Accueil de Maître Ysaline : le texte et sa voix enregistrée sont dans content/voix/lignes.json (un seul endroit : modifier ce texte demande de le réenregistrer). */
const WELCOME = lignes.find((l) => l.id === 'ile-accueil')!.texte

export function GameScreen({ services, demo, onQuit }: { services: Services; demo: boolean; onQuit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<GameWorld | null>(null)
  const [world, setWorld] = useState<GameWorld | null>(null)
  const saveRef = useRef<SaveGame | null>(null)
  const [data, setData] = useState<SaveData>(() => structuredClone(EMPTY_SAVE))
  // La partie à jour, même dans un combat qui dure (les fonctions asynchrones gardent l'état de leur création).
  const dataRef = useRef<SaveData>(data)
  const [loading, setLoading] = useState<{ label: string; ratio: number } | null>({ label: 'Préparation', ratio: 0 })
  const [failure, setFailure] = useState('')
  const [region, setRegion] = useState<WorldEvents['region'] | null>(null)
  const [focus, setFocus] = useState<Interactable | null>(null)
  const [modal, setModal] = useState<Modal>(null)
  // Dans l'intérieur d'un lieu (l'île est en pause) : son nom et l'étage du héros.
  const [inside, setInside] = useState<{ title: string } | null>(null)
  const [floor, setFloor] = useState('')
  const [stats, setStats] = useState<WorldEvents['stats'] | null>(null)
  const [online, setOnline] = useState(services.api.online)
  const [helpVisible, setHelpVisible] = useState(true)
  const profile = services.session.profile!
  const prefsKey = `prefs.${profile.id}`
  const [prefs, setPrefs] = useState<ChildPrefs>(() => services.store.get(prefsKey, {}))
  const mapVisible = prefs.map !== false
  const musicVolume = volumeOf(prefs.music)
  const musicOn = prefs.music_off !== true && musicVolume > 0
  const accommodations: Accommodations = withChildPrefs(fromServer(profile.accommodations), prefs)
  const params = new URLSearchParams(location.search)

  const fight = useFight({
    services,
    worldRef,
    world,
    demo,
    worldName: (profile.world as WorldName) ?? 'lumineux',
    heroName: profile.name,
    accommodations,
    grantXp,
    currentXp: () => dataRef.current.xp,
    getSave: () => dataRef.current,
    persist,
  })

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
      dataRef.current = save
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
        setWorld(world)
        world.events.on('region', setRegion)
        world.events.on('interior', (entered) => setInside(entered ? { title: entered.place.dungeon.title } : null))
        world.events.on('floor', (current) => setFloor(current.label))
        world.events.on('focus', setFocus)
        world.events.on('stats', setStats)
        world.events.on('interact', (target) => interactRef.current(target))
        setLoading(null)
        if (params.has('e2e')) (window as unknown as { __aldoria: unknown }).__aldoria = { world, services }
      } catch (error) {
        if (reloadPending()) return // nouvelle version du jeu : la page se recharge
        console.error(error)
        setFailure("L'île n'a pas pu se charger. Recharge la page. Si ça recommence, le navigateur est peut-être trop ancien (WebGL 2).")
      }
    })()
    return () => {
      cancelled = true
      created?.dispose()
      worldRef.current = null
      setWorld(null)
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

  function savePrefs(next: ChildPrefs) {
    setPrefs(next)
    services.store.set(prefsKey, next)
  }

  /** Musique coupée ou remise (bouton « Musique ») ; remise à zéro dans les Options, elle revient au volume par défaut. */
  function toggleMusic() {
    if (musicOn) savePrefs({ ...prefs, music_off: true })
    else savePrefs({ ...prefs, music_off: false, music: musicVolume > 0 ? prefs.music : DEFAULT_VOLUME })
  }

  /** Mini-carte affichée ou cachée (touche M, bouton « Carte ») : gardé pour chaque enfant. */
  function toggleMap() {
    savePrefs({ ...prefs, map: !mapVisible })
  }

  // Touche M : la lettre, pas la position (AZERTY et QWERTY) ; jamais pendant une question,
  // un dialogue, ou quand on écrit dans un champ.
  const toggleMapRef = useRef(toggleMap)
  toggleMapRef.current = toggleMap
  const modalOpenRef = useRef(false)
  modalOpenRef.current = modal !== null || fight.overlayOpen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || e.key.toLowerCase() !== 'm') return
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable)) return
      if (modalOpenRef.current || !worldRef.current || worldRef.current.interior) return
      toggleMapRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Musique : à l'écran quand l'île est prête, réglée par l'enfant, muette pendant une question.
  const calm = accommodations.calm
  const musicQuestion = modal?.kind === 'question' || modal?.kind === 'daily' || fight.questionOpen
  useEffect(() => {
    services.music.configure({ muted: !musicOn, volume: musicVolume, calm })
  }, [services, musicOn, musicVolume, calm])
  useEffect(() => {
    services.music.setFocus(musicQuestion)
  }, [services, musicQuestion])
  useEffect(() => {
    if (!world) return
    services.music.start()
    return () => services.music.stop()
  }, [services, world])

  /** XP gagnées (combat) : rend le nouveau niveau si on en gagne un. */
  function grantXp(amount: number): number | null {
    const next = structuredClone(dataRef.current)
    const before = levelForXp(next.xp)
    next.xp += Math.max(0, Math.round(amount))
    persist(next)
    const after = levelForXp(next.xp)
    return after > before ? after : null
  }

  function close() {
    setModal(null)
    worldRef.current?.setInputEnabled(true)
  }

  function persist(next: SaveData) {
    dataRef.current = next
    setData({ ...next })
    const game = saveRef.current
    if (game) {
      game.data = next
      void game.save()
    }
  }

  function onInteract(target: Interactable) {
    if (target.kind === 'sortie') {
      onExit(target)
    } else if (target.kind === 'pierre') {
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
    } else if (target.kind === 'coffre') {
      void openChest()
    } else if (target.kind === 'jour') {
      setModal({ kind: 'daily' })
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
      if (target.open) prefetchPlace(place) // l'enfant lit le seuil : les modèles du lieu arrivent déjà
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
                run: () => void enterPlace(place),
              },
            ]
          : [{ label: 'D’accord', primary: true, run: close }],
      })
    }
  }

  /** « J'y vais » : l'intérieur se construit derrière l'écran de chargement, puis remplace l'île. */
  async function enterPlace(place: NonNullable<Interactable['place']>) {
    const world = worldRef.current
    if (!world) return
    setModal(null)
    setLoading({ label: place.dungeon.title, ratio: 0 })
    const entered = await fight.enter(place, (label, ratio) => setLoading({ label, ratio }))
    setLoading(null)
    if (entered === 'ok') {
      world.setInputEnabled(true)
      return
    }
    world.setInputEnabled(false)
    setModal({
      kind: 'dialog',
      title: place.dungeon.title,
      text:
        entered === 'session'
          ? "Le lieu n'a pas pu s'ouvrir : le serveur ne répond pas. Réessaie dans un instant."
          : "L'intérieur n'a pas pu s'ouvrir. Reviens sur l'île et réessaie.",
      actions: [{ label: 'D’accord', primary: true, run: close }],
    })
  }

  /**
   * Le coffre de l'Effaceur : le lieu est terminé, retour sur l'île ; la première fois, Maître Ysaline salue l'Archiviste (sa voix
   * enregistrée) en annonçant le chemin qui s'ouvre.
   */
  async function openChest() {
    const result = await fight.openChest()
    if (!result?.first) return
    const text = pageGreeting(result.code)
    const world = worldRef.current
    if (!text || !world) return
    world.setInputEnabled(false)
    setModal({
      kind: 'dialog',
      title: 'Maître Ysaline',
      text,
      actions: [
        { label: '🔊 Écouter', run: () => void services.voice.say([text]) },
        {
          label: 'Merci !',
          primary: true,
          run: () => {
            services.voice.stop()
            close()
          },
        },
      ],
    })
    if (accommodations.auto_read) void services.voice.say([text])
  }

  /** La porte de sortie : retour sur l'île, devant le lieu. */
  function onExit(target: Interactable) {
    setModal({
      kind: 'dialog',
      title: target.label,
      text: 'Tu pourras y revenir quand tu voudras.',
      actions: [
        { label: 'Rester', run: close },
        {
          label: 'Sortir',
          primary: true,
          run: () => {
            setModal(null)
            void fight.leave()
          },
        },
      ],
    })
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
    <div className="game">
      <canvas ref={canvasRef} className="world-canvas" tabIndex={-1} aria-label="L'île d'Aldoria" data-testid="monde" />

      <div className="hud-top">
        <div className="badge">
          <strong>{profile.name}</strong> · {data.xp} XP{demo && ' · découverte'}
          {!online && <span className="offline" title="Les réponses partiront au retour du réseau"> · hors connexion</span>}
        </div>
        <div className="hud-right">
          <div className="hud-buttons">
            {!inside && (
              <button
                type="button"
                className="secondary small"
                aria-pressed={mapVisible}
                title="Afficher ou cacher la carte (touche M)"
                data-testid="bouton-carte"
                onClick={() => {
                  toggleMap()
                  canvasRef.current?.focus() // Espace ou Entrée ne doivent pas rappuyer sur le bouton
                }}
              >
                Carte
              </button>
            )}
            {services.music.enabled && (
              <button
                type="button"
                className="secondary small"
                aria-pressed={musicOn}
                title="Couper ou remettre la musique"
                data-testid="bouton-musique"
                onClick={() => {
                  toggleMusic()
                  canvasRef.current?.focus()
                }}
              >
                Musique
              </button>
            )}
            <button type="button" className="secondary small" data-testid="bouton-archives" onClick={() => { worldRef.current?.setInputEnabled(false); setModal({ kind: 'archives' }) }}>Archives</button>
            <button type="button" className="secondary small" onClick={() => { worldRef.current?.setInputEnabled(false); setModal({ kind: 'options' }) }}>Options</button>
            <button type="button" className="secondary small" onClick={onQuit}>Quitter</button>
          </div>
          {world && mapVisible && !loading && !inside && <Minimap world={world} place={region?.title ?? ''} />}
        </div>
      </div>

      {region?.title && <div key={region.title} className="region-banner" data-testid="region">{region.title}</div>}
      {inside && floor && <div className="floor-label" data-testid="etage">{floor}</div>}
      {fight.hud}

      {focus && !modal && !fight.active && (
        <div className="prompt-bar" data-testid="invite">
          <kbd>E</kbd>{' '}
          {focus.kind === 'pierre'
            ? `Toucher ${focus.label.toLowerCase()}`
            : focus.kind === 'jour'
              ? 'Relever le défi du jour'
              : focus.kind === 'coffre'
                ? 'Ouvrir le coffre'
                : focus.kind === 'ysaline'
                  ? 'Parler à Maître Ysaline'
                  : focus.kind === 'sortie'
                    ? focus.label
                    : `Approcher : ${focus.label}`}
        </div>
      )}

      {helpVisible && !loading && !modal && !fight.active && (
        <div className="controls-help">
          <span><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> ou flèches : avancer</span>
          <span>Souris : regarder</span>
          <span><kbd>E</kbd> : agir</span>
          {!inside && <span><kbd>M</kbd> : carte</span>}
          {!inside && <span>Clic sur le sol : y aller</span>}
        </div>
      )}

      {params.has('perf') && stats && (
        <div className="perf">
          {stats.fps} i/s · {stats.drawCalls} appels · {Math.round(stats.triangles / 1000)} k triangles · {worldRef.current?.quality.name} ·{' '}
          {worldRef.current?.engine.isWebGPU ? 'WebGPU' : 'WebGL 2'}
        </div>
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
      {fight.overlay}
      {modal?.kind === 'dialog' && <Dialog title={modal.title} text={modal.text} note={modal.note} actions={modal.actions} />}

      {/* Fin de séance et rappel de pause fixés par le parent : par-dessus tout, le monde se fige. */}
      <PlayTimeGuard
        services={services}
        pauseMinutes={accommodations.pause_minutes}
        onBlock={(blocked) => worldRef.current?.setInputEnabled(!blocked)}
        onEnd={onQuit}
      />
      {modal?.kind === 'archives' && <Archives services={services} onClose={close} />}
      {modal?.kind === 'daily' && (
        <DailyChallenge
          services={services}
          accommodations={accommodations}
          demo={demo}
          data={data}
          onSave={(next) => {
            persist(next)
            worldRef.current?.setDayChallenge(!next.daily.days.includes(localDay()))
          }}
          onClose={close}
        />
      )}
      {modal?.kind === 'options' && (
        <Options
          accommodations={accommodations}
          textSize={prefs.text_size ?? 0}
          onTextSize={(size) => savePrefs({ ...prefs, text_size: size })}
          musicVolume={services.music.enabled ? musicVolume : null}
          onMusicVolume={(volume) => savePrefs({ ...prefs, music: volume, music_off: false })}
          onClose={close}
        />
      )}
    </div>
  )
}
