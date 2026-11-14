// Mesure les monstres Quaternius et écrit leur échelle dans content/monde/monstres.json.
//
// Un modèle Quaternius a une armature tournée de -90° et à l'échelle 100 (export Blender) : sa boîte
// englobante au repos ne dit rien de sa taille réelle. On charge donc chaque monstre à l'échelle 1 dans
// le jeu, on attend une image (squelette appliqué), on mesure la hauteur des sommets et on en tire
// l'échelle qui donne la hauteur visée. À relancer si un monstre est ajouté ou si `hauteur_heros` change.
//
//   npm --prefix client run build && npm --prefix client run preview &    puis    node tools/mesurer_monstres.mjs
// Variables : E2E_URL (défaut http://127.0.0.1:4173), CHROMIUM_PATH (sinon Edge du poste).
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../client/e2e/package.json', import.meta.url))
const { chromium } = (() => {
  try {
    return require('playwright-core')
  } catch {
    return require('playwright')
  }
})()

const FILE = new URL('../content/monde/monstres.json', import.meta.url)
const BASE = process.env.E2E_URL ?? 'http://127.0.0.1:4173'
const data = JSON.parse(readFileSync(FILE, 'utf-8'))

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  channel: process.env.CHROMIUM_PATH ? undefined : 'msedge',
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 800, height: 450 } })
await page.goto(`${BASE}/?decouverte&e2e&qualite=bas&musique=0&renard=0`)
await page.waitForFunction(() => window.__aldoria?.world, null, { timeout: 240_000 })

const ratio = data.hauteur_heros / data.hauteur_heros_v1
for (const [model, entry] of Object.entries(data.monstres)) {
  const measured = await page.evaluate((m) => window.__aldoria.world.measureMonster(m), model)
  const target = entry.hauteur_v1 * ratio
  const scale = target / measured.height
  console.log(`${model.padEnd(16)} mesuré ${measured.height.toFixed(3)} m à l'échelle 1, visé ${target.toFixed(2)} m → échelle ${scale.toFixed(4)}`)
  entry.echelle = Number(scale.toFixed(4))
}
await browser.close()
writeFileSync(FILE, `${JSON.stringify(data, null, 2)}\n`)
console.log(`Écrit : ${FILE.pathname}`)
