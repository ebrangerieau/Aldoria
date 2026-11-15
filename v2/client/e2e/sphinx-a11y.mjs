// Vérifie que le plus grand plateau du Sphinx (palier 6, 10 x 9 cases) tient dans la fenêtre à 1280 x 720, par défaut puis avec les aménagements
// les plus larges (texte agrandi, police lisible, grandes cibles) : rien de coupé, les boutons et le message accessibles, sinon le panneau défile
// proprement. Serveur de prévisualisation lancé ; captures dans $E2E_OUT.
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
let failed = false

for (const [name, accommodations] of [['defaut', false], ['amenagements', true]]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => {
    failed = true
    console.error(e.message)
  })
  await page.goto(`${BASE}/?decouverte&e2e&qualite=bas&musique=0&sons=0`)
  await page.waitForFunction(() => window.__aldoria?.world, null, { timeout: 300_000 })
  await page.evaluate((wide) => {
    if (wide) {
      const html = document.documentElement
      // L'écran réapplique à chaque rendu les aménagements de l'enfant (découverte : aucun) : un observateur remet ceux de ce test.
      const wanted = { 'data-text-size': '2', 'data-readable-font': 'true', 'data-big-targets': 'true' }
      const apply = () => {
        for (const [key, value] of Object.entries(wanted)) if (html.getAttribute(key) !== value) html.setAttribute(key, value)
      }
      new MutationObserver(apply).observe(html, { attributes: true })
      apply()
    }
    window.__aldoria.giveSphinxPasses(1, { tier: 6 })
    const w = window.__aldoria.world
    const boat = w.interactables.find((i) => i.id === 'barque')
    w.teleport(boat.x - 1.8, boat.z, boat.x + 4, boat.z)
  }, accommodations)
  await page.getByTestId('invite').filter({ hasText: 'Monter dans la barque du Sphinx' }).waitFor({ timeout: 20_000 })
  await page.keyboard.press('KeyE')
  await page.getByRole('button', { name: 'Traverser' }).click()
  await page.getByRole('button', { name: 'Au premier bloc !' }).click()
  await page.getByTestId('sphinx-enigme').waitFor()
  const info = await page.evaluate(() => {
    const panel = document.querySelector('.sphinx-panel')
    const board = document.querySelector('[data-testid="sphinx-plateau"]').getBoundingClientRect()
    const buttons = [...panel.querySelectorAll('.actions button')].map((b) => ({ text: b.textContent.replace(/\s+/g, ' ').trim(), bottom: Math.round(b.getBoundingClientRect().bottom) }))
    const status = document.querySelector('[data-testid="sphinx-message"]').getBoundingClientRect()
    const r = panel.getBoundingClientRect()
    return {
      panel: { top: Math.round(r.top), bottom: Math.round(r.bottom) },
      scrolls: panel.scrollHeight > panel.clientHeight,
      board: { w: Math.round(board.width), h: Math.round(board.height), bottom: Math.round(board.bottom) },
      statusBottom: Math.round(status.bottom),
      buttons,
    }
  })
  console.log(name, JSON.stringify(info))
  await page.screenshot({ path: `${OUT}/sphinx-grand-plateau-${name}.png` })
  // La salle 3D tient en entier à gauche du panneau : les quatre coins du plateau, projetés à l'écran, ne passent ni sous le panneau ni hors de la fenêtre.
  const room = await page.evaluate(() => {
    const t = window.__aldoria.world.temple
    const rows = t.snapshot().rows
    const w = Math.max(...rows.map((r) => r.length))
    const h = rows.length
    const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(([x, y]) => t.projectCell({ x, y }))
    return { corners, panelLeft: document.querySelector('.sphinx-panel').getBoundingClientRect().left }
  })
  for (const c of room.corners) {
    if (c.x < 0 || c.x > room.panelLeft || c.y < 0 || c.y > 720) {
      failed = true
      console.error(`${name} : un coin de la salle 3D sort de la part libre de l'écran (${Math.round(c.x)}, ${Math.round(c.y)}), le panneau commence à ${Math.round(room.panelLeft)}`)
    }
  }
  // Sans défilement, tout doit être dans la fenêtre ; avec, le panneau doit défiler (jamais un débordement hors du panneau).
  const inside = info.panel.bottom <= 720 && info.buttons.every((b) => b.bottom <= 720)
  if (!inside && !info.scrolls) {
    failed = true
    console.error(`${name} : le panneau déborde sans défiler`)
  }
  if (!accommodations && !inside) {
    failed = true
    console.error(`${name} : par défaut, le plus grand plateau doit tenir en entier à 1280 x 720`)
  }
  await page.close()
}
await browser.close()
process.exit(failed ? 1 : 0)
