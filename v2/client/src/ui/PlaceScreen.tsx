/**
 * Un lieu de quête, de l'entrée au coffre : charge l'intérieur 3D, ouvre la session `donjon` du serveur
 * (chapitres du lieu et énigme), puis laisse le contrôleur (core/quest/controller.ts) dérouler la quête
 * en lui prêtant l'interface (panneaux, barres, bandeaux). Rend la main à l'île avec le résultat.
 */
import { useEffect, useRef, useState } from 'react'
import type { Services } from '../app/services'
import type { Accommodations } from '../core/accessibility'
import type { Action } from '../core/combat/encounter'
import type { Item } from '../core/items'
import { type ActionChoice, type AskOutcome, QuestController, type QuestResult, type QuestUi, type Tone } from '../core/quest/controller'
import { HeroVoice } from '../core/quest/heroVoice'
import { Progress, resumeRoom } from '../core/quest/run'
import { levelForXp } from '../core/progression/progression'
import type { Owned } from '../core/progression/inventory'
import type { SaveGame } from '../core/save'
import type { DungeonData } from '../core/world/places'
import type { GameWorld } from '../game/GameWorld'
import type { FloatingText } from '../game/interior/InteriorWorld'
import type { WorldName } from '../game/theme'
import { Dialog } from './Dialogs'
import { ActionMenu, Banner, FloatingTexts, type Gauge, HeroBubble, HpBar, RatingPanel, RoomBanner } from './PlaceHud'
import { QuestionPanel } from './QuestionPanel'

type Prompt =
  | { kind: 'message'; title: string; text: string; button: string; resolve: () => void }
  | { kind: 'actions'; menu: Parameters<QuestUi['chooseAction']>[0]; resolve: (choice: ActionChoice) => void }
  | { kind: 'question'; item: Item; title: string; mode: string; success: string; resolve: (outcome: AskOutcome) => void }
  | { kind: 'rating'; title: string; resolve: (rating: number) => void }

export function PlaceScreen({ services, world, def, save, demo, accommodations, profileName, worldName, onExit }: {
  services: Services
  world: GameWorld
  def: DungeonData
  save: SaveGame
  demo: boolean
  accommodations: Accommodations
  profileName: string
  worldName: WorldName
  onExit: (result: QuestResult) => void
}) {
  const [loading, setLoading] = useState<{ label: string; ratio: number } | null>({ label: 'Les salles', ratio: 0 })
  const [failure, setFailure] = useState('')
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [hero, setHero] = useState<Gauge>({ name: profileName, hp: 0, max: 0 })
  const [enemy, setEnemy] = useState<Gauge | null>(null)
  const [banner, setBanner] = useState<{ id: number; text: string; tone: Tone } | null>(null)
  const [bubble, setBubble] = useState('')
  const [floats, setFloats] = useState<(FloatingText & { id: number })[]>([])
  const [room, setRoom] = useState(0)
  const controllerRef = useRef<QuestController | null>(null)
  const leave = useRef<() => void>(() => {})
  const counter = useRef(0)
  /** Numéro de la dernière exécution : en développement, React monte l'écran deux fois de suite. */
  const run = useRef(0)
  /** L'avancement du lieu survit à un remontage : la scène 3D et le contrôleur lisent le même objet. */
  const progressRef = useRef<Progress | null>(null)

  useEffect(() => {
    const mine = (run.current += 1)
    let cancelled = false
    const timers: number[] = []
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))
    const next = () => (counter.current += 1)

    const ui: QuestUi = {
      message: (title, text, button) => new Promise<void>((resolve) => setPrompt({ kind: 'message', title, text, button, resolve })),
      banner: (text, tone, seconds = 1.2) => {
        const id = next()
        setBanner({ id, text, tone })
        later(seconds * 1000 + 300, () => setBanner((b) => (b?.id === id ? null : b)))
      },
      say: (text) => {
        if (!text) return
        setBubble(text)
        later(5000, () => setBubble((b) => (b === text ? '' : b)))
      },
      setHero: (hp, max) => setHero((g) => ({ ...g, hp, max })),
      setEnemy: (name, hp = 0, max = 0) => setEnemy(name ? { name, hp, max } : null),
      chooseAction: (menu) => new Promise<ActionChoice>((resolve) => setPrompt({ kind: 'actions', menu, resolve })),
      ask: (item, title, mode, success) => new Promise<AskOutcome>((resolve) => setPrompt({ kind: 'question', item, title, mode, success, resolve })),
      rating: (title) => new Promise<number>((resolve) => setPrompt({ kind: 'rating', title, resolve })),
    }

    void (async () => {
      try {
        // Session du serveur pour ce lieu : ses chapitres et son énigme. En mode découverte, le paquet de démonstration suffit.
        if (!demo) {
          await services.session.end()
          const started = await services.session.start('donjon', { focus_chapters: def.chapter_codes, enigma: { generator: def.enigma.generator, count: 3 } }, `donjon.${def.code}`)
          if (!started.ok) throw new Error('session du lieu impossible')
        }
        services.questions.reset(false)
        progressRef.current ??= new Progress(def, resumeRoom(def, save.checkpoint(def.code)))
        const progress = progressRef.current
        const stage = await world.enterPlace({
          def,
          progress,
          onFloat: (f) => {
            const id = next()
            setFloats((all) => [...all, { ...f, id }])
            later(1300, () => setFloats((all) => all.filter((x) => x.id !== id)))
          },
          onProgress: (label, ratio) => !cancelled && setLoading({ label, ratio }),
        })
        if (cancelled) return // une exécution plus récente (ou la sortie de l'écran) s'en occupe
        setLoading(null)
        const controller = new QuestController(def, stage, ui, {
          questions: services.questions,
          save,
          voice: new HeroVoice(services.store),
          world: worldName,
          noSpeed: accommodations.no_speed,
        }, progress)
        controllerRef.current = controller
        setHero({ name: `${profileName} · niveau ${levelForXp(save.data.xp)}`, hp: controller.hero.hp, max: controller.hero.maxHp })
        leave.current = () => stage.requestLeave()
        const handle = (window as unknown as { __aldoria?: Record<string, unknown> }).__aldoria
        if (handle) Object.assign(handle, { place: { controller, stage, progress } })
        const result = await controller.run()
        if (cancelled) return
        setPrompt(null)
        if (!demo) await save.save().catch(() => {}) // mode découverte : rien n'est enregistré
        await services.session.end(result.rating)
        world.leavePlace()
        onExit(result)
      } catch (error) {
        console.error(error)
        if (!cancelled) setFailure("Ce lieu n'a pas pu se charger. Reviens à l'île et réessaie.")
      }
    })()
    return () => {
      cancelled = true
      for (const t of timers) window.clearTimeout(t)
      // Écran quitté en plein lieu (et non simple remontage) : on rend l'île.
      window.setTimeout(() => {
        if (run.current === mine && world.interior) world.leavePlace()
      }, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Salle en cours, pour le bandeau d'étage.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const interior = world.interior
      if (interior) setRoom(interior.heroPosition().room)
    }, 400)
    return () => window.clearInterval(timer)
  }, [world])

  const close = <T,>(resolve: (value: T) => void, value: T) => {
    setPrompt(null)
    resolve(value)
  }

  return (
    <div className="place-hud" data-testid="lieu">
      {loading && (
        <div className="loading" role="status">
          <p className="game-title small">{def.title}</p>
          <p>{loading.label}…</p>
          <div className="bar"><div className="bar-fill" data-ratio={Math.round(loading.ratio * 10)} /></div>
        </div>
      )}
      {failure && (
        <div className="loading error" role="alert">
          {failure}
          <div className="actions"><button type="button" className="primary" onClick={() => { world.leavePlace(); onExit({ status: 'left', rating: 0, answered: 0, correct: 0 }) }}>Retour à l'île</button></div>
        </div>
      )}
      {!loading && !failure && (
        <>
          <div className="place-top">
            <div className="place-bars">
              {hero.max > 0 && <HpBar gauge={hero} tone="hero" testId="pv-heros" />}
              {enemy && <HpBar gauge={enemy} tone="enemy" testId="pv-ennemi" />}
            </div>
            <RoomBanner title={def.rooms[room]?.title ?? def.title} floor={`Salle ${room + 1} sur ${def.rooms.length}`} />
          </div>
          {banner && <Banner id={banner.id} text={banner.text} tone={banner.tone} />}
          {bubble && !prompt && <HeroBubble text={bubble} />}
          <FloatingTexts items={floats} />
          {!prompt && (
            <div className="place-leave">
              <button type="button" className="quiet small" onClick={() => leave.current()}>Quitter le lieu</button>
            </div>
          )}
        </>
      )}

      {prompt?.kind === 'message' && (
        <Dialog title={prompt.title} text={prompt.text} actions={[
          { label: '🔊 Écouter', run: () => void services.voice.say([prompt.text]) },
          { label: prompt.button, primary: true, run: () => close(prompt.resolve, undefined) },
        ]} />
      )}
      {prompt?.kind === 'actions' && (
        <ActionMenu
          names={prompt.menu.names}
          canHeal={prompt.menu.canHeal}
          bag={prompt.menu.bag as Owned}
          onChoose={(choice) => close(prompt.resolve, choice)}
          onLeave={() => close(prompt.resolve, { kind: 'leave' })}
        />
      )}
      {prompt?.kind === 'question' && (
        <>
          {new URLSearchParams(location.search).has('e2e') && <E2eQuestion item={prompt.item} />}
          <QuestionPanel
            services={services}
            item={prompt.item}
            title={prompt.title}
            gameMode={prompt.mode}
            success={prompt.success}
            accommodations={accommodations}
            onDone={(outcome) => close(prompt.resolve, { item: outcome.item, result: outcome.result, hintUsed: outcome.hintUsed })}
          />
        </>
      )}
      {prompt?.kind === 'rating' && <RatingPanel title={prompt.title} onRate={(n) => close(prompt.resolve, n)} />}
    </div>
  )
}

/** Crochet de test (?e2e) : la question affichée, pour répondre juste sans la lire. */
function E2eQuestion({ item }: { item: Item }) {
  useEffect(() => {
    const handle = (window as unknown as { __aldoria?: Record<string, unknown> }).__aldoria
    if (handle) handle.question = item
  }, [item])
  return null
}

export type { Action }
