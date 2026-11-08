// Captures de vérification visuelle de l'île (skill « captures » de la v2). Serveur de prévisualisation
// lancé (npm run preview), puis : npm run captures [-- vue1 vue2…]. Captures dans $E2E_OUT
// (défaut : e2e/captures). Qualité : $E2E_QUALITE (haut par défaut ; « bas » en rendu logiciel lent).
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
const QUALITY = process.env.E2E_QUALITE ?? 'haut'
mkdirSync(OUT, { recursive: true })

// Vue : où poser le héros (x, z), vers où il regarde, et la caméra (hauteur, distance, décalage) ;
// `interface` : garder l'interface (mini-carte, bandeau) au lieu de la cacher.
const VIEWS = {
  depart: { query: '', at: [0, -30], face: [0, 30], beta: 1.3, radius: 9, turn: 0 },
  panorama: { query: '', at: [0, -30], face: [0, 30], beta: 1.05, radius: 18, turn: 0.5 },
  cimes: { query: '', at: [70, 60], face: [120, 105], beta: 1.32, radius: 9, turn: 0.15 },
  lieu: { query: '', at: [80, 104], face: [94, 120], beta: 1.25, radius: 10, turn: 0.4 },
  foret: { query: '', at: [-10, -100], face: [0, -140], beta: 1.3, radius: 8, turn: -0.3 },
  cote: { query: '', at: [-200, -10], face: [-260, -10], beta: 1.35, radius: 9, turn: 0.2 },
  sphinx: { query: '', at: [318, 10], face: [345, 15], beta: 1.3, radius: 11, turn: 0.3 },
  brouillard: { query: '&monde=brouillard&classe=2nde', at: [0, -30], face: [0, 30], beta: 1.25, radius: 12, turn: 0.3 },
  carte: { query: '', at: [70, 60], face: [120, 105], beta: 1.32, radius: 9, turn: 0.15, interface: true },
  // Intérieur d'un lieu : `lieu` (code), `salle` (0 à 5), `at` : [x dans la salle, profondeur], caméra : écart au sud, inclinaison, distance.
  interieur: { query: '', lieu: 'tour_fractions', salle: 0, at: [6, 9], turn: 0, beta: 1.05, radius: 12, interface: true },
  escalier: { query: '', lieu: 'tour_fractions', salle: 0, at: [13.5, 10], turn: -0.4, beta: 1.0, radius: 11, interface: true },
  'interieur-brouillard': { query: '&monde=brouillard&classe=2nde', lieu: 'labyrinthe_vecteurs', salle: 2, at: [8, 9], turn: -0.25, beta: 1.05, radius: 12, interface: true },
}

const wanted = process.argv.slice(2).filter((v) => v in VIEWS)
const views = wanted.length > 0 ? wanted : Object.keys(VIEWS)
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
let failed = false
for (const name of views) {
  const view = VIEWS[name]
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => {
    failed = true
    console.error(`${name} : ${e.message}`)
  })
  await page.goto(`${BASE}/?decouverte&e2e&qualite=${QUALITY}${view.query}`)
  await page.waitForFunction(() => window.__aldoria?.world, null, { timeout: 300_000 })
  if (view.lieu) {
    // Intérieur d'un lieu : x dans le monde intérieur = 16 × salle + x ; z = -profondeur.
    await page.evaluate(async (v) => {
      const w = window.__aldoria.world
      await w.enterPlace(v.lieu)
      w.interior.teleport(16 * v.salle + v.at[0], -v.at[1])
      w.interior.frame(v.turn, v.beta, v.radius)
    }, view)
  } else {
    await page.evaluate((v) => {
      const w = window.__aldoria.world
      w.teleport(v.at[0], v.at[1], v.face[0], v.face[1])
      w.frame(w.camera.alpha + v.turn, v.beta, v.radius)
    }, view)
  }
  // Interface cachée (sauf vue `interface`), le temps que les ombres et le halo se stabilisent.
  if (!view.interface) await page.evaluate(() => document.documentElement.classList.add('sans-interface'))
  await page.waitForTimeout(6000)
  await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 180_000 })
  console.log(`✓ ${name}`)
  await page.close()
}
await browser.close()
process.exit(failed ? 1 : 0)
