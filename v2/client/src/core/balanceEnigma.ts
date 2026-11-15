/**
 * La balance géante de la salle-énigme (Tour des Fractions, pré-algèbre de Jules ; v1 : scenes/dungeon/balance_enigma.gd) : la question se résout sur
 * la balance elle-même. L'enfant peut enlever la même chose des deux côtés (elle reste en équilibre : c'est le raisonnement de la pré-algèbre), puis essaie
 * une masse pour une boîte ; chaque boîte affiche la masse essayée et le fléau penche : trop lourd, trop léger ou juste. **Seul le premier essai est enregistré
 * comme réponse** (suivi des notions) ; les suivants servent à corriger, comme avec une vraie balance. Pur : une manche est un état rendu neuf à chaque geste ;
 * l'interface (ui/BalanceEnigma.tsx) l'affiche et la scène (game/balanceRig.ts) dessine la balance sans rien décider.
 */
import {
  balanceFrom, canRemove, removeBoth, sideText, type BalanceNames, type BalanceState, type Side,
} from './visuals'

/** Manches d'une énigme (trois fois de suite). */
export const BALANCE_ROUNDS = 3
/** La masse qu'on peut essayer, de 0 à ce maximum. */
export const MAX_GUESS = 40

/** Le côté le plus lourd : -1 à gauche, 0 en équilibre, 1 à droite. */
export type Heavier = -1 | 0 | 1

export interface BalanceRound {
  /** Ce qui est sur les plateaux (les retraits des deux côtés le changent). */
  state: BalanceState
  names: BalanceNames
  /** La masse proposée pour une boîte. */
  guess: number
  /** Essais faits sur la balance (le premier seul est enregistré). */
  tries: number
  hintUsed: boolean
  /** La balance s'est mise en équilibre : la manche est finie. */
  done: boolean
  /** Le dernier côté le plus lourd montré (le fléau penche de ce côté) ; en équilibre avant tout essai. */
  heavier: Heavier
  /** La masse écrite sur chaque boîte (essai montré), null avant le premier essai ou après un retrait. */
  shown: number | null
}

/** Une manche qui commence : la balance en équilibre, telle que la question la décrit. */
export function startRound(visual: Record<string, unknown> | null | undefined): BalanceRound {
  const { state, names } = balanceFrom(visual ?? {})
  return { state, names, guess: 1, tries: 0, hintUsed: false, done: false, heavier: 0, shown: null }
}

/** Une question de balance se joue sur la balance géante seulement si elle décrit des plateaux (jamais une question sans visuel). */
export function isBalanceItem(item: { visual?: Record<string, unknown> | null }): boolean {
  const visual = item.visual
  return !!visual && visual.kind === 'balance' && typeof visual.left === 'object' && typeof visual.right === 'object'
}

/** Les boîtes sont-elles seulement d'un côté ? Alors « enlever une boîte de chaque côté » ne servirait jamais. */
export function boxesBothSides(round: BalanceRound): boolean {
  return round.state.right.boxes > 0
}

export function canRemoveBoth(round: BalanceRound, what: keyof Side): boolean {
  return !round.done && canRemove(round.state, what)
}

/** Enlève la même chose des deux côtés : la balance reste en équilibre (le fléau se redresse, l'essai montré s'efface). */
export function removeFromBoth(round: BalanceRound, what: keyof Side): BalanceRound {
  if (!canRemoveBoth(round, what)) return round
  return { ...round, state: removeBoth(round.state, what), heavier: 0, shown: null }
}

export function canStep(round: BalanceRound, delta: number): boolean {
  if (round.done) return false
  const next = round.guess + delta
  return next >= 0 && next <= MAX_GUESS
}

/** La masse proposée monte ou descend (jamais hors de 0 à `MAX_GUESS`). */
export function stepGuess(round: BalanceRound, delta: number): BalanceRound {
  if (round.done) return round
  return { ...round, guess: Math.min(MAX_GUESS, Math.max(0, round.guess + delta)) }
}

export function useHint(round: BalanceRound): BalanceRound {
  return round.hintUsed ? round : { ...round, hintUsed: true }
}

/** La masse d'un plateau quand chaque boîte pèse `guess`. */
export function massOf(side: Side, guess: number): number {
  return side.boxes * guess + side.units
}

/** Quel côté est le plus lourd quand chaque boîte pèse `guess`. */
export function weigh(state: BalanceState, guess: number): Heavier {
  const left = massOf(state.left, guess)
  const right = massOf(state.right, guess)
  return left === right ? 0 : left > right ? -1 : 1
}

// --- Les mots -----------------------------------------------------------------------------------

/** « Une boîte », « Un sac » : le genre suit le mot (la boîte est féminine, le sac masculin). */
function feminine(names: BalanceNames): boolean {
  return names.box[0] === 'boîte'
}

export const article = (names: BalanceNames): string => (feminine(names) ? 'Une' : 'Un')

/** « À gauche : 1 boîte et 4 billes. À droite : 10 billes. » (aussi la phrase lue à voix haute). */
export function describe(state: BalanceState, names: BalanceNames): string {
  return `À gauche : ${sideText(state.left, names)}. À droite : ${sideText(state.right, names)}.`
}

/** La consigne : « Au départ, la balance est en équilibre. Toutes les boîtes ont la même masse. Combien de billes pèse une boîte ? » */
export function instruction(names: BalanceNames): string {
  const all = feminine(names) ? `Toutes les ${names.box[1]} ont la même masse.` : `Tous les ${names.box[1]} ont la même masse.`
  return `Au départ, la balance est en équilibre. ${all} Combien de ${names.unit[1]} pèse ${article(names).toLowerCase()} ${names.box[0]} ?`
}

/** Ce que lit un lecteur d'écran : l'état des plateaux puis la question. */
export function spoken(round: BalanceRound): string {
  return `${describe(round.state, round.names)} Combien de ${round.names.unit[1]} pèse ${article(round.names).toLowerCase()} ${round.names.box[0]} ?`
}

export const REMOVED_MESSAGE = 'Même chose enlevée des deux côtés : la balance reste en équilibre.'

export function removeLabel(round: BalanceRound, what: keyof Side): string {
  return `Enlever 1 ${what === 'boxes' ? round.names.box[0] : round.names.unit[0]} de chaque côté`
}

export interface Attempt {
  round: BalanceRound
  /** Premier essai de la manche : c'est lui qui est enregistré comme réponse à la question. */
  first: boolean
  /** Le côté le plus lourd montré. */
  heavier: Heavier
  /** En équilibre : la manche est gagnée. */
  balanced: boolean
  message: string
  tone: 'good' | 'bad'
}

/**
 * Un essai : chaque boîte prend la masse choisie, le fléau penche du côté le plus lourd. En équilibre, la manche est finie (l'explication de la question
 * s'ajoute après une correction). Sinon le message dit le côté, la masse essayée et le sens de la correction **sans donner la réponse** ; l'indice sort au
 * troisième essai.
 */
export function attempt(round: BalanceRound, question: { hint?: string; explanation?: string }): Attempt {
  const tries = round.tries + 1
  const heavier = weigh(round.state, round.guess)
  const { names } = round
  const base = { ...round, tries, heavier, shown: round.guess }
  if (heavier === 0) {
    let message = `En équilibre ! ${article(names)} ${names.box[0]} pèse ${round.guess} ${names.unit[1]}.`
    if (tries > 1 && question.explanation) message += ` ${question.explanation}`
    return { round: { ...base, done: true }, first: tries === 1, heavier, balanced: true, message, tone: 'good' }
  }
  // Les boîtes sont plus nombreuses d'un côté : si ce côté est le plus lourd, c'est qu'une boîte pèse trop ; sinon, trop peu.
  const boxesLeft = round.state.left.boxes >= round.state.right.boxes
  const tooHeavy = (heavier === -1) === boxesLeft
  const she = feminine(names)
  const adjective = tooHeavy ? (she ? 'lourde' : 'lourd') : she ? 'légère' : 'léger'
  let message = `La balance penche ${heavier === -1 ? 'à gauche' : 'à droite'} : avec ${round.guess} ${names.unit[1]}, ${she ? 'la' : 'le'} ${names.box[0]} est trop ${adjective}. Essaie ${tooHeavy ? 'moins' : 'plus'}.`
  if (tries >= 3 && !round.hintUsed && question.hint) message += ` ${question.hint}`
  return { round: base, first: tries === 1, heavier, balanced: false, message, tone: 'bad' }
}

/** XP d'une manche : toute celle de l'énigme si la masse est trouvée du premier coup, la moitié (arrondie au-dessus) après une correction. */
export function roundXp(fullXp: number, firstTry: boolean): number {
  return firstTry ? fullXp : Math.ceil(fullXp / 2)
}
