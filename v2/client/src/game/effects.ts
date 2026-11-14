/**
 * Effets visuels partagés par l'île et l'intérieur d'un lieu : gerbe d'étincelles dorées (pierre éveillée, coffre qui apparaît ou
 * s'ouvre). Un système de particules de Babylon.js (shaders de base, aussi en WGSL : aucun CDN) ; réduit en mode calme.
 */
import { Color4, DynamicTexture, ParticleSystem, type Scene, Vector3 } from '@babylonjs/core'

/** Une texture d'étincelle par scène (l'île et chaque intérieur ont la leur). */
const textures = new WeakMap<Scene, DynamicTexture>()

function sparkTexture(scene: Scene): DynamicTexture {
  let texture = textures.get(scene)
  if (!texture) {
    texture = new DynamicTexture('etincelle', 64, scene, false)
    const ctx = texture.getContext()
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.4, 'rgba(255,230,160,0.8)')
    gradient.addColorStop(1, 'rgba(255,200,80,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)
    texture.hasAlpha = true
    texture.update()
    textures.set(scene, texture)
  }
  return texture
}

/** Une gerbe d'étincelles à `at` ; `calm` : moins de particules, plus petites (aménagement « mode calme »). */
export function sparkle(scene: Scene, at: Vector3, calm: boolean): void {
  const ps = new ParticleSystem('etincelles', calm ? 80 : 400, scene)
  ps.particleTexture = sparkTexture(scene)
  ps.emitter = at
  ps.minEmitBox = new Vector3(-0.3, 0, -0.3)
  ps.maxEmitBox = new Vector3(0.3, 0.4, 0.3)
  ps.color1 = new Color4(1, 0.92, 0.6, 1)
  ps.color2 = new Color4(0.6, 0.85, 1, 1)
  ps.colorDead = new Color4(1, 0.8, 0.3, 0)
  ps.minSize = 0.08
  ps.maxSize = calm ? 0.18 : 0.3
  ps.minLifeTime = 0.6
  ps.maxLifeTime = 1.4
  ps.emitRate = calm ? 120 : 600
  ps.manualEmitCount = calm ? 60 : 300
  ps.gravity = new Vector3(0, -2, 0)
  ps.direction1 = new Vector3(-2, 4, -2)
  ps.direction2 = new Vector3(2, 7, 2)
  ps.minEmitPower = 1
  ps.maxEmitPower = calm ? 1.5 : 3
  ps.blendMode = ParticleSystem.BLENDMODE_ADD
  ps.disposeOnStop = true
  ps.targetStopDuration = 1.6
  ps.start()
}
