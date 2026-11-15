/**
 * La Lice (le plateau d'exercices de la Citadelle) : le Pont des fractions (6e) et le stand de tir (6e : rapporteur géant, 2nde : droite de l'arbalète). Portée de la v1
 * (scenes/pont/pont.gd, scenes/tir/tir.gd) : une **série de six** cibles ou ravins, sans chrono ; seul le premier essai de chaque cible compte comme réponse
 * (suivi des notions), les suivants servent à corriger et rapportent moitié moins d'XP. Pur et testé : les règles propres à chaque jeu sont dans core/pont.ts
 * et core/tir.ts, l'écran de chaque jeu dans ui/.
 */
import { answerXp } from './progression'

export type LiceKind = 'pont' | 'tir'

/** Cibles ou ravins d'une série. */
export const ROUNDS = 6

/** `game_mode` des réponses (suivi côté serveur). */
export const GAME_MODE: Record<LiceKind, string> = { pont: 'pont', tir: 'tir' }

/** Générateur d'énigme de chaque jeu selon la classe : absent, ce jeu n'existe pas encore pour cette classe. */
const GENERATORS: Record<LiceKind, Record<string, string>> = {
  pont: { '6e': '6e.fractions.pont' },
  tir: { '6e': '6e.angles.tir', '2nde': '2nde.droites.tir' },
}

export function generatorFor(kind: LiceKind, level: string): string | null {
  return GENERATORS[kind][level] ?? null
}

/** Ce que le serveur doit composer au lancement (`POST /play/session/start`, mode « arene ») : deux cibles d'avance. */
export function sessionParams(kind: LiceKind, level: string): { enigma: { generator: string; count: number } } | null {
  const generator = generatorFor(kind, level)
  return generator ? { enigma: { generator, count: ROUNDS + 2 } } : null
}

export interface LiceState {
  /** Cibles ou ravins terminés. */
  round: number
  /** Réussis dès le premier essai. */
  firstTry: number
  /** XP gagnée pendant la série. */
  xp: number
}

export const START: LiceState = { round: 0, firstTry: 0, xp: 0 }

export const isOver = (state: LiceState): boolean => state.round >= ROUNDS

/** XP d'une cible réussie : 15 plus la valeur de la question, moitié moins (arrondi au-dessus) après un premier essai raté. */
export function roundGain(difficulty: number, tries: number): number {
  const gain = 15 + answerXp(difficulty)
  return tries <= 1 ? gain : Math.ceil(gain / 2)
}

/** La cible est réussie après `tries` essais : l'état suivant et ce qu'elle a rapporté. */
export function finishRound(state: LiceState, difficulty: number, tries: number): { state: LiceState; gain: number } {
  const gain = roundGain(difficulty, tries)
  return { gain, state: { round: state.round + 1, firstTry: state.firstTry + (tries <= 1 ? 1 : 0), xp: state.xp + gain } }
}

export const TITLES: Record<LiceKind, string> = { pont: 'Le pont des fractions', tir: 'Le stand de tir' }

/** Le texte d'ouverture (v1) : le tir de 6e mesure un angle au rapporteur, celui de 2nde donne le coefficient directeur de la droite de l'arbalète. */
export function introText(kind: LiceKind, level: string): string {
  if (kind === 'pont') {
    return 'Un gouffre coupe le chemin. Pour passer, pose des planches bout à bout. Chaque planche mesure une fraction de perche. Le pont magique ne tient que si les planches couvrent exactement le ravin : ni plus court, ni plus long.'
  }
  if (level === '2nde') {
    return "Le mur de tir est un repère. Ton arbalète est sur l'axe des ordonnées ; le carreau file en ligne droite. Donne le coefficient directeur qui mène à la cible. Si tu rates, regarde sa trace et corrige."
  }
  return "Un rapporteur géant est peint au sol. Mesure l'angle entre la ligne de départ et la cible, puis tire. Ta flèche part exactement dans la direction choisie : si tu rates, regarde où elle est allée et corrige."
}

export const START_LABEL: Record<LiceKind, string> = { pont: 'Au premier ravin !', tir: 'À mes cibles !' }

const NAME: Record<LiceKind, string> = { pont: 'Ravin', tir: 'Cible' }

/** « Ravin 2 / 6 », « Cible 2 / 6 » (la série en cours : le tour est celui qu'on joue, pas celui qui est fini). */
export const roundLabel = (kind: LiceKind, state: LiceState): string => `${NAME[kind]} ${Math.min(state.round + 1, ROUNDS)} / ${ROUNDS}`

export const statusLine = (kind: LiceKind, state: LiceState): string => `${roundLabel(kind, state)} · ${state.firstTry} du premier coup`

/** Ce que dit la réussite d'une cible ; au deuxième essai ou plus, l'explication de la question s'y ajoute. */
export function successText(kind: LiceKind, gain: number, tries: number, explanation: string): string {
  const base = kind === 'pont' ? `Le pont tient ! +${gain} XP.` : `En plein cœur ! +${gain} XP.`
  return tries > 1 && explanation ? `${base} ${explanation}` : base
}

export const finishTitle = (kind: LiceKind): string => (kind === 'pont' ? "Fin de l'expédition" : 'Fin de la série')

export function finishText(kind: LiceKind, state: LiceState): string {
  const what = kind === 'pont' ? 'Ravins franchis' : 'Cibles touchées'
  return `${what} du premier coup : ${state.firstTry}. +${state.xp} XP.`
}

/** Sans paquet (connexion perdue) : les cibles ne sont pas prêtes. */
export const NOT_READY: Record<LiceKind, string> = {
  pont: 'Les planches ne sont pas prêtes (connexion perdue ?). Reviens tout à l’heure.',
  tir: 'Les cibles ne sont pas prêtes (connexion perdue ?). Reviens tout à l’heure.',
}

/** Une série n'est lancée que pour une classe qui a ce jeu. */
export const noGameText = (kind: LiceKind): string =>
  kind === 'pont' ? 'Le pont des fractions attend la classe de Jules : il n’y en a pas encore pour toi.' : 'Le stand de tir n’est pas encore ouvert pour ta classe.'
