/**
 * Une traversée de l'île du Sphinx : les textes et le déroulé d'une énigme, repris de la v1 (scenes/sphinx/sphinx.gd), sans écran. L'interface
 * (ui/SphinxVisit.tsx, ui/SphinxPuzzle.tsx) ne décide de rien : elle lit ces fonctions et range la partie.
 *
 * Une traversée coûte un passage et propose `VISIT_PUZZLES` énigmes ; trois énigmes de suite sans l'aide du Sphinx font monter d'un palier.
 */
import { HOW_TO_EARN, VISIT_PUZZLES, type SphinxLevel } from './island'
import { SphinxBoard } from './board'

/** Étape de l'histoire : le Sphinx s'est présenté (la première traversée seulement). */
export const STORY_KEY = 'sphinx-vu'

/** Le Sphinx accueille l'enfant : la présentation complète la première fois, un mot ensuite. */
export function welcomeText(first: boolean): string {
  if (!first) return `Te revoilà, Archiviste ! ${VISIT_PUZZLES} énigmes t'attendent dans mon temple.`
  return (
    "Bienvenue sur mon île, jeune Archiviste. Je suis le Sphinx, gardien de ce temple. Ici, pas de leçon à réciter : il faut réfléchir. " +
    'Pousse les blocs de pierre jusqu\'aux dalles gravées. Tu peux pousser un bloc, jamais le tirer. Si un bloc se coince, annule ton ' +
    "dernier pas ou recommence. Et si tu sèches, demande mon aide. Pour marcher : les flèches du clavier (ou Z, Q, S, D), ou touche une dalle."
  )
}

/** Sans passage, la barque ne part pas. */
export function noPassageText(): string {
  return `Tu n'as pas de passage pour l'île. ${HOW_TO_EARN}`
}

export interface Solved {
  moves: number
  pushes: number
  /** Combien de fois l'enfant a demandé l'aide du Sphinx. */
  hints: number
  /** Poussées de la solution la plus courte (`SphinxLevel.pushes`). */
  best: number
  /** On vient de monter d'un palier ; `tier` : le palier atteint. */
  up: boolean
  tier: number
}

const plural = (n: number, one: string, many: string): string => (n > 1 ? many : one)

/** Ce que dit le Sphinx d'une énigme résolue. */
export function celebrateLines(r: Solved): string[] {
  const lines = [`Résolue en ${r.moves} pas et ${r.pushes} ${plural(r.pushes, 'poussée', 'poussées')}.`]
  if (r.hints === 0 && r.pushes <= r.best) lines.push("Le moins de poussées possible : même moi, je n'aurais pas fait mieux !")
  else if (r.hints > 0) lines.push('Avec mon aide, cette fois. La prochaine, tu la trouveras seul.')
  if (r.up) lines.push(`Tu es digne d'énigmes plus difficiles : palier ${r.tier} !`)
  return lines
}

/** Le bilan de la traversée : les énigmes de cette visite, et le total des sceaux du Sphinx gagnés. */
export function finishText(solvedNow: number, solvedTotal: number): string {
  return `Énigmes résolues pendant cette traversée : ${solvedNow}. Sceaux du Sphinx gagnés en tout : ${solvedTotal}. La barque te ramène sur la grande île.`
}

/** Le bandeau d'une énigme : « Énigme du temple 2 / 3 », « Palier 2 · 12 pas · 3 poussées ». */
export function statusLine(round: number, tier: number, board: Pick<SphinxBoard, 'moves' | 'pushes'>): { title: string; detail: string } {
  return {
    title: `Énigme du temple ${round + 1} / ${VISIT_PUZZLES}`,
    detail: `Palier ${tier} · ${board.moves} pas · ${board.pushes} ${plural(board.pushes, 'poussée', 'poussées')}`,
  }
}

/** Le plateau d'une énigme (une nouvelle partie à chaque appel : le plateau garde son historique). */
export const boardFor = (level: Pick<SphinxLevel, 'rows'>): SphinxBoard => SphinxBoard.fromRows(level.rows)

/**
 * Ce que l'écran dit après un pas : un bloc poussé, un bloc coincé (à annuler), ou rien. `stuck` : indice d'un bloc coincé, -1 sinon.
 * Annoncé par `role="status"` : un lecteur d'écran sait où on en est sans voir le plateau.
 */
export function stepMessage(moved: boolean, pushed: boolean, stuck: number): string {
  if (!moved) return 'Ça ne bouge pas : un mur, ou un bloc qu\'on ne peut pas pousser.'
  if (stuck >= 0) return 'Un bloc est coincé dans un coin : annule ton dernier pas ou recommence.'
  return pushed ? 'Bloc poussé.' : ''
}

/** Une description du plateau pour un lecteur d'écran. */
export function boardSummary(board: Pick<SphinxBoard, 'width' | 'height' | 'boxes' | 'goals'>): string {
  const n = board.boxes.length
  const g = board.goals.length
  return `Temple de ${board.width} colonnes et ${board.height} rangées : ${n} ${plural(n, 'bloc', 'blocs')} à pousser sur ${g} ${plural(g, 'dalle gravée', 'dalles gravées')}.`
}
