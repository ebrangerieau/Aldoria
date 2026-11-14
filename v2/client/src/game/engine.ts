/**
 * Création du moteur : WebGL 2 ou WebGPU (décision D9, docs/decisions.md). `?moteur=webgl2` ou
 * `?moteur=webgpu` force l'un ou l'autre ; si WebGPU manque ou échoue au démarrage, le jeu repart
 * en WebGL 2 sans rien demander.
 *
 * Les outils que Babylon.js télécharge à la demande (glslang et twgsl, qui traduisent un shader
 * GLSL en WGSL pour WebGPU ; décodeurs Draco, Basis…) viennent du site, jamais du CDN de
 * Babylon.js : la CSP l'interdit. vite.config.ts les copie de node_modules dans
 * /ressources/babylon/. Tous les matériaux de l'île ont leur version WGSL : WebGPU ne les
 * télécharge que si un shader GLSL sans équivalent apparaît.
 */
import { type AbstractEngine, Engine, SceneLoaderFlags, Tools, WebGPUEngine } from '@babylonjs/core'

export type EngineKind = 'webgl2' | 'webgpu'

/** Moteur choisi sans `?moteur=` dans l'adresse. */
export const DEFAULT_ENGINE: EngineKind = 'webgl2'

/** Où le site sert les outils de Babylon.js (même version que le paquet, voir vite.config.ts). */
export const BABYLON_TOOLS_URL = '/ressources/babylon'

export interface CreatedEngine {
  engine: AbstractEngine
  kind: EngineKind
  /** Pourquoi WebGPU, demandé, n'a pas été pris (affiché par le banc de mesure). */
  fallback?: string
}

export function wantedEngine(params: URLSearchParams): EngineKind {
  const wanted = params.get('moteur')
  return wanted === 'webgpu' || wanted === 'webgl2' ? wanted : DEFAULT_ENGINE
}

export async function createEngine(canvas: HTMLCanvasElement, params: URLSearchParams): Promise<CreatedEngine> {
  // Écran de chargement de Babylon.js : il injecte une feuille de style, refusée par la CSP ;
  // le jeu a le sien (ui/GameScreen.tsx).
  SceneLoaderFlags.ShowLoadingScreen = false
  Tools.ScriptBaseUrl = BABYLON_TOOLS_URL
  let fallback: string | undefined
  if (wantedEngine(params) === 'webgpu') {
    const gpu = await createWebGPU(canvas, params.has('mesure'))
    if ('engine' in gpu) return { engine: gpu.engine, kind: 'webgpu' }
    fallback = gpu.reason
    console.warn(`WebGPU indisponible, repli sur WebGL 2 : ${gpu.reason}`)
  }
  const engine = new Engine(
    canvas,
    true,
    { stencil: true, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('e2e') },
    true,
  )
  return { engine, kind: 'webgl2', fallback }
}

async function createWebGPU(canvas: HTMLCanvasElement, measuring: boolean): Promise<{ engine: WebGPUEngine } | { reason: string }> {
  if (!(await WebGPUEngine.IsSupportedAsync)) return { reason: 'navigateur sans WebGPU' }
  const engine = new WebGPUEngine(canvas, {
    antialias: true,
    adaptToDeviceRatio: true,
    powerPreference: 'high-performance',
    // Mesure du temps de la carte graphique (banc `?mesure`) ; ignorée si la carte ne la permet pas.
    deviceDescriptor: measuring ? { requiredFeatures: ['timestamp-query'] } : {},
  })
  try {
    await engine.initAsync()
    return { engine }
  } catch (error) {
    // Échec avant que le canevas soit pris (pas d'adaptateur, pas d'appareil) : WebGL 2 peut s'en
    // servir. Un échec plus tard (rare) laisse le canevas à WebGPU : l'écran d'erreur s'affiche.
    try {
      engine.dispose()
    } catch {
      // rien à libérer
    }
    return { reason: error instanceof Error ? error.message : String(error) }
  }
}
