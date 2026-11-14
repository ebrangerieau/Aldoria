/** Un combattant : nom et points de vie (la mise en scène est dans game/combat). */
export class Fighter {
  hp: number

  constructor(
    readonly name: string,
    readonly maxHp: number,
    hp = maxHp,
  ) {
    this.hp = Math.max(0, Math.min(maxHp, hp))
  }

  get alive(): boolean {
    return this.hp > 0
  }

  /** Retire des PV ; rend ce qui a vraiment été retiré. */
  damage(amount: number): number {
    const lost = Math.min(this.hp, Math.max(0, Math.round(amount)))
    this.hp -= lost
    return lost
  }

  /** Rend des PV ; rend ce qui a vraiment été récupéré. */
  heal(amount: number): number {
    const gained = Math.min(this.maxHp - this.hp, Math.max(0, Math.round(amount)))
    this.hp += gained
    return gained
  }
}
