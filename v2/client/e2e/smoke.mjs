// Parcours de fumée dans un vrai navigateur : écran titre → île (mode découverte) → le héros
// avance → la mini-carte le suit et se cache avec M → la musique joue, se coupe et se tait pendant
// une question → pierre d'éveil → question → bonne réponse → la pierre s'éveille. Échoue sur toute
// erreur de la page ou toute ressource introuvable. Captures dans $E2E_OUT (défaut : e2e/captures).
//   npm run build && npm run preview &   puis   npm run e2e
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'

// playwright-core d'e2e/package.json (CI), sinon un Playwright installé sur le poste.
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
const SLOW = Number(process.env.E2E_SLOW ?? 1) // rendu logiciel de la CI : attentes allongées
const QUALITY = process.env.E2E_QUALITE ?? 'bas'
mkdirSync(OUT, { recursive: true })

const problems = []
// E2E_RETARD_MUSIQUE=<ms> : chaque fichier de /musique/ arrive avec ce retard (réseau lent, CI chargée).
const MUSIC_DELAY = Number(process.env.E2E_RETARD_MUSIQUE ?? 0)
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
// Seule tolérée : l'erreur d'essai levée exprès par `?erreur_test=1` (remontée des erreurs).
const TEST_ERROR = "Erreur d'essai (erreur_test=1)"
page.on('pageerror', (e) => { if (!e.message.includes(TEST_ERROR)) problems.push(`erreur de la page : ${e.message}`) })
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes(TEST_ERROR)) problems.push(`console : ${m.text()}`) })
page.on('response', (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`) })
if (MUSIC_DELAY > 0) {
  await page.route('**/musique/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, MUSIC_DELAY))
    await route.continue()
  })
}

const step = async (label, fn) => {
  const t = Date.now()
  await fn()
  console.log(`✓ ${label} (${((Date.now() - t) / 1000).toFixed(1)} s)`)
}

try {
  await step('écran titre', async () => {
    await page.goto(`${BASE}/`)
    await page.getByTestId('decouvrir').waitFor()
    await page.screenshot({ path: `${OUT}/01-titre.png` })
  })

  await step("chargement de l'île", async () => {
    await page.goto(`${BASE}/?decouverte&e2e&erreur_test=1&qualite=${QUALITY}`)
    await page.waitForFunction(() => window.__aldoria?.world, null, { timeout: 180_000 * SLOW })
    await page.waitForTimeout(2500 * SLOW)
    await page.screenshot({ path: `${OUT}/02-depart.png` })
  })

  await step('une erreur du jeu est captée pour l’exploitant (sans appareil relié : rien ne part)', async () => {
    const caught = await page.evaluate(() => window.__aldoria.services.errors.list())
    const test = caught.find((e) => e.message.includes("Erreur d'essai"))
    if (!test) throw new Error(`erreur d'essai non captée : ${JSON.stringify(caught)}`)
    if (!test.location) throw new Error("erreur d'essai sans endroit du code")
  })

  await step('le renard a des proportions normales et touche le sol', async () => {
    // Sommets avec le squelette appliqué, dans le repère du monde : tous à moins de 1,5 m du renard
    // (avant le correctif de la racine du squelette, certains partaient à des dizaines de mètres), et
    // le plus bas à moins de 8 cm du sol.
    const fox = await page.evaluate(() => {
      const f = window.__aldoria.world.fox
      if (!f) return null
      const o = f.root.getAbsolutePosition()
      let far = 0
      let lowest = Infinity
      for (const m of f.meshes) {
        if (!m.getTotalVertices()) continue
        const p = m.getPositionData(true, false)
        const w = m.getWorldMatrix().m
        for (let i = 0; i < p.length; i += 3) {
          const x = p[i] * w[0] + p[i + 1] * w[4] + p[i + 2] * w[8] + w[12]
          const y = p[i] * w[1] + p[i + 1] * w[5] + p[i + 2] * w[9] + w[13]
          const z = p[i] * w[2] + p[i + 1] * w[6] + p[i + 2] * w[10] + w[14]
          far = Math.max(far, Math.hypot(x - o.x, y - o.y, z - o.z))
          lowest = Math.min(lowest, y)
        }
      }
      return { far, gap: lowest - o.y }
    })
    if (!fox) throw new Error('pas de renard dans le monde lumineux')
    if (fox.far > 1.5) throw new Error(`un sommet du renard est à ${fox.far.toFixed(1)} m de lui`)
    if (Math.abs(fox.gap) > 0.08) throw new Error(`le renard est à ${(fox.gap * 100).toFixed(0)} cm du sol`)
  })

  await step('le héros avance (touche Z/W)', async () => {
    const before = await page.evaluate(() => window.__aldoria.world.heroPosition())
    await page.getByTestId('monde').click({ position: { x: 640, y: 120 } })
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(1500 * SLOW)
    await page.keyboard.up('KeyW')
    const after = await page.evaluate(() => window.__aldoria.world.heroPosition())
    const moved = Math.hypot(after.x - before.x, after.z - before.z)
    if (moved < 1) throw new Error(`le héros n'a pas bougé (${moved.toFixed(2)} m)`)
  })

  await step('la carte suit le héros et se cache avec M', async () => {
    const carte = page.getByTestId('carte')
    await carte.waitFor()
    const u = () => page.getByTestId('carte-heros').getAttribute('data-u').then(Number)
    const before = await u()
    // 70 m vers l'est : la flèche part vers la droite de la carte.
    await page.evaluate(() => window.__aldoria.world.teleport(70, 60, 120, 105))
    await page.waitForFunction(
      (start) => Number(document.querySelector('[data-testid=carte-heros]')?.getAttribute('data-u')) > start + 15,
      before,
      { timeout: 5000 * SLOW },
    )
    await page.locator('.hud-right').screenshot({ path: `${OUT}/02b-carte.png` })
    await page.keyboard.press('m')
    await carte.waitFor({ state: 'detached' })
    if ((await page.getByTestId('bouton-carte').getAttribute('aria-pressed')) !== 'false') throw new Error('bouton « Carte » pas relâché')
    await page.keyboard.press('m')
    await carte.waitFor()
    if ((await u()) <= before) throw new Error('la carte rouverte ne montre plus le héros où il est')
  })

  await step('la musique joue, se coupe avec le bouton et revient', async () => {
    const music = () => page.evaluate(() => window.__aldoria.services.music.state())
    // Le navigateur ne la lance qu'après un geste : le clic sur le monde, plus haut, en est un.
    await page.waitForFunction(() => window.__aldoria.services.music.state().playing, null, { timeout: 15_000 * SLOW })
    const first = await music()
    if (first.track !== 'theme.mp3') throw new Error(`premier morceau inattendu : ${first.track}`)
    await page.waitForFunction(() => window.__aldoria.services.music.state().level > 0.05, null, { timeout: 10_000 * SLOW })
    await page.waitForTimeout(800 * SLOW)
    if ((await music()).time <= first.time) throw new Error('la musique n’avance pas')
    const button = page.getByTestId('bouton-musique')
    if ((await button.getAttribute('aria-pressed')) !== 'true') throw new Error('bouton « Musique » pas enfoncé alors qu’elle joue')
    await button.click()
    await page.waitForFunction(() => !window.__aldoria.services.music.state().playing, null, { timeout: 8000 * SLOW })
    if ((await button.getAttribute('aria-pressed')) !== 'false') throw new Error('bouton « Musique » pas relâché')
    await button.click()
    await page.waitForFunction(() => window.__aldoria.services.music.state().playing, null, { timeout: 8000 * SLOW })
  })

  await step('en fin de morceau, le suivant prend le relais, puis le thème revient après le dernier', async () => {
    const music = () => page.evaluate(() => window.__aldoria.services.music.state())
    const tracks = await page.evaluate(() => window.__aldoria.services.music.tracks.map((t) => t.file))
    if (tracks.length < 2) return // un seul morceau : il boucle sur lui-même (vérifié à la main)
    // On saute à une seconde et demie de la fin du morceau en cours, tant de fois qu'il y a de morceaux.
    for (let k = 1; k <= tracks.length; k += 1) {
      const before = await music()
      const expected = tracks[(tracks.indexOf(before.track) + 1) % tracks.length]
      // « Joue » dès l'appel à play() : le début du morceau peut ne pas être arrivé (sa durée est alors inconnue).
      await page.waitForFunction(
        () => Number.isFinite(window.__aldoria.services.music.state().duration) && window.__aldoria.services.music.state().duration > 10,
        null,
        { timeout: 30_000 * SLOW },
      )
      await page.evaluate(() => {
        const a = window.__aldoria.services.music.audio
        a.currentTime = a.duration - 1.5
      })
      await page.waitForFunction((next) => window.__aldoria.services.music.state().track === next, expected, { timeout: 12_000 * SLOW })
      await page.waitForFunction(() => window.__aldoria.services.music.state().playing, null, { timeout: 8000 * SLOW })
    }
    if ((await music()).track !== tracks[0]) throw new Error('après le dernier morceau, le premier devait revenir')
    await page.waitForFunction(() => window.__aldoria.services.music.audio.currentTime > 0.3, null, { timeout: 8000 * SLOW })
  })

  await step("question de la pierre d'éveil", async () => {
    await page.evaluate(() => window.__aldoria.world.teleport(9, -24.5, 9, -22))
    await page.getByTestId('invite').waitFor({ timeout: 10_000 * SLOW })
    await page.screenshot({ path: `${OUT}/03-pierre.png` })
    await page.keyboard.press('KeyE')
    await page.getByRole('dialog').waitFor()
    // Pendant une question, la musique s'éteint en fondu (l'enfant reste concentré) ; elle revient après.
    await page.waitForFunction(() => !window.__aldoria.services.music.state().playing, null, { timeout: 8000 * SLOW })
    // Pendant une question, M ne touche pas à la carte (ni à la réponse : elle est remplie plus bas).
    await page.keyboard.press('m')
    if ((await page.getByTestId('carte').count()) !== 1) throw new Error('la touche M a caché la carte pendant une question')
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT}/04-question.png` })
  })

  await step('bonne réponse, la pierre s’éveille', async () => {
    const item = await page.evaluate(() => window.__aldoria.question)
    if (item.answer.kind === 'choice') {
      await page.locator('.choice').nth(item.answer.index).click()
    } else if (item.answer.kind === 'number' || item.answer.kind === 'fraction') {
      await page.getByLabel('Ta réponse').fill(String(item.answer.value).replace('.', ','))
      await page.getByRole('button', { name: 'Valider' }).click()
    } else if (item.answer.kind === 'text') {
      await page.getByLabel('Ta réponse').fill(item.answer.value[0])
      await page.getByRole('button', { name: 'Valider' }).click()
    } else if (item.answer.kind === 'order') {
      for (const i of item.answer.value) await page.locator('.choices .choice').nth(i).click()
      await page.getByRole('button', { name: 'Valider' }).click()
    } else {
      throw new Error(`type de réponse non géré par le test : ${item.answer.kind}`)
    }
    await page.locator('.feedback.good').waitFor({ timeout: 5000 })
    await page.screenshot({ path: `${OUT}/05-juste.png` })
    await page.getByRole('button', { name: 'Continuer' }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    await page.waitForFunction(() => window.__aldoria.services.music.state().playing, null, { timeout: 8000 * SLOW })
    const xp = await page.locator('.badge').innerText()
    if (!/15 XP/.test(xp)) throw new Error(`XP attendue après la pierre : ${xp}`)
    // La carte montre la pierre éveillée (dorée).
    await page.locator('[data-id="pierre-eveil"].mark-eveillee').waitFor({ state: 'attached', timeout: 3000 })
    await page.waitForTimeout(800 * SLOW)
    await page.screenshot({ path: `${OUT}/06-eveillee.png` })
  })

  await step('vue de la Citadelle et des montagnes', async () => {
    await page.evaluate(() => {
      const w = window.__aldoria.world
      w.teleport(0, -40, 0, 30)
      w.frame(-Math.PI / 2 - 0.35, 1.28, 14)
    })
    await page.waitForTimeout(1500 * SLOW)
    await page.screenshot({ path: `${OUT}/07-citadelle.png` })
  })
} catch (error) {
  problems.push(String(error))
  await page.screenshot({ path: `${OUT}/echec.png` }).catch(() => {})
} finally {
  await browser.close()
}

if (problems.length > 0) {
  console.error('\n✗ Parcours en échec :\n  ' + problems.join('\n  '))
  process.exit(1)
}
console.log(`\nParcours réussi. Captures : ${OUT}`)
