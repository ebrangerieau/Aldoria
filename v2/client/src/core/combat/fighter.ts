/** Un combattant : nom et points de vie (la mise en scène est dans game/combat). */
export class Fighter {
  hp: number

  constructor(
    readonly name: string,
    public maxHp: number,
    hp = maxHp,
  ) {
    this.hp = Math.max(0, Math.min(maxHp, hp))
  }

  /** Toute la vie (avant l'Effaceur, après un repli) ; rend ce qui a été récupéré. */
  restore(): number {
    return this.heal(this.maxHp)
  }

  /** Nouveau maximum (montée de niveau) : le héros est soigné. */
  setMax(maxHp: number): void {
    this.maxHp = maxHp
    this.hp = maxHp
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
