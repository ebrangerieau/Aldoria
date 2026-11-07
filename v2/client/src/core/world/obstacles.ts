/**
 * Obstacles du héros : des cercles au sol (troncs, bâtiments, rochers), rangés dans une grille
 * de cases pour ne tester que les voisins. Plus simple et plus prévisible qu'un moteur
 * physique pour marcher dans une île ; un moteur physique (Havok) viendra seulement si un jeu
 * en a besoin (blocs à pousser, objets à lancer).
 */
export interface Circle {
  x: number
  z: number
  r: number
}

export class Obstacles {
  private cells = new Map<string, Circle[]>()
  count = 0

  constructor(private readonly cellSize = 16) {}

  add(circle: Circle): void {
    const span = Math.ceil(circle.r / this.cellSize)
    const ci = Math.floor(circle.x / this.cellSize)
    const cj = Math.floor(circle.z / this.cellSize)
    for (let di = -span; di <= span; di += 1) {
      for (let dj = -span; dj <= span; dj += 1) {
        const key = `${ci + di},${cj + dj}`
        const list = this.cells.get(key) ?? []
        list.push(circle)
        this.cells.set(key, list)
      }
    }
    this.count += 1
  }

  near(x: number, z: number): Circle[] {
    return this.cells.get(`${Math.floor(x / this.cellSize)},${Math.floor(z / this.cellSize)}`) ?? []
  }

  /** Position corrigée d'un corps de rayon `radius` : repoussé hors de chaque cercle. */
  resolve(x: number, z: number, radius: number): { x: number; z: number } {
    let px = x
    let pz = z
    for (let pass = 0; pass < 2; pass += 1) {
      for (const c of this.near(px, pz)) {
        const dx = px - c.x
        const dz = pz - c.z
        const min = c.r + radius
        const d = Math.hypot(dx, dz)
        if (d >= min) continue
        if (d < 1e-6) {
          px = c.x + min
          continue
        }
        px = c.x + (dx / d) * min
        pz = c.z + (dz / d) * min
      }
    }
    return { x: px, z: pz }
  }

  /** Vrai si un cercle de ce rayon chevauche un obstacle (placement du décor). */
  overlaps(x: number, z: number, radius: number): boolean {
    return this.near(x, z).some((c) => Math.hypot(x - c.x, z - c.z) < c.r + radius)
  }
}
