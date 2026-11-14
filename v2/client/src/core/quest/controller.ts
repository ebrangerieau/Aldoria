/**
 * Déroulé d'un lieu de quête, porté de scenes/dungeon/dungeon.gd (v1) : exploration salle par
 * salle, combats au contact, énigme à trois piédestaux, Effaceur, coffre, note de fin. Aucune
 * dépendance au moteur 3D ni à React : la scène (QuestStage) et l'interface (QuestUi) sont
 * injectées, ce qui permet de tester tout le parcours avec des faux (tests/quest-controller.test.ts).
 *
 * Règles qui ne bougent pas : aucune question contre la montre (le monde se fige pendant qu'un
 * panneau est ouvert), une erreur n'est jamais punie (explication, la notion reviendra), un repli ne
 * fait rien perdre (l'ennemi garde ses blessures), chaque salle franchie est un point de reprise.
 */
import combat from '@content/monde/combat.json'
import { Encounter, type Action, type BagEffect, type TurnResult, type World } from '../combat/encounter'
import { Fighter } from '../combat/fighter'
import type { Item, Role } from '../items'
import { draw, foundText, type ItemId, type Owned } from '../progression/inventory'
import { heroMaxHp, levelForXp } from '../progression/progression'
import type { SubmitResult } from '../questionService'
import type { DungeonData } from '../world/places'
import type { HeroVoice } from './heroVoice'
import { breathe, chestMessage, type EnemyState, enigmaReward, Progress } from './run'

export type Tone = 'good' | 'bad' | 'accent' | 'gold' | 'plain'

/** Ce qui arrive pendant que l'enfant explore (la scène l'annonce, le contrôleur décide). */
export type StageEvent =
  | { kind: 'room'; index: number }
  | { kind: 'enemy'; id: string }
  | { kind: 'pedestal'; index: number }
  | { kind: 'chest' }
  | { kind: 'leave' }
  | { kind: 'timeOver' }

/** Le monde 3D : mouvements, animations, portes, coffre. Chaque méthode rend la main quand c'est fini. */
export interface QuestStage {
  /** Commandes actives jusqu'au prochain événement. */
  explore(): Promise<StageEvent>
  /** Le héros se place face à l'ennemi, qui se réveille. */
  engage(enemy: EnemyState): Promise<void>
  playTurn(enemy: EnemyState, turn: TurnResult, hero: Fighter): Promise<void>
  playBag(effect: BagEffect, hero: Fighter): Promise<void>
  /** Après un combat : victoire (l'ennemi tombe) ou repli (le héros revient à l'entrée de la salle). */
  endFight(enemy: EnemyState, outcome: 'victory' | 'retreat'): Promise<void>
  openDoor(room: number): Promise<void>
  pedestalSolved(index: number): Promise<void>
  /** Mauvaise réponse : le piédestal se réarme quand le héros s'éloigne. */
  pedestalRearm(index: number): void
  spawnChest(): Promise<void>
  openChest(): Promise<void>
  /** Le héros reprend des forces (étincelles). */
  restored(): void
  levelUp(): void
}

export interface AskOutcome {
  item: Item
  /** null : question mise de côté sans réponse (« Pas vu en classe »). */
  result: SubmitResult | null
  /** Indice ordinaire demandé : réduit la puissance (ni la plume ni le parchemin). */
  hintUsed: boolean
}

export type ActionChoice = { kind: 'action'; action: Action } | { kind: 'bag'; item: ItemId } | { kind: 'leave' }

/** L'interface : panneaux, bandeaux, barres de vie, questions. */
export interface QuestUi {
  message(title: string, text: string, button: string): Promise<void>
  banner(text: string, tone: Tone, seconds?: number): void
  say(text: string): void
  setHero(hp: number, maxHp: number): void
  /** null : plus d'ennemi à l'écran. */
  setEnemy(name: string | null, hp?: number, maxHp?: number): void
  chooseAction(menu: { canHeal: boolean; bag: Owned; canUse: (id: ItemId) => boolean; names: Record<Action, string> }): Promise<ActionChoice>
  ask(item: Item, title: string, gameMode: string, success: string): Promise<AskOutcome>
  /** Note de plaisir de 1 à 5 ; 0 si l'enfant passe. */
  rating(title: string): Promise<number>
}

export interface QuestSave {
  data: { xp: number; items: Owned; places: Record<string, number> }
  addXp(amount: number): void
  completePlace(code: string): void
  markStory(step: string): void
  giveItems(ids: readonly ItemId[]): void
  useItem(id: ItemId): boolean
  checkpoint(code: string): number
  setCheckpoint(code: string, room: number): void
}

export interface QuestQuestions {
  next(role?: Role, level?: number): Item | null
  levelFor(role: Role): number
  readonly answered: number
  readonly correctCount: number
}

export interface QuestServices {
  questions: QuestQuestions
  save: QuestSave
  voice: HeroVoice
  world: World
  /** Aménagement « sans pénalité de lenteur ». */
  noSpeed: boolean
  random?: () => number
}

export interface QuestResult {
  status: 'completed' | 'left' | 'timeOver'
  /** Note de fin de lieu (0 si non donnée). */
  rating: number
  answered: number
  correct: number
}

type FightOutcome = 'victory' | 'retreat' | 'left' | 'timeOver'

export class QuestController {
  readonly progress: Progress
  readonly hero: Fighter
  private readonly visited = new Set<number>()
  private readonly texts: (typeof combat)['lumineux']
  private readonly random: () => number
  private chestReady = false

  constructor(
    readonly def: DungeonData,
    private readonly stage: QuestStage,
    private readonly ui: QuestUi,
    private readonly services: QuestServices,
  ) {
    const checkpoint = Math.max(0, Math.min(def.rooms.length - 1, services.save.checkpoint(def.code)))
    this.progress = new Progress(def, checkpoint)
    this.hero = new Fighter('Héros', heroMaxHp(levelForXp(services.save.data.xp)))
    this.texts = services.world === 'brouillard' ? combat.brouillard : combat.lumineux
    this.random = services.random ?? Math.random
  }

  async run(): Promise<QuestResult> {
    const { def, ui, services } = this
    const checkpoint = this.progress.checkpoint
    ui.setHero(this.hero.hp, this.hero.maxHp)
    ui.setEnemy(null)
    if (checkpoint === 0) await ui.message(def.title, def.intro, 'En avant !')
    else ui.banner(`Reprise : ${def.rooms[checkpoint]!.title}`, 'plain', 1.2)
    ui.say(services.voice.beforeRoom(services.world, def.rooms, Math.max(1, checkpoint), true))
    // Salles déjà franchies : on ne s'y présente plus.
    for (let i = 0; i <= checkpoint; i += 1) this.visited.add(i)
    for (;;) {
      const event = await this.stage.explore()
      switch (event.kind) {
        case 'leave':
          return this.result('left')
        case 'timeOver':
          return this.result('timeOver')
        case 'room':
          await this.enterRoom(event.index)
          break
        case 'enemy': {
          const outcome = await this.fight(event.id)
          if (outcome === 'left') return this.result('left')
          if (outcome === 'timeOver') return this.result('timeOver')
          break
        }
        case 'pedestal':
          await this.solvePedestal(event.index)
          break
        case 'chest': {
          if (!this.chestReady) break
          const rating = await this.openChest()
          return this.result('completed', rating)
        }
      }
    }
  }

  private result(status: QuestResult['status'], rating = 0): QuestResult {
    return { status, rating, answered: this.services.questions.answered, correct: this.services.questions.correctCount }
  }

  // --- Salles ----------------------------------------------------------------------------

  private async enterRoom(index: number): Promise<void> {
    if (this.visited.has(index)) return
    this.visited.add(index)
    const room = this.def.rooms[index]
    if (!room) return
    if (room.kind === 'enigme') {
      if (!this.progress.isCleared(index)) await this.ui.message(this.def.enigma.title, this.def.enigma.intro, "C'est parti")
    } else if (room.kind === 'boss') {
      this.ui.banner(room.title, 'bad', 1.4)
    } else if (index > 0) {
      this.ui.banner(room.title, 'plain', 1)
    }
  }

  /** La porte s'ouvre quand la salle est franchie ; chaque salle franchie est un point de reprise. */
  private async checkRoomCleared(room: number): Promise<void> {
    if (!this.progress.isCleared(room)) return
    const { ui, services, def } = this
    await this.stage.openDoor(room)
    ui.banner('La porte s’ouvre !', 'accent', 1.2)
    services.save.setCheckpoint(def.code, room + 1)
    if (def.rooms[room]!.kind === 'enigme') {
      // Énigme résolue : un objet attendait sur le dernier piédestal.
      const found = draw(services.save.data.items, 1, this.random)
      services.save.giveItems(found)
      if (found.length > 0) ui.banner(foundText(found).replace('Dans ton sac', 'Trouvé'), 'gold', 1.6)
    }
    ui.say(services.voice.beforeRoom(services.world, def.rooms, room + 1))
  }

  // --- Combats ---------------------------------------------------------------------------

  private async fight(id: string): Promise<FightOutcome> {
    const enemy = this.progress.enemy(id)
    if (!enemy || enemy.defeated) return 'victory'
    const { ui, stage, services } = this
    await stage.engage(enemy)
    if (enemy.boss) {
      // Grand combat : le héros l'aborde avec toutes ses forces.
      if (this.hero.hp < this.hero.maxHp) {
        this.hero.restore()
        ui.setHero(this.hero.hp, this.hero.maxHp)
        stage.restored()
      }
      ui.banner(enemy.spec.name, 'bad', 1.2)
      if (this.def.boss_intro && !enemy.taunted) {
        // L'Effaceur se présente (une fois par partie, pas après un repli).
        enemy.taunted = true
        await ui.message(enemy.spec.name, this.def.boss_intro, 'En garde !')
      }
    }
    ui.setEnemy(enemy.fighter.name, enemy.fighter.hp, enemy.fighter.maxHp)
    const encounter = new Encounter({
      hero: this.hero,
      enemy: enemy.fighter,
      tier: enemy.spec.tier,
      boss: enemy.boss,
      world: services.world,
      noSpeed: services.noSpeed,
      baseLevels: { automatisme: services.questions.levelFor('automatisme'), chapitre: services.questions.levelFor('chapitre') },
      random: this.random,
    })
    const outcome = await this.fightLoop(encounter, enemy)
    ui.setEnemy(null)
    if (outcome === 'victory') {
      enemy.defeated = true
      this.gainXp(enemy.spec.xp)
      await stage.endFight(enemy, 'victory')
      if (enemy.boss) await this.bossDefeated()
      else {
        breathe(this.hero)
        ui.setHero(this.hero.hp, this.hero.maxHp)
        await this.checkRoomCleared(enemy.room)
      }
    } else if (outcome === 'retreat') {
      await ui.message('Repli', this.texts.retreat_text, "Reprendre l'exploration")
      // Les coups portés restent acquis : l'ennemi, boss compris, garde ses blessures.
      this.hero.restore()
      ui.setHero(this.hero.hp, this.hero.maxHp)
      await stage.endFight(enemy, 'retreat')
      stage.restored()
    }
    return outcome
  }

  private async fightLoop(encounter: Encounter, enemy: EnemyState): Promise<FightOutcome> {
    const { ui, stage, services } = this
    for (;;) {
      const choice = await ui.chooseAction({
        canHeal: encounter.canHeal,
        bag: services.save.data.items,
        canUse: (id) => encounter.canUse(id, services.save.data.items[id] ?? 0),
        names: this.texts.actions as Record<Action, string>,
      })
      if (choice.kind === 'leave') return 'left'
      if (choice.kind === 'bag') {
        // Sans question et sans perdre son tour ; l'objet part du sac seulement s'il a servi.
        if (!encounter.canUse(choice.item, services.save.data.items[choice.item] ?? 0)) continue
        const effect = encounter.useBag(choice.item)
        if (!effect) continue
        services.save.useItem(choice.item)
        await stage.playBag(effect, this.hero)
        ui.setHero(this.hero.hp, this.hero.maxHp)
        continue
      }
      const role = Encounter.roleOf(choice.action)
      const item = services.questions.next(role, encounter.levelFor(role))
      if (!item) {
        ui.banner('Aucune question disponible', 'bad')
        continue
      }
      const asked = await ui.ask(item, this.texts.actions[choice.action], enemy.boss ? 'boss' : 'combat', encouragement(this.texts.encouragements, this.random))
      // « Pas vu en classe » sans autre question : rien n'est compté, le tour n'est pas perdu.
      if (!asked.result) continue
      const turn = encounter.turn(choice.action, {
        correct: asked.result.correct,
        speedRatio: asked.result.speedRatio,
        rewardFactor: asked.result.rewardFactor,
        difficulty: asked.item.difficulty,
        hintPenalized: asked.hintUsed,
      })
      if (turn.resolution.kind !== 'miss') this.gainXp(turn.resolution.xp)
      await stage.playTurn(enemy, turn, this.hero)
      ui.setHero(this.hero.hp, this.hero.maxHp)
      ui.setEnemy(enemy.fighter.name, enemy.fighter.hp, enemy.fighter.maxHp)
      if (turn.outcome === 'victory') return 'victory'
      if (turn.outcome === 'retreat') return 'retreat'
    }
  }

  private async bossDefeated(): Promise<void> {
    const boss = this.progress.enemies.find((e) => e.boss)
    if (this.def.boss_defeat && boss) await this.ui.message(boss.spec.name, this.def.boss_defeat, 'Reprendre la page')
    await this.stage.spawnChest()
    this.chestReady = true
    this.ui.banner('Un coffre est apparu !', 'gold', 1.4)
  }

  // --- Énigme ----------------------------------------------------------------------------

  private async solvePedestal(index: number): Promise<void> {
    if (this.progress.solved.has(index)) return
    const { ui, stage, services, def } = this
    const item = services.questions.next('enigme')
    if (!item) {
      ui.banner('Énigme indisponible hors connexion', 'bad')
      stage.pedestalRearm(index)
      return
    }
    const asked = await ui.ask(item, def.enigma.title, 'enigme', 'Bravo ! Le cristal s’illumine.')
    if (asked.result?.correct) {
      this.progress.solved.add(index)
      await stage.pedestalSolved(index)
      ui.banner(encouragement(this.texts.encouragements, this.random), 'good', 0.8)
      this.gainXp(enigmaReward(def, asked.item.difficulty))
      await this.checkRoomCleared(this.progress.enigmaRoom)
    } else {
      // Erreur (ou question mise de côté) : l'explication a été montrée ; on peut réessayer en s'éloignant.
      stage.pedestalRearm(index)
    }
  }

  // --- Coffre ----------------------------------------------------------------------------

  private async openChest(): Promise<number> {
    const { ui, stage, services, def } = this
    this.chestReady = false
    await stage.openChest()
    const first = (services.save.data.places[def.code] ?? 0) === 0
    this.gainXp(def.chest_xp)
    services.save.completePlace(def.code)
    services.save.setCheckpoint(def.code, 0)
    if (first) services.save.markStory(`page-${def.code}`)
    const found = draw(services.save.data.items, 2, this.random)
    services.save.giveItems(found)
    const { title, text } = chestMessage(def, {
      first,
      answered: services.questions.answered,
      correct: services.questions.correctCount,
      itemsText: foundText(found),
    })
    await ui.message(title, text, 'Continuer')
    return ui.rating(def.title)
  }

  /** XP gagnée : une montée de niveau soigne le héros et agrandit sa barre de vie. */
  private gainXp(amount: number): void {
    const { save } = this.services
    const before = levelForXp(save.data.xp)
    save.addXp(amount)
    const after = levelForXp(save.data.xp)
    if (after > before) {
      this.hero.setMax(heroMaxHp(after))
      this.ui.setHero(this.hero.hp, this.hero.maxHp)
      this.ui.banner(`Niveau ${after} !`, 'gold', 1.4)
      this.stage.levelUp()
    }
  }
}

function encouragement(texts: readonly string[], random: () => number): string {
  return texts[Math.floor(random() * texts.length)] ?? ''
}
