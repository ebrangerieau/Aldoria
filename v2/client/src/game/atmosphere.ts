/**
 * Ciel, soleil, ombres, brouillard et post-traitement : c'est ici que se joue l'immersion
 * (la v1, bridée par le rendu WebGL 2 « Compatibility » de Godot et par la tablette, n'avait
 * ni halo, ni occlusion ambiante, ni ombres sur tout le paysage).
 */
import {
  type Camera,
  CascadedShadowGenerator,
  Color3,
  Color4,
  DefaultRenderingPipeline,
  DirectionalLight,
  GlowLayer,
  HemisphericLight,
  ImageProcessingConfiguration,
  Mesh,
  MeshBuilder,
  type Scene,
  ShadowGenerator,
  SSAO2RenderingPipeline,
  StandardMaterial,
  TransformNode,
  Vector3,
  VertexBuffer,
  DynamicTexture,
} from '@babylonjs/core'
import type { Quality } from './quality'
import type { WorldTheme } from './theme'

export interface Atmosphere {
  sun: DirectionalLight
  shadows: CascadedShadowGenerator
  glow: GlowLayer | null
  /** Direction vers le soleil (normalisée). */
  sunDirection: Vector3
}

/** Direction vers le soleil d'après sa hauteur et son azimut (0 = nord, 90 = est). */
export function sunVector(elevationDeg: number, azimuthDeg: number): Vector3 {
  const el = (elevationDeg * Math.PI) / 180
  const az = (azimuthDeg * Math.PI) / 180
  return new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize()
}

export function createAtmosphere(scene: Scene, camera: Camera, theme: WorldTheme, quality: Quality): Atmosphere {
  const toSun = sunVector(theme.sunElevation, theme.sunAzimuth)
  const fog = Color3.FromHexString(theme.fogColor)
  scene.clearColor = new Color4(fog.r, fog.g, fog.b, 1)
  scene.ambientColor = new Color3(0.25, 0.25, 0.28)
  scene.fogMode = 2 // Scene.FOGMODE_EXP2
  scene.fogColor = fog
  scene.fogDensity = theme.fogDensity

  const hemi = new HemisphericLight('ciel', new Vector3(0, 1, 0), scene)
  hemi.diffuse = Color3.FromHexString(theme.skyColor)
  hemi.groundColor = Color3.FromHexString(theme.groundColor)
  hemi.specular = Color3.Black()
  hemi.intensity = theme.hemiIntensity

  const sun = new DirectionalLight('soleil', toSun.scale(-1), scene)
  sun.position = toSun.scale(200)
  sun.diffuse = Color3.FromHexString(theme.sunColor)
  sun.specular = Color3.FromHexString(theme.sunColor).scale(0.35)
  sun.intensity = theme.sunIntensity

  // Ombres en cascades : nettes près du héros, jusqu'à 180 m pour les montagnes.
  const shadows = new CascadedShadowGenerator(quality.shadowMapSize, sun, undefined, camera)
  shadows.numCascades = quality.shadowCascades
  shadows.lambda = 0.82
  shadows.shadowMaxZ = 180
  shadows.stabilizeCascades = true
  shadows.depthClamp = true
  shadows.usePercentageCloserFiltering = true
  shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM
  shadows.bias = 0.004
  shadows.normalBias = 0.02
  shadows.darkness = 0.25

  buildSkyDome(scene, theme, toSun)

  // Post-traitement : rendu HDR, tonalité ACES, halo léger sur les éléments lumineux.
  const pipeline = new DefaultRenderingPipeline('rendu', true, scene, [camera])
  pipeline.samples = quality.msaa
  pipeline.fxaaEnabled = quality.msaa <= 1
  pipeline.bloomEnabled = quality.bloom
  pipeline.bloomThreshold = 0.82
  pipeline.bloomWeight = 0.22
  pipeline.bloomKernel = 48
  pipeline.bloomScale = 0.5
  pipeline.imageProcessingEnabled = true
  pipeline.imageProcessing.toneMappingEnabled = true
  pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES
  pipeline.imageProcessing.exposure = theme.exposure
  pipeline.imageProcessing.contrast = theme.contrast
  pipeline.imageProcessing.vignetteEnabled = true
  pipeline.imageProcessing.vignetteWeight = theme.vignette
  pipeline.imageProcessing.vignetteColor = new Color4(0.1, 0.08, 0.12, 0)

  if (quality.ssao) {
    const ssao = new SSAO2RenderingPipeline('occlusion', scene, { ssaoRatio: 0.5, blurRatio: 1 }, [camera])
    ssao.radius = 1.6
    ssao.totalStrength = 0.9
    ssao.samples = 16
    ssao.maxZ = 120
  }

  const glow = quality.glow ? new GlowLayer('lueur', scene, { mainTextureSamples: 1, blurKernelSize: 32 }) : null
  if (glow) glow.intensity = 0.7

  return { sun, shadows, glow, sunDirection: toSun }
}

/**
 * Voûte céleste en dégradé (couleurs par sommet) et disque du soleil : un ciel stylisé, qui
 * va avec le low-poly, se fond dans le brouillard à l'horizon et ne dépend d'aucun shader
 * particulier (même rendu en WebGL 2 et en WebGPU).
 */
function buildSkyDome(scene: Scene, theme: WorldTheme, toSun: Vector3): void {
  const dome = MeshBuilder.CreateSphere('voute', { diameter: 2000, segments: 48, sideOrientation: Mesh.BACKSIDE }, scene)
  const positions = dome.getVerticesData(VertexBuffer.PositionKind)!
  const colors = new Float32Array((positions.length / 3) * 4)
  const zenith = Color3.FromHexString(theme.zenithColor)
  const horizon = Color3.FromHexString(theme.fogColor)
  const glow = Color3.FromHexString(theme.sunGlowColor)
  const dir = new Vector3()
  for (let v = 0; v < positions.length / 3; v += 1) {
    dir.set(positions[v * 3]!, positions[v * 3 + 1]!, positions[v * 3 + 2]!).normalize()
    const t = Math.max(0, dir.y)
    const c = Color3.Lerp(horizon, zenith, Math.pow(t, 0.5))
    const sun = Math.pow(Math.max(0, Vector3.Dot(dir, toSun)), 5) * 0.75
    const out = Color3.Lerp(c, glow, sun)
    colors.set([out.r, out.g, out.b, 1], v * 4)
  }
  dome.setVerticesData(VertexBuffer.ColorKind, colors)
  const material = new StandardMaterial('voute', scene)
  material.disableLighting = true
  material.emissiveColor = Color3.White()
  material.diffuseColor = Color3.Black()
  material.specularColor = Color3.Black()
  material.fogEnabled = false
  dome.material = material
  dome.infiniteDistance = true
  dome.isPickable = false
  dome.applyFog = false

  // Disque du soleil : un panneau toujours tourné vers la caméra, très loin dans sa direction.
  const texture = new DynamicTexture('disque-soleil', 128, scene, false)
  const ctx = texture.getContext()
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,255,245,1)')
  gradient.addColorStop(0.22, 'rgba(255,248,225,1)')
  gradient.addColorStop(0.35, 'rgba(255,230,170,0.45)')
  gradient.addColorStop(1, 'rgba(255,220,150,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  texture.hasAlpha = true
  texture.update()
  const holder = new TransformNode('soleil-disque', scene)
  const disc = MeshBuilder.CreatePlane('soleil-disque', { size: 150 }, scene)
  disc.parent = holder
  disc.position = toSun.scale(900)
  disc.billboardMode = TransformNode.BILLBOARDMODE_ALL
  disc.infiniteDistance = true
  const discMaterial = new StandardMaterial('soleil-disque', scene)
  discMaterial.disableLighting = true
  discMaterial.emissiveTexture = texture
  discMaterial.opacityTexture = texture
  discMaterial.diffuseColor = Color3.Black()
  discMaterial.fogEnabled = false
  disc.material = discMaterial
  disc.isPickable = false
  disc.applyFog = false
}
