// Vérifie l'écran d'apparence avec les aménagements les plus larges (texte agrandi, police lisible, grandes cibles) à 1280 × 720 : le panneau doit
// tenir dans l'écran à droite (au plus deux tiers), défiler proprement, garder ses boutons atteignables, et le héros doit rester visible à gauche.
// Serveur de prévisualisation lancé ; captures dans $E2E_OUT (apparence-amenagements.png).
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
const fail = (message) => {
  failed = true
  console.error(`ÉCHEC : ${message}`)
}
page.on('pageerror', (e) => fail(e.message))
await page.goto(`${BASE}/?decouverte&e2e&qualite=bas&musique=0&sons=0`)
await page.waitForFunction(() => window.__aldoria?.world, null, { timeout: 300_000 })
await page.evaluate(() => {
  const html = document.documentElement
  // L'écran réapplique à chaque rendu les aménagements de l'enfant (découverte : aucun) : un observateur remet ceux de ce test.
  const wanted = { 'data-text-size': '2', 'data-readable-font': 'true', 'data-big-targets': 'true' }
  const apply = () => {
    for (const [name, value] of Object.entries(wanted)) if (html.getAttribute(name) !== value) html.setAttribute(name, value)
  }
  new MutationObserver(apply).observe(html, { attributes: true })
  apply()
  window.__aldoria.giveProgress(600, 2)
  window.__aldoria.world.teleport(0, -30, 0, 30)
})
await page.getByTestId('bouton-apparence').click()
await page.getByTestId('apparence').waitFor()
await page.waitForFunction(() => window.__aldoria.world.camera.radius < 6, null, { timeout: 20_000 })
await page.waitForTimeout(2500)
const box = await page.evaluate(() => {
  const panel = document.querySelector('.wardrobe')
  const r = panel.getBoundingClientRect()
  const close = document.querySelector('[data-testid="apparence-fermer"]')
  panel.scrollTop = panel.scrollHeight
  const c = close.getBoundingClientRect()
  const w = window.__aldoria.world
  // Le héros projeté à l'écran (à mi-hauteur) : il doit être à gauche du panneau.
  const p = w.hero.root.position
  const v = w.projectToScreen ? w.projectToScreen(p.x, p.y + 1, p.z) : null
  return {
    left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom),
    scrolls: panel.scrollHeight > panel.clientHeight,
    closeBottom: Math.round(c.bottom), closeVisible: c.bottom <= innerHeight && c.top >= r.top,
    hero: v,
    buttonHeight: Math.round(document.querySelector('.wardrobe-choice').getBoundingClientRect().height),
  }
})
console.log(JSON.stringify(box))
if (box.left < 400) fail(`le panneau prend plus des deux tiers de l’écran (gauche : ${box.left})`)
if (box.right > 1280 || box.top < 0 || box.bottom > 720) fail('le panneau déborde de l’écran')
if (!box.closeVisible) fail('le bouton « Terminé » n’est pas atteignable en bas du panneau')
if (box.hero && box.hero.x > box.left - 40) fail(`le héros (x ${Math.round(box.hero.x)}) est caché par le panneau (gauche : ${box.left})`)
await page.evaluate(() => { document.querySelector('.wardrobe').scrollTop = 0 })
await page.screenshot({ path: `${OUT}/apparence-amenagements.png` })
await browser.close()
process.exit(failed ? 1 : 0)
