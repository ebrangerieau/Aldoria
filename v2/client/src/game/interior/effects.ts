/**
 * Effets de l'intérieur des lieux : étincelles, éclats de coup, flammes de torche, projectile du
 * sort. Peu de particules (un enfant les trouve beau, pas un spectacle) et moins encore en mode
 * calme (aménagement `calm` : pas d'éclat fort ni de secousse).
 */
import {
  Color3,
  Color4,
  DynamicTexture,
  MeshBuilder,
  ParticleSystem,
  type Scene,
  StandardMaterial,
  type Texture,
  Vector3,
} from '@babylonjs/core'

/** Disque lumineux doux, partagé par tous les effets de la scène. */
export function glowTexture(scene: Scene): Texture {
  const texture = new DynamicTexture('lueur', 64, scene, false)
  const ctx = texture.getContext()
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  texture.update()
  return texture
}

export class Effects {
  private readonly glow: Texture

  constructor(
    private readonly scene: Scene,
    private readonly calm: boolean,
  ) {
    this.glow = glowTexture(scene)
  }

  /** Gerbe de lumière (coup, coffre). `power` : vitesse des étincelles. */
  burst(at: Vector3, color: Color3, count: number, power = 4): void {
    const n = this.calm ? Math.ceil(count / 3) : count
    const ps = new ParticleSystem('eclat', n, this.scene)
    ps.particleTexture = this.glow
    ps.emitter = at.clone()
    ps.minEmitBox = ps.maxEmitBox = Vector3.Zero()
    ps.color1 = new Color4(color.r, color.g, color.b, 1)
    ps.color2 = new Color4(color.r, color.g, color.b, 0.8)
    ps.colorDead = new Color4(color.r, color.g, color.b, 0)
    ps.minSize = 0.08
    ps.maxSize = this.calm ? 0.16 : 0.26
    ps.minLifeTime = 0.3
    ps.maxLifeTime = 0.7
    ps.direction1 = new Vector3(-1, 0.6, -1)
    ps.direction2 = new Vector3(1, 1.6, 1)
    ps.minEmitPower = power * 0.5
    ps.maxEmitPower = power
    ps.gravity = new Vector3(0, -6, 0)
    ps.blendMode = ParticleSystem.BLENDMODE_ADD
    ps.manualEmitCount = n
    ps.disposeOnStop = true
    ps.targetStopDuration = 0.8
    ps.start()
  }

  /** Étincelles qui montent (soin, objet trouvé, page rendue). */
  rise(at: Vector3, color: Color3): void {
    const ps = new ParticleSystem('montee', this.calm ? 12 : 30, this.scene)
    ps.particleTexture = this.glow
    ps.emitter = at.clone()
    ps.minEmitBox = new Vector3(-0.4, 0, -0.4)
    ps.maxEmitBox = new Vector3(0.4, 0.2, 0.4)
    ps.color1 = new Color4(color.r, color.g, color.b, 1)
    ps.color2 = new Color4(1, 1, 1, 0.8)
    ps.colorDead = new Color4(color.r, color.g, color.b, 0)
    ps.minSize = 0.06
    ps.maxSize = 0.16
    ps.minLifeTime = 0.8
    ps.maxLifeTime = 1.4
    ps.direction1 = new Vector3(-0.2, 1, -0.2)
    ps.direction2 = new Vector3(0.2, 1.4, 0.2)
    ps.minEmitPower = 0.8
    ps.maxEmitPower = 1.6
    ps.emitRate = this.calm ? 18 : 60
    ps.blendMode = ParticleSystem.BLENDMODE_ADD
    ps.disposeOnStop = true
    ps.targetStopDuration = 0.7
    ps.start()
  }

  /** Flamme d'une torche : démarrée et arrêtée selon la salle du héros (le coût suit le regard). */
  flame(at: Vector3, color: Color3): ParticleSystem {
    const ps = new ParticleSystem('flamme', 24, this.scene)
    ps.particleTexture = this.glow
    ps.emitter = at.clone()
    ps.minEmitBox = new Vector3(-0.04, 0, -0.04)
    ps.maxEmitBox = new Vector3(0.04, 0, 0.04)
    ps.color1 = new Color4(color.r, color.g, color.b, 0.9)
    ps.color2 = new Color4(1, 0.9, 0.6, 0.7)
    ps.colorDead = new Color4(color.r, color.g, color.b, 0)
    ps.minSize = 0.14
    ps.maxSize = 0.3
    ps.minLifeTime = 0.3
    ps.maxLifeTime = 0.6
    ps.direction1 = new Vector3(-0.1, 1, -0.1)
    ps.direction2 = new Vector3(0.1, 1.2, 0.1)
    ps.minEmitPower = 0.6
    ps.maxEmitPower = 1.1
    ps.emitRate = 40
    ps.blendMode = ParticleSystem.BLENDMODE_ADD
    return ps
  }

  /** Boule de lumière qui va d'un point à un autre (sort d'étoiles) ; rend la main à l'arrivée. */
  projectile(from: Vector3, to: Vector3, color: Color3, seconds = 0.35): Promise<void> {
    const ball = MeshBuilder.CreateSphere('sort', { diameter: 0.32, segments: 8 }, this.scene)
    const material = new StandardMaterial('sort-matiere', this.scene)
    material.emissiveColor = color
    material.disableLighting = true
    ball.material = material
    ball.isPickable = false
    ball.position.copyFrom(from)
    const trail = this.flame(from.clone(), color)
    trail.emitter = ball
    trail.emitRate = 80
    trail.start()
    const started = performance.now()
    return new Promise((resolve) => {
      const observer = this.scene.onBeforeRenderObservable.add(() => {
        const t = Math.min(1, (performance.now() - started) / (seconds * 1000))
        ball.position = Vector3.Lerp(from, to, t)
        ball.position.y += Math.sin(t * Math.PI) * 0.5
        if (t >= 1) {
          this.scene.onBeforeRenderObservable.remove(observer)
          trail.stop()
          window.setTimeout(() => trail.dispose(), 700)
          ball.dispose(false, true)
          resolve()
        }
      })
    })
  }

  dispose(): void {
    this.glow.dispose()
  }
}
