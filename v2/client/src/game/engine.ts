/**
 * Création du moteur. WebGL 2 par défaut ; WebGPU sur demande (`?moteur=webgpu`), avec retour à WebGL 2 si le
 * navigateur ne le propose pas (décision D9, revue à l'étape 0.4 : docs/decisions.md, mesures dans docs/perf-log.md).
 * En WebGPU, Babylon.js 9 a une version WGSL de tous les shaders qu'utilise l'île : il ne charge pas glslang ni twgsl
 * (traduction des shaders GLSL, servis par un CDN que la CSP refuse). Un matériau qui n'existe qu'en GLSL les
 * demanderait : tout matériau ajouté se vérifie avec `?moteur=webgpu` (aucune requête vers cdn.babylonjs.com).
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
