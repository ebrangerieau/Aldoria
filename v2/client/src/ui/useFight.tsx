/**
 * Les combats d'un lieu de quête, côté interface : ouvrir et fermer la session du lieu, mener chaque rencontre (choix de
 * l'action, question, verdict, récit) avec core/combat/flow.ts, tenir les barres de PV et les nombres flottants, annoncer la
 * victoire, le niveau gagné et la porte qui s'ouvre. Le monde 3D (game/interior.ts) met en scène ; ce crochet décide.
 *
 * Il rend deux morceaux d'interface à poser dans l'écran de jeu : `hud` (barres, actions, nombres flottants, annonce) et
 * `overlay` (la question, le texte du repli).
 */
import { type ReactNode, type MutableRefObject, useCallback, useEffect, useRef, useState } from 'react'
import { startPlaceSession, type PlaceSession } from '../app/placeSession'
import type { Services } from '../app/services'
import { type Action, type Answer, Combatant, Encounter } from '../core/combat/encounter'
import { applyEvent, type FightHost, type FightView, runFight, viewOf } from '../core/combat/flow'
import { combatTexts, pickOne } from '../core/combat/texts'
import { chestMessage, completePlace } from '../core/quest/chest'
import type { SaveData } from '../core/save'
import type { Accommodations } from '../core/accessibility'
import type { Item } from '../core/items'
import { heroMaxHp, levelForXp } from '../core/progression'
import type { Place } from '../core/world/places'
import type { GameWorld } from '../game/GameWorld'
import type { Enemy } from '../game/interior'
import type { WorldName } from '../game/theme'
import { ActionBar, FightBars, type Floating, Floats } from './Combat'
import { Dialog } from './Dialogs'
import { QuestionPanel, type QuestionOutcome } from './QuestionPanel'

const FLOAT_MS = 1400
const NOTICE_MS = 2400

type Phase = 'actions' | 'busy'

export interface FightOptions {
  services: Services
  worldRef: MutableRefObject<GameWorld | null>
  /** Le monde 3D, une fois créé (pour s'abonner à ses événements). */
  world: GameWorld | null
  demo: boolean
  worldName: WorldName
  heroName: string
  accommodations: Accommodations
  /** Les XP gagnées : rend le nouveau niveau si on en a gagné un. */
  grantXp: (amount: number) => number | null
  /** XP actuelle, pour le niveau d'entrée dans le lieu. */
  currentXp: () => number
  /** La partie à jour (même dans un combat qui dure) et son rangement : la fin d'un lieu y écrit le lieu terminé, l'XP du coffre, les objets. */
  getSave: () => SaveData
  persist: (next: SaveData) => void
}

export function useFight(options: FightOptions) {
  const { services, worldRef, world, demo, worldName, heroName, accommodations } = options
  const [view, setView] = useState<FightView | null>(null)
  const [phase, setPhase] = useState<Phase>('busy')
  const [question, setQuestion] = useState<{ item: Item; title: string; success: string; resolve: (o: QuestionOutcome) => void } | null>(null)
  const [dialog, setDialog] = useState<{ title: string; text: string; actions: { label: string; primary?: boolean; run: () => void }[] } | null>(null)
  const [floats, setFloats] = useState<Floating[]>([])
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null)
  const encounter = useRef<Encounter | null>(null)
  const placeSession = useRef<PlaceSession | null>(null)
  const place = useRef<Place | null>(null)
  /** Effaceurs qui se sont déjà présentés dans cette visite : après un repli, ils ne se présentent pas deux fois. */
  const taunted = useRef(new Set<string>())
  const viewRef = useRef<FightView | null>(null)
  const actionResolver = useRef<((action: Action) => void) | null>(null)
  const nextId = useRef(1)
  const latest = useRef(options)
  latest.current = options
  const texts = combatTexts(worldName)

  const show = useCallback((next: FightView | null) => {
    viewRef.current = next
    setView(next)
  }, [])

  const announce = useCallback((text: string) => {
    const id = nextId.current++
    setNotice({ id, text })
    window.setTimeout(() => setNotice((current) => (current?.id === id ? null : current)), NOTICE_MS)
  }, [])

  /**
   * Un dialogue à un bouton ; avec `voice`, un bouton « Écouter » lit ce texte enregistré (seul et à l'identique : sa voix en dépend), et
   * l'aménagement « lecture automatique » le lit d'office. Rend la main quand l'enfant a répondu.
   */
  const speak = useCallback(
    (title: string, text: string, label: string, voice?: string) =>
      new Promise<void>((resolve) => {
        const { services: s, accommodations: acc } = latest.current
        const say = () => void s.voice.say([voice ?? text])
        const done = () => {
          s.voice.stop()
          setDialog(null)
          resolve()
        }
        setDialog({
          title,
          text,
          actions: [...(voice ? [{ label: '🔊 Écouter', run: say }] : []), { label, primary: true, run: done }],
        })
        if (voice && acc.auto_read) say()
      }),
    [],
  )

  const addFloat = useCallback((f: Omit<Floating, 'id'>) => {
    const id = nextId.current++
    setFloats((list) => [...list, { ...f, id }])
    window.setTimeout(() => setFloats((list) => list.filter((x) => x.id !== id)), FLOAT_MS)
  }, [])

  // --- Un combat --------------------------------------------------------------------------

  const fightRef = useRef<(enemy: Enemy) => Promise<void>>(async () => {})
  fightRef.current = async (enemy: Enemy) => {
    const current = worldRef.current
    const interior = current?.interior
    const enc = encounter.current
    const lieu = place.current
    if (!current || !interior || !enc || !lieu) return
    const { services: s } = latest.current
    const def = lieu.dungeon
    enc.engage(enemy.combatant, {
      tier: enemy.spec.tier,
      rewardXp: enemy.spec.xp,
      boss: enemy.boss,
      baseLevels: { automatisme: s.questions.levelFor('automatisme'), chapitre: s.questions.levelFor('chapitre') },
    })
    await interior.beginFight(enemy)
    if (enemy.boss) {
      // Grand combat : le héros aborde l'Effaceur avec toutes ses forces (règle de la v1), puis l'Effaceur se présente, une seule fois par visite.
      if (enc.hero.hp < enc.hero.maxHp) {
        enc.hero.heal(enc.hero.maxHp)
        s.sfx.play('heal')
        announce('Tes forces sont rendues !')
      }
      show(viewOf(enc))
      if (!taunted.current.has(enemy.id)) {
        taunted.current.add(enemy.id)
        await speak(enemy.spec.name, def.boss_intro, 'En garde !', def.boss_intro)
      }
    }
    show(viewOf(enc))

    const host: FightHost = {
      chooseAction: (v) => {
        show(v)
        setPhase('actions')
        return new Promise<Action>((resolve) => {
          actionResolver.current = resolve
        })
      },
      ask: async (action, role, level): Promise<Answer | null> => {
        const item = s.questions.next(role, level) ?? s.questions.next()
        if (!item) {
          announce('Aucune question disponible')
          return null
        }
        const outcome = await new Promise<QuestionOutcome>((resolve) => {
          setQuestion({ item, title: combatTexts(latest.current.worldName).actions[action], success: pickOne(texts.encouragements), resolve })
        })
        setQuestion(null)
        if (!outcome.result) return null // « pas vu en classe », sans question de remplacement
        return {
          correct: outcome.result.correct,
          speedRatio: outcome.result.speedRatio,
          rewardFactor: outcome.result.rewardFactor,
          hintUsed: outcome.hintUsed,
          difficulty: outcome.item.difficulty,
        }
      },
      show: async (events) => {
        setPhase('busy')
        let shown = viewRef.current ?? viewOf(enc)
        await interior.present(events, (event) => {
          if (event.kind === 'xp') {
            const level = latest.current.grantXp(event.amount)
            if (level) {
              enc.hero.raiseMax(heroMaxHp(level))
              announce(`Niveau ${level} !`)
              shown = { ...shown, hero: { hp: enc.hero.hp, maxHp: enc.hero.maxHp } }
              show(shown)
            }
            return
          }
          shown = applyEvent(shown, event)
          show(shown)
        })
        show(viewOf(enc))
      },
    }

    // Le déroulé tourne jusqu'à la victoire ou au repli ; une action en suspens (écran quitté) ne le retient pas.
    const outcome = await runFight(enc, host)
    setPhase('busy')
    if (outcome === 'victory' && enemy.boss) {
      // L'Effaceur a le dernier mot (le héros ne bouge pas encore), puis le coffre apparaît : la page n'est pas loin.
      show(null)
      await speak(enemy.spec.name, def.boss_defeat, 'Reprendre la page', def.boss_defeat)
      await interior.endFight('victory')
      interior.revealChest()
      s.sfx.play('crit')
      announce('Un coffre est apparu !')
    } else if (outcome === 'victory') {
      show(null)
      await interior.endFight('victory')
      const { hero } = enc
      hero.heal(Math.ceil((hero.maxHp - hero.hp) / 2)) // souffle repris entre deux combats : la moitié des PV manquants
      announce(pickOne(combatTexts(latest.current.worldName).victoire))
      const kind = lieu.dungeon.rooms[enemy.room]?.kind
      if (kind === 'combat' && interior.enemiesLeft(enemy.room) === 0) {
        window.setTimeout(() => {
          interior.openDoor(enemy.room)
          announce("La porte s'ouvre !")
        }, 900)
      }
    } else {
      await speak('Repli', combatTexts(latest.current.worldName).repli, "Reprendre l'exploration")
      show(null)
      enc.hero.heal(enc.hero.maxHp)
      await interior.endFight('retreat')
    }
  }

  // Tests dans le navigateur (?e2e) : la question d'un combat, pour y répondre juste.
  useEffect(() => {
    const handle = (window as unknown as { __aldoria?: Record<string, unknown> }).__aldoria
    if (handle && question) handle.question = question.item
  }, [question])

  useEffect(() => {
    if (!world) return
    const offs = [
      world.events.on('fight', (enemy) => void fightRef.current(enemy)),
      world.events.on('float', (f) => addFloat(f)),
    ]
    return () => {
      for (const off of offs) off()
    }
  }, [world, addFloat])

  // --- Entrer, sortir ---------------------------------------------------------------------

  /** Ouvre la session du lieu puis son intérieur ; « session » : le serveur n'a pas répondu, « scene » : l'intérieur n'a pas pu se dresser. */
  const enter = useCallback(
    async (target: Place, onProgress?: (label: string, ratio: number) => void): Promise<'ok' | 'session' | 'scene'> => {
      const w = worldRef.current
      if (!w) return 'scene'
      const opened = await startPlaceSession(services, target.dungeon, demo)
      if (!opened) return 'session'
      placeSession.current = opened
      try {
        const entered = await w.enterPlace(target.dungeon.code, onProgress)
        if (!entered) throw new Error('lieu inconnu')
      } catch (error) {
        console.error(error)
        await opened.end()
        placeSession.current = null
        return 'scene'
      }
      place.current = target
      taunted.current = new Set()
      const level = levelForXp(latest.current.currentXp())
      encounter.current = new Encounter(new Combatant(heroName, heroMaxHp(level)), {
        world: worldName,
        noSpeed: accommodations.no_speed,
      })
      const handle = (window as unknown as { __aldoria?: Record<string, unknown> }).__aldoria
      if (handle) handle.encounter = encounter.current // tests dans le navigateur (?e2e)
      return 'ok'
    },
    [services, demo, worldRef, heroName, worldName, accommodations.no_speed],
  )

  /** Sort du lieu : l'île reprend, la session de l'île aussi. */
  const leave = useCallback(async () => {
    worldRef.current?.leavePlace()
    encounter.current = null
    place.current = null
    show(null)
    const closing = placeSession.current
    placeSession.current = null
    await closing?.end()
  }, [worldRef, show])

  /**
   * Le héros ouvre le coffre de l'Effaceur : le lieu est terminé (XP du coffre, deux objets, page rendue la première fois), l'île s'allume
   * pour le lieu suivant, puis retour sur l'île. Rend si c'était la première fois (Maître Ysaline salue alors le héros) et le lieu.
   */
  const openChest = useCallback(async (): Promise<{ first: boolean; code: string } | null> => {
    const w = worldRef.current
    const interior = w?.interior
    const lieu = place.current
    if (!w || !interior || !lieu || !interior.chestReady) return null
    const { services: s, getSave, persist } = latest.current
    interior.openChest()
    s.sfx.play('victory')
    await new Promise<void>((resolve) => window.setTimeout(resolve, 900)) // le couvercle se lève
    const before = getSave()
    const done = completePlace(before, lieu.dungeon)
    persist(done.save)
    w.placeCompleted(done.save.places)
    const message = chestMessage(lieu.dungeon, { first: done.first, answered: s.questions.answered, correct: s.questions.correctCount, found: done.found })
    const level = levelForXp(done.save.xp)
    const text = level > levelForXp(before.xp) ? `${message.text}\nNiveau ${level} !` : message.text
    const code = lieu.dungeon.code
    await speak(message.title, text, "Retour sur l'île")
    await leave()
    return { first: done.first, code }
  }, [worldRef, speak, leave])

  const choose = useCallback((action: Action) => {
    const resolve = actionResolver.current
    if (!resolve) return
    actionResolver.current = null
    resolve(action)
  }, [])

  const hud: ReactNode = (
    <>
      {view && <FightBars view={view} heroName={heroName} />}
      {view && phase === 'actions' && !question && !dialog && <ActionBar world={worldName} canHeal={view.canHeal} onChoose={choose} />}
      <Floats items={floats} />
      {notice && (
        <div key={notice.id} className="notice" data-testid="annonce">
          {notice.text}
        </div>
      )}
    </>
  )

  const overlay: ReactNode = (
    <>
      {question && (
        <QuestionPanel
          services={services}
          item={question.item}
          title={question.title}
          gameMode="combat"
          success={question.success}
          accommodations={accommodations}
          onDone={question.resolve}
        />
      )}
      {dialog && <Dialog title={dialog.title} text={dialog.text} actions={dialog.actions} />}
    </>
  )

  return { hud, overlay, enter, leave, openChest, active: view !== null || dialog !== null, questionOpen: question !== null, overlayOpen: question !== null || dialog !== null }
}
