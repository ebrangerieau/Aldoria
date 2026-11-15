// Vérifie que les écrans ajoutés à la Lice et à l'histoire (stand de tir en 6e et en 2nde, pont des fractions, prologue, sac, bestiaire) tiennent dans la fenêtre à 1280 x 720, par
// défaut puis avec les aménagements les plus larges (texte agrandi, police lisible, grandes cibles) : jamais de débordement horizontal, le bouton qui fait avancer le jeu
// toujours atteignable (dans la fenêtre, ou le panneau défile), les captures dans $E2E_OUT. Serveur de prévisualisation lancé : npm run preview.
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

/** Les écrans à vérifier : comment les ouvrir, quel conteneur mesurer, quel bouton doit rester atteignable. */
const SCREENS = [
  {
    name: 'tir-rapporteur',
    query: '',
    open: async (page) => {
      await goTo(page, 'tir-stand', 'Tirer au stand')
      await page.getByRole('button', { name: 'À mes cibles !' }).click()
      await page.getByTestId('tir-jeu').waitFor({ timeout: 20_000 })
    },
    panel: '.tir-panel',
    button: '[data-testid="tir-tirer"]',
  },
  {
    name: 'tir-droite',
    query: '&classe=2nde&monde=brouillard',
    open: async (page) => {
      await goTo(page, 'tir-stand', 'Tirer au stand')
      await page.getByRole('button', { name: 'À mes cibles !' }).click()
      await page.getByTestId('tir-jeu').waitFor({ timeout: 20_000 })
    },
    panel: '.tir-panel',
    button: '[data-testid="tir-tirer"]',
  },
  {
    name: 'pont',
    query: '',
    open: async (page) => {
      await goTo(page, 'pont-fractions', 'Franchir le pont')
      await page.getByRole('button', { name: 'Au premier ravin !' }).click()
      await page.getByTestId('pont-jeu').waitFor({ timeout: 20_000 })
    },
    panel: '.pont-panel',
    button: '[data-testid="pont-poser"]',
  },
  {
    name: 'prologue',
    query: '',
    open: async (page) => {
      await page.evaluate(() => { window.__aldoria.services.voice.say = () => new Promise(() => {}) })
      await goTo(page, null, 'Maître Ysaline', (w) => w.interactables.find((i) => i.kind === 'ysaline'))
      await page.getByRole('button', { name: 'Revoir l’histoire' }).click()
      await page.getByTestId('prologue').waitFor({ timeout: 20_000 })
      await page.getByTestId('prologue-bouton-texte').click()
    },
    panel: '.prologue-panel',
    button: '[data-testid="prologue-suite"]',
  },
  {
    name: 'sac',
    query: '',
    open: async (page) => {
      await page.evaluate(() => { window.__aldoria.give('plume', 2); window.__aldoria.give('potion', 1) })
      await page.getByTestId('bouton-sac').click()
      await page.getByTestId('sac-ile').waitFor({ timeout: 20_000 })
    },
    panel: '.bag',
    button: '.bag .actions button',
  },
  {
    name: 'bestiaire',
    query: '',
    open: async (page) => {
      await page.getByTestId('bouton-archives').click()
      await page.getByTestId('archives').waitFor({ timeout: 20_000 })
      await page.getByTestId('archives-bestiaire').click()
    },
    panel: '.archives',
    button: '.archives-head button',
  },
]

/** Place le héros devant un élément de l'île (par son identifiant, ou par une recherche) puis appuie sur E. */
async function goTo(page, id, invite, find) {
  await page.evaluate(({ id: wanted, findSource }) => {
    const w = window.__aldoria.world
    const target = wanted ? w.interactables.find((i) => i.id === wanted) : new Function('w', `return (${findSource})(w)`)(w)
    w.teleport(target.x, target.z - 1.8, target.x, target.z)
  }, { id, findSource: find ? find.toString() : '' })
  await page.getByTestId('invite').filter({ hasText: invite }).waitFor({ timeout: 20_000 })
  await page.keyboard.press('KeyE')
}

for (const screen of SCREENS) {
  for (const [mode, wide] of [['defaut', false], ['amenagements', true]]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
    page.on('pageerror', (e) => {
      failed = true
      console.error(`${screen.name} ${mode} : ${e.message}`)
    })
    await page.goto(`${BASE}/?decouverte&e2e&qualite=bas&musique=0&sons=0${screen.query}`)
    await page.waitForFunction(() => window.__aldoria?.world, null, { timeout: 300_000 })
    if (wide) {
      await page.evaluate(() => {
        const html = document.documentElement
        // L'écran réapplique à chaque rendu les aménagements de l'enfant (découverte : aucun) : un observateur remet ceux de ce test.
        const wanted = { 'data-text-size': '2', 'data-readable-font': 'true', 'data-big-targets': 'true' }
        const apply = () => {
          for (const [key, value] of Object.entries(wanted)) if (html.getAttribute(key) !== value) html.setAttribute(key, value)
        }
        new MutationObserver(apply).observe(html, { attributes: true })
        apply()
      })
    }
    try {
      await screen.open(page)
      await page.waitForTimeout(600)
      const info = await page.evaluate(({ panelSel, buttonSel }) => {
        const panel = document.querySelector(panelSel)
        const r = panel.getBoundingClientRect()
        const button = document.querySelector(buttonSel)?.getBoundingClientRect()
        return {
          panel: { top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width) },
          scrolls: panel.scrollHeight > panel.clientHeight + 1,
          overflowsX: panel.scrollWidth > panel.clientWidth + 1 || document.documentElement.scrollWidth > window.innerWidth,
          button: button ? { top: Math.round(button.top), bottom: Math.round(button.bottom) } : null,
        }
      }, { panelSel: screen.panel, buttonSel: screen.button })
      console.log(screen.name, mode, JSON.stringify(info))
      await page.screenshot({ path: `${OUT}/a11y-${screen.name}-${mode}.png` })
      const reachable = info.button && info.button.bottom <= 720 && info.button.top >= 0
      if (info.overflowsX) {
        failed = true
        console.error(`${screen.name} ${mode} : débordement horizontal`)
      }
      if (!reachable && !info.scrolls) {
        failed = true
        console.error(`${screen.name} ${mode} : le bouton principal est hors de la fenêtre et le panneau ne défile pas`)
      }
      if (!wide && !reachable) {
        failed = true
        console.error(`${screen.name} ${mode} : par défaut, le bouton principal doit tenir dans la fenêtre à 1280 x 720`)
      }
    } catch (error) {
      failed = true
      console.error(`${screen.name} ${mode} : ${error.message.split('\n')[0]}`)
      await page.screenshot({ path: `${OUT}/a11y-${screen.name}-${mode}-echec.png` }).catch(() => {})
    }
    await page.close()
  }
}
await browser.close()
console.log(failed ? 'Aménagements : des écrans débordent' : 'Aménagements : tous les écrans tiennent')
process.exit(failed ? 1 : 0)
