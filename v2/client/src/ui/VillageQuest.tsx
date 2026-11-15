/**
 * Un habitant de Clairval (ou de Brumegarde) confie sa quête du jour : trois questions, puis sa récompense (XP, un objet, parfois un passage pour la barque du
 * Sphinx). Règles, textes et récompense dans core/village.ts (testé) ; ici seulement l'enchaînement des écrans, comme le défi du jour. « Plus tard » et la
 * sortie à tout moment ramènent à l'île : une quête interrompue ne compte pas. Une quête déjà faite ce jour-là ne se refait pas (l'habitant le dit).
 */
import { useEffect, useRef, useState } from 'react'
import { islandContext, startVillageSession, type VillageSession } from '../app/villageSession'
import type { Services } from '../app/services'
import type { Accommodations } from '../core/accessibility'
import { today as localDay } from '../core/dailyChallenge'
import type { Item } from '../core/items'
import type { SaveData } from '../core/save'
import type { WorldName } from '../game/theme'
import { askText, completeQuest, DONE_TEXT, GAME_MODE, NO_QUESTION_TEXT, QUEST_SIZE, questDone, type Village, type Villager, veilleChapters } from '../core/village'
import { E2eQuestion } from './E2eQuestion'
import { QuestionPanel, type QuestionAids, type QuestionOutcome } from './QuestionPanel'

type Phase =
  | { kind: 'ask' }
  | { kind: 'preparing' }
  | { kind: 'unavailable' }
  | { kind: 'empty' }
  | { kind: 'question'; item: Item }
  | { kind: 'thanks'; lines: string[] }

function Card({ services, accommodations, npc, lines, actions }: {
  services: Services
  accommodations: Accommodations
  npc: Villager
  lines: string[]
  actions: { label: string; primary?: boolean; run: () => void }[]
}) {
  const paragraphs = lines.flatMap((line) => line.split('\n'))
  const text = paragraphs.join(' ')
  /** Jeton de la dernière lecture lancée par cette carte : à la fermeture, on ne coupe que celle-là (jamais la voix d'un dialogue qui s'ouvre). */
  const spoke = useRef<number | null>(null)
  const say = () => {
    void services.voice.say([text])
    spoke.current = services.voice.token
  }
  // Comme les dialogues de Maître Ysaline : « Écouter », et lecture d'office avec la « lecture automatique » (aménagement des enfants dys).
  useEffect(() => {
    if (accommodations.auto_read) say()
    return () => {
      if (spoke.current !== null) services.voice.stopIf(spoke.current, 'dialogue d’habitant')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="habitant-titre" data-testid="habitant">
      <section className="panel dialog">
        <h2 id="habitant-titre">{npc.name}</h2>
        {paragraphs.map((line, i) => <p key={i}>{line}</p>)}
        <div className="actions">
          <button type="button" className="secondary" data-testid="habitant-ecouter" onClick={say}>🔊 Écouter</button>
          {actions.map((a, i) => (
            <button key={a.label} type="button" className={a.primary ? 'primary' : 'secondary'} autoFocus={i === actions.length - 1} onClick={a.run}>
              {a.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

export function VillageQuest({ services, accommodations, demo, data, village, npc, world, aids, onSave, onCheer, onClose }: {
  services: Services
  accommodations: Accommodations
  demo: boolean
  data: SaveData
  village: Village
  npc: Villager
  world: WorldName
  aids: QuestionAids
  /** Range la partie à la fin de la quête (XP, objet, quête du jour, passage). */
  onSave: (next: SaveData) => void
  /** L'habitant se réjouit (le monde joue son geste). */
  onCheer: () => void
  onClose: () => void
}) {
  const day = localDay()
  const [phase, setPhase] = useState<Phase>({ kind: 'ask' })
  const [index, setIndex] = useState(0)
  const sessionRef = useRef<VillageSession | null>(null)
  const savedRef = useRef(data) // la partie la plus récente, même entre deux rendus
  savedRef.current = data
  const correct = useRef(0)
  const done = questDone(data, npc.code, day)

  // Une quête interrompue (Plus tard, changement d'écran) referme sa session et rouvre celle de l'île.
  useEffect(
    () => () => {
      void sessionRef.current?.end()
      sessionRef.current = null
    },
    [],
  )

  function nextQuestion(asked: number) {
    const context = sessionRef.current?.context ?? islandContext(services)
    const item = services.questions.nextQuestItem(npc.quest, npc.generator ?? '', veilleChapters(context))
    if (!item) {
      void sessionRef.current?.end()
      sessionRef.current = null
      return setPhase({ kind: 'empty' })
    }
    setIndex(asked)
    setPhase({ kind: 'question', item })
  }

  async function begin() {
    setPhase({ kind: 'preparing' })
    const started = await startVillageSession(services, village, demo)
    if (!started) return setPhase({ kind: 'unavailable' })
    sessionRef.current = started
    correct.current = 0
    nextQuestion(0)
  }

  function answered(outcome: QuestionOutcome) {
    if (outcome.result === null) return nextQuestion(index) // « Pas vu en classe » sans remplaçante : une autre question, rien n'est compté
    if (outcome.result.correct) correct.current += 1
    const asked = index + 1
    if (asked < QUEST_SIZE) return nextQuestion(asked)
    const report = completeQuest(savedRef.current, npc, correct.current, { day, world, level: services.session.profile?.level ?? '6e' })
    onSave(report.save)
    services.sfx.play('victory')
    onCheer()
    void sessionRef.current?.end()
    sessionRef.current = null
    setPhase({ kind: 'thanks', lines: report.lines })
  }

  const e2e = new URLSearchParams(location.search).has('e2e')
  return (
    <>
      {phase.kind === 'ask' && done && <Card services={services} accommodations={accommodations} npc={npc} lines={[DONE_TEXT]} actions={[{ label: 'À demain !', primary: true, run: onClose }]} />}
      {phase.kind === 'ask' && !done && (
        <Card
          services={services}
          accommodations={accommodations}
          npc={npc}
          lines={[askText(npc, islandContext(services))]}
          actions={[{ label: 'Plus tard', run: onClose }, { label: "Je t'aide !", primary: true, run: () => void begin() }]}
        />
      )}
      {phase.kind === 'preparing' && (
        <div className="overlay" role="status" data-testid="habitant">
          <section className="panel dialog"><p>{npc.name} prépare ses notes…</p></section>
        </div>
      )}
      {phase.kind === 'unavailable' && (
        <Card services={services} accommodations={accommodations} npc={npc} lines={['Il faut une connexion pour préparer cette quête. Reviens quand le royaume sera de nouveau connecté.']} actions={[{ label: "Retour à l'île", primary: true, run: onClose }]} />
      )}
      {phase.kind === 'empty' && <Card services={services} accommodations={accommodations} npc={npc} lines={[NO_QUESTION_TEXT]} actions={[{ label: "D'accord", primary: true, run: onClose }]} />}
      {phase.kind === 'question' && (
        <>
          {e2e && <E2eQuestion item={phase.item} />}
          <QuestionPanel
            key={`${index}-${phase.item.id}`}
            services={services}
            item={phase.item}
            title={`${npc.title} · ${index + 1} / ${QUEST_SIZE}`}
            gameMode={GAME_MODE}
            success="Bravo !"
            aids={aids}
            accommodations={accommodations}
            onDone={answered}
          />
        </>
      )}
      {phase.kind === 'thanks' && <Card services={services} accommodations={accommodations} npc={npc} lines={phase.lines} actions={[{ label: 'Avec plaisir !', primary: true, run: onClose }]} />}
    </>
  )
}
