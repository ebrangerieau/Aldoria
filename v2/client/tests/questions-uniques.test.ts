import { describe, expect, it } from 'vitest'
import type { Item, Pack, Role } from '../src/core/items'
import { riddleItem } from '../src/core/quest/enigma'
import { QuestionService, questionSignature, type QuestionSource } from '../src/core/questionService'
import pack2nde from './fixtures/pack_2nde.json'
import { PACK_6E } from './support'

/** Une question de QCM minimale ; `over` change ce qu'il faut. */
function item(id: string, over: Partial<Item> = {}): Item {
  return {
    id, type: 'mcq', difficulty: 2, notions: ['6e.maths.test'], role: 'chapitre', prompt: `Question ${id} ?`,
    choices: ['a', 'b', 'c'], answer: { kind: 'choice', index: 1 }, hint: 'indice', explanation: 'parce que', time_target_ms: 20000,
    ...over,
  }
}

function serviceOf(items: Item[], random: () => number = () => 0) {
  const recorded: string[] = []
  const source: QuestionSource = {
    items: () => items,
    startLevels: () => ({}),
    isSetAside: () => false,
    record: (it) => void recorded.push(it.id),
  }
  const questions = new QuestionService(source, random)
  questions.reset()
  return { questions, recorded }
}

/** Pose toutes les questions possibles (sans énigme), dans l'ordre où le service les rend. */
function drain(questions: QuestionService, roles: (Role | undefined)[], count: number): Item[] {
  const asked: Item[] = []
  for (let i = 0; i < count; i += 1) {
    const next = questions.next(roles[i % roles.length])
    if (next) asked.push(next)
  }
  return asked
}

describe('Jamais deux fois la même question dans un parcours', () => {
  for (const [name, pack] of [['6e', PACK_6E], ['2nde', pack2nde as unknown as Pack]] as const) {
    it(`pose chaque question du vrai paquet de ${name} une fois, quel que soit le rôle demandé`, () => {
      const playable = pack.items.filter((it) => it.role !== 'enigme' && !it.visual?.kind)
      for (const roles of [['automatisme'], ['chapitre'], ['automatisme', 'chapitre', 'chapitre']] as Role[][]) {
        const { questions } = serviceOf(pack.items)
        const asked = drain(questions, roles, playable.length).filter((it) => !it.visual?.kind)
        expect(new Set(asked.map(questionSignature)).size).toBe(asked.length)
        expect(questions.repeats).toBe(0)
      }
    })
  }

  it('une enfant qui ne fait que frapper vide les automatismes, puis reçoit des questions du chapitre, jamais les mêmes', () => {
    const autos = Array.from({ length: 4 }, (_, i) => item(`a${i}`, { role: 'automatisme', difficulty: 1 }))
    const chapters = Array.from({ length: 6 }, (_, i) => item(`c${i}`, { role: 'chapitre', difficulty: 2 }))
    const { questions } = serviceOf([...autos, ...chapters])
    const asked = drain(questions, ['automatisme'], 10)
    expect(asked.map((it) => it.role).slice(0, 4)).toEqual(['automatisme', 'automatisme', 'automatisme', 'automatisme'])
    expect(asked.slice(4).every((it) => it.role === 'chapitre')).toBe(true)
    expect(new Set(asked.map((it) => it.id)).size).toBe(10)
    expect(questions.repeats).toBe(0)
  })

  it('et réciproquement : le sort épuise le chapitre, les automatismes prennent le relais', () => {
    const { questions } = serviceOf([
      item('c0', { role: 'chapitre' }),
      item('a0', { role: 'automatisme', difficulty: 1 }),
      item('a1', { role: 'automatisme', difficulty: 1 }),
    ])
    expect(drain(questions, ['chapitre'], 3).map((it) => it.id)).toEqual(['c0', 'a0', 'a1'])
    expect(questions.repeats).toBe(0)
  })

  it('un jumeau (même énoncé, autre identifiant, autre graine, propositions mélangées) compte pour la même question', () => {
    const twin = item('b', { prompt: 'Question a ?', choices: ['c', 'b', 'a'], answer: { kind: 'choice', index: 1 }, seed: 99 })
    expect(questionSignature(item('a'))).toBe(questionSignature(twin))
    const other = item('x', { prompt: 'Question a ?', answer: { kind: 'choice', index: 0 } })
    expect(questionSignature(item('a'))).not.toBe(questionSignature(other)) // autre bonne réponse : autre question
    const { questions } = serviceOf([item('a'), twin, item('c')])
    const [first, second] = drain(questions, ['chapitre'], 2)
    expect(new Set([first!.id, second!.id]).size).toBe(2)
    expect(questionSignature(first!)).not.toBe(questionSignature(second!))
    expect(questions.repeats).toBe(0)
  })

  it('un visuel différent fait une autre question, même énoncé (les balances d’une énigme)', () => {
    const balance = (n: number) => item(`e${n}`, { role: 'enigme', prompt: 'Trouve la masse.', visual: { kind: 'balance', units: n } })
    const { questions } = serviceOf([balance(8), balance(12), balance(8)])
    expect([questions.next('enigme')!.id, questions.next('enigme')!.id, questions.next('enigme')]).toEqual(['e8', 'e12', null])
  })

  it('énigmes toutes posées : null, puis une question du chapitre à la place, jamais une énigme reposée', () => {
    const { questions } = serviceOf([item('e1', { role: 'enigme' }), item('c1'), item('c2')])
    const got = [riddleItem(questions), riddleItem(questions), riddleItem(questions)]
    expect(got.map((it) => it!.id)).toEqual(['e1', 'c1', 'c2'])
    expect(questions.repeats).toBe(0)
  })

  it('une notion ratée revient sous une question inédite, jamais sous une question déjà posée', () => {
    const items = [
      item('m1', { notions: ['6e.maths.test.m'] }), item('m2', { notions: ['6e.maths.test.m'] }),
      ...Array.from({ length: 4 }, (_, i) => item(`o${i}`, { notions: ['6e.maths.test.o'] })),
    ]
    const { questions } = serviceOf(items)
    const missed = questions.next('chapitre')!
    questions.submit(missed, -1, 5000, false)
    const asked = [missed]
    for (let i = 0; i < 5; i += 1) {
      const next = questions.next('chapitre')!
      asked.push(next)
      questions.submit(next, 1, 5000, false)
    }
    expect(new Set(asked.map((it) => it.id)).size).toBe(6)
    expect(questions.repeats).toBe(0)
  })

  it('notion ratée sans question inédite : on n’en repose pas une déjà vue pour autant', () => {
    const { questions } = serviceOf([item('m1', { notions: ['6e.maths.m'] }), item('o1', { notions: ['6e.maths.o'] }), item('o2', { notions: ['6e.maths.o'] })])
    const missed = questions.next('chapitre')!
    expect(missed.id).toBe('m1')
    questions.submit(missed, -1, 5000, false)
    const rest = [questions.next('chapitre')!, questions.next('chapitre')!]
    expect(rest.map((it) => it.id).sort()).toEqual(['o1', 'o2'])
    expect(questions.repeats).toBe(0)
  })

  it('dernier recours, tout est posé : la plus ancienne revient, jamais celle qu’on vient de poser, et c’est compté', () => {
    const { questions } = serviceOf([item('a'), item('b'), item('c')])
    expect(drain(questions, ['chapitre'], 3).map((it) => it.id)).toEqual(['a', 'b', 'c'])
    expect(questions.repeats).toBe(0)
    const again = drain(questions, ['chapitre'], 3).map((it) => it.id)
    expect(again).toEqual(['a', 'b', 'c']) // dans l'ordre où elles avaient été posées
    expect(questions.repeats).toBe(3)
  })

  it('un paquet d’une seule question la repose, faute de mieux, sans planter', () => {
    const { questions } = serviceOf([item('seule')])
    expect(questions.next('chapitre')!.id).toBe('seule')
    expect(questions.next('chapitre')!.id).toBe('seule')
    expect(questions.repeats).toBe(1)
  })

  it('sans aucune question, rien (le combat et la porte de l’énigme ont leur repli)', () => {
    const { questions } = serviceOf([])
    expect(questions.next('chapitre')).toBeNull()
    expect(questions.next()).toBeNull()
    expect(riddleItem(questions)).toBeNull()
  })

  it('un nouveau parcours (reset) repart de zéro, et préfère ce que la séance n’a pas encore vu', () => {
    const { questions } = serviceOf([item('a'), item('b'), item('c')], () => 0)
    const first = drain(questions, ['chapitre'], 2).map((it) => it.id)
    questions.reset()
    expect(questions.repeats).toBe(0)
    const next = questions.next('chapitre')!
    expect(first).not.toContain(next.id) // la seule question encore jamais vue de la séance passe en premier
    expect(next.id).toBe('c')
    expect(drain(questions, ['chapitre'], 2).map((it) => it.id).sort()).toEqual(['a', 'b'])
    expect(questions.repeats).toBe(0)
  })

  it('un lieu entier (cinq combats, l’Effaceur, trois piédestaux) ne reçoit aucune question deux fois, même d’une enfant en difficulté', () => {
    // 60 questions, le plus qu'un lieu demande à qui ne fait que frapper et se trompe une fois sur trois (lieux.json) :
    // les 17 automatismes du vrai paquet ne suffisent pas, les 43 questions du chapitre prennent le relais.
    const { questions } = serviceOf(PACK_6E.items)
    const asked: Item[] = []
    for (let i = 0; i < 60; i += 1) {
      const next = questions.next('automatisme')!
      asked.push(next)
      questions.submit(next, i % 3 === 0 ? -1 : (next.answer.kind === 'choice' ? next.answer.index : -1), 5000, false)
    }
    expect(new Set(asked.map(questionSignature)).size).toBe(60)
    expect(questions.repeats).toBe(0)
  })
})
