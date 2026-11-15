/**
 * Clairval (6e) et Brumegarde (2nde), le village de l'île : portés de la v1 (worlds/shared/village_def.gd, scenes/village/village.gd). Chaque habitant confie une
 * quête de trois questions **par jour** :
 * - `revision` : des notions à revoir (révision espacée, catégorie « revision » du paquet) ;
 * - `veille` : le chapitre « contrôle bientôt » marqué par le parent, sinon le chapitre en cours ;
 * - `enquete` : trois questions sur un même document (générateur d'énigme du lieu, `shared_document` côté API).
 *
 * Pur et testé sans moteur : habitants et textes viennent de content/monde/villages.json (exporté de la v1) ; les questions viennent de
 * `QuestionService.nextQuestItem` (jamais lues ici) ; `completeQuest` rend une **nouvelle** partie (XP, objet, quête du jour faite), jamais modifiée sur place.
 */
import data from '@content/monde/villages.json'
import { unlockNews } from './appearance'
import { type ItemId, foundText } from './inventory'
import { levelForXp } from './progression'
import { findItems } from './quest/enigma'
import type { SaveData } from './save'
import { afterActivity, PASS_ANSWERS, passesText, sphinxOf } from './sphinx/island'
import type { World } from './wardrobe'

export type QuestKind = 'revision' | 'veille' | 'enquete'

export interface Villager {
  code: string
  name: string
  /** Silhouette KayKit (core/wardrobe.ts : `PARTS`). */
  model: string
  quest: QuestKind
  /** Générateur de l'enquête (l'énigme du serveur) ; absent pour les autres quêtes. */
  generator?: string
  title: string
  ask: string
  thanks: string
}

export interface Village {
  code: string
  level: string
  title: string
  intro: string
  npcs: Villager[]
}

/** Questions d'une quête, XP de fin de quête et XP par bonne réponse (v1 : `VillageDef`). */
export const QUEST_SIZE: number = data.quest_size
export const QUEST_XP: number = data.quest_xp
export const ANSWER_XP: number = data.answer_xp
/** `game_mode` des réponses d'une quête (suivi côté serveur). */
export const GAME_MODE = 'village'

const VILLAGES = data.villages as unknown as Village[]

/** Le village d'une classe ; null tant qu'elle n'en a pas (le jeu n'en pose alors aucun). */
export function villageFor(level: string): Village | null {
  return VILLAGES.find((v) => v.level === level) ?? null
}

/** Les enquêtes à demander au serveur au lancement d'une quête : deux quêtes d'avance par générateur (`POST /play/session/start`, `enigmas`). */
export function sessionParams(village: Village): { enigmas: { generator: string; count: number }[] } {
  const enigmas: { generator: string; count: number }[] = []
  for (const npc of village.npcs) {
    if (npc.quest === 'enquete' && npc.generator && !enigmas.some((e) => e.generator === npc.generator)) {
      enigmas.push({ generator: npc.generator, count: QUEST_SIZE * 2 })
    }
  }
  return { enigmas }
}

// --- Quête du jour, rangée dans la partie -----------------------------------------------------------------------------------------------------

/** Jour de la dernière quête faite pour chaque habitant (code → « AAAA-MM-JJ »), relu avec prudence d'une partie ancienne ou abîmée. */
export function normalizeQuests(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out
  for (const [code, day] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)) out[code] = day
  }
  return out
}

/** Cet habitant a-t-il déjà reçu l'aide de l'enfant ce jour-là ? */
export function questDone(save: Pick<SaveData, 'quests'>, code: string, day: string): boolean {
  return save.quests[code] === day
}

/** Habitants qui attendent encore de l'aide ce jour-là (repères « ! » du village). */
export function pendingQuests(village: Village | null, save: Pick<SaveData, 'quests'>, day: string): number {
  return village ? village.npcs.filter((npc) => !questDone(save, npc.code, day)).length : 0
}

// --- Questions de la quête -------------------------------------------------------------------------------------------------------------------

export interface Chapter {
  code: string
  title: string
}

/** Chapitres que le parent a marqués « en cours » et « contrôle bientôt » (champ `context` du paquet de session). */
export interface QuestContext {
  test_soon: Chapter[]
  current: Chapter[]
}

const chaptersOf = (raw: unknown): Chapter[] =>
  Array.isArray(raw)
    ? raw.flatMap((c) => (c && typeof c === 'object' && typeof (c as Chapter).code === 'string' && typeof (c as Chapter).title === 'string' ? [{ code: (c as Chapter).code, title: (c as Chapter).title }] : []))
    : []

export function contextOf(raw: Record<string, unknown> | undefined | null): QuestContext {
  return { test_soon: chaptersOf(raw?.test_soon), current: chaptersOf(raw?.current) }
}

/** Les chapitres de la quête « veille de contrôle » : ceux du contrôle qui approche, sinon ceux travaillés en classe en ce moment. */
export function veilleChapters(context: QuestContext): string[] {
  const chosen = context.test_soon.length > 0 ? context.test_soon : context.current
  return chosen.map((c) => c.code)
}

/** La demande de l'habitant ; la veille de contrôle nomme le chapitre choisi par le parent. */
export function askText(npc: Pick<Villager, 'quest' | 'ask'>, context: QuestContext): string {
  if (npc.quest !== 'veille') return npc.ask
  if (context.test_soon.length > 0) return `Ton contrôle sur « ${context.test_soon[0]!.title} » approche, n'est-ce pas ? Entraînons-nous ensemble, tu seras prêt.`
  if (context.current.length > 0) return `En classe, tu travailles « ${context.current[0]!.title} » en ce moment. Voyons si tout est clair.`
  return npc.ask
}

/** Ce que dit l'habitant dont l'enfant a déjà fait la quête aujourd'hui. */
export const DONE_TEXT = "Merci encore pour ton aide ! Reviens demain : j'aurai sûrement de nouveau besoin de toi."
/** Quand le paquet n'a aucune question pour cette quête (hors connexion, jamais venu ici). */
export const NO_QUESTION_TEXT = "Hum… mes papiers sont restés à l'abri. Reviens quand le royaume sera de nouveau connecté."

// --- Fin de la quête ---------------------------------------------------------------------------------------------------------------------------

export interface QuestReport {
  /** La partie après la quête : XP, objet au sac, quête du jour faite, passage du Sphinx. */
  save: SaveData
  xp: number
  found: ItemId[]
  /** Un passage pour la barque du Sphinx vient d'être gagné (la deuxième quête du jour : six réponses, comme les autres activités). */
  passage: boolean
  /** Le texte de fin : remerciement, bilan, trouvaille, passage, niveau gagné, apparence débloquée. */
  lines: string[]
}

const plural = (n: number): string => (n > 1 ? 's' : '')

/** XP d'une quête menée à terme : le forfait, plus un bonus par bonne réponse. */
export const questXp = (correct: number): number => QUEST_XP + ANSWER_XP * Math.max(0, Math.min(QUEST_SIZE, correct))

/** Les quêtes faites ce jour-là (pour tous les habitants). */
export const questsToday = (save: Pick<SaveData, 'quests'>, day: string): number => Object.values(save.quests).filter((d) => d === day).length

export interface CompleteOptions {
  day: string
  /** Pour annoncer ce que le niveau gagné débloque dans l'apparence. */
  world: World
  /** La classe de l'enfant : fixe le palier de départ de l'île du Sphinx. */
  level: string
  /** Tirage de l'objet (tests). */
  random?: () => number
}

/**
 * Termine la quête d'un habitant : XP, un objet pour le sac, la quête du jour enregistrée (même une quête ratée compte : l'habitant est aidé). La deuxième
 * quête du jour atteint les six réponses d'une activité : un passage pour la barque du Sphinx (jamais un de plus les jours suivants de la même journée).
 */
export function completeQuest(save: SaveData, npc: Pick<Villager, 'code' | 'thanks'>, correct: number, options: CompleteOptions): QuestReport {
  const { day, world, level, random = Math.random } = options
  const xp = questXp(correct)
  const { save: withItem, found } = findItems(save, 1, random)
  let next: SaveData = { ...withItem, xp: withItem.xp + xp, quests: { ...withItem.quests, [npc.code]: day } }
  // Les quêtes du jour sont celles d'habitants distincts (l'écran refuse de refaire une quête faite) : le passage tombe quand leur total franchit six réponses.
  const reachesPassage = questsToday(save, day) * QUEST_SIZE < PASS_ANSWERS && questsToday(next, day) * QUEST_SIZE >= PASS_ANSWERS
  let passage = false
  if (reachesPassage) {
    const earned = afterActivity(next, level, GAME_MODE, PASS_ANSWERS)
    next = earned.save
    passage = earned.gained
  }
  const lines = [npc.thanks, `${correct} bonne${plural(correct)} réponse${plural(correct)} sur ${QUEST_SIZE}. +${xp} XP`]
  if (found.length > 0) lines.push(foundText(found))
  if (passage) lines.push(`Un passage pour la barque du Sphinx ! (${passesText(sphinxOf(next, level).passes)})`)
  const before = levelForXp(save.xp)
  const after = levelForXp(next.xp)
  if (after > before) {
    lines.push(`Niveau ${after} !`)
    const news = unlockNews(save, next, world)
    if (news.length > 0) lines.push(`Nouveau dans ton apparence : ${news.join(', ')}`)
  }
  return { save: next, xp, found, passage, lines }
}
