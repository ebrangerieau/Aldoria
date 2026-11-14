import { describe, expect, it } from 'vitest'
import combat from '@content/monde/combat.json'
import type { Action, BagEffect, TurnResult } from '../src/core/combat/encounter'
import type { Fighter } from '../src/core/combat/fighter'
import type { Item, Role } from '../src/core/items'
import { type ItemId, type Owned, give } from '../src/core/progression/inventory'
import { levelForXp } from '../src/core/progression/progression'
import {
  type ActionChoice, type AskOutcome, QuestController, type QuestSave, type QuestStage, type QuestUi, type StageEvent, type Tone,
} from '../src/core/quest/controller'
import { HeroVoice } from '../src/core/quest/heroVoice'
import type { EnemyState } from '../src/core/quest/run'
import { DUNGEONS } from '../src/core/world/places'

const FRACTIONS = DUNGEONS.find((d) => d.code === 'tour_fractions')!

// --- Faux --------------------------------------------------------------------------------

class FakeSave implements QuestSave {
  data = { xp: 0, items: {} as Owned, places: {} as Record<string, number> }
  checkpoints: Record<string, number> = {}
  stories: string[] = []
  addXp(amount: number) { this.data.xp += amount }
  completePlace(code: string) { this.data.places[code] = (this.data.places[code] ?? 0) + 1 }
  markStory(step: string) { this.stories.push(step) }
  giveItems(ids: readonly ItemId[]) { this.data.items = give(this.data.items, ids) }
  useItem(id: ItemId) {
    if ((this.data.items[id] ?? 0) <= 0) return false
    this.data.items[id] = (this.data.items[id] ?? 0) - 1
    return true
  }
  checkpoint(code: string) { return this.checkpoints[code] ?? 0 }
  setCheckpoint(code: string, room: number) {
    if (room > 0) this.checkpoints[code] = room
    else delete this.checkpoints[code]
  }
}

class FakeStage implements QuestStage {
  log: string[] = []
  turns: TurnResult[] = []
  constructor(public events: StageEvent[]) {}
  async explore(): Promise<StageEvent> {
    const next = this.events.shift()
    if (!next) throw new Error('plus d’événement prévu')
    return next
  }
  async engage(e: EnemyState) { this.log.push(`engage ${e.id}`) }
  async playTurn(_e: EnemyState, turn: TurnResult) { this.turns.push(turn) }
  async playBag(effect: BagEffect) { this.log.push(`bag ${effect.kind}`) }
  async endFight(e: EnemyState, outcome: string) { this.log.push(`fin ${e.id} ${outcome}`) }
  async openDoor(room: number) { this.log.push(`porte ${room}`) }
  async pedestalSolved(i: number) { this.log.push(`piédestal ${i} résolu`) }
  pedestalRearm(i: number) { this.log.push(`piédestal ${i} réarmé`) }
  async spawnChest() { this.log.push('coffre apparu') }
  async openChest() { this.log.push('coffre ouvert') }
  restored() { this.log.push('soigné') }
  levelUp() { this.log.push('niveau') }
}

interface Script {
  /** Réponses aux questions, dans l'ordre ; défaut : juste. */
  answers?: Partial<AskOutcome & { correct: boolean; speedRatio: number }>[]
  /** Choix d'action ; défaut : « automatisme » (frappe). */
  choices?: ActionChoice[]
  rating?: number
}

class FakeUi implements QuestUi {
  messages: string[] = []
  banners: { text: string; tone: Tone }[] = []
  said: string[] = []
  hero: [number, number] = [0, 0]
  enemy: { name: string | null; hp?: number; max?: number } = { name: null }
  asked: { title: string; mode: string; level?: number }[] = []
  menus: { canHeal: boolean }[] = []
  constructor(private script: Script = {}, private questions?: FakeQuestions) {}
  async message(title: string) { this.messages.push(title) }
  banner(text: string, tone: Tone) { this.banners.push({ text, tone }) }
  say(text: string) { this.said.push(text) }
  setHero(hp: number, max: number) { this.hero = [hp, max] }
  setEnemy(name: string | null, hp?: number, max?: number) { this.enemy = { name, hp, max } }
  async chooseAction(menu: { canHeal: boolean }): Promise<ActionChoice> {
    this.menus.push(menu)
    return this.script.choices?.shift() ?? { kind: 'action', action: 'automatisme' }
  }
  async ask(item: Item, title: string, mode: string): Promise<AskOutcome> {
    this.asked.push({ title, mode })
    const a = this.script.answers?.shift() ?? {}
    if (a.result === null) return { item, result: null, hintUsed: false }
    const correct = a.correct ?? true
    this.questions?.record(correct)
    return { item, hintUsed: a.hintUsed ?? false, result: { correct, speedRatio: a.speedRatio ?? 1.5, rewardFactor: 1, explanation: '' } }
  }
  async rating() { return this.script.rating ?? 5 }
}

class FakeQuestions {
  answered = 0
  correctCount = 0
  unavailable = new Set<string>()
  requested: { role?: Role; level?: number }[] = []
  levels = { automatisme: 3, chapitre: 3 }
  levelFor(role: Role) { return role === 'enigme' ? 1 : this.levels[role] }
  next(role?: Role, level?: number): Item | null {
    this.requested.push({ role, level })
    if (role && this.unavailable.has(role)) return null
    return { id: `q${this.requested.length}`, type: 'numeric', difficulty: 2, role: role ?? 'automatisme', notions: [], prompt: '', answer: { kind: 'number', value: '1' }, hint: '', explanation: '', time_target_ms: 1000 } as Item
  }
  record(correct: boolean) { this.answered += 1; if (correct) this.correctCount += 1 }
}

function setup(events: StageEvent[], script: Script = {}, opts: { save?: FakeSave; world?: 'lumineux' | 'brouillard'; random?: () => number; noSpeed?: boolean } = {}) {
  const save = opts.save ?? new FakeSave()
  const questions = new FakeQuestions()
  const stage = new FakeStage([...events]) // copie : une liste partagée serait consommée par le premier test
  const ui = new FakeUi(script, questions)
  const controller = new QuestController(FRACTIONS, stage, ui, {
    questions, save, voice: new HeroVoice(null, () => 0), world: opts.world ?? 'lumineux', noSpeed: opts.noSpeed ?? false, random: opts.random ?? (() => 0),
  })
  return { save, questions, stage, ui, controller }
}

const ev = {
  room: (index: number): StageEvent => ({ kind: 'room', index }),
  enemy: (id: string): StageEvent => ({ kind: 'enemy', id }),
  pedestal: (index: number): StageEvent => ({ kind: 'pedestal', index }),
  chest: { kind: 'chest' } as StageEvent,
  leave: { kind: 'leave' } as StageEvent,
}

/** Tour des Fractions : entrée, 1 sbire, 2 ennemis, énigme, 1 gardien, Effaceur (200 PV). */
const FULL_RUN: StageEvent[] = [
  ev.room(1), ev.enemy('1.0'),
  ev.room(2), ev.enemy('2.0'), ev.enemy('2.1'),
  ev.room(3), ev.pedestal(0), ev.pedestal(1), ev.pedestal(2),
  ev.room(4), ev.enemy('4.0'),
  ev.room(5), ev.enemy('5.0'), ev.chest,
]

// --- Tests -------------------------------------------------------------------------------

describe('parcours complet de la Tour des Fractions', () => {
  it('traverse les six salles jusqu’au coffre, et rend la page', async () => {
    const { controller, stage, ui, save, questions } = setup(FULL_RUN, { rating: 4 })
    const result = await controller.run()
    expect(result).toMatchObject({ status: 'completed', rating: 4 })
    // Messages dans l'ordre du récit : intro, énigme, présentation de l'Effaceur, sa défaite, la page.
    expect(ui.messages).toEqual([FRACTIONS.title, FRACTIONS.enigma.title, 'Le Grand Diviseur', 'Le Grand Diviseur', 'La page des Fractions retrouvée !'])
    expect(stage.log.filter((l) => l.startsWith('porte'))).toEqual(['porte 1', 'porte 2', 'porte 3', 'porte 4'])
    expect(stage.log).toContain('coffre apparu')
    expect(stage.log).toContain('coffre ouvert')
    expect(save.data.places.tour_fractions).toBe(1)
    expect(save.stories).toEqual(['page-tour_fractions'])
    expect(save.checkpoints.tour_fractions).toBeUndefined() // lieu terminé : plus de point de reprise
    expect(save.data.xp).toBeGreaterThan(FRACTIONS.chest_xp)
    expect(result.answered).toBe(questions.answered)
    expect(ui.banners.map((b) => b.text)).toContain('Un coffre est apparu !')
  })

  it('pose des questions du bon rôle et du bon mode de jeu (combat, énigme, Effaceur)', async () => {
    const { controller, ui, questions } = setup(FULL_RUN)
    await controller.run()
    const modes = new Set(ui.asked.map((a) => a.mode))
    expect(modes).toEqual(new Set(['combat', 'enigme', 'boss']))
    expect(questions.requested.filter((r) => r.role === 'enigme')).toHaveLength(3)
    // Hors Effaceur, la difficulté reste adaptative (0) ; pour l'Effaceur, elle est imposée.
    const boss = questions.requested.filter((r) => (r.level ?? 0) > 0)
    expect(boss.length).toBeGreaterThanOrEqual(7)
    expect(Math.min(...boss.map((r) => r.level!))).toBe(2) // un cran sous le niveau 3
    expect(Math.max(...boss.map((r) => r.level!))).toBeLessThanOrEqual(4)
  })

  it('chaque salle franchie devient un point de reprise', async () => {
    const { controller, save } = setup([ev.room(1), ev.enemy('1.0'), ev.leave])
    const result = await controller.run()
    expect(result.status).toBe('left')
    expect(save.checkpoints.tour_fractions).toBe(2) // salle 1 franchie : on reprendra à la salle 2
  })

  it('reprend au point de reprise : pas d’introduction, salles d’avant franchies', async () => {
    const save = new FakeSave()
    save.checkpoints.tour_fractions = 4
    const { controller, ui } = setup([ev.room(4), ev.enemy('4.0'), ev.leave], {}, { save })
    await controller.run()
    expect(ui.messages).toEqual([]) // ni introduction ni présentation de l'énigme
    expect(ui.banners[0]!.text).toBe(`Reprise : ${FRACTIONS.rooms[4]!.title}`)
    expect(controller.progress.enemies.filter((e) => e.room < 4).every((e) => e.defeated)).toBe(true)
    expect(controller.progress.solved.size).toBe(3)
  })

  it('la première fois rend la page, les suivantes disent seulement le mot de la fin', async () => {
    const save = new FakeSave()
    save.data.places.tour_fractions = 1
    const { controller, ui } = setup(FULL_RUN, {}, { save })
    await controller.run()
    expect(ui.messages.at(-1)).toBe(`${FRACTIONS.title} : terminé !`)
    expect(save.stories).toEqual([])
    expect(save.data.places.tour_fractions).toBe(2)
  })
})

describe('combat', () => {
  it('un ennemi vaincu rapporte de l’XP, et le héros reprend son souffle entre deux combats', async () => {
    const save = new FakeSave()
    const { controller, ui } = setup([ev.room(1), ev.enemy('1.0'), ev.leave], { answers: [{ correct: false }] }, { save })
    await controller.run()
    // Le Champignon des moitiés a 60 PV : 1 erreur (riposte 8), puis 4 coups de 18.
    expect(save.data.xp).toBeGreaterThanOrEqual(FRACTIONS.rooms[1]!.enemies![0]!.xp)
    expect(ui.hero[0]).toBeGreaterThan(80) // blessé puis soigné de moitié
    expect(ui.enemy.name).toBeNull() // plus d'ennemi à l'écran
  })

  it('un repli ramène le héros en pleine forme, et l’ennemi garde ses blessures', async () => {
    const wrongs = Array(20).fill({ correct: false })
    const { controller, ui, stage } = setup([ev.room(1), ev.enemy('1.0'), ev.leave], { answers: [{ correct: true }, ...wrongs] }, { random: () => 0.999 })
    await controller.run()
    expect(ui.messages).toContain('Repli')
    expect(stage.log).toContain('fin 1.0 retreat')
    expect(ui.hero).toEqual([100, 100])
    const enemy = controller.progress.enemy('1.0')!
    expect(enemy.defeated).toBe(false)
    expect(enemy.fighter.hp).toBe(60 - 18) // le premier coup reste acquis
  })

  it('le héros peut reprendre le combat après un repli, et l’Effaceur ne se présente qu’une fois', async () => {
    // L'Effaceur (force 4) frappe à 14 : 8 erreurs suffisent à faire reculer le héros (100 PV).
    const lose = Array(8).fill({ correct: false })
    const { controller, ui } = setup(
      [ev.room(5), ev.enemy('5.0'), ev.enemy('5.0'), ev.leave],
      { answers: [...lose, ...Array(40).fill({ correct: true })] },
      { random: () => 0.999, save: Object.assign(new FakeSave(), { checkpoints: { tour_fractions: 5 } }) },
    )
    const result = await controller.run()
    expect(ui.messages).toEqual(['Le Grand Diviseur', 'Repli', 'Le Grand Diviseur']) // présentation (une seule fois), repli, défaite
    expect(controller.progress.enemy('5.0')!.defeated).toBe(true)
    expect(result.status).toBe('left')
  })

  it('l’Effaceur est abordé en pleine forme', async () => {
    const save = new FakeSave()
    save.checkpoints.tour_fractions = 5
    const { controller, stage } = setup([ev.room(5), ev.enemy('5.0'), ev.leave], {}, { save })
    controller.hero.damage(60)
    await controller.run()
    expect(stage.log).toContain('soigné')
    expect(controller.hero.hp).toBeGreaterThan(40)
  })

  it('« Pas vu en classe » sans autre question ne coûte pas le tour et ne compte rien', async () => {
    const { controller, stage, questions } = setup([ev.room(1), ev.enemy('1.0'), ev.leave], { answers: [{ result: null }, { correct: true }], choices: [{ kind: 'action', action: 'automatisme' }, { kind: 'action', action: 'automatisme' }, { kind: 'leave' }] })
    await controller.run()
    expect(stage.turns).toHaveLength(1)
    expect(questions.answered).toBe(1)
  })

  it('le soin ne se propose que si le héros est blessé, et pose une question du chapitre', async () => {
    const { controller, ui, questions } = setup([ev.room(1), ev.enemy('1.0'), ev.leave], { answers: [{ correct: false }], choices: [{ kind: 'action', action: 'automatisme' }, { kind: 'action', action: 'soin' }, { kind: 'leave' }] })
    await controller.run()
    expect(ui.menus.map((m) => m.canHeal)).toEqual([false, true, true])
    expect(questions.requested.map((r) => r.role)).toEqual(['automatisme', 'chapitre'])
  })

  it('sortir pendant un combat quitte le lieu sans rien perdre', async () => {
    const { controller, save } = setup([ev.room(1), ev.enemy('1.0')], { choices: [{ kind: 'leave' }] })
    const result = await controller.run()
    expect(result.status).toBe('left')
    expect(controller.progress.enemy('1.0')!.defeated).toBe(false)
    expect(save.data.xp).toBe(0)
  })

  it('une question sans item disponible n’arrête pas le combat', async () => {
    const { controller, ui, questions } = setup([ev.room(1), ev.enemy('1.0')], { choices: [{ kind: 'action', action: 'automatisme' }, { kind: 'leave' }] })
    questions.unavailable.add('automatisme')
    await controller.run()
    expect(ui.banners.map((b) => b.text)).toContain('Aucune question disponible')
  })
})

describe('sac en combat', () => {
  it('la potion rend la vie et part du sac ; le bouclier aussi ; sans objet rien ne se passe', async () => {
    const save = new FakeSave()
    save.data.items = { potion: 1, bouclier: 1 }
    const { controller, stage, ui } = setup([ev.room(1), ev.enemy('1.0')], {
      answers: [{ correct: false }],
      choices: [{ kind: 'action', action: 'automatisme' }, { kind: 'bag', item: 'potion' }, { kind: 'bag', item: 'bouclier' }, { kind: 'bag', item: 'bouclier' }, { kind: 'bag', item: 'plume' }, { kind: 'leave' }],
    }, { save })
    await controller.run()
    expect(stage.log.filter((l) => l.startsWith('bag'))).toEqual(['bag potion', 'bag shield']) // 2e bouclier refusé, plume inutilisable en combat
    expect(save.data.items).toEqual({ potion: 0, bouclier: 0 })
    expect(ui.hero).toEqual([100, 100])
  })
})

describe('énigme', () => {
  it('trois piédestaux ouvrent la porte ; une erreur réarme le piédestal et ne rapporte rien', async () => {
    const { controller, stage, save } = setup(
      [ev.room(3), ev.pedestal(0), ev.pedestal(0), ev.pedestal(1), ev.pedestal(2), ev.leave],
      { answers: [{ correct: false }] },
      { save: Object.assign(new FakeSave(), { checkpoints: { tour_fractions: 3 } }) },
    )
    await controller.run()
    expect(stage.log).toEqual(['piédestal 0 réarmé', 'piédestal 0 résolu', 'piédestal 1 résolu', 'piédestal 2 résolu', 'porte 3'])
    expect(controller.progress.isCleared(3)).toBe(true)
    expect(save.checkpoints.tour_fractions).toBe(4)
    expect(save.data.xp).toBe(3 * (FRACTIONS.enigma.xp + 20)) // XP de l'énigme + 10 × difficulté 2, trois fois
  })

  it('un objet attendait sur le dernier piédestal', async () => {
    const { controller, save } = setup(
      [ev.room(3), ev.pedestal(0), ev.pedestal(1), ev.pedestal(2), ev.leave],
      {}, { save: Object.assign(new FakeSave(), { checkpoints: { tour_fractions: 3 } }) },
    )
    await controller.run()
    expect(Object.values(save.data.items).reduce((a, b) => a + (b ?? 0), 0)).toBe(1)
  })

  it('sans énigme jouable (hors connexion, visuel non dessiné), une question du chapitre la remplace', async () => {
    const { controller, stage, ui, questions } = setup([ev.room(3), ev.pedestal(1), ev.leave], {}, { save: Object.assign(new FakeSave(), { checkpoints: { tour_fractions: 3 } }) })
    questions.unavailable.add('enigme')
    await controller.run()
    expect(questions.requested.map((r) => r.role)).toEqual(['enigme', 'chapitre'])
    expect(ui.asked[0]!.mode).toBe('enigme')
    expect(stage.log).toEqual(['piédestal 1 résolu'])
  })

  it('sans aucune question, le piédestal se réarme et le lieu reste jouable', async () => {
    const { controller, stage, ui, questions } = setup([ev.room(3), ev.pedestal(1), ev.leave], {}, { save: Object.assign(new FakeSave(), { checkpoints: { tour_fractions: 3 } }) })
    questions.unavailable.add('enigme')
    questions.unavailable.add('chapitre')
    await controller.run()
    expect(ui.banners.map((b) => b.text)).toContain('Aucune question disponible pour cette énigme')
    expect(stage.log).toEqual(['piédestal 1 réarmé'])
  })

  it('un piédestal déjà résolu ne repose pas de question', async () => {
    const { controller, ui } = setup([ev.room(3), ev.pedestal(0), ev.pedestal(0), ev.leave], {}, { save: Object.assign(new FakeSave(), { checkpoints: { tour_fractions: 3 } }) })
    await controller.run()
    expect(ui.asked).toHaveLength(1)
  })
})

describe('progression du héros', () => {
  it('une montée de niveau soigne le héros et agrandit sa vie', async () => {
    const save = new FakeSave()
    save.data.xp = 195 // le premier ennemi (30 XP) fait passer au niveau 2 (200 XP)
    const { controller, stage, ui } = setup([ev.room(1), ev.enemy('1.0'), ev.leave], {}, { save })
    await controller.run()
    expect(levelForXp(save.data.xp)).toBe(2)
    expect(stage.log).toContain('niveau')
    expect(ui.banners.map((b) => b.text)).toContain('Niveau 2 !')
    expect(controller.hero.maxHp).toBe(110)
  })

  it('porte le ton du monde : textes du Brouillard et dégâts plus forts', async () => {
    const lose = Array(20).fill({ correct: false })
    const { controller, ui } = setup([ev.room(1), ev.enemy('1.0'), ev.leave], { answers: lose }, { world: 'brouillard', random: () => 0 })
    await controller.run()
    expect(ui.messages).toContain('Repli')
    expect(combat.brouillard.retreat_text).toContain('Brouillard')
    // 9 + force 1 = 10 par coup : repli au 10e échec
    expect(controller.progress.enemy('1.0')!.fighter.hp).toBe(60)
  })
})

describe('autres issues', () => {
  it('quitte quand l’enfant sort, ou quand le temps de jeu est écoulé', async () => {
    expect((await setup([ev.leave]).controller.run()).status).toBe('left')
    expect((await setup([{ kind: 'timeOver' }]).controller.run()).status).toBe('timeOver')
  })

  it('le héros dit une phrase au départ et à chaque porte ouverte', async () => {
    const { controller, ui } = setup([ev.room(1), ev.enemy('1.0'), ev.leave])
    await controller.run()
    expect(ui.said.length).toBe(2) // départ, puis salle 1 franchie
    expect(ui.said.every((s) => s.length > 0)).toBe(true)
  })

  it('ne rouvre pas le coffre avant que l’Effaceur soit vaincu', async () => {
    const { controller, stage } = setup([ev.chest, ev.leave])
    const result = await controller.run()
    expect(result.status).toBe('left')
    expect(stage.log).not.toContain('coffre ouvert')
  })
})

// Évite un avertissement d'import inutilisé selon la configuration de typage.
export type _Used = [Action, Fighter]
