// Parcours WebGPU dans un vrai navigateur, sous la CSP de production (décision D9) :
//   npm run build && npm run preview &   puis   npm run e2e:webgpu
// Vérifie que l'île se charge en WebGPU sans rien demander hors du site, que le héros avance, que les
// outils de traduction des shaders (glslang, twgsl) sont servis par le site avec le bon type, que le
// banc de mesure (?mesure) va au bout, et que sans WebGPU le jeu repart en WebGL 2.
// Navigateur sans WebGPU (pas d'adaptateur) : le parcours le dit et s'arrête sans échec.
// Captures dans $E2E_OUT (défaut : e2e/captures).
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = (() => {
  try {
    return require('playwright-core')
  } catch {
    return require('playwright')
  }
})()

const BASE = process.env.E2E_URL ?? 'http://127.0.0.1:4173'
const OUT = process.env.E2E_OUT ?? new URL('./captures/', import.meta.url).pathname
const SLOW = Number(process.env.E2E_SLOW ?? 1)
mkdirSync(OUT, { recursive: true })

// WebGPU sans carte graphique : Vulkan logiciel (SwiftShader). Sans ces options, le contexte WebGPU
// se perd dès la création (« A valid external Instance reference no longer exists »).
const SOFTWARE_GPU = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
const launch = (args) => chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args })

const problems = []
const watch = (page) => {
  page.on('pageerror', (e) => problems.push(`erreur de la page : ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console : ${m.text()}`) })
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`) })
  page.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) problems.push(`requête hors du site : ${r.url()}`) })
}
const step = async (label, fn) => {
  const t = Date.now()
  await fn()
  console.log(`✓ ${label} (${((Date.now() - t) / 1000).toFixed(1)} s)`)
}
const open = async (page, query) => {
  await page.goto(`${BASE}/?decouverte&e2e&qualite=bas&erreurs=0&${query}`)
  await page.waitForFunction(() => window.__aldoria?.world, null, { timeout: 180_000 * SLOW })
}

const browser = await launch(SOFTWARE_GPU)
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  watch(page)

  await page.goto(`${BASE}/`)
  const gpu = await page.evaluate(async () => {
    if (!navigator.gpu) return 'pas de navigator.gpu'
    return (await navigator.gpu.requestAdapter()) ? 'ok' : 'pas d’adaptateur'
  })
  if (gpu !== 'ok') {
    console.log(`WebGPU indisponible dans ce navigateur (${gpu}) : parcours WebGPU ignoré.`)
    await browser.close()
    process.exit(0)
  }

  await step("l'île se charge en WebGPU", async () => {
    await open(page, 'moteur=webgpu')
    const kind = await page.evaluate(() => ({ kind: window.__aldoria.world.engineKind, fallback: window.__aldoria.world.engineFallback ?? null }))
    if (kind.kind !== 'webgpu') throw new Error(`moteur : ${kind.kind} (repli : ${kind.fallback})`)
    await page.waitForTimeout(2500 * SLOW)
    await page.screenshot({ path: `${OUT}/webgpu-01-depart.png` })
  })

  await step('le héros avance (touche Z/W)', async () => {
    const before = await page.evaluate(() => window.__aldoria.world.heroPosition())
    await page.locator('canvas').click({ position: { x: 640, y: 120 } })
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(1500 * SLOW)
    await page.keyboard.up('KeyW')
    const after = await page.evaluate(() => window.__aldoria.world.heroPosition())
    const moved = Math.hypot(after.x - before.x, after.z - before.z)
    if (moved < 1) throw new Error(`le héros n'a pas bougé (${moved.toFixed(2)} m)`)
  })

  await step('glslang et twgsl viennent du site et traduisent un shader GLSL en WGSL', async () => {
    const served = []
    const onResponse = (r) => { if (r.url().includes('/ressources/babylon/')) served.push(`${r.status()} ${r.headers()['content-type']} ${new URL(r.url()).pathname}`) }
    page.on('response', onResponse)
    const wgsl = await page.evaluate(async () => {
      const engine = window.__aldoria.world.engine
      await engine.prepareGlslangAndTintAsync()
      const spirv = engine._glslang.compileGLSL('#version 450\nlayout(location = 0) in vec3 position;\nvoid main() { gl_Position = vec4(position, 1.0); }\n', 'vertex')
      return engine._tintWASM.convertSpirV2WGSL(spirv)
    })
    page.off('response', onResponse)
    if (!wgsl.includes('fn main')) throw new Error(`WGSL inattendu : ${wgsl.slice(0, 120)}`)
    for (const f of ['glslang/glslang.js', 'twgsl/twgsl.js']) if (!served.some((s) => s.startsWith('200 ') && s.endsWith(`/ressources/babylon/${f}`))) throw new Error(`${f} non servi par le site : ${served.join(' ; ')}`)
    for (const f of ['glslang/glslang.wasm', 'twgsl/twgsl.wasm']) if (!served.some((s) => s.startsWith('200 application/wasm ') && s.endsWith(`/ressources/babylon/${f}`))) throw new Error(`${f} non servi en application/wasm : ${served.join(' ; ')}`)
  })

  await step('le banc de mesure (?mesure) va au bout en WebGPU', async () => {
    await open(page, 'moteur=webgpu&mesure=8')
    await page.waitForFunction(() => window.__aldoria?.mesure, null, { timeout: 240_000 * SLOW })
    const r = await page.evaluate(() => window.__aldoria.mesure)
    if (r.engine !== 'WebGPU') throw new Error(`moteur mesuré : ${r.engine}`)
    if (r.summary.frames < 3 || !(r.summary.fps > 0)) throw new Error(`mesure vide : ${JSON.stringify(r.summary)}`)
    if (!(r.drawCalls > 0) || !(r.triangles > 0)) throw new Error(`compteurs vides : ${r.drawCalls} appels, ${r.triangles} triangles`)
    await page.getByTestId('mesure').waitFor()
    await page.screenshot({ path: `${OUT}/webgpu-02-mesure.png` })
  })
} catch (error) {
  problems.push(String(error))
} finally {
  await browser.close()
}

// Sans WebGPU (navigateur lancé sans l'option), `?moteur=webgpu` doit donner un jeu qui marche en WebGL 2.
const plain = await launch(['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'])
try {
  const page = await plain.newPage({ viewport: { width: 1280, height: 720 } })
  // Le repli prévient par un avertissement (console.warn) : seules les vraies erreurs comptent.
  watch(page)
  await step('sans WebGPU, ?moteur=webgpu repart en WebGL 2', async () => {
    await open(page, 'moteur=webgpu')
    const r = await page.evaluate(() => ({ kind: window.__aldoria.world.engineKind, fallback: window.__aldoria.world.engineFallback ?? null }))
    if (r.kind !== 'webgl2') throw new Error(`moteur : ${r.kind}`)
    if (!r.fallback) throw new Error('repli sans explication')
    await page.waitForTimeout(1500 * SLOW)
    await page.screenshot({ path: `${OUT}/webgpu-03-repli.png` })
  })
} catch (error) {
  problems.push(String(error))
} finally {
  await plain.close()
}

if (problems.length > 0) {
  console.error('\n✗ Parcours WebGPU en échec :\n  ' + problems.join('\n  '))
  process.exit(1)
}
console.log(`\nParcours WebGPU réussi. Captures : ${OUT}`)
