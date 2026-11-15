/**
 * La reprise d'un lieu (v1 : `SaveManager.set_checkpoint`, `dungeon.gd` `_checkpoint`) : un enfant qui quitte un lieu en plein milieu (la séance se termine, l'heure du dîner)
 * le retrouve à la salle qu'il avait atteinte, les portes d'avant ouvertes et leurs ennemis vaincus, au lieu de tout refaire depuis l'entrée. Le point de reprise est la salle
 * où l'on entre quand on franchit la porte qui vient de s'ouvrir (combat vaincu, énigme résolue) ; il s'efface quand le lieu est terminé (le coffre : il se rejoue depuis l'entrée).
 * Pur et testé sans moteur ; un état se rend toujours neuf (jamais modifié sur place).
 *
 * Seule la **salle** est gardée : les cristaux, les manches de la balance et les ennemis de la salle en cours reviennent à neuf (comme dans la v1, qui ne gardait pas non plus les
 * blessures d'un ennemi à la reprise).
 */
import type { SaveData } from './save'

/** Lieu (code) → salle de reprise (1 et plus : 0 est l'entrée, rien à reprendre). */
export type Checkpoints = Record<string, number>

/** Lieux gardés au plus (il y en a 30 : la limite ne protège que d'une partie abîmée). */
export const MAX_CHECKPOINTS = 100
export const MAX_CODE = 60
/** Une salle de plus que ce que n'importe quel lieu a (6) : une valeur plus grande est une partie abîmée. */
export const MAX_ROOM = 20

/** Points de reprise relus d'une partie ancienne ou abîmée : codes non vides, salles entières de 1 à `MAX_ROOM`, `MAX_CHECKPOINTS` lieux au plus. */
export function normalizeCheckpoints(raw: unknown): Checkpoints {
  const given = (typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
  const out: Checkpoints = {}
  for (const [code, room] of Object.entries(given)) {
    const clean = code.trim().slice(0, MAX_CODE)
    if (clean === '' || typeof room !== 'number' || !Number.isFinite(room)) continue
    const n = Math.floor(room)
    if (n < 1 || n > MAX_ROOM) continue
    if (!(clean in out) && Object.keys(out).length >= MAX_CHECKPOINTS) continue
    out[clean] = n
  }
  return out
}

/** La salle où l'on reprend ce lieu : 0 (l'entrée) sans point de reprise, jamais au-delà de la dernière salle (`rooms` : le nombre de salles du lieu). */
export function checkpointOf(save: Pick<SaveData, 'checkpoints'>, code: string, rooms: number): number {
  const room = save.checkpoints[code] ?? 0
  return Math.min(Math.max(0, Math.floor(room)), Math.max(0, rooms - 1))
}

/**
 * La salle `room` est atteinte : la partie garde ce point de reprise. Jamais en arrière (une salle d'avant, retrouvée en revenant, ne fait pas perdre la progression) et jamais
 * au-delà de la dernière salle ; 0 ne garde rien. Rend la même partie quand rien ne change.
 */
export function withCheckpoint<T extends Pick<SaveData, 'checkpoints'>>(save: T, code: string, room: number, rooms: number): T {
  const wanted = Math.min(Math.max(0, Math.floor(room)), Math.max(0, rooms - 1))
  const before = save.checkpoints[code] ?? 0
  if (wanted < 1 || wanted <= before) return save
  if (!(code in save.checkpoints) && Object.keys(save.checkpoints).length >= MAX_CHECKPOINTS) return save
  return { ...save, checkpoints: { ...save.checkpoints, [code]: wanted } }
}

/** Le lieu est terminé : il se rejoue depuis l'entrée. */
export function withoutCheckpoint<T extends Pick<SaveData, 'checkpoints'>>(save: T, code: string): T {
  if (!(code in save.checkpoints)) return save
  const { [code]: _gone, ...rest } = save.checkpoints
  return { ...save, checkpoints: rest }
}

/** « Tu reprendras à l'étage 3. » (au seuil du lieu), vide quand on entre par la porte. */
export function resumeText(room: number): string {
  return room > 0 ? `Tu reprendras à l'étage ${room + 1}.` : ''
}

/** « Reprise : La Salle des Quarts » (le bandeau à l'entrée), ou vide. */
export function resumeBanner(room: number, titles: readonly string[]): string {
  const title = room > 0 ? titles[room] : undefined
  return title ? `Reprise : ${title}` : ''
}
