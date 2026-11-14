// Vérifie la Table des Reliques avec les aménagements les plus larges (texte agrandi, police lisible, grandes cibles) : le panneau doit
// rester lisible, défiler proprement et garder ses boutons accessibles. Serveur de prévisualisation lancé ; capture dans $E2E_OUT.
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
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
let failed = false
page.on('pageerror', (e) => {
  failed = true
  console.error(e.message)
})
await page.goto(`${BASE}/?decouverte&e2e&qualite=bas&musique=0&sons=0`)
await page.waitForFunction(() => window.__aldoria?.world, null, { timeout: 300_000 })
await page.evaluate(() => {
  const html = document.documentElement
  html.setAttribute('data-text-size', '2')
  html.setAttribute('data-readable-font', 'true')
  html.setAttribute('data-big-targets', 'true')
  window.__aldoria.giveRelics(['flamme-1', 'onde-1', 'feuille-1', 'etoile-1', 'flamme-3', 'onde-3', 'feuille-3'])
  window.__aldoria.give('parchemin', 2)
  const w = window.__aldoria.world
  const table = w.interactables.find((i) => i.id === 'table-reliques')
  w.teleport(table.x + 2.6, table.z, table.x, table.z)
})
await page.getByTestId('invite').filter({ hasText: 'Ouvrir la Table des Reliques' }).waitFor({ timeout: 20_000 })
await page.keyboard.press('KeyE')
await page.getByTestId('table-reliques').waitFor()
const box = await page.evaluate(() => {
  const panel = document.querySelector('.relic-table')
  const overlay = document.querySelector('.overlay')
  const r = panel.getBoundingClientRect()
  const buttons = [...panel.querySelectorAll('.actions button')].map((b) => ({ text: b.textContent, bottom: Math.round(b.getBoundingClientRect().bottom) }))
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), panelScrolls: panel.scrollHeight > panel.clientHeight, overlayScrolls: overlay.scrollHeight > overlay.clientHeight, buttons, cell: Math.round(document.querySelector('.relic-cell').getBoundingClientRect().width) }
})
console.log(JSON.stringify(box))
await page.screenshot({ path: `${OUT}/table-amenagements.png` })
await browser.close()
process.exit(failed ? 1 : 0)
