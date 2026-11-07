/**
 * Hauteurs du relief échantillonnées sur la grille du maillage du sol. Le héros, le renard
 * et la caméra lisent la hauteur ici, interpolée sur les mêmes triangles que ceux qu'on voit
 * à l'écran : les pieds touchent toujours le sol affiché (ni flottement ni enfoncement).
 *
 * Grille : (n + 1)² sommets, x et z de -size/2 à +size/2. Chaque case a deux triangles,
 * séparés par la diagonale qui va du sommet (i + 1, j) au sommet (i, j + 1), comme
 * MeshBuilder.CreateGround de Babylon.js.
 */
export class HeightGrid {
  readonly heights: Float32Array
  readonly cell: number

  constructor(
    readonly size: number,
    readonly subdivisions: number,
    sample: (x: number, z: number) => number,
  ) {
    const n = subdivisions
    this.cell = size / n
    this.heights = new Float32Array((n + 1) * (n + 1))
    for (let j = 0; j <= n; j += 1) {
      for (let i = 0; i <= n; i += 1) {
        this.heights[j * (n + 1) + i] = sample(this.xOf(i), this.zOf(j))
      }
    }
  }

  xOf(i: number): number {
    return -this.size / 2 + i * this.cell
  }

  zOf(j: number): number {
    return -this.size / 2 + j * this.cell
  }

  at(i: number, j: number): number {
    const n = this.subdivisions
    const ci = Math.min(n, Math.max(0, i))
    const cj = Math.min(n, Math.max(0, j))
    return this.heights[cj * (n + 1) + ci]!
  }

  /** Hauteur du sol affiché en (x, z) ; hors de la grille, celle du bord le plus proche. */
  heightAt(x: number, z: number): number {
    const gx = (x + this.size / 2) / this.cell
    const gz = (z + this.size / 2) / this.cell
    const i = Math.min(this.subdivisions - 1, Math.max(0, Math.floor(gx)))
    const j = Math.min(this.subdivisions - 1, Math.max(0, Math.floor(gz)))
    const fx = Math.min(1, Math.max(0, gx - i))
    const fz = Math.min(1, Math.max(0, gz - j))
    const h00 = this.at(i, j)
    const h10 = this.at(i + 1, j)
    const h01 = this.at(i, j + 1)
    const h11 = this.at(i + 1, j + 1)
    if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz
    return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz)
  }
}
