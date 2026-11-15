import { describe, expect, it } from 'vitest'
import { EMPTY_SAVE, normalizeSave, type SaveData } from '../src/core/save'
import type { Item } from '../src/core/items'
import { findItems } from '../src/core/quest/enigma'
import { QuestionService, type QuestionSource } from '../src/core/questionService'
import { xpForLevel } from '../src/core/progression'
import {
  ANSWER_XP, askText, completeQuest, contextOf, DONE_TEXT, normalizeQuests, pendingQuests, QUEST_SIZE, QUEST_XP, questDone, questXp, sessionParams,
  veilleChapters, villageFor,
} from '../src/core/village'
import { PACK_6E } from './support'

const fresh = (over: Partial<SaveData> = {}): SaveData => ({ ...structuredClone(EMPTY_SAVE), ...over })
const DAY = '2026-11-15'

function item(id: string, over: Partial<Item> = {}): Item {
  return {
    id, type: 'mcq', difficulty: 2, notions: ['6e.maths.test'], role: 'chapitre', category: 'chapitre', prompt: `Question ${id} ?`,
    choices: ['a', 'b', 'c'], answer: { kind: 'choice', index: 1 }, hint: 'indice', explanation: 'parce que', time_target_ms: 20000,
    ...over,
  }
}

function serviceOf(items: Item[]): QuestionService {
  const source: QuestionSource = { items: () => items, startLevels: () => ({}), isSetAside: () => false, record: () => {} }
  const questions = new QuestionService(source, () => 0)
  questions.reset()
  return questions
}

describe('Les villages', () => {
  it('Clairval pour la 6e (trois habitants), Brumegarde pour la 2nde (quatre), aucun pour une autre classe', () => {
    const clairval = villageFor('6e')!
    expect(clairval.title).toBe('Clairval')
    expect(clairval.npcs.map((n) => n.quest)).toEqual(['revision', 'enquete', 'veille'])
    const brumegarde = villageFor('2nde')!
    expect(brumegarde.npcs).toHaveLength(4)
    expect(villageFor('5e')).toBeNull()
    expect(QUEST_SIZE).toBe(3)
    expect(QUEST_XP).toBe(50)
    expect(ANSWER_XP).toBe(10)
  })

  it('chaque habitant a un nom, un modèle KayKit, une demande et un remerciement ; une enquête nomme son générateur', () => {
    for (const level of ['6e', '2nde']) {
      const village = villageFor(level)!
      expect(new Set(village.npcs.map((n) => n.code)).size).toBe(village.npcs.length)
      for (const npc of village.npcs) {
        expect(npc.name.length).toBeGreaterThan(3)
        expect(['Barbarian', 'Rogue', 'Mage', 'Knight', 'Rogue_Hooded']).toContain(npc.model)
        expect(npc.ask.length).toBeGreaterThan(20)
        expect(npc.thanks.length).toBeGreaterThan(10)
        if (npc.quest === 'enquete') expect(npc.generator).toMatch(new RegExp(`^${level}\\.`))
      }
    }
  })

  it('les enquêtes demandées au serveur : deux quêtes d’avance par générateur, une seule fois chacun', () => {
    expect(sessionParams(villageFor('6e')!)).toEqual({ enigmas: [{ generator: '6e.proportionnalite.carte', count: 6 }] })
    const generators = sessionParams(villageFor('2nde')!).enigmas.map((e) => e.generator)
    expect(generators).toEqual(['2nde.statistiques.enquete', '2nde.probabilites.enquete'])
  })
})

describe('La quête du jour dans la partie', () => {
  it('une partie ancienne se relit sans quête ; les valeurs abîmées sont écartées', () => {
    expect(normalizeSave({}).quests).toEqual({})
    expect(normalizeQuests(null)).toEqual({})
    expect(normalizeQuests(['x'])).toEqual({})
    expect(normalizeQuests({ barnabe: DAY, oriel: 'hier', melisande: 5 })).toEqual({ barnabe: DAY })
  })

  it('un habitant n’est aidé qu’une fois par jour ; demain tout recommence', () => {
    const save = fresh({ quests: { barnabe: DAY } })
    expect(questDone(save, 'barnabe', DAY)).toBe(true)
    expect(questDone(save, 'barnabe', '2026-11-16')).toBe(false)
    expect(questDone(save, 'oriel', DAY)).toBe(false)
    const village = villageFor('6e')!
    expect(pendingQuests(village, fresh(), DAY)).toBe(3)
    expect(pendingQuests(village, save, DAY)).toBe(2)
    expect(pendingQuests(null, save, DAY)).toBe(0)
  })
})

describe('Les textes de la demande', () => {
  const veille = { quest: 'veille' as const, ask: 'Demande par défaut.' }
  it('la veille de contrôle nomme le contrôle qui approche, sinon le chapitre en cours, sinon la demande de l’habitant', () => {
    const both = contextOf({ test_soon: [{ code: '6e.fractions', title: 'Les fractions' }], current: [{ code: '6e.angles', title: 'Les angles' }] })
    expect(askText(veille, both)).toContain('Les fractions')
    expect(askText(veille, both)).toContain('contrôle')
    expect(veilleChapters(both)).toEqual(['6e.fractions'])
    const current = contextOf({ test_soon: [], current: [{ code: '6e.angles', title: 'Les angles' }] })
    expect(askText(veille, current)).toContain('Les angles')
    expect(veilleChapters(current)).toEqual(['6e.angles'])
    expect(askText(veille, contextOf(undefined))).toBe('Demande par défaut.')
    expect(veilleChapters(contextOf(undefined))).toEqual([])
  })

  it('une autre quête garde la demande de l’habitant ; un contexte abîmé est ignoré', () => {
    const context = contextOf({ test_soon: [{ code: '6e.fractions', title: 'Les fractions' }], current: 'rien' })
    expect(askText({ quest: 'revision', ask: 'Souviens-toi.' }, context)).toBe('Souviens-toi.')
    expect(contextOf({ test_soon: [{ code: 3 }, null, { code: 'a', title: 'A' }] }).test_soon).toEqual([{ code: 'a', title: 'A' }])
    expect(DONE_TEXT).toContain('demain')
  })
})

describe('La fin d’une quête', () => {
  const npc = { code: 'barnabe', thanks: 'Tout me revient !' }

  it('XP du forfait et de chaque bonne réponse, un objet, la quête du jour enregistrée, la partie d’origine intacte', () => {
    const save = fresh({ xp: 10 })
    const report = completeQuest(save, npc, 2, DAY, 'lumineux', () => 0)
    expect(questXp(2)).toBe(QUEST_XP + 2 * ANSWER_XP)
    expect(report.xp).toBe(70)
    expect(report.save.xp).toBe(80)
    expect(report.save.quests).toEqual({ barnabe: DAY })
    expect(report.found).toHaveLength(1)
    expect(Object.values(report.save.items).reduce((n, c) => n + (c ?? 0), 0)).toBe(1)
    expect(report.lines[0]).toBe('Tout me revient !')
    expect(report.lines[1]).toBe('2 bonnes réponses sur 3. +70 XP')
    expect(save.xp).toBe(10)
    expect(save.quests).toEqual({})
    expect(save.items).toEqual({})
  })

  it('une quête sans bonne réponse compte aussi (l’habitant est aidé) ; au singulier une seule bonne réponse', () => {
    expect(completeQuest(fresh(), npc, 0, DAY, 'lumineux', () => 0).lines[1]).toBe('0 bonne réponse sur 3. +50 XP')
    expect(completeQuest(fresh(), npc, 1, DAY, 'lumineux', () => 0).lines[1]).toBe('1 bonne réponse sur 3. +60 XP')
    expect(questXp(9)).toBe(QUEST_XP + QUEST_SIZE * ANSWER_XP) // jamais plus de bonnes réponses que de questions
    expect(questXp(-1)).toBe(QUEST_XP)
  })

  it('sac plein : pas d’objet ni de ligne de trouvaille', () => {
    const full = fresh({ items: { plume: 5, parchemin: 5, bouclier: 5, potion: 5 } })
    expect(findItems(full, 1, () => 0).found).toEqual([])
    const report = completeQuest(full, npc, 3, DAY, 'lumineux', () => 0)
    expect(report.found).toEqual([])
    expect(report.lines.some((l) => l.startsWith('Dans ton sac'))).toBe(false)
  })

  it('un niveau gagné est annoncé, avec ce qu’il débloque dans l’apparence', () => {
    const save = fresh({ xp: xpForLevel(2) - 10 })
    const report = completeQuest(save, npc, 3, DAY, 'lumineux', () => 0)
    expect(report.lines).toContain('Niveau 2 !')
    expect(report.lines.some((l) => l.startsWith('Nouveau dans ton apparence'))).toBe(true) // le Voleur, au niveau 2
    const none = completeQuest(fresh({ xp: 0 }), npc, 0, DAY, 'lumineux', () => 0)
    expect(none.lines.some((l) => l.startsWith('Niveau'))).toBe(false)
  })
})

describe('Les questions d’une quête (QuestionService.nextQuestItem)', () => {
  const enigma = (id: string, generator = 'g.carte'): Item => item(id, { role: 'enigme', category: 'enigme', generator })

  it('une enquête pose les énigmes de son générateur dans l’ordre du paquet, puis plus rien', () => {
    const questions = serviceOf([item('c1'), enigma('e1'), enigma('x1', 'g.autre'), enigma('e2'), enigma('e3'), enigma('e4')])
    const asked = [1, 2, 3, 4, 5].map(() => questions.nextQuestItem('enquete', 'g.carte')?.id ?? null)
    expect(asked).toEqual(['e1', 'e2', 'e3', 'e4', null])
    expect(serviceOf([item('c1')]).nextQuestItem('enquete', 'g.carte')).toBeNull() // sans énigme, pas d'enquête
  })

  it('la révision prend les notions à revoir, sinon une question de chapitre ; jamais deux fois la même', () => {
    const items = [item('c1'), item('r1', { category: 'revision' }), item('r2', { category: 'revision' }), item('a1', { role: 'automatisme', category: 'automatisme' })]
    const questions = serviceOf(items)
    const asked = [1, 2, 3].map(() => questions.nextQuestItem('revision')!.id)
    expect(asked.slice(0, 2).sort()).toEqual(['r1', 'r2'])
    expect(asked[2]).toBe('c1') // la révision est posée : une question inédite d'un chapitre plutôt qu'une répétition
    expect(questions.repeats).toBe(0)
    const noRevision = serviceOf([item('c1'), item('c2')])
    expect(['c1', 'c2']).toContain(noRevision.nextQuestItem('revision')!.id)
    expect(noRevision.repeats).toBe(0)
  })

  it('la veille ne pose que les chapitres demandés (le chapitre est le code de la notion sans son dernier segment)', () => {
    const items = [
      item('f1', { notions: ['6e.fractions.somme'] }),
      item('f2', { notions: ['6e.fractions.comparaison'] }),
      item('a1', { notions: ['6e.angles.mesure'] }),
    ]
    const questions = serviceOf(items)
    expect(['f1', 'f2']).toContain(questions.nextQuestItem('veille', '', ['6e.fractions'])!.id)
    expect(['f1', 'f2']).toContain(questions.nextQuestItem('veille', '', ['6e.fractions'])!.id)
    const other = serviceOf(items)
    expect(other.nextQuestItem('veille', '', ['6e.angles'])!.id).toBe('a1')
    // Aucun chapitre demandé (ni contrôle ni cours en cours) : n'importe quelle question de chapitre.
    expect(serviceOf(items).nextQuestItem('veille', '', [])).not.toBeNull()
  })

  it('sur le vrai paquet de 6e : l’enquête de Mélisande rend ses trois questions sur un même document, une quête ne répète rien', () => {
    const questions = serviceOf(PACK_6E.items)
    const asked = Array.from({ length: QUEST_SIZE }, () => questions.nextQuestItem('enquete', '6e.proportionnalite.carte'))
    expect(asked.every((it) => it !== null && it.role === 'enigme' && it.generator === '6e.proportionnalite.carte')).toBe(true)
    expect(new Set(asked.map((it) => it!.id)).size).toBe(QUEST_SIZE)
    const revision = serviceOf(PACK_6E.items)
    const three = Array.from({ length: QUEST_SIZE }, () => revision.nextQuestItem('revision')!)
    expect(new Set(three.map((it) => it.id)).size).toBe(QUEST_SIZE)
    expect(revision.repeats).toBe(0)
  })
})
