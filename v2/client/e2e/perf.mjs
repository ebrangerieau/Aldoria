// Mesures de rendu : WebGL 2 face à WebGPU, profil par profil (étapes 0.4 et 0.5 du plan, docs/perf-log.md) :
// images par seconde sans limite, durée d'une image (moyenne et 95e centile), temps de calcul d'une image côté
// processeur (scene.render), appels de dessin, triangles, temps jusqu'à l'île prête.
// Serveur de prévisualisation lancé (npm run preview), puis : npm run perf
//
// Navigateur : Edge du poste avec sa carte graphique (défaut), ou $CHROMIUM_PATH. Synchronisation verticale
// coupée : les images par seconde mesurent ce que la machine peut rendre, pas la fréquence de l'écran.
// Avec PERF_SYNCHRO=1, synchronisation normale : on vérifie que le jeu tient la fréquence de l'écran et on lit les
// à-coups (95e centile de la durée d'une image ; sans synchronisation, le navigateur envoie les images par rafales).
// Variables : PERF_MOTEURS (webgl2,webgpu), PERF_PROFILS (haut,moyen,bas), PERF_VUES (depart,panorama),
// PERF_DUREE (secondes de mesure par vue, 10), PERF_LARGEUR × PERF_HAUTEUR (1920 × 1080), PERF_REQUETE (ajoutée à
// l'adresse, ex. « &monde=brouillard&classe=2nde »), E2E_URL, PERF_JSON (fichier de résultats).
import { writeFileSync } from 'node:fs'
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
const ENGINES = (process.env.PERF_MOTEURS ?? 'webgl2,webgpu').split(',')
const PROFILES = (process.env.PERF_PROFILS ?? 'haut,moyen,bas').split(',')
const DURATION = Number(process.env.PERF_DUREE ?? 10)
const WIDTH = Number(process.env.PERF_LARGEUR ?? 1920)
const HEIGHT = Number(process.env.PERF_HAUTEUR ?? 1080)
// Mêmes vues que les captures (e2e/captures.mjs) : départ (île devant soi) et panorama (vue large, plus d'objets).
const VIEWS = {
  depart: { at: [0, -30], face: [0, 30], beta: 1.3, radius: 9, turn: 0 },
  panorama: { at: [0, -30], face: [0, 30], beta: 1.05, radius: 18, turn: 0.5 },
}
const views = (process.env.PERF_VUES ?? 'depart,panorama').split(',').filter((v) => v in VIEWS)

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  channel: process.env.CHROMIUM_PATH ? undefined : 'msedge',
  headless: true,
  args: [
    ...(process.env.PERF_SYNCHRO === '1' ? [] : ['--disable-gpu-vsync', '--disable-frame-rate-limit']),
    '--ignore-gpu-blocklist',
    '--use-angle=d3d11',
  ],
})
const EXTRA = process.env.PERF_REQUETE ?? ''
const results = []
const f = (x, d = 1) => (x == null ? 'n/d' : x.toFixed(d))
for (const engine of ENGINES) {
  for (const profile of PROFILES) {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    const started = Date.now()
    await page.goto(`${BASE}/?decouverte&e2e&qualite=${profile}${engine === 'webgpu' ? '&moteur=webgpu' : ''}${EXTRA}`)
    await page.waitForFunction(() => window.__aldoria?.world, null, { timeout: 300_000 })
    const ready = (Date.now() - started) / 1000
    // WebGPU absent du navigateur : le jeu se rabat sur WebGL 2 (noté « obtenu »).
    const kind = await page.evaluate(() => (window.__aldoria.world.engine.isWebGPU ? 'webgpu' : 'webgl2'))
    for (const name of views) {
      const view = VIEWS[name]
      await page.evaluate((v) => {
        const w = window.__aldoria.world
        w.teleport(v.at[0], v.at[1], v.face[0], v.face[1])
        w.frame(w.camera.alpha + v.turn, v.beta, v.radius)
      }, view)
      await page.waitForTimeout(4000) // ombres, halo et compilation des shaders de la vue
      const m = await page.evaluate(async (seconds) => {
        const w = window.__aldoria.world
        const instr = w.instrumentation
        const frames = []
        const cpu = []
        let draws = 0
        let tris = 0
        const end = performance.now() + seconds * 1000
        let last = performance.now()
        await new Promise((resolve) => {
          const tick = () => {
            const now = performance.now()
            frames.push(now - last)
            last = now
            if (instr) cpu.push(instr.frameTimeCounter.lastSecAverage)
            draws = Math.max(draws, instr?.drawCallsCounter.current ?? 0)
            tris = Math.max(tris, w.scene.getActiveIndices() / 3)
            if (now < end) requestAnimationFrame(tick)
            else resolve()
          }
          requestAnimationFrame(tick)
        })
        frames.shift()
        frames.sort((a, b) => a - b)
        const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)
        return {
          fps: frames.length / seconds,
          frameMs: avg(frames),
          p95Ms: frames[Math.floor(frames.length * 0.95)] ?? null,
          cpuMs: avg(cpu.filter((x) => x > 0)),
          draws,
          triangles: Math.round(tris),
          heapMo: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null,
        }
      }, DURATION)
      results.push({ engine, kind, profile, view: name, ready, errors: errors.length, ...m })
      console.log(
        `${engine.padEnd(6)} ${kind === engine ? '' : `(obtenu : ${kind}) `}${profile.padEnd(5)} ${name.padEnd(8)} ` +
          `${f(m.fps, 0).padStart(4)} i/s · image ${f(m.frameMs)} ms (95 % < ${f(m.p95Ms)}) · calcul ${f(m.cpuMs)} ms · ` +
          `${m.draws} appels · ${(m.triangles / 1e6).toFixed(2)} M triangles · mémoire JS ${f(m.heapMo, 0)} Mo · ` +
          `prête en ${ready.toFixed(1)} s${errors.length ? ` · ${errors.length} erreur(s) : ${errors[0]}` : ''}`,
      )
    }
    await page.close()
  }
}
await browser.close()
if (process.env.PERF_JSON) writeFileSync(process.env.PERF_JSON, JSON.stringify(results, null, 2))
if (results.some((r) => r.errors > 0)) process.exitCode = 1
