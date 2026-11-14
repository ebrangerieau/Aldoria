// Parcours d'un lieu de quête dans un vrai navigateur, sous la CSP de production : la Tour des Fractions de
// l'entrée au coffre (cinq salles, énigme à trois piédestaux, Effaceur), la note de fin, puis le retour à l'île
// où le lieu suivant s'ouvre et où Maître Ysaline salue la page rapportée. Mode découverte : rien n'est enregistré.
//   npm run build && npm run preview &   puis   npm run e2e:lieu
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
const QUALITY = process.env.E2E_QUALITE ?? 'bas'
const CODE = process.env.E2E_LIEU ?? 'tour_fractions'
mkdirSync(OUT, { recursive: true })

const problems = []
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (e) => problems.push(`erreur de la page : ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console : ${m.text()}`) })
page.on('response', (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`) })
const step = async (label, fn) => {
  const t = Date.now()
  await fn()
  console.log(`✓ ${label} (${((Date.now() - t) / 1000).toFixed(1)} s)`)
}
const stage = (fn, arg) => page.evaluate(fn, arg)

/** Répond juste à la question affichée (le crochet ?e2e donne l'item), puis continue. */
async function answerAndContinue() {
  await page.getByRole('dialog').waitFor({ timeout: 30_000 * SLOW })
  const item = await page.evaluate(() => window.__aldoria.question)
  if (item.answer.kind === 'choice') await page.locator('.choice').nth(item.answer.index).click()
  else if (item.answer.kind === 'number' || item.answer.kind === 'fraction') {
    await page.getByLabel('Ta réponse').fill(String(item.answer.value).replace('.', ','))
    await page.getByRole('button', { name: 'Valider' }).click()
  } else if (item.answer.kind === 'text') {
    await page.getByLabel('Ta réponse').fill(item.answer.value[0])
    await page.getByRole('button', { name: 'Valider' }).click()
  } else if (item.answer.kind === 'order') {
    for (const i of item.answer.value) await page.locator('.choices .choice').nth(i).click()
    await page.getByRole('button', { name: 'Valider' }).click()
  } else if (item.answer.kind === 'vector') {
    const fields = page.locator('.vector-row input')
    await fields.nth(0).fill(item.answer.value[0])
    await fields.nth(1).fill(item.answer.value[1])
    await page.getByRole('button', { name: 'Valider' }).click()
  } else throw new Error(`type de réponse non géré par le test : ${item.answer.kind}`)
  await page.locator('.feedback.good').waitFor({ timeout: 10_000 * SLOW })
  await page.getByRole('button', { name: 'Continuer' }).click()
}

/** Marche vers `to` depuis `from` (touche tenue) jusqu'à ce que `until` apparaisse. */
async function walkUntil(key, until) {
  await page.keyboard.down(key)
  try {
    await until.waitFor({ timeout: 40_000 * SLOW })
  } finally {
    await page.keyboard.up(key)
  }
}

/** Combat au contact : l'ennemi `id` est abordé de l'ouest ; chaque tour, une frappe et une bonne réponse. */
async function fight(id) {
  const at = await stage((i) => window.__aldoria.place.stage.enemyPosition(i), id)
  await stage(({ x, z }) => window.__aldoria.place.stage.teleport(x - 6, z), at)
  await walkUntil('KeyD', page.getByTestId('actions').or(page.getByRole('dialog')))
  // L'Effaceur se présente d'abord : on lit, on continue.
  if (await page.getByRole('button', { name: 'En garde !' }).count()) await page.getByRole('button', { name: 'En garde !' }).click()
  for (let turn = 0; turn < 40; turn += 1) {
    await page.getByTestId('actions').waitFor({ timeout: 40_000 * SLOW })
    await page.getByRole('button', { name: /Coup d'épée/ }).click()
    await answerAndContinue()
    const outcome = await Promise.race([
      page.getByTestId('actions').waitFor({ timeout: 40_000 * SLOW }).then(() => 'suite'),
      page.getByTestId('pv-ennemi').waitFor({ state: 'detached', timeout: 40_000 * SLOW }).then(() => 'victoire'),
    ])
    if (outcome === 'victoire') return turn + 1
  }
  throw new Error(`l'ennemi ${id} n'est pas tombé en 40 tours`)
}

try {
  await step('on entre dans le lieu : introduction de Maître Ysaline, héros dans la première salle', async () => {
    await page.goto(`${BASE}/?decouverte&e2e&qualite=${QUALITY}&erreurs=0&lieu=${CODE}`)
    await page.waitForFunction(() => window.__aldoria?.place, null, { timeout: 240_000 * SLOW })
    await page.getByRole('button', { name: 'En avant !' }).click()
    await page.getByTestId('heros-parle').waitFor({ timeout: 10_000 * SLOW })
    await page.waitForTimeout(800 * SLOW)
    await page.screenshot({ path: `${OUT}/lieu-01-entree.png` })
    const where = await stage(() => window.__aldoria.place.stage.heroPosition())
    if (where.room !== 0) throw new Error(`salle de départ : ${where.room}`)
  })

  await step('salle 1 : le sbire tombe, la porte s’ouvre', async () => {
    const turns = await fight('1.0')
    await page.screenshot({ path: `${OUT}/lieu-02-victoire.png` })
    if (turns > 6) throw new Error(`trop de tours pour un sbire : ${turns}`)
    await page.getByTestId('bandeau').filter({ hasText: 'La porte s’ouvre' }).waitFor({ timeout: 10_000 * SLOW })
    if (!(await stage(() => window.__aldoria.place.stage.isDoorOpen(1)))) throw new Error('la porte 1 est restée fermée')
  })

  await step('salle 2 : deux ennemis, la porte ne s’ouvre qu’après le second', async () => {
    await fight('2.0')
    if (await stage(() => window.__aldoria.place.stage.isDoorOpen(2))) throw new Error('la porte 2 s’est ouverte avec un ennemi en vie')
    await fight('2.1')
    await page.getByTestId('bandeau').filter({ hasText: 'La porte s’ouvre' }).waitFor({ timeout: 10_000 * SLOW })
  })

  await step('salle 3 : énigme, trois piédestaux (balance) ; l’objet trouvé', async () => {
    await stage(() => window.__aldoria.place.stage.teleport(3 * 16 + 2.5, 10))
    await page.getByRole('button', { name: "C'est parti" }).click({ timeout: 20_000 * SLOW })
    for (let i = 0; i < 3; i += 1) {
      const at = await stage((k) => window.__aldoria.place.stage.pedestalPosition(k), i)
      await stage(({ x, z }) => window.__aldoria.place.stage.teleport(x, z - 3), at)
      await walkUntil('KeyW', page.getByRole('dialog'))
      if (i === 0) await page.screenshot({ path: `${OUT}/lieu-03-enigme.png` })
      await answerAndContinue()
      await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10_000 * SLOW })
    }
    await page.getByTestId('bandeau').filter({ hasText: /porte s’ouvre|Trouvé/ }).first().waitFor({ timeout: 10_000 * SLOW })
    if (!(await stage(() => window.__aldoria.place.stage.isDoorOpen(3)))) throw new Error('la porte 3 est restée fermée')
  })

  await step('salle 4 : le gardien des os', async () => {
    await fight('4.0')
  })

  await step('salle 5 : l’Effaceur se présente, tombe, rend la page ; le coffre apparaît', async () => {
    await stage(() => window.__aldoria.place.stage.teleport(5 * 16 + 2.5, 10))
    const turns = await fight('5.0')
    if (turns < 7) throw new Error(`l'Effaceur est tombé trop vite : ${turns} tours`)
    await page.screenshot({ path: `${OUT}/lieu-04-effaceur.png` })
    await page.getByRole('dialog').waitFor({ timeout: 20_000 * SLOW }) // sa défaite
    await page.getByRole('button', { name: 'Reprendre la page' }).click()
    await page.getByTestId('bandeau').filter({ hasText: 'Un coffre est apparu' }).waitFor({ timeout: 10_000 * SLOW })
  })

  await step('le coffre rend la page ; note de fin ; retour à l’île', async () => {
    const chest = await stage(() => window.__aldoria.place.stage.chestPosition())
    if (!chest) throw new Error('pas de coffre')
    await stage(({ x, z }) => window.__aldoria.place.stage.teleport(x - 4, z), chest)
    await walkUntil('KeyD', page.getByRole('dialog'))
    await page.getByRole('heading', { name: /retrouvée/ }).waitFor({ timeout: 20_000 * SLOW })
    await page.screenshot({ path: `${OUT}/lieu-05-page.png` })
    await page.getByRole('button', { name: 'Continuer' }).click()
    await page.getByTestId('note').waitFor({ timeout: 10_000 * SLOW })
    await page.getByRole('button', { name: '5 sur 5' }).click()
    await page.getByRole('heading', { name: 'Maître Ysaline' }).waitFor({ timeout: 30_000 * SLOW })
    await page.screenshot({ path: `${OUT}/lieu-06-retour.png` })
  })

  await step('à l’île : le lieu est terminé, le suivant de la région est ouvert', async () => {
    await page.getByRole('button', { name: 'Merci !' }).click()
    const state = await page.evaluate((code) => {
      const w = window.__aldoria.world
      return { interior: w.interior !== null, lieux: w.interactables.filter((i) => i.kind === 'lieu').map((i) => ({ id: i.id, open: i.open })), code }
    }, CODE)
    if (state.interior) throw new Error("l'intérieur n'a pas été rendu")
    const next = state.lieux.filter((l) => l.open).map((l) => l.id)
    if (next.length < 2) throw new Error(`aucun lieu de plus ouvert : ${JSON.stringify(state.lieux.filter((l) => l.open))}`)
    await page.waitForTimeout(800 * SLOW)
    await page.screenshot({ path: `${OUT}/lieu-07-ile.png` })
  })
} catch (error) {
  problems.push(String(error))
  await page.screenshot({ path: `${OUT}/lieu-echec.png` }).catch(() => {})
} finally {
  await browser.close()
}

if (problems.length > 0) {
  console.error('\n✗ Parcours du lieu en échec :\n  ' + problems.join('\n  '))
  process.exit(1)
}
console.log(`\nParcours du lieu réussi. Captures : ${OUT}`)
