/**
 * Un lieu de quête en cours : ses ennemis (avec leurs blessures), son énigme, ce qui est franchi.
 * Règles pures portées de la v1 (scenes/dungeon/dungeon.gd) ; le déroulé est dans controller.ts.
 *
 * Chaque salle franchie devient un point de reprise (SaveGame.checkpoints) : quitter au milieu du
 * lieu ne perd rien. Un repli à 0 PV ramène à l'entrée de la salle sans rien enlever : l'ennemi
 * garde ses blessures.
 */
import { Fighter } from '../combat/fighter'
import { answerXp } from '../progression/progression'
import type { DungeonData, EnemySpec, RoomSpec } from '../world/places'

/** Trois piédestaux dans la salle-énigme : une question chacun. */
export const PEDESTAL_COUNT = 3

export interface EnemyState {
  id: string
  room: number
  spec: EnemySpec
  boss: boolean
  defeated: boolean
  /** L'Effaceur se présente une fois par partie, pas après un repli. */
  taunted: boolean
  fighter: Fighter
}

/** Salle de reprise d'un lieu : celle du point de reprise, ramenée aux salles qui existent. */
export const resumeRoom = (def: DungeonData, saved: number): number => Math.max(0, Math.min(def.rooms.length - 1, saved))

export class Progress {
  readonly enemies: EnemyState[] = []
  /** Piédestaux résolus (indices 0 à 2). */
  readonly solved = new Set<number>()

  constructor(
    readonly def: DungeonData,
    /** Salle de reprise : les salles d'avant sont déjà franchies. */
    readonly checkpoint = 0,
  ) {
    def.rooms.forEach((room, i) => {
      room.enemies?.forEach((spec, k) => {
        this.enemies.push({
          id: `${i}.${k}`,
          room: i,
          spec,
          boss: room.kind === 'boss',
          defeated: i < checkpoint,
          taunted: false,
          fighter: new Fighter(spec.name, spec.hp),
        })
      })
    })
    if (checkpoint > this.enigmaRoom && this.enigmaRoom >= 0) for (let i = 0; i < PEDESTAL_COUNT; i += 1) this.solved.add(i)
  }

  get rooms(): readonly RoomSpec[] {
    return this.def.rooms
  }

  get enigmaRoom(): number {
    return this.def.rooms.findIndex((r) => r.kind === 'enigme')
  }

  get bossRoom(): number {
    return this.def.rooms.findIndex((r) => r.kind === 'boss')
  }

  enemy(id: string): EnemyState | undefined {
    return this.enemies.find((e) => e.id === id)
  }

  /** La porte de la salle s'ouvre quand tous ses ennemis sont vaincus, ou son énigme résolue. */
  isCleared(room: number): boolean {
    const kind = this.def.rooms[room]?.kind
    if (kind === 'combat') return this.enemies.every((e) => e.room !== room || e.defeated)
    if (kind === 'enigme') return this.solved.size >= PEDESTAL_COUNT
    return false
  }

  get bossDefeated(): boolean {
    return this.enemies.filter((e) => e.boss).every((e) => e.defeated)
  }
}

/** Souffle repris entre deux combats : la moitié des PV manquants (pas avant l'Effaceur : il se soigne en entier). */
export function breathe(hero: Fighter): number {
  return hero.heal(Math.ceil((hero.maxHp - hero.hp) / 2))
}

/** XP d'un piédestal résolu : celle de l'énigme, plus celle de la question. */
export function enigmaReward(def: DungeonData, difficulty: number): number {
  return def.enigma.xp + answerXp(difficulty)
}

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

/** Ce qui s'affiche à l'ouverture du coffre : la page rendue (première fois) ou le mot de la fin. */
export function chestMessage(
  def: DungeonData,
  facts: { first: boolean; answered: number; correct: number; itemsText: string },
): { title: string; text: string } {
  const story = facts.first && def.page_text ? def.page_text : def.outro
  const lines = [story, `${facts.correct} bonnes réponses sur ${facts.answered}. +${def.chest_xp} XP dans le coffre.`]
  if (facts.itemsText) lines.push(facts.itemsText)
  const title = facts.first && def.page ? `${capitalize(def.page)} retrouvée !` : `${def.title} : terminé !`
  return { title, text: lines.join('\n') }
}
