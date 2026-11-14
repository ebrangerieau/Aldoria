/**
 * Déroulé d'un combat, sans interface ni moteur : on choisit une action, une question se pose, le
 * verdict va à `Encounter.answer`, ce qui s'est passé est raconté (coup, soin, riposte, chute), et on
 * recommence jusqu'à la victoire ou au repli. L'hôte (ui/GameScreen.tsx et game/interior.ts) fournit
 * les trois choses qui prennent du temps et dépendent de l'écran : le choix de l'enfant, la question,
 * la mise en scène. Rien ici ne connaît le contenu d'une question.
 */
import type { Action, Answer, CombatEvent, Encounter, Outcome, QuestionRole } from './encounter'

/** Ce que l'interface montre d'un combat à un instant. */
export interface FightView {
  hero: { hp: number; maxHp: number }
  foe: { name: string; hp: number; maxHp: number }
  boss: boolean
  /** Le soin n'est proposé qu'à un héros blessé. */
  canHeal: boolean
  /** Questions posées dans ce combat. */
  questions: number
}

export interface FightHost {
  /** L'enfant choisit son action. */
  chooseAction(view: FightView): Promise<Action>
  /**
   * Pose une question pour cette action (`level` : difficulté imposée par un boss, 0 sinon) et rend le verdict.
   * null : aucune question à poser (rien de disponible, ou « pas vu en classe » sans remplaçante) : on revient aux actions.
   */
  ask(action: Action, role: QuestionRole, level: number): Promise<Answer | null>
  /** Raconte, dans l'ordre, ce qui vient de se passer ; `view` : l'état à la fin du tour. */
  show(events: CombatEvent[], view: FightView): Promise<void>
}

/** L'état affiché après un événement, pour que les barres de PV bougent au moment du coup et non à la fin du tour. */
export function applyEvent(view: FightView, event: CombatEvent): FightView {
  switch (event.kind) {
    case 'hero_strike':
      return { ...view, foe: { ...view.foe, hp: Math.max(0, view.foe.hp - event.power) } }
    case 'hero_heal':
    case 'potion':
      return { ...view, hero: { ...view.hero, hp: Math.min(view.hero.maxHp, view.hero.hp + event.healed) } }
    case 'foe_attack':
      return { ...view, hero: { ...view.hero, hp: Math.max(0, view.hero.hp - event.damage) } }
    default:
      return view
  }
}

export function viewOf(encounter: Encounter): FightView {
  const { hero, foe } = encounter
  return {
    hero: { hp: hero.hp, maxHp: hero.maxHp },
    foe: { name: foe.name, hp: foe.hp, maxHp: foe.maxHp },
    boss: encounter.isBoss,
    canHeal: encounter.canHeal,
    questions: encounter.questions,
  }
}

/** Joue le combat ouvert de `encounter` (`engage` déjà appelé) jusqu'à son issue. */
export async function runFight(encounter: Encounter, host: FightHost): Promise<Outcome> {
  for (;;) {
    const action = await host.chooseAction(viewOf(encounter))
    const role = encounter.roleOf(action)
    const answer = await host.ask(action, role, encounter.questionLevel(role))
    if (!answer) continue
    const turn = encounter.answer(action, answer)
    await host.show(turn.events, viewOf(encounter))
    if (turn.outcome) return turn.outcome
  }
}
