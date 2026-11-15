// Vérifie que le panneau de la balance géante (Tour des Fractions) tient dans la fenêtre à 1280 x 720, par défaut puis avec les aménagements les plus larges
// (texte agrandi, police lisible, grandes cibles) : le panneau reste dans la moitié basse, « Essayer sur la balance » et la masse proposée restent à l'écran
// (collés en bas du panneau qui défile), la balance reste visible au-dessus. Serveur de prévisualisation lancé ; captures dans $E2E_OUT.
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
    const w = window.__aldoria.world
    const it = w.interactables.find((i) => i.id === 'tour_fractions')
    w.teleport(it.x, it.z - 1.5, it.x, it.z)
  }, accommodations)
  await page.getByTestId('invite').filter({ hasText: 'Approcher' }).waitFor({ timeout: 20_000 })
  await page.keyboard.press('KeyE')
  await page.getByRole('button', { name: "J'y vais" }).click()
  await page.getByTestId('etage').waitFor({ timeout: 120_000 })
  await page.evaluate(() => {
    const i = window.__aldoria.world.interior
    for (let d = 0; d < 3; d += 1) i.openDoor(d, false)
    const e = i.dungeon.entryPoint(3)
    i.teleport(e.x, e.z)
  })
  await page.getByRole('button', { name: "C'est parti" }).click()
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  await page.evaluate(() => {
    const i = window.__aldoria.world.interior
    i.teleport(i.balance.x - 1.0, i.balance.z - 3.0)
  })
  await page.getByTestId('balance-enigme').waitFor({ timeout: 30_000 })
  // Un essai à côté : le message de correction s'affiche (il passe au-dessus des commandes collées en bas).
  const item = await page.evaluate(() => window.__aldoria.balance.item)
  for (let n = 0; n < Number(item.answer.value) + 2; n += 1) await page.keyboard.press('ArrowUp')
  await page.getByTestId('balance-essayer').click()
  await page.getByTestId('balance-message').filter({ hasText: /\S/ }).waitFor()
  await page.waitForTimeout(1500)
  const info = await page.evaluate(() => {
    const rect = (el) => {
      const r = el.getBoundingClientRect()
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }
    }
    const panel = document.querySelector('.balance-panel')
    return {
      panel: rect(panel),
      scrolls: panel.scrollHeight > panel.clientHeight,
      essayer: rect(document.querySelector('[data-testid="balance-essayer"]')),
      valeur: rect(document.querySelector('[data-testid="balance-valeur"]')),
      message: rect(document.querySelector('[data-testid="balance-message"]')),
    }
  })
  console.log(name, JSON.stringify(info))
  await page.screenshot({ path: `${OUT}/balance-a11y-${name}.png` })
  // La balance reste visible : le panneau ne couvre jamais plus de la moitié basse de la fenêtre.
  if (info.panel.top < 720 * 0.45) {
    failed = true
    console.error(`${name} : le panneau couvre trop de la scène (il commence à ${info.panel.top} px)`)
  }
  // Le retour de l'essai se lit en entier, dans le panneau et au-dessus de la rangée collée en bas (jamais dessous ou coupé).
  if (info.message.top < info.panel.top || info.message.bottom > info.essayer.top) {
    failed = true
    console.error(`${name} : le message de l'essai est coupé ou caché sous les commandes (${JSON.stringify(info.message)}, commandes à ${info.essayer.top})`)
  }
  // La masse proposée et « Essayer sur la balance » sont toujours à l'écran, même quand le panneau défile.
  for (const key of ['essayer', 'valeur']) {
    if (info[key].bottom > 720 || info[key].top < info.panel.top || info[key].right > 1280) {
      failed = true
      console.error(`${name} : « ${key} » sort de la fenêtre ou du panneau (${JSON.stringify(info[key])})`)
    }
  }
  await page.close()
}
await browser.close()
process.exit(failed ? 1 : 0)
