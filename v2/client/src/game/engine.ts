/**
 * Création du moteur. WebGL 2 par défaut ; WebGPU seulement sur demande (`?moteur=webgpu`)
 * tant que ses outils de traduction des shaders (twgsl) ne sont pas servis par le site
 * (la CSP interdit tout chargement depuis un CDN) : décision à prendre en phase 1, voir
 * docs/TRD.md §2.
 */
import { type AbstractEngine, Engine, SceneLoaderFlags, WebGPUEngine } from '@babylonjs/core'

export type EngineKind = 'webgl2' | 'webgpu'

export async function createEngine(canvas: HTMLCanvasElement, params: URLSearchParams): Promise<{ engine: AbstractEngine; kind: EngineKind }> {
  // Écran de chargement de Babylon.js : il injecte une feuille de style, refusée par la CSP ;
  // le jeu a le sien (ui/GameScreen.tsx).
  SceneLoaderFlags.ShowLoadingScreen = false
  if (params.get('moteur') === 'webgpu' && (await WebGPUEngine.IsSupportedAsync)) {
    const engine = new WebGPUEngine(canvas, { antialias: true, adaptToDeviceRatio: true })
    await engine.initAsync()
    return { engine, kind: 'webgpu' }
  }
  const engine = new Engine(
    canvas,
    true,
    { stencil: true, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('e2e') },
    true,
  )
  return { engine, kind: 'webgl2' }
}
