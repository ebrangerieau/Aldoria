// Parcours de fumée dans un vrai navigateur : écran titre → île (mode découverte) → le héros
// avance → la mini-carte le suit et se cache avec M → la musique joue, se coupe et se tait pendant
// une question → l'intérieur d'un lieu (entrée par le seuil, étage 2 au clavier, sortie) → un combat (repli sans perte,
// victoire, porte qui s'ouvre) → pierre d'éveil → question → bonne réponse → la pierre s'éveille. Échoue sur toute
// erreur de la page ou toute ressource introuvable. Captures dans $E2E_OUT (défaut : e2e/captures).
//   npm run build && npm run preview &   puis   npm run e2e
import { currentQuestion, solve } from './answers.mjs'
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
// E2E_RETARD_VOIX=<ms> : chaque fichier de /voix/ arrive avec ce retard (le réseau du VPS, que l'aperçu local n'a pas).
const VOICE_DELAY = Number(process.env.E2E_RETARD_VOIX ?? 0)
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
// E2E_CPU=<facteur> : le processeur de la page est ralenti de ce facteur (4 à 6 : un PC chargé ou le runner de la CI), pour retrouver les
// courses entre un nettoyage de React et un clic (la voix coupée par le panneau de question qui se ferme, vue en production).
const CPU_SLOWDOWN = Number(process.env.E2E_CPU ?? 0)
if (CPU_SLOWDOWN > 1) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN })
}
// Seule tolérée : l'erreur d'essai levée exprès par `?erreur_test=1` (remontée des erreurs).
const TEST_ERROR = "Erreur d'essai (erreur_test=1)"
page.on('pageerror', (e) => { if (!e.message.includes(TEST_ERROR)) problems.push(`erreur de la page : ${e.message}`) })
// Les refus du serveur que l'étape de la connexion expirée provoque exprès (401, 503 sur l'ouverture de la session) : seuls tolérés pendant cette étape.
let refusalsExpected = false
page.on('console', (m) => {
  if (m.type() !== 'error' || m.text().includes(TEST_ERROR)) return
  if (refusalsExpected && m.text().includes('Failed to load resource')) return
  problems.push(`console : ${m.text()}`)
})
page.on('response', (r) => {
  if (r.status() >= 400 && !(refusalsExpected && r.url().includes('/play/session/start'))) problems.push(`${r.status()} ${r.url()}`)
})
if (VOICE_DELAY > 0) {
  await page.route('**/voix/*.mp3', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, VOICE_DELAY))
    await route.continue()
  })
}
if (MUSIC_DELAY > 0) {
  await page.route('**/musique/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, MUSIC_DELAY))
    await route.continue()
  })
}

/**
 * Répond à la question ouverte (celle de `window.__aldoria.question`), juste ou fausse, puis « Continuer ». `useAids` : se sert d'abord du
 * parchemin et de la plume du sac quand la question les propose (le parchemin s'il y a un indice, la plume sur un QCM d'au moins trois choix).
 */
const answerQuestion = async (correct, useAids = false) => {
  await page.getByRole('dialog').waitFor({ timeout: 10_000 * SLOW })
  const item = await currentQuestion(page, 10_000 * SLOW)
  if (useAids) {
    const scroll = page.getByTestId('objet-parchemin')
    if ((await scroll.count()) > 0) {
      await scroll.click()
      await page.locator('.hint-text').waitFor({ timeout: 5000 * SLOW })
      if ((await scroll.count()) > 0) throw new Error('le parchemin dépensé ne devrait plus être proposé')
      if (!(await page.getByRole('button', { name: 'Un indice ?' }).isDisabled())) throw new Error('« Un indice ? » devrait être grisé après le parchemin')
    }
    const feather = page.getByTestId('objet-plume')
    if ((await feather.count()) > 0) {
      const n = await page.locator('.choice').count()
      await feather.click()
      const gone = await page.locator('.choice.gone').count()
      if (gone !== Math.min(2, n - 2)) throw new Error(`la plume devrait cacher ${Math.min(2, n - 2)} propositions sur ${n}, pas ${gone}`)
      if (n > 0 && (await page.locator('.choice.gone').nth(0).isEnabled())) throw new Error('une proposition cachée doit être grisée')
      await page.screenshot({ path: `${OUT}/03c3-plume.png` })
    }
  }
  await solve(page, item, correct)
  await page.locator(correct ? '.feedback.good' : '.feedback.bad').waitFor({ timeout: 5000 * SLOW })
  await page.getByRole('button', { name: 'Continuer' }).click()
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

  await step('« Continuer, Tom » avec une connexion expirée ou refusée : le code est redemandé, un serveur muet est expliqué, jamais un bouton sans réponse', async () => {
    const login = (exp) => page.evaluate((expiry) => {
      const b64 = (o) => btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
      const token = `${b64({ alg: 'HS256' })}.${b64({ exp: expiry })}.signature`
      localStorage.setItem('aldoria2.auth', JSON.stringify({ token, profile: { id: 2, name: 'Tom', level: '2nde', world: 'brouillard', accommodations: {} } }))
      localStorage.setItem('aldoria2.device', JSON.stringify({ token: 'appareil', family: 'Famille' }))
    }, exp)
    const reply = (status) => page.route('**/api/v1/play/session/start', (route) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: { code: 'refuse', message: 'non' } }) }))
    const toTitle = async () => {
      await page.reload()
      await page.getByTestId('jouer').filter({ hasText: 'Continuer, Tom' }).waitFor({ timeout: 10_000 * SLOW })
    }
    const now = Math.floor(Date.now() / 1000)
    refusalsExpected = true

    // 1. Connexion gardée depuis plus de 12 heures : le code est redemandé tout de suite, sans même appeler le serveur.
    let called = false
    page.on('request', (r) => { if (r.url().includes('/play/session/start')) called = true })
    await login(now - 3600)
    await toTitle()
    await page.getByTestId('jouer').click()
    await page.getByRole('heading', { name: 'Bonjour Tom !' }).waitFor({ timeout: 10_000 * SLOW })
    if (!(await page.getByTestId('code-avis').innerText()).includes('Ta connexion a expiré')) throw new Error('l’enfant doit savoir pourquoi son code est redemandé')
    if (called) throw new Error('une connexion expirée n’a pas à appeler le serveur')
    await page.screenshot({ path: `${OUT}/01b-connexion-expiree.png` })

    // 2. Jeton qui semble valide mais que le serveur refuse (401) : même chose.
    await login(now + 3600)
    await reply(401)
    await toTitle()
    await page.getByTestId('jouer').click()
    await page.getByRole('heading', { name: 'Bonjour Tom !' }).waitFor({ timeout: 10_000 * SLOW })
    if (!(await page.getByTestId('code-avis').innerText()).includes('Ta connexion a expiré')) throw new Error('le refus du serveur (401) doit redemander le code avec son explication')
    await page.unroute('**/api/v1/play/session/start')

    // 3. Serveur en panne (503) : l'écran titre le dit, et le bouton se rend.
    await login(now + 3600)
    await reply(503)
    await toTitle()
    await page.getByTestId('jouer').click()
    await page.getByTestId('titre-avis').waitFor({ timeout: 10_000 * SLOW })
    if (!(await page.getByTestId('titre-avis').innerText()).includes('Le serveur ne répond pas')) throw new Error('un serveur en panne doit être expliqué')
    if (!(await page.getByTestId('jouer').isEnabled())) throw new Error('le bouton doit se rendre après un échec')
    await page.screenshot({ path: `${OUT}/01c-serveur-muet.png` })
    refusalsExpected = false
    await page.unroute('**/api/v1/play/session/start')
    await page.evaluate(() => { localStorage.removeItem('aldoria2.auth'); localStorage.removeItem('aldoria2.device') })
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

  await step('une relique de l’île : on la ramasse (E), elle rejoint la partie et son éclat disparaît', async () => {
    const spot = await page.evaluate(() => {
      const w = window.__aldoria.world
      const it = w.interactables.find((i) => i.kind === 'relique' && i.relic === 'flamme-1')
      if (!it) return null
      w.teleport(it.x - 1.4, it.z, it.x, it.z)
      return { x: it.x, z: it.z }
    })
    if (!spot) throw new Error('la relique flamme-1 devrait être dans l’île')
    await page.getByTestId('invite').filter({ hasText: 'Ramasser : Sceau de Flamme I' }).waitFor({ timeout: 10_000 * SLOW })
    if (!(await page.evaluate(() => !!window.__aldoria.world.scene.getMeshByName('flamme-1-eclat')))) throw new Error('l’éclat de la relique devrait être visible')
    await page.screenshot({ path: `${OUT}/02b-relique.png` })
    if ((await page.evaluate(() => window.__aldoria.save().relics.length)) !== 0) throw new Error('aucune relique avant de ramasser')
    await page.keyboard.press('KeyE')
    await page.getByRole('heading', { name: 'Relique trouvée !' }).waitFor({ timeout: 10_000 * SLOW })
    const text = await page.getByRole('dialog').innerText()
    if (!text.includes('Sceau de Flamme I') || !text.includes('1 relique sur 16')) throw new Error(`le message de la relique : ${text}`)
    const relics = await page.evaluate(() => window.__aldoria.save().relics)
    if (relics.join() !== 'flamme-1') throw new Error(`la partie devrait garder flamme-1 : ${relics}`)
    await page.getByRole('button', { name: 'Continuer' }).click()
    const gone = await page.evaluate(() => {
      const w = window.__aldoria.world
      return !w.scene.getMeshByName('flamme-1-eclat') && !w.interactables.some((i) => i.relic === 'flamme-1')
    })
    if (!gone) throw new Error('la relique ramassée devrait avoir disparu de l’île')
    if ((await page.getByTestId('invite').count()) !== 0) throw new Error('plus d’invitation à ramasser une fois la relique prise')
    // Une seule relique ne suffit pas pour une table : la Table l'explique et se referme à Échap.
    await page.evaluate(() => {
      const w = window.__aldoria.world
      const table = w.interactables.find((i) => i.id === 'table-reliques')
      w.teleport(table.x + 2.6, table.z, table.x, table.z)
    })
    await page.getByTestId('invite').filter({ hasText: 'Ouvrir la Table des Reliques' }).waitFor({ timeout: 10_000 * SLOW })
    await page.keyboard.press('KeyE')
    const empty = await page.getByTestId('table-vide').innerText()
    if (!empty.includes('tu en as 1')) throw new Error(`la table sans assez de reliques : ${empty}`)
    await page.screenshot({ path: `${OUT}/02c-table-vide.png` })
    await page.keyboard.press('Escape')
    await page.getByTestId('table-reliques').waitFor({ state: 'detached', timeout: 5000 * SLOW })
  })

  await step('un lieu de quête : on entre par le seuil, on monte à l’étage 2 au clavier, on sort', async () => {
    // Devant la porte de la Tour des Fractions (le premier lieu de maths de la 6e), face à elle.
    const door = await page.evaluate(() => {
      const w = window.__aldoria.world
      const it = w.interactables.find((i) => i.id === 'tour_fractions')
      w.teleport(it.x, it.z - 1.5, it.x, it.z)
      return { x: it.x, z: it.z }
    })
    // L'invite du lieu, pas celle que la téléportation n'a pas encore effacée (la table, juste avant).
    await page.getByTestId('invite').filter({ hasText: 'Tour des Fractions' }).waitFor({ timeout: 10_000 * SLOW })
    await page.keyboard.press('KeyE')
    await page.getByRole('dialog').waitFor()
    await page.getByRole('button', { name: "J'y vais" }).click()
    await page.getByTestId('etage').waitFor({ timeout: 60_000 * SLOW })
    if ((await page.getByTestId('etage').innerText()).replace(/\s+/g, ' ').toLowerCase() !== 'étage 1 / 6') throw new Error('départ à l’étage 1 attendu')
    if ((await page.getByTestId('carte').count()) !== 0) throw new Error('la mini-carte devrait être cachée dans un lieu')
    await page.screenshot({ path: `${OUT}/03a-interieur.png` })
    // Orientation des modèles (piège : un mur est symétrique et ne dit rien) : chaque escalier tient entre 12 et 16 m de sa salle,
    // chaque battant de porte ouvert dans sa salle (x ≥ 16·i), jamais sur l'escalier qui y mène (un battant fermé occupe l'embrasure).
    const bad = await page.evaluate(() => {
      const boxes = (suffix) =>
        window.__aldoria.world.interior.scene.meshes
          .filter((m) => m.name.endsWith(suffix))
          .map((m) => ({ room: Number(m.name.split('-')[1]), box: m.getBoundingInfo().boundingBox }))
      const out = []
      for (const { room, box } of boxes('-stairs')) {
        if (box.minimumWorld.x < 16 * room + 11.9 || box.maximumWorld.x > 16 * room + 16.1) out.push(`escalier ${room} : x ${box.minimumWorld.x.toFixed(1)} à ${box.maximumWorld.x.toFixed(1)}`)
      }
      for (const { room, box } of boxes('wall_doorway_door')) {
        const open = room === 0 || window.__aldoria.world.interior.dungeon.isDoorOpen(room - 1)
        if (open && box.minimumWorld.x < 16 * room - 0.3) out.push(`porte ${room} : battant ouvert à x ${box.minimumWorld.x.toFixed(1)}`)
      }
      return out
    })
    if (bad.length > 0) throw new Error(`modèles mal orientés : ${bad.join(' ; ')}`)
    // Vers l'est (D) : la porte, puis l'escalier, jusqu'à la deuxième salle (4 m plus haut).
    await page.getByTestId('monde').click({ position: { x: 640, y: 120 } })
    await page.keyboard.down('KeyD')
    await page.waitForFunction(() => document.querySelector('[data-testid=etage]')?.textContent?.includes('2 / 6'), null, { timeout: 30_000 * SLOW })
    await page.keyboard.up('KeyD')
    const up = await page.evaluate(() => window.__aldoria.world.interior.heroPosition())
    if (up.y < 3.5) throw new Error(`le héros n'est pas monté (${up.y.toFixed(1)} m)`)
    await page.screenshot({ path: `${OUT}/03b-etage2.png` })
    // La sortie : la porte du mur ouest de la première salle.
    await page.evaluate(() => window.__aldoria.world.interior.teleport(1.9, -10))
    await page.getByTestId('invite').waitFor({ timeout: 10_000 * SLOW })
    await page.keyboard.press('KeyE')
    await page.getByRole('button', { name: 'Sortir' }).click()
    await page.getByTestId('carte').waitFor({ timeout: 10_000 * SLOW })
    const after = await page.evaluate(() => ({ inside: window.__aldoria.world.interior, pos: window.__aldoria.world.heroPosition() }))
    if (after.inside !== null) throw new Error('l’intérieur devrait être fermé')
    if (Math.hypot(after.pos.x - door.x, after.pos.z - door.z) > 4) throw new Error('le héros devrait être revenu devant la porte du lieu')
    // L'île répond de nouveau aux touches.
    const before = await page.evaluate(() => window.__aldoria.world.heroPosition())
    await page.keyboard.down('KeyS')
    await page.waitForTimeout(700 * SLOW)
    await page.keyboard.up('KeyS')
    const moved = await page.evaluate(() => window.__aldoria.world.heroPosition())
    if (Math.hypot(moved.x - before.x, moved.z - before.z) < 0.5) throw new Error('le héros de l’île ne bouge plus après la sortie')
  })

  await step('un combat : repli sans perte, victoire, la porte s’ouvre, on monte à l’étage suivant', async () => {
    await page.evaluate(() => {
      const w = window.__aldoria.world
      const it = w.interactables.find((i) => i.id === 'tour_fractions')
      w.teleport(it.x, it.z - 1.5, it.x, it.z)
    })
    await page.getByTestId('invite').waitFor({ timeout: 10_000 * SLOW })
    await page.keyboard.press('KeyE')
    await page.getByRole('button', { name: "J'y vais" }).click()
    await page.getByTestId('etage').waitFor({ timeout: 60_000 * SLOW })
    const interior = () => page.evaluate(() => {
      const i = window.__aldoria.world.interior
      const foe = i.enemies.find((e) => e.room === 1)
      return { door1: i.dungeon.isDoorOpen(1), foeHp: foe.combatant.hp, foeMax: foe.combatant.maxHp, heroHp: window.__aldoria.encounter.hero.hp, heroMax: window.__aldoria.encounter.hero.maxHp, x: i.heroPosition().x }
    })
    if ((await interior()).door1) throw new Error('la porte de la salle 1 devrait être fermée tant que l’ennemi vit')
    // On approche l'ennemi de la salle 1 : le combat s'engage tout seul.
    await page.evaluate(() => window.__aldoria.world.interior.teleport(19, -10))
    await page.getByTestId('monde').click({ position: { x: 640, y: 120 } })
    await page.keyboard.down('KeyD')
    await page.getByTestId('actions').waitFor({ timeout: 20_000 * SLOW })
    await page.keyboard.up('KeyD')
    await page.screenshot({ path: `${OUT}/03c-combat.png` })
    const turn = async (key, correct, useAids = false) => {
      await page.getByTestId('actions').waitFor({ timeout: 30_000 * SLOW })
      await page.keyboard.press(key)
      await answerQuestion(correct, useAids)
      await page.waitForFunction(() => !document.querySelector('[data-testid=pv-ennemi]') || document.querySelector('[data-testid=actions]') || document.querySelector('[role=dialog]'), null, { timeout: 30_000 * SLOW })
    }
    // Le sac (touche 4) : sans question et sans perdre son tour. Un bouclier levé, une potion bue, puis les objets d'une question.
    await page.evaluate(() => {
      const w = window.__aldoria
      w.give('potion', 1)
      w.give('bouclier', 1)
      w.give('parchemin', 1)
      w.give('plume', 1)
      w.encounter.hero.hp = 40
    })
    await page.getByTestId('actions').waitFor({ timeout: 30_000 * SLOW })
    const asked = await page.evaluate(() => window.__aldoria.encounter.questions)
    if (!/2 objets|3 objets|4 objets/.test(await page.getByTestId('action-sac').innerText())) throw new Error(`le sac devrait annoncer ses objets : ${await page.getByTestId('action-sac').innerText()}`)
    await page.keyboard.press('4')
    await page.getByTestId('sac').waitFor({ timeout: 5000 * SLOW })
    await page.screenshot({ path: `${OUT}/03c2-sac.png` })
    await page.getByTestId('sac-bouclier').click()
    await page.getByTestId('bouclier').waitFor({ timeout: 10_000 * SLOW })
    await page.getByTestId('actions').waitFor({ timeout: 10_000 * SLOW })
    if (!(await page.evaluate(() => window.__aldoria.encounter.shieldUp))) throw new Error('le bouclier devrait être levé')
    // Il est déjà levé : le sac le refuse. La potion, elle, rend toute la vie.
    await page.keyboard.press('4')
    await page.getByTestId('sac').waitFor({ timeout: 5000 * SLOW })
    if (!(await page.getByTestId('sac-bouclier').isDisabled())) throw new Error('un bouclier déjà levé ne doit pas se redépenser')
    await page.getByTestId('sac-potion').click()
    await page.getByTestId('actions').waitFor({ timeout: 10_000 * SLOW })
    const drunk = await page.evaluate(() => ({ hp: window.__aldoria.encounter.hero.hp, max: window.__aldoria.encounter.hero.maxHp, questions: window.__aldoria.encounter.questions }))
    if (drunk.hp !== drunk.max) throw new Error(`la potion devrait rendre toute la vie : ${drunk.hp}/${drunk.max}`)
    if (drunk.questions !== asked) throw new Error('le sac ne doit pas poser de question ni faire perdre le tour')
    // Plus rien d'utilisable : tout est grisé, Échap revient aux actions.
    await page.keyboard.press('4')
    await page.getByTestId('sac').waitFor({ timeout: 5000 * SLOW })
    if (!(await page.getByTestId('sac-potion').isDisabled())) throw new Error('la potion dépensée ne doit plus être utilisable')
    await page.screenshot({ path: `${OUT}/03c4-sac-vide.png` })
    if (!(await page.getByTestId('sac-questions').innerText()).includes('Plume ×1')) throw new Error('le sac devrait rappeler la plume et le parchemin gardés pour les questions')
    await page.keyboard.press('Escape')
    await page.getByTestId('sac').waitFor({ state: 'detached', timeout: 5000 * SLOW })
    await page.getByTestId('actions').waitFor({ timeout: 10_000 * SLOW })
    // Un coup porté (avec les objets de la question, si elle les propose) : l'ennemi riposte, le bouclier encaisse.
    // Puis le héros n'a plus qu'un point de vie : une erreur le replie, l'ennemi garde ses blessures.
    await turn('1', true, true)
    const hurt = await interior()
    if (hurt.heroHp !== hurt.heroMax) throw new Error(`le bouclier aurait dû parer la riposte : ${hurt.heroHp}/${hurt.heroMax}`)
    if (await page.getByTestId('bouclier').count()) throw new Error('le bouclier doit retomber après le coup paré')
    if (hurt.foeHp >= hurt.foeMax) throw new Error('le coup n’a pas blessé l’ennemi')
    await page.evaluate(() => { window.__aldoria.encounter.hero.hp = 1 })
    await page.getByTestId('actions').waitFor({ timeout: 30_000 * SLOW })
    await page.keyboard.press('2')
    await answerQuestion(false)
    await page.getByRole('button', { name: "Reprendre l'exploration" }).click({ timeout: 30_000 * SLOW })
    await page.waitForFunction(() => !window.__aldoria.world.interior.fighting, null, { timeout: 15_000 * SLOW })
    const retreat = await interior()
    if (retreat.heroHp !== retreat.heroMax) throw new Error(`après le repli, le héros devrait avoir toute sa vie (${retreat.heroHp}/${retreat.heroMax})`)
    if (retreat.foeHp !== hurt.foeHp) throw new Error(`l'ennemi devrait garder ses blessures (${retreat.foeHp} au lieu de ${hurt.foeHp})`)
    if (retreat.x > 16 + 4) throw new Error('le héros devrait être revenu à l’entrée de la salle')
    // On y retourne et on gagne.
    await page.keyboard.down('KeyD')
    await page.getByTestId('actions').waitFor({ timeout: 20_000 * SLOW })
    await page.keyboard.up('KeyD')
    for (let k = 0; k < 12 && (await page.getByTestId('pv-ennemi').count()) > 0; k += 1) await turn(k % 2 ? '1' : '2', true)
    if ((await page.getByTestId('pv-ennemi').count()) > 0) throw new Error('l’ennemi ne tombe pas')
    await page.waitForFunction(() => window.__aldoria.world.interior.dungeon.isDoorOpen(1), null, { timeout: 15_000 * SLOW })
    const won = await page.locator('.badge').innerText()
    if (/ 0 XP/.test(won)) throw new Error(`la victoire devrait rapporter de l'XP : ${won}`)
    await page.screenshot({ path: `${OUT}/03d-victoire.png` })
    // La porte est ouverte : on se place sur la ligne de l'escalier (le héros est resté là où il a combattu), puis cap à l'est.
    await page.evaluate(() => {
      const i = window.__aldoria.world.interior
      i.teleport(i.heroPosition().x, -10)
    })
    await page.keyboard.down('KeyD')
    await page.waitForFunction(() => document.querySelector('[data-testid=etage]')?.textContent?.includes('3 / 6'), null, { timeout: 30_000 * SLOW })
    await page.keyboard.up('KeyD')
    // Retour sur l'île, pour la suite du parcours.
    await page.evaluate(() => window.__aldoria.world.interior.teleport(1.9, -10))
    await page.getByTestId('invite').waitFor({ timeout: 10_000 * SLOW })
    await page.keyboard.press('KeyE')
    await page.getByRole('button', { name: 'Sortir' }).click()
    await page.getByTestId('carte').waitFor({ timeout: 10_000 * SLOW })
  })

  await step('l’énigme : trois piédestaux, une erreur qui réarme, la porte s’ouvre au troisième cristal, le héros parle', async () => {
    await page.evaluate(() => {
      const w = window.__aldoria.world
      const it = w.interactables.find((i) => i.id === 'tour_fractions')
      w.teleport(it.x, it.z - 1.5, it.x, it.z)
    })
    await page.getByTestId('invite').filter({ hasText: 'Approcher' }).waitFor({ timeout: 10_000 * SLOW })
    await page.keyboard.press('KeyE')
    await page.getByRole('button', { name: "J'y vais" }).click()
    await page.getByTestId('etage').waitFor({ timeout: 60_000 * SLOW })
    // Le héros se lance : sa phrase de départ s'affiche en bulle (le texte vient de heros.json, entre guillemets).
    await page.getByTestId('heros-dit').waitFor({ timeout: 10_000 * SLOW })
    const hello = await page.getByTestId('heros-dit').innerText()
    if (!/^«.+»$/s.test(hello.trim())) throw new Error(`la bulle du héros : ${hello}`)
    // Les salles d'avant ont leur propre test : on ouvre leurs portes et on va dans la salle de l'énigme (la quatrième).
    const ped = () => page.evaluate(() => window.__aldoria.world.interior.pedestals.map((p) => ({ x: p.x, z: p.z, solved: p.solved })))
    await page.evaluate(() => {
      const i = window.__aldoria.world.interior
      for (let d = 0; d < 3; d += 1) i.openDoor(d, false)
      const e = i.dungeon.entryPoint(3)
      i.teleport(e.x, e.z)
    })
    await page.getByRole('heading', { name: 'Les Balances du Gardien' }).waitFor({ timeout: 10_000 * SLOW })
    await page.screenshot({ path: `${OUT}/03e0-enigme-intro.png` })
    await page.getByRole('button', { name: "C'est parti" }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    const start = await ped()
    if (start.length !== 3 || start.some((p) => p.solved)) throw new Error(`trois piédestaux endormis attendus : ${JSON.stringify(start)}`)
    if (await page.evaluate(() => window.__aldoria.world.interior.dungeon.isDoorOpen(3))) throw new Error('la porte de l’énigme devrait être fermée tant que les cristaux dorment')
    const xp = async () => Number(((await page.locator('.badge').innerText()).match(/(\d+) XP/) ?? [])[1] ?? 0)
    const xpBefore = await xp()
    /** Le héros se place à portée du piédestal `k` (à sa gauche) : sa question s'ouvre toute seule. */
    const approach = (k) => page.evaluate((k) => {
      const i = window.__aldoria.world.interior
      const p = i.pedestals[k]
      i.teleport(p.x - 1.3, p.z)
    }, k)

    // Premier piédestal : une erreur. Pas de « Pas vu en classe » sur une énigme ; le piédestal repose tant que le héros reste là.
    await approach(0)
    await page.getByRole('dialog').waitFor({ timeout: 10_000 * SLOW })
    if ((await page.getByRole('button', { name: 'Pas vu en classe' }).count()) > 0) throw new Error('« Pas vu en classe » ne doit pas être proposé sur une énigme')
    await page.screenshot({ path: `${OUT}/03e1-enigme-question.png` })
    await answerQuestion(false)
    await page.waitForTimeout(800 * SLOW)
    if ((await page.getByRole('dialog').count()) > 0) throw new Error('le piédestal ne doit pas reposer sa question tant que le héros reste devant')
    if ((await ped())[0].solved) throw new Error('une erreur ne doit pas éveiller le cristal')
    // Le héros s'éloigne, puis revient : le piédestal pose une autre question.
    await page.evaluate(() => {
      const i = window.__aldoria.world.interior
      i.teleport(i.pedestals[0].x - 1.3, i.pedestals[0].z - 4) // plus loin que PEDESTAL_REARM, dans la même salle
    })
    await page.waitForTimeout(300 * SLOW)
    await approach(0)
    await page.getByRole('dialog').waitFor({ timeout: 10_000 * SLOW })
    await answerQuestion(true)
    await page.waitForFunction(() => window.__aldoria.world.interior.pedestals[0].solved, null, { timeout: 10_000 * SLOW })
    await page.screenshot({ path: `${OUT}/03e1b-un-cristal.png` })
    if (await page.evaluate(() => window.__aldoria.world.interior.dungeon.isDoorOpen(3))) throw new Error('un seul cristal ne doit pas ouvrir la porte')
    for (const k of [1, 2]) {
      await approach(k)
      await page.getByRole('dialog').waitFor({ timeout: 10_000 * SLOW })
      await answerQuestion(true)
      await page.waitForFunction((k) => window.__aldoria.world.interior.pedestals[k].solved, k, { timeout: 10_000 * SLOW })
    }
    // Le troisième cristal ouvre la porte, et le héros dit un mot sur la salle suivante.
    await page.waitForFunction(() => window.__aldoria.world.interior.dungeon.isDoorOpen(3), null, { timeout: 15_000 * SLOW })
    await page.screenshot({ path: `${OUT}/03e1c-porte-ouverte.png` })
    await page.getByTestId('heros-dit').waitFor({ timeout: 10_000 * SLOW })
    const gained = (await xp()) - xpBefore
    if (gained < 3 * 10) throw new Error(`les trois bonnes réponses devraient rapporter de l’XP : +${gained}`)
    // La sortie, pour la suite du parcours.
    await page.evaluate(() => window.__aldoria.world.interior.teleport(1.9, -10))
    await page.getByTestId('invite').filter({ hasText: 'Sortir' }).waitFor({ timeout: 10_000 * SLOW })
    await page.keyboard.press('KeyE')
    await page.getByRole('button', { name: 'Sortir' }).click()
    await page.getByTestId('carte').waitFor({ timeout: 10_000 * SLOW })
  })

  await step('le boss : l’Effaceur parle de sa voix enregistrée, huit sceaux, le coffre, la page rendue, le lieu suivant s’ouvre, Maître Ysaline salue', async () => {
    // Les demandes de son vues depuis le début de l'étape : si une attente expire, le message dit lesquelles sont parties (aucune : le jeu n'a
    // rien demandé ; une demande sans réponse : le réseau ou le serveur) et quel dialogue était ouvert.
    const voixVues = []
    page.on('request', (r) => { if (r.url().includes('/voix/')) voixVues.push(`${r.method()} ${r.url().split('/voix/')[1]}`) })
    page.on('requestfailed', (r) => { if (r.url().includes('/voix/')) voixVues.push(`ÉCHEC ${r.url().split('/voix/')[1]} : ${r.failure()?.errorText}`) })
    // Le son enregistré a-t-il été joué ? Le journal de la voix du jeu le dit : « son <fichier> » (demandé) puis « joue » (le navigateur l'a décodé et
    // lancé). On n'exige pas une réponse réseau : à la seconde visite, Chromium rejoue un son déjà reçu sans nouvelle demande (c'est ce qui faisait
    // échouer ce pas en production, avec le journal montrant le son de défaite joué jusqu'au bout) ; un fichier absent, mal typé ou illisible n'arrive
    // jamais à « joue » (« erreur du fichier »), et une réponse 4xx est déjà relevée par ailleurs.
    const heard = async (url) => {
      const file = url.split('/voix/')[1]
      const from = await page.evaluate(() => window.__aldoria.services.voice.notedCount)
      await page.waitForFunction(
        ([name, start]) => {
          const voice = window.__aldoria.services.voice
          const fresh = voice.trace.slice(Math.max(0, voice.trace.length - (voice.notedCount - start)))
          const at = fresh.findIndex((line) => line.includes(`son ${name}`))
          return at >= 0 && fresh.slice(at).some((line) => line.endsWith('joue'))
        },
        [file, from],
        { timeout: 15_000 * SLOW },
      )
    }
    const soundOk = async (pending, what) => {
      await pending.catch(async (error) => {
        const dialog = await page.getByRole('dialog').first().innerText({ timeout: 2000 }).catch(() => '(aucun dialogue ouvert)')
        const trace = await page.evaluate(() => window.__aldoria?.services?.voice?.trace?.slice(-14).join(' ; ') ?? '(pas de journal)').catch(() => '(page injoignable)')
        throw new Error(`${what} : ${error.message.split('\n')[0]} ; demandes de son vues : ${voixVues.slice(-6).join(' | ') || 'aucune'} ; dialogue : ${dialog.replace(/\s+/g, ' ').slice(0, 140)} ; journal de la voix : ${trace}`)
      })
    }
    const xp = async () => Number(((await page.locator('.badge').innerText()).match(/(\d+) XP/) ?? [])[1] ?? 0)
    /** Entre dans la Tour des Fractions, bat l'Effaceur, ouvre le coffre. `first` : première fois (page rendue, salut de Maître Ysaline). */
    const run = async (first) => {
      await page.evaluate(() => {
        const w = window.__aldoria.world
        const it = w.interactables.find((i) => i.id === 'tour_fractions')
        w.teleport(it.x, it.z - 1.5, it.x, it.z)
      })
      await page.getByTestId('invite').filter({ hasText: 'Approcher' }).waitFor({ timeout: 10_000 * SLOW })
      await page.keyboard.press('KeyE')
      await page.getByRole('button', { name: "J'y vais" }).click()
      await page.getByTestId('etage').waitFor({ timeout: 60_000 * SLOW })
      // Les salles d'avant ont leur propre test : on ouvre les portes et on va droit à la salle de l'Effaceur.
      const boss = await page.evaluate(() => {
        const i = window.__aldoria.world.interior
        for (let d = 0; d < 5; d += 1) i.openDoor(d, false)
        const b = i.enemies.find((e) => e.boss)
        i.teleport(b.x - 6, b.z)
        return { x: b.x, z: b.z, name: b.spec.name, max: b.combatant.maxHp }
      })
      if (boss.name !== 'Le Grand Diviseur') throw new Error(`l’Effaceur de la Tour : ${boss.name}`)
      const xpBefore = await xp()
      await page.getByTestId('monde').click({ position: { x: 640, y: 120 } })
      await page.keyboard.down('KeyD')
      // L'Effaceur se présente (une fois) : titre à son nom, son texte, sa voix enregistrée au bouton « Écouter ».
      await page.getByRole('heading', { name: boss.name }).waitFor({ timeout: 30_000 * SLOW })
      await page.keyboard.up('KeyD')
      const heardIntro = heard('/voix/boss-intro-tour_fractions-')
      await page.getByRole('button', { name: /Écouter/ }).click()
      await soundOk(heardIntro, 'voix de l’entrée de l’Effaceur')
      await page.screenshot({ path: `${OUT}/03e-boss.png` })
      await page.getByRole('button', { name: 'En garde !' }).click()
      await page.getByTestId('actions').waitFor({ timeout: 30_000 * SLOW })
      const seals = Number(await page.getByTestId('sceaux').getAttribute('data-left'))
      if (seals !== 8) throw new Error(`les sceaux de l’Effaceur : ${seals} au lieu de 8`)
      await page.screenshot({ path: `${OUT}/03e2-sceaux.png` })
      // Pour aller vite : il ne lui reste qu'un sceau (20 PV sur 200, 25 PV par sceau) ; le prochain tour le met à terre.
      await page.evaluate(() => { window.__aldoria.encounter.foe.hp = 20 })
      await page.keyboard.press('2')
      await answerQuestion(true)
      // Il a le dernier mot, de sa voix, puis le coffre apparaît.
      await page.getByRole('heading', { name: boss.name }).waitFor({ timeout: 30_000 * SLOW })
      const heardDefeat = heard('/voix/boss-defeat-tour_fractions-')
      await page.getByRole('button', { name: /Écouter/ }).click()
      await soundOk(heardDefeat, 'voix de la défaite de l’Effaceur')
      await page.getByRole('button', { name: 'Reprendre la page' }).click()
      await page.waitForFunction(() => window.__aldoria.world.interior.chestReady, null, { timeout: 15_000 * SLOW })
      await page.screenshot({ path: `${OUT}/03f-coffre.png` })
      // Le héros va au coffre (E l'ouvre) : le lieu est terminé.
      await page.evaluate(() => {
        const i = window.__aldoria.world.interior
        const c = i.dungeon.chestPoint(5)
        i.teleport(c.x - 1.6, c.z)
      })
      await page.getByTestId('invite').filter({ hasText: 'Ouvrir le coffre' }).waitFor({ timeout: 10_000 * SLOW })
      await page.keyboard.press('KeyE')
      await page.getByRole('heading', { name: first ? 'La page des Fractions retrouvée !' : 'La Tour des Fractions : terminé !' }).waitFor({ timeout: 15_000 * SLOW })
      const message = await page.getByRole('dialog').innerText()
      for (const attendu of first ? ['les parts se remettent en ordre', '+100 XP dans le coffre'] : ['La Tour des Fractions brille à nouveau', '+100 XP dans le coffre']) {
        if (!message.includes(attendu)) throw new Error(`message du coffre sans « ${attendu} » : ${message}`)
      }
      if (!/Dans ton sac : /.test(message)) throw new Error(`le coffre devrait rendre deux objets : ${message}`)
      // Une relique (core/relics.ts) : la première fois seulement, la première des reliques de coffre.
      if (first !== message.includes('Relique trouvée : Sceau de Flamme II !')) throw new Error(`la relique du coffre : première fois = ${first} : ${message}`)
      await page.screenshot({ path: `${OUT}/03g-page.png` })
      await page.getByRole('button', { name: 'Continuer' }).click()
      // La note de plaisir, facultative : la première fois on donne quatre étoiles, la seconde on passe.
      await page.getByTestId('note').waitFor({ timeout: 10_000 * SLOW })
      if (first) {
        await page.getByTestId('etoile-4').click()
        const word = await page.getByTestId('note-mot').innerText()
        if (word !== 'Très bien') throw new Error(`le mot de la note : ${word}`)
        await page.screenshot({ path: `${OUT}/03g2-note.png` })
      } else {
        await page.getByRole('button', { name: 'Passer' }).click()
      }
      await page.getByTestId('carte').waitFor({ timeout: 15_000 * SLOW })
      const gained = (await xp()) - xpBefore
      if (gained < 100 + 150) throw new Error(`XP du boss et du coffre : +${gained} au lieu de 250 au moins`)
      return message
    }

    await run(true)
    // Première fois : Maître Ysaline salue le héros de sa voix enregistrée et annonce le chemin qui s'ouvre sur l'île.
    await page.getByRole('heading', { name: 'Maître Ysaline' }).waitFor({ timeout: 10_000 * SLOW })
    const greeting = await page.getByRole('dialog').innerText()
    if (!greeting.includes('Tu as rapporté la page des Fractions') || !greeting.includes("sur l'île")) throw new Error(`salut de Maître Ysaline : ${greeting}`)
    const heardPage = heard('/voix/page-tour_fractions-')
    await page.getByRole('button', { name: /Écouter/ }).click()
    await soundOk(heardPage, 'voix du salut de Maître Ysaline')
    await page.screenshot({ path: `${OUT}/03h-salut.png` })
    await page.getByRole('button', { name: 'Merci !' }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    // L'île a suivi : le lieu suivant de la région s'ouvre, sa balise et la mini-carte aussi.
    const state = await page.evaluate(() => {
      const it = window.__aldoria.world.interactables
      return { tour: it.find((i) => i.id === 'tour_fractions').open, atelier: it.find((i) => i.id === 'atelier_balances').open }
    })
    if (!state.tour || !state.atelier) throw new Error(`après la page rendue, les deux lieux devraient être ouverts : ${JSON.stringify(state)}`)
    await page.locator('[data-id="tour_fractions"].mark-termine').waitFor({ state: 'attached', timeout: 5000 * SLOW })
    await page.locator('[data-id="atelier_balances"].mark-ouvert').waitFor({ state: 'attached', timeout: 5000 * SLOW })

    // Une seconde fois : le mot de la fin, l'XP du coffre, et plus de salut (la page n'est rendue qu'une fois).
    await run(false)
    await page.waitForTimeout(1500 * SLOW)
    if ((await page.getByRole('heading', { name: 'Maître Ysaline' }).count()) > 0) throw new Error('Maître Ysaline ne devrait pas saluer une seconde fois')
  })

  let xpBefore = 0
  const xpOf = async () => Number(((await page.locator('.badge').innerText()).match(/(\d+) XP/) ?? [])[1] ?? 0)
  await step('la Table des Reliques : un conflit signalé, un indice contre un parchemin, le carré résolu, la récompense du jour une seule fois', async () => {
    // Des reliques de plus (la table en demande au moins deux ; celle du coffre est déjà dans la partie), un parchemin pour l'indice.
    await page.evaluate(() => {
      window.__aldoria.giveRelics(['onde-1', 'feuille-1', 'etoile-1', 'flamme-3', 'onde-3'])
      window.__aldoria.give('parchemin', 2)
      const w = window.__aldoria.world
      const table = w.interactables.find((i) => i.id === 'table-reliques')
      w.teleport(table.x + 2.6, table.z, table.x, table.z)
    })
    const ring = await page.evaluate(() => window.__aldoria.world.interactables.find((i) => i.id === 'table-reliques').open)
    if (!ring) throw new Error('avec des reliques et la récompense du jour à prendre, l’anneau de la table devrait briller')
    await page.getByTestId('invite').filter({ hasText: 'Ouvrir la Table des Reliques' }).waitFor({ timeout: 10_000 * SLOW })
    await page.keyboard.press('KeyE')
    await page.getByTestId('table-reliques').waitFor({ timeout: 10_000 * SLOW })
    const puzzle = await page.evaluate(() => window.__aldoria.table)
    const holes = puzzle.fixed.flatMap((id, cell) => (id === null ? [cell] : []))
    if (holes.length !== puzzle.pool.length || holes.length < 6) throw new Error(`les cases à remplir : ${holes.length} pour ${puzzle.pool.length} reliques`)
    const engraved = await page.locator('[data-state="grave"]').count()
    if (engraved !== 16 - holes.length) throw new Error(`cases gravées : ${engraved}`)
    await page.screenshot({ path: `${OUT}/04a-table.png` })

    // Une relique qui croise une autre de sa rangée ou de sa colonne (même élément, même rang) : la case porte un « ! », la table le dit.
    const share = (a, b) => a.split('-')[0] === b.split('-')[0] || a.split('-')[1] === b.split('-')[1]
    const clash = holes.flatMap((h) => puzzle.pool.map((r) => ({ h, r }))).find(({ h, r }) =>
      puzzle.fixed.some((other, c) => other !== null && c !== h && (Math.floor(c / 4) === Math.floor(h / 4) || c % 4 === h % 4) && share(other, r)),
    )
    if (!clash) throw new Error('aucun conflit possible sur cette table : impossible')
    await page.getByTestId(`relique-${clash.r}`).click()
    await page.getByTestId(`case-${clash.h}`).click()
    if ((await page.getByTestId(`case-${clash.h}`).getAttribute('data-clash')) !== 'oui') throw new Error('la case en conflit devrait être signalée')
    const said = await page.getByTestId('table-message').innerText()
    if (!said.includes('croise') || !said.includes('en conflit')) throw new Error(`le message du conflit : ${said}`)
    if (!(await page.getByTestId(`case-${clash.h}`).getAttribute('aria-label')).includes('croise')) throw new Error('le lecteur d’écran devrait entendre le conflit')
    await page.screenshot({ path: `${OUT}/04b-table-conflit.png` })
    await page.getByTestId(`case-${clash.h}`).click() // reprise : la relique revient en bas
    if ((await page.getByTestId(`case-${clash.h}`).getAttribute('data-state')) !== 'libre') throw new Error('toucher une relique posée devrait la reprendre')
    await page.getByTestId(`relique-${clash.r}`).click() // reprise, elle reste choisie : un clic la lâche

    // Un indice : un parchemin de moins, la bonne relique à la bonne case.
    const before = await page.evaluate(() => window.__aldoria.save().items.parchemin ?? 0)
    await page.getByTestId('table-indice').click()
    const after = await page.evaluate(() => window.__aldoria.save().items.parchemin ?? 0)
    if (after !== before - 1) throw new Error(`l’indice devrait coûter un parchemin : ${before} -> ${after}`)
    if ((await page.locator('[data-state="posee"]').count()) !== 1) throw new Error('l’indice devrait poser une relique')

    // On range le reste ; la table résolue rapporte l'XP du jour, une seule fois.
    const place = async (puzzle) => {
      for (const h of puzzle.fixed.flatMap((id, cell) => (id === null ? [cell] : []))) {
        if ((await page.getByTestId(`case-${h}`).getAttribute('data-state')) === 'posee') continue
        await page.getByTestId(`relique-${puzzle.solution[h]}`).click()
        await page.getByTestId(`case-${h}`).click()
      }
    }
    const xpBefore = await page.evaluate(() => window.__aldoria.save().xp)
    await place(puzzle)
    await page.getByTestId('table-resolue').waitFor({ timeout: 10_000 * SLOW })
    const done = await page.getByTestId('table-resolue').innerText()
    if (!done.includes('Table résolue !') || !done.includes(`+${holes.length * 8} XP`)) throw new Error(`le bilan de la table : ${done}`)
    const saved = await page.evaluate(() => window.__aldoria.save())
    if (saved.xp !== xpBefore + holes.length * 8) throw new Error(`l’XP de la table : ${xpBefore} -> ${saved.xp}`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(saved.table)) throw new Error(`le jour de la récompense : ${saved.table}`)
    if (await page.evaluate(() => window.__aldoria.world.interactables.find((i) => i.id === 'table-reliques').open)) throw new Error('l’anneau devrait s’éteindre une fois la récompense prise')
    await page.screenshot({ path: `${OUT}/04c-table-resolue.png` })

    // Une autre table : de l'entraînement (rien de plus aujourd'hui), jouée au clavier : 1 choisit la relique, Entrée la pose.
    await page.getByTestId('table-autre').click()
    await page.getByTestId('table-reliques').getByText('entraînement').first().waitFor({ timeout: 5000 * SLOW })
    const next = await page.evaluate(() => window.__aldoria.table)
    const [first] = next.fixed.flatMap((id, cell) => (id === null ? [cell] : []))
    await page.keyboard.press('Digit1')
    if ((await page.getByTestId(`relique-${next.pool[0]}`).getAttribute('aria-pressed')) !== 'true') throw new Error('la touche 1 devrait choisir la première relique')
    await page.getByTestId(`case-${first}`).focus()
    await page.keyboard.press('Enter')
    if ((await page.getByTestId(`case-${first}`).getAttribute('data-state')) !== 'posee') throw new Error('Entrée devrait poser la relique choisie')
    await page.keyboard.press('Enter') // reprise de cette même relique
    await page.getByTestId(`relique-${next.pool[0]}`).click() // on la lâche
    await place(next)
    await page.getByTestId('table-resolue').waitFor({ timeout: 10_000 * SLOW })
    const practice = await page.getByTestId('table-resolue').innerText()
    if (!practice.includes('Bien joué !') || practice.includes('+')) throw new Error(`l’entraînement ne rapporte rien : ${practice}`)
    if ((await page.evaluate(() => window.__aldoria.save().xp)) !== saved.xp) throw new Error('l’XP ne devrait pas bouger sur la table d’entraînement')
    await page.keyboard.press('Escape')
    await page.getByTestId('table-reliques').waitFor({ state: 'detached', timeout: 5000 * SLOW })
  })

  await step('l’île du Sphinx : sans passage la barque ne part pas, puis trois énigmes (annuler, recommencer, aide, une dalle cliquée), le bilan, et une visite quittée à Échap', async () => {
    const save = () => page.evaluate(() => window.__aldoria.save())
    const toBoat = () =>
      page.evaluate(() => {
        const w = window.__aldoria.world
        const boat = w.interactables.find((i) => i.id === 'barque')
        w.teleport(boat.x - 1.8, boat.z, boat.x + 4, boat.z)
      })
    const openBoat = async () => {
      await toBoat()
      await page.getByTestId('invite').filter({ hasText: 'Monter dans la barque du Sphinx' }).waitFor({ timeout: 10_000 * SLOW })
      await page.keyboard.press('KeyE')
      await page.getByTestId('sphinx-carte').waitFor({ timeout: 10_000 * SLOW })
    }
    // Sans passage : la barque l'explique et ne part pas.
    await page.evaluate(() => window.__aldoria.giveSphinxPasses(-3))
    await openBoat()
    const none = await page.getByTestId('sphinx-carte').innerText()
    if (!none.includes("Tu n'as pas de passage") || none.includes('Traverser')) throw new Error(`la barque sans passage : ${none}`)
    await page.screenshot({ path: `${OUT}/05a-barque-sans-passage.png` })
    await page.getByRole('button', { name: 'Retour à l’île' }).click()
    await page.getByTestId('sphinx-carte').waitFor({ state: 'detached', timeout: 5000 * SLOW })

    // Avec deux passages : on traverse, le Sphinx se présente (la première fois), trois énigmes.
    await page.evaluate(() => window.__aldoria.giveSphinxPasses(2))
    await openBoat()
    if (!(await page.getByTestId('sphinx-carte').innerText()).includes('2 passages en réserve')) throw new Error('la réserve de passages devrait s’afficher')
    await page.getByRole('button', { name: 'Traverser' }).click()
    await page.getByRole('button', { name: 'Au premier bloc !' }).waitFor({ timeout: 10_000 * SLOW })
    if (!(await page.getByTestId('sphinx-carte').innerText()).includes('Je suis le Sphinx')) throw new Error('la présentation du Sphinx')
    let s = await save()
    if (s.sphinx.passes !== 1) throw new Error(`la traversée coûte un passage : ${s.sphinx.passes}`)
    await page.getByRole('button', { name: 'Au premier bloc !' }).click()
    await page.getByTestId('sphinx-enigme').waitFor({ timeout: 10_000 * SLOW })
    s = await save()
    if (!s.story.includes('sphinx-vu')) throw new Error('la présentation du Sphinx devrait être marquée vue')

    const KEY = { l: 'ArrowLeft', r: 'ArrowRight', u: 'ArrowUp', d: 'ArrowDown' }
    const play = async (letters) => {
      for (const c of letters) await page.keyboard.press(KEY[c.toLowerCase()])
    }
    const puzzle = () => page.evaluate(() => window.__aldoria.sphinx)
    const heroAt = () => page.getByTestId('sphinx-heros').evaluate((g) => [Number(g.dataset.x), Number(g.dataset.y)])
    const message = () => page.getByTestId('sphinx-message').innerText()
    const solvedCard = async () => {
      await page.getByTestId('sphinx-carte').waitFor({ timeout: 15_000 * SLOW })
      return page.getByTestId('sphinx-carte').innerText()
    }

    // Énigme 1 : un mur ne bouge pas, annuler et recommencer, l'aide du Sphinx, puis la fin.
    let p1 = await puzzle()
    if (p1.round !== 0) throw new Error(`la première énigme : rang ${p1.round}`)
    await page.screenshot({ path: `${OUT}/05b-enigme.png` })
    const start = await heroAt()
    await page.keyboard.press('Backspace') // rien à annuler : sans effet
    const first = p1.solution[0].toLowerCase()
    await play(first)
    if ((await heroAt()).join() === start.join()) throw new Error('le premier pas de la solution devrait faire avancer le héros')
    await page.keyboard.press('Backspace')
    if ((await heroAt()).join() !== start.join()) throw new Error('annuler devrait ramener le héros au départ')
    await play(first)
    await page.getByTestId('sphinx-recommencer').click()
    if ((await heroAt()).join() !== start.join()) throw new Error('recommencer devrait remettre la salle comme au départ')
    // Un pas dans le mur le plus proche : « Ça ne bouge pas ».
    for (const wall of ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']) {
      await page.keyboard.press(wall)
      if ((await message()).includes('Ça ne bouge pas')) break
      await page.getByTestId('sphinx-recommencer').click({ timeout: 800 }).catch(() => {}) // désactivé tant qu'il n'y a rien à annuler
    }
    await page.getByTestId('sphinx-recommencer').click({ timeout: 800 }).catch(() => {}) // désactivé tant qu'il n'y a rien à annuler
    await page.getByTestId('sphinx-aide').click() // le Sphinx rejoue le début de sa solution
    await page.waitForFunction(() => /À toi de continuer|Énigme résolue/.test(document.querySelector('[data-testid="sphinx-message"]')?.textContent ?? ''), null, { timeout: 30_000 * SLOW })
    await page.screenshot({ path: `${OUT}/05c-aide-du-sphinx.png` })
    // La suite de la solution depuis l'état où l'aide a laissé le plateau : on recommence et on rejoue tout (même résultat, l'aide a déjà compté).
    if (!(await page.getByTestId('sphinx-carte').count())) {
      await page.getByTestId('sphinx-recommencer').click()
      await play(p1.solution)
    }
    let card = await solvedCard()
    if (!card.includes('Résolue en') || !card.includes('Avec mon aide')) throw new Error(`l’énigme résolue avec l’aide : ${card}`)
    await page.getByRole('button', { name: 'Énigme suivante' }).click()

    // Énigme 2 : on clique sur une dalle pour y aller (sans pousser de bloc), puis on recommence et on résout seul : le Sphinx salue le minimum de poussées.
    await page.getByTestId('sphinx-enigme').waitFor({ timeout: 10_000 * SLOW })
    const p2 = await puzzle()
    if (p2.round !== 1) throw new Error(`la deuxième énigme : rang ${p2.round}`)
    const spots = p2.rows.flatMap((row, y) => [...row].flatMap((c, x) => (c === ' ' || c === '.' ? [[x, y]] : [])))
    const origin = await heroAt()
    let walked = false
    for (const [x, y] of spots.slice(0, 12)) {
      if (x === origin[0] && y === origin[1]) continue
      await page.getByTestId(`dalle-${x}-${y}`).click()
      try {
        await page.waitForFunction(([tx, ty]) => {
          const g = document.querySelector('[data-testid="sphinx-heros"]')
          return g && Number(g.dataset.x) === tx && Number(g.dataset.y) === ty
        }, [x, y], { timeout: 4000 * SLOW })
        walked = true
        break
      } catch { /* dalle hors d'atteinte sans pousser : on essaie la suivante */ }
    }
    if (!walked) throw new Error('cliquer sur une dalle libre devrait y mener le héros')
    await page.getByTestId('sphinx-recommencer').click()
    await play(p2.solution)
    card = await solvedCard()
    if (!card.includes('Le moins de poussées possible')) throw new Error(`l’énigme résolue seul : ${card}`)
    await page.screenshot({ path: `${OUT}/05d-enigme-resolue.png` })
    await page.getByRole('button', { name: 'Énigme suivante' }).click()

    // Énigme 3, la dernière : « Terminer », le bilan, le retour sur l'île.
    await page.getByTestId('sphinx-enigme').waitFor({ timeout: 10_000 * SLOW })
    const p3 = await puzzle()
    await play(p3.solution)
    await solvedCard()
    await page.getByRole('button', { name: 'Terminer' }).click()
    const bilan = await solvedCard()
    if (!bilan.includes('Énigmes résolues pendant cette traversée : 3')) throw new Error(`le bilan de la traversée : ${bilan}`)
    s = await save()
    if (s.sphinx.solved !== 3) throw new Error(`trois énigmes résolues : ${s.sphinx.solved}`)
    await page.getByRole('button', { name: 'Retour à l’île' }).click()
    await page.getByTestId('sphinx-carte').waitFor({ state: 'detached', timeout: 5000 * SLOW })

    // Une seconde visite (le dernier passage) : le Sphinx ne se présente plus ; Échap quitte l'île, le passage est dépensé.
    await openBoat()
    await page.getByRole('button', { name: 'Traverser' }).click()
    await page.getByRole('button', { name: 'J’entre' }).waitFor({ timeout: 10_000 * SLOW })
    if ((await page.getByTestId('sphinx-carte').innerText()).includes('Je suis le Sphinx')) throw new Error('le Sphinx ne se présente qu’une fois')
    await page.getByRole('button', { name: 'J’entre' }).click()
    await page.getByTestId('sphinx-enigme').waitFor({ timeout: 10_000 * SLOW })
    await page.keyboard.press('Escape')
    await page.getByTestId('sphinx-enigme').waitFor({ state: 'detached', timeout: 10_000 * SLOW })
    s = await save()
    if (s.sphinx.passes !== 0) throw new Error(`le passage de la seconde visite : ${s.sphinx.passes}`)
  })

  await step("question de la pierre d'éveil", async () => {
    xpBefore = await xpOf() // le combat d'avant a déjà rapporté de l'XP
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

  /** Répond juste à la question affichée (lue par le crochet ?e2e), sans cliquer sur « Continuer ». */
  async function answerRight() {
    await solve(page, await currentQuestion(page, 10_000 * SLOW), true)
    await page.locator('.feedback.good').waitFor({ timeout: 5000 * SLOW })
  }

  await step('bonne réponse, la pierre s’éveille', async () => {
    await answerRight()
    // Effets sonores (Web Audio, chargés au premier geste) : les dix sons sont décodés et « bonne réponse » vient de jouer.
    const sfx = await page.evaluate(() => window.__aldoria.services.sfx.state())
    if (!sfx.enabled || sfx.loaded.length !== 10 || sfx.last !== 'correct' || sfx.played < 1) throw new Error(`effets sonores : ${JSON.stringify(sfx)}`)
    await page.screenshot({ path: `${OUT}/05-juste.png` })
    await page.getByRole('button', { name: 'Continuer' }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    await page.waitForFunction(() => window.__aldoria.services.music.state().playing, null, { timeout: 8000 * SLOW })
    const gained = (await xpOf()) - xpBefore
    if (gained !== 15) throw new Error(`la pierre devait rapporter 15 XP, elle en a rapporté ${gained}`)
    // La carte montre la pierre éveillée (dorée).
    await page.locator('[data-id="pierre-eveil"].mark-eveillee').waitFor({ state: 'attached', timeout: 3000 })
    await page.waitForTimeout(800 * SLOW)
    await page.screenshot({ path: `${OUT}/06-eveillee.png` })
  })

  await step('Pierre du Jour : dix questions, bilan, puis le défi suivant n’est qu’un entraînement', async () => {
    const stone = await page.evaluate(() => {
      const i = window.__aldoria.world.interactables.find((x) => x.id === 'pierre-jour')
      return i ? { x: i.x, z: i.z } : null
    })
    if (!stone) throw new Error('la Pierre du Jour manque dans l’île')
    const xpBefore = Number((await page.locator('.badge').innerText()).match(/(\d+) XP/)?.[1])
    await page.evaluate(({ x, z }) => window.__aldoria.world.teleport(x, z - 1.5, x, z), stone)
    // L'invite de la pierre d'éveil (où l'on se trouvait) peut rester une image : on attend celle de la Pierre du Jour.
    await page.getByTestId('invite').filter({ hasText: 'défi du jour' }).waitFor({ timeout: 10_000 * SLOW })
    await page.keyboard.press('KeyE')
    await page.getByRole('heading', { name: 'Défi du jour' }).waitFor()
    await page.getByRole('button', { name: "C'est parti !" }).click()
    for (let i = 1; i <= 10; i += 1) {
      await page.getByRole('heading', { name: new RegExp(`question ${i} sur 10`) }).waitFor({ timeout: 8000 * SLOW })
      await answerRight()
      if (i === 1) await page.screenshot({ path: `${OUT}/05c-defi.png` })
      await page.getByRole('button', { name: 'Continuer' }).click()
    }
    await page.getByRole('heading', { name: 'Défi réussi !' }).waitFor({ timeout: 8000 * SLOW })
    const bilan = await page.getByTestId('defi').innerText()
    for (const attendu of ['10 bonnes réponses sur 10', "Premier défi : c'est ton record à battre !", "Série : 1 jour d'affilée.", 'Coffre de la semaine : 1 / 5 défis.']) {
      if (!bilan.includes(attendu)) throw new Error(`bilan du défi sans « ${attendu} » : ${bilan}`)
    }
    await page.screenshot({ path: `${OUT}/05d-bilan.png` })
    await page.getByRole('button', { name: "Retour à l'île" }).click()
    await page.getByTestId('defi').waitFor({ state: 'detached' })
    const xpAfter = Number((await page.locator('.badge').innerText()).match(/(\d+) XP/)?.[1])
    if (xpAfter < xpBefore + 40 + 10) throw new Error(`XP après le défi : ${xpBefore} → ${xpAfter}`)
    // La mini-carte montre la pierre relevée ; un second défi le même jour est un entraînement, sans bonus ni série de plus.
    await page.locator('[data-id="pierre-jour"].mark-faite').waitFor({ state: 'attached', timeout: 3000 })
    await page.keyboard.press('KeyE')
    await page.getByRole('heading', { name: 'Défi du jour' }).waitFor()
    const intro = await page.getByTestId('defi').innerText()
    if (!intro.includes("celui-ci est pour t'entraîner")) throw new Error(`second défi du jour : ${intro}`)
    await page.getByRole('button', { name: 'Plus tard' }).click()
    await page.getByTestId('defi').waitFor({ state: 'detached' })
  })

  await step('Archives : étoiles par notion (réponse du serveur simulée), fermeture à Échap', async () => {
    const payload = {
      chapters: [
        {
          code: '6e.fractions',
          title: 'Les fractions',
          subject: { code: 'maths', label: 'Mathématiques' },
          status: 'en_cours',
          notions: [
            { code: 'a', label: 'Lire une fraction', playable: true, stars: 3, state: 'acquise', mastery: 90, seen: 9, set_aside: null },
            { code: 'b', label: 'Comparer', playable: true, stars: 1, state: 'en cours', mastery: 30, seen: 3, set_aside: null },
          ],
        },
      ],
    }
    await page.route('**/api/v1/play/progress', (route) => route.fulfill({ json: payload }))
    // Découverte : pas de jeton. On en pose un le temps de la lecture (sinon la voix du serveur serait appelée par la suite).
    await page.evaluate(() => (window.__aldoria.services.api.token = 'e2e'))
    try {
      await page.getByTestId('bouton-archives').click()
      await page.getByTestId('archives').waitFor()
      await page.getByText('1 notion acquise ★★★ · 0 fragile · 1 en cours · 0 à découvrir').waitFor({ timeout: 5000 * SLOW })
      const stars = await page.locator('.archives-stars').allTextContents()
      if (stars.join('|') !== '★★★|★☆☆') throw new Error(`étoiles des Archives : ${stars.join('|')}`)
      await page.screenshot({ path: `${OUT}/05b-archives.png` })
      await page.keyboard.press('Escape')
      await page.getByTestId('archives').waitFor({ state: 'detached' })
    } finally {
      await page.evaluate(() => (window.__aldoria.services.api.token = ''))
      await page.unroute('**/api/v1/play/progress')
    }
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

  await step('Maître Ysaline accueille l’Archiviste de sa voix enregistrée (ElevenLabs), pas de Piper', async () => {
    const ysaline = await page.evaluate(() => {
      const i = window.__aldoria.world.interactables.find((x) => x.kind === 'ysaline')
      return i ? { x: i.x, z: i.z } : null
    })
    if (!ysaline) throw new Error('Maître Ysaline manque dans l’île')
    await page.evaluate(({ x, z }) => window.__aldoria.world.teleport(x, z - 1.5, x, z), ysaline)
    await page.getByTestId('invite').filter({ hasText: 'Maître Ysaline' }).waitFor({ timeout: 10_000 * SLOW })
    await page.keyboard.press('KeyE')
    await page.getByRole('heading', { name: 'Maître Ysaline' }).waitFor()
    const speech = []
    page.on('request', (r) => { if (r.url().includes('/play/speech')) speech.push(r.url()) })
    const sound = page.waitForResponse((r) => r.url().includes('/voix/ile-accueil-'), { timeout: 15_000 * SLOW })
    await page.getByRole('button', { name: /Écouter/ }).click()
    const res = await sound
    // 200 sur l'aperçu local, 206 en production (nginx sert le son par morceaux).
    if (![200, 206].includes(res.status()) || !(res.headers()['content-type'] ?? '').startsWith('audio/mpeg')) {
      throw new Error(`son de l’accueil : ${res.status()} ${res.headers()['content-type']} ${res.url()}`)
    }
    await page.waitForTimeout(500 * SLOW)
    if (speech.length > 0) throw new Error(`Piper appelé pour l’accueil enregistré : ${speech.join(' ')}`)
    await page.getByRole('button', { name: 'En route !' }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
  })

  await step('seuil d’un lieu : Maître Ysaline parle de sa voix enregistrée (ElevenLabs), pas de Piper', async () => {
    const lieu = await page.evaluate(() => {
      const i = window.__aldoria.world.interactables.find((x) => x.kind === 'lieu' && x.open)
      return i ? { x: i.x, z: i.z, label: i.label } : null
    })
    if (!lieu) throw new Error('aucun lieu ouvert dans l’île')
    await page.evaluate(({ x, z }) => window.__aldoria.world.teleport(x, z - 1, x, z), lieu)
    // L'invite de l'endroit précédent (ici Maître Ysaline) reste une image après la téléportation : on attend celle du lieu.
    await page.getByTestId('invite').filter({ hasText: 'Approcher' }).waitFor({ timeout: 10_000 * SLOW })
    await page.keyboard.press('KeyE')
    await page.getByRole('heading', { name: lieu.label }).waitFor()
    await page.screenshot({ path: `${OUT}/08-seuil.png` })
    const speech = []
    page.on('request', (r) => { if (r.url().includes('/play/speech')) speech.push(r.url()) })
    const sound = page.waitForResponse((r) => r.url().includes('/voix/seuil-'), { timeout: 15_000 * SLOW })
    await page.getByRole('button', { name: /Écouter/ }).click()
    const res = await sound
    // 200 sur l'aperçu local, 206 (contenu partiel) en production : nginx sert un son par morceaux quand le lecteur le demande.
    if (![200, 206].includes(res.status()) || !(res.headers()['content-type'] ?? '').startsWith('audio/mpeg')) {
      throw new Error(`son du seuil : ${res.status()} ${res.headers()['content-type']} ${res.url()}`)
    }
    await page.waitForTimeout(500 * SLOW)
    if (speech.length > 0) throw new Error(`Piper appelé pour un texte enregistré : ${speech.join(' ')}`)
    const note = await page.locator('.dialog .hint').innerText()
    if (!/étapes, une énigme/.test(note)) throw new Error(`indication des étapes absente : ${note}`)
  })

  await step('le village : un habitant confie sa quête du jour (trois questions, récompense), une quête faite ne se refait pas, la deuxième quête rapporte un passage pour le Sphinx', async () => {
    // Le seuil du lieu, resté ouvert par l'étape d'avant, recouvre l'interface : « Pas maintenant » rend la main au monde.
    await page.getByRole('button', { name: 'Pas maintenant' }).click()
    await page.locator('.dialog').waitFor({ state: 'detached', timeout: 10_000 * SLOW })
    const save = () => page.evaluate(() => window.__aldoria.save())
    const day = await page.evaluate(() => {
      const d = new Date()
      const pad = (n) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    })
    const villager = (code) => page.evaluate((c) => {
      const w = window.__aldoria.world
      const i = w.interactables.find((x) => x.id === `habitant-${c}`)
      return i ? { x: i.x, z: i.z, open: i.open, label: i.label, marker: w.villagers.get(c).marker.isEnabled() } : null
    }, code)
    // Les habitants se chargent après l'entrée dans l'île (leurs modèles pèsent plusieurs Mo) : on attend les trois de Clairval.
    await page.waitForFunction(() => window.__aldoria.world.villagers.size >= 3, null, { timeout: 60_000 * SLOW })
    const talk = async (code) => {
      const v = await villager(code)
      if (!v) throw new Error(`l'habitant ${code} manque dans le village`)
      await page.evaluate(({ x, z }) => window.__aldoria.world.teleport(x + 1.8, z, x, z), v)
      // L'invite de l'endroit précédent reste une image après la téléportation : on attend celle de l'habitant.
      await page.getByTestId('invite').filter({ hasText: `Parler à ${v.label}` }).waitFor({ timeout: 10_000 * SLOW })
      await page.keyboard.press('KeyE')
      await page.getByTestId('habitant').waitFor({ timeout: 10_000 * SLOW })
    }
    const quest = async (code, answers, expected) => {
      await talk(code)
      const ask = await page.getByTestId('habitant').innerText()
      if (!ask.includes('Plus tard') || !ask.includes('t\'aide')) throw new Error(`la demande de ${code} : ${ask}`)
      if ((await page.getByTestId('habitant-ecouter').count()) !== 1) throw new Error(`la demande de ${code} se lit à voix haute (bouton « Écouter »)`)
      if (code === 'barnabe') await page.screenshot({ path: `${OUT}/07a-habitant.png` })
      await page.getByRole('button', { name: "Je t'aide !" }).click()
      for (const [i, right] of answers.entries()) {
        await page.getByRole('heading', { name: new RegExp(`${i + 1} / 3`) }).waitFor({ timeout: 10_000 * SLOW })
        await answerQuestion(right)
      }
      await page.getByRole('button', { name: 'Avec plaisir !' }).waitFor({ timeout: 10_000 * SLOW })
      const thanks = await page.getByTestId('habitant').innerText()
      for (const line of expected) if (!thanks.includes(line)) throw new Error(`fin de la quête de ${code} sans « ${line} » : ${thanks}`)
      return thanks
    }

    // Barnabé (révision) : trois bonnes réponses, 50 XP de forfait et 30 de bonus ; la partie garde la quête du jour, le « ! » s'éteint.
    const before = await save()
    if (!(await villager('barnabe')).marker) throw new Error('le « ! » de Barnabé devrait briller avant sa quête')
    const first = await quest('barnabe', [true, true, true], ['3 bonnes réponses sur 3. +80 XP'])
    await page.screenshot({ path: `${OUT}/07b-quete-faite.png` })
    if (first.includes('passage pour la barque')) throw new Error('une seule quête ne rapporte pas de passage')
    await page.getByRole('button', { name: 'Avec plaisir !' }).click()
    await page.getByTestId('habitant').waitFor({ state: 'detached', timeout: 5000 * SLOW })
    let s = await save()
    if (s.quests.barnabe !== day) throw new Error(`quête du jour de Barnabé : ${JSON.stringify(s.quests)}`)
    if (s.xp < before.xp + 80) throw new Error(`XP après la quête : ${before.xp} → ${s.xp}`)
    const barnabe = await villager('barnabe')
    if (barnabe.open || barnabe.marker) throw new Error('le « ! » de Barnabé doit s’éteindre une fois sa quête faite')

    // Une quête faite ne se refait pas : l'habitant le dit et la partie ne bouge pas.
    await talk('barnabe')
    const again = await page.getByTestId('habitant').innerText()
    if (!again.includes('Reviens demain') || again.includes("t'aide")) throw new Error(`la quête de Barnabé refaite : ${again}`)
    await page.getByRole('button', { name: 'À demain !' }).click()
    await page.getByTestId('habitant').waitFor({ state: 'detached', timeout: 5000 * SLOW })
    if ((await save()).xp !== s.xp) throw new Error('une quête déjà faite ne rapporte rien')

    // Maître Oriel (veille), une réponse fausse : 50 + 20 ; c'est la deuxième quête du jour, donc six réponses : un passage pour la barque du Sphinx.
    await quest('oriel', [true, false, true], ['2 bonnes réponses sur 3. +70 XP', 'Un passage pour la barque du Sphinx'])
    await page.getByRole('button', { name: 'Avec plaisir !' }).click()
    await page.getByTestId('habitant').waitFor({ state: 'detached', timeout: 5000 * SLOW })
    s = await save()
    if (s.quests.oriel !== day) throw new Error(`quête du jour d'Oriel : ${JSON.stringify(s.quests)}`)

    // Mélisande (enquête sur un document) : trois questions du même générateur ; la troisième quête du jour ne rapporte pas un second passage.
    const third = await quest('melisande', [true, true, true], ['3 bonnes réponses sur 3. +80 XP'])
    if (third.includes('passage pour la barque')) throw new Error('un seul passage par jour pour les quêtes du village')
    await page.getByRole('button', { name: 'Avec plaisir !' }).click()
    await page.getByTestId('habitant').waitFor({ state: 'detached', timeout: 5000 * SLOW })
    s = await save()
    if (Object.keys(s.quests).length !== 3) throw new Error(`les trois quêtes du jour : ${JSON.stringify(s.quests)}`)
    for (const code of ['barnabe', 'oriel', 'melisande']) {
      const v = await villager(code)
      if (v.open || v.marker) throw new Error(`le « ! » de ${code} doit être éteint`)
    }
  })

  await step('le pont des fractions : un pont trop court s’effondre et s’explique, la bonne somme fait traverser, six ravins, le bilan et un passage pour le Sphinx', async () => {
    const save = () => page.evaluate(() => window.__aldoria.save())
    const xpBefore = (await save()).xp
    const bridge = await page.evaluate(() => {
      const i = window.__aldoria.world.interactables.find((x) => x.id === 'pont-fractions')
      return i ? { x: i.x, z: i.z } : null
    })
    if (!bridge) throw new Error('le pont des fractions manque dans l’île (6e)')
    await page.evaluate(({ x, z }) => window.__aldoria.world.teleport(x, z - 2, x, z), bridge)
    await page.getByTestId('invite').filter({ hasText: 'Franchir le pont des fractions' }).waitFor({ timeout: 10_000 * SLOW })
    await page.keyboard.press('KeyE')
    await page.getByRole('heading', { name: 'Le pont des fractions' }).waitFor({ timeout: 10_000 * SLOW })
    await page.screenshot({ path: `${OUT}/09a-pont-intro.png` })
    await page.getByRole('button', { name: 'Au premier ravin !' }).click()
    await page.getByTestId('pont-jeu').waitFor({ timeout: 15_000 * SLOW })

    const current = () => page.evaluate(() => window.__aldoria.pont)
    const stageOf = () => page.getByTestId('pont-ravin').getAttribute('data-stage')
    /** Pose la solution de la réserve, planche après planche (clic, ou touche chiffre si `keys`), puis le pont. */
    const solveIt = async (keys = false) => {
      const p = await current()
      for (const length of p.solution) {
        const index = p.stock.findIndex((s) => s.length === length)
        if (keys) await page.keyboard.press(String(index + 1))
        else await page.getByTestId(`pont-prendre-${index}`).click()
      }
      if (keys) await page.keyboard.press('Enter')
      else await page.getByTestId('pont-poser').click()
    }

    // Ravin 1 : un pont trop court (une seule planche, jamais la bonne somme), il s'effondre et le conseil dit la somme posée sans donner la réponse.
    let p = await current()
    const wrongIndex = p.stock.findIndex((s) => s.length !== p.gap)
    await page.getByTestId(`pont-prendre-${wrongIndex}`).click()
    await page.getByTestId('pont-poser').click()
    await page.getByTestId('pont-message').filter({ hasText: /Trop (court|long)/ }).waitFor({ timeout: 5000 * SLOW })
    const advice = await page.getByTestId('pont-message').innerText()
    if (!advice.includes(`Ta planche mesure ${p.stock[wrongIndex].length}`)) throw new Error(`le conseil dit la somme posée : ${advice}`)
    await page.screenshot({ path: `${OUT}/09b-pont-effondre.png` })
    await page.waitForFunction(() => document.querySelector('[data-testid="pont-ravin"]')?.getAttribute('data-stage') === 'edit', null, { timeout: 5000 * SLOW }) // les planches reviennent
    if ((await page.getByTestId('pont-choix').innerText()) === 'Ton pont : aucune planche') throw new Error('après l’effondrement, le choix reste à corriger (les planches ne disparaissent pas)')
    // Retirer, puis la bonne somme : le pont tient, le héros traverse, l'XP est rangée tout de suite.
    await page.getByTestId('pont-retirer').click()
    if ((await page.getByTestId('pont-choix').innerText()) !== 'Ton pont : aucune planche') throw new Error('Retirer vide le pont')
    await solveIt()
    await page.getByTestId('pont-message').filter({ hasText: 'Le pont tient !' }).waitFor({ timeout: 5000 * SLOW })
    if ((await stageOf()) !== 'juste') throw new Error('le pont qui tient montre la traversée')
    await page.screenshot({ path: `${OUT}/09c-pont-tient.png` })
    if (!(await page.getByTestId('pont-score').innerText()).startsWith('0 du premier coup')) throw new Error('un ravin réussi au deuxième essai ne compte pas du premier coup')
    if ((await save()).xp <= xpBefore) throw new Error('l’XP du pont réussi est rangée tout de suite')

    // Ravins 2 à 6 du premier coup (le troisième au clavier : chiffres, Entrée).
    for (let round = 2; round <= 6; round += 1) {
      await page.getByTestId('pont-suite').click()
      await page.getByRole('heading', { name: new RegExp(`Ravin ${round} / 6`) }).waitFor({ timeout: 8000 * SLOW })
      await page.getByTestId('pont-ravin').waitFor()
      if (round === 3) await page.screenshot({ path: `${OUT}/09d-pont-ravin.png` })
      await solveIt(round === 3)
      await page.getByTestId('pont-message').filter({ hasText: 'Le pont tient !' }).waitFor({ timeout: 5000 * SLOW })
    }
    await page.getByTestId('pont-suite').filter({ hasText: 'Voir le bilan' }).click()
    await page.getByTestId('pont-bilan').waitFor({ timeout: 8000 * SLOW })
    const report = await page.getByTestId('pont-bilan').innerText()
    if (!report.includes('Ravins franchis du premier coup : 5.')) throw new Error(`le bilan du pont : ${report}`)
    if (!report.includes('Un passage pour la barque du Sphinx')) throw new Error(`six réponses : un passage pour le Sphinx : ${report}`)
    await page.screenshot({ path: `${OUT}/09e-pont-bilan.png` })
    await page.getByRole('button', { name: "Retour à l'île" }).click()
    await page.getByTestId('pont-bilan').waitFor({ state: 'detached', timeout: 5000 * SLOW })
    if ((await save()).xp < xpBefore + 6 * 13) throw new Error('six ravins rapportent au moins 6 × 13 XP')
  })

  await step('l’apparence : un choix verrouillé l’explique sans rien changer, un déblocage se signale puis se choisit, le héros change à l’écran et la partie le garde', async () => {
    const look = () => page.evaluate(() => ({ ...window.__aldoria.world.look }))
    const savedLook = () => page.evaluate(() => ({ ...window.__aldoria.save().look }))
    const badge = () => page.getByTestId('apparence-nouveautes').count()
    const stateOf = (id) => page.getByTestId(`apparence-${id}`).getAttribute('data-state')
    const open = async () => {
      await page.getByTestId('bouton-apparence').click()
      await page.getByTestId('apparence').waitFor({ timeout: 10_000 * SLOW })
    }
    const close = async () => {
      await page.keyboard.press('Escape')
      await page.getByTestId('apparence').waitFor({ state: 'detached', timeout: 10_000 * SLOW })
    }
    const pos = () => page.evaluate(() => { const p = window.__aldoria.world.hero.root.position; return [p.x, p.z].map((v) => Math.round(v * 100) / 100) })
    const before = await pos()
    const start = await look()

    // Un lieu terminé plus tôt dans le parcours a débloqué une cape : une nouveauté est signalée sur le bouton, et ouvrir l'écran la fait disparaître.
    if ((await badge()) === 0) throw new Error('la cape débloquée par le premier lieu terminé devrait être signalée sur le bouton')
    await open()
    if ((await badge()) !== 0) throw new Error('ouvrir l’écran d’apparence doit faire disparaître la pastille des nouveautés')
    await page.waitForFunction(() => window.__aldoria.world.camera.radius < 6, null, { timeout: 8000 * SLOW }) // la caméra est passée devant le héros, tout près
    await page.waitForTimeout(500 * SLOW)
    await page.screenshot({ path: `${OUT}/06a-apparence.png` })
    if ((await pos()).join() !== before.join()) throw new Error('le héros ne doit pas bouger pendant l’écran d’apparence')
    if ((await stateOf(`silhouette-${start.model}`)) !== 'choisi') throw new Error(`la silhouette choisie est repérée : ${await stateOf(`silhouette-${start.model}`)}`)

    // Le Mage demande le niveau 5 : visible, verrouillé, avec la condition ; le toucher l'explique et ne change rien.
    const xp = await page.evaluate(() => window.__aldoria.save().xp)
    if (xp < 2000) {
      if ((await stateOf('silhouette-Mage')) !== 'verrouille') throw new Error('le Mage doit être verrouillé avant le niveau 5')
      const text = await page.getByTestId('apparence-silhouette-Mage').innerText()
      if (!text.includes('Niveau 5')) throw new Error(`la condition de déblocage est écrite : ${text}`)
      await page.getByTestId('apparence-silhouette-Mage').click({ force: true }) // aria-disabled : Playwright attendrait qu'il s'active, l'enfant, lui, peut le toucher
      const message = await page.getByTestId('apparence-message').innerText()
      if (!message.includes('Niveau 5')) throw new Error(`le choix verrouillé s’explique : ${message}`)
      if ((await look()).model !== start.model) throw new Error('un choix verrouillé ne change rien')
    }
    await close()
    await page.waitForFunction(() => window.__aldoria.world.camera.radius > 6.5, null, { timeout: 8000 * SLOW }) // la caméra est revenue derrière le héros
    if ((await pos()).join() !== before.join()) throw new Error('le héros n’a pas bougé en fermant l’écran')

    // Niveau 8 et cinq lieux de plus : tout se débloque, la pastille compte les nouveautés, ouvrir l'écran les vide.
    await page.evaluate(() => window.__aldoria.giveProgress(2400, 5))
    if ((await badge()) === 0) throw new Error('les déblocages du niveau 8 doivent être signalés sur le bouton')
    await page.getByTestId('bouton-apparence').getAttribute('aria-label').then((label) => {
      if (!/nouveaut/.test(label ?? '')) throw new Error(`le bouton dit qu’il y a du nouveau : ${label}`)
    })
    await open()
    if ((await badge()) !== 0) throw new Error('la pastille disparaît à l’ouverture')

    // Le Mage : un autre modèle prend la place du Chevalier ; ses pièces par défaut, sa cape.
    await page.getByTestId('apparence-silhouette-Mage').click()
    await page.waitForFunction(() => window.__aldoria.world.look.model === 'Mage', null, { timeout: 8000 * SLOW })
    let l = await look()
    if (l.main !== '1H_Wand' || l.off !== 'Spellbook') throw new Error(`pièces du Mage : ${l.main} / ${l.off}`)
    if ((await stateOf('silhouette-Mage')) !== 'choisi') throw new Error('le Mage est repéré comme choisi')
    await page.waitForTimeout(1200 * SLOW) // le nouveau héros se charge
    if ((await pos()).join() !== before.join()) throw new Error('le nouveau modèle prend la place de l’ancien')

    // Des demandes qui se chevauchent, sans attendre le chargement des modèles (un enfant qui clique vite) : un seul héros reste, celui du dernier choix.
    await page.evaluate(async () => {
      const w = window.__aldoria.world
      const l = { ...w.look }
      void w.setLook({ ...l, model: 'Barbarian', main: '1H_Axe', off: 'Barbarian_Round_Shield' })
      void w.setLook({ ...l, model: 'Rogue', main: 'Knife', off: 'Knife_Offhand' })
      void w.setLook({ ...l })
      await w.setLook({ ...l, main: '2H_Staff', off: '' })
    })
    const shown = await page.evaluate(() => {
      const w = window.__aldoria.world
      return {
        heroes: w.scene.transformNodes.filter((n) => n.name === 'heros').length,
        parts: w.hero.meshes.filter((m) => m.isEnabled()).map((m) => m.name.replace(/^.*?-/, '').replace(/_primitive\d+$/, '')),
      }
    })
    if (shown.heroes !== 1) throw new Error(`après des demandes rapprochées il reste ${shown.heroes} héros à l'écran`)
    if (!shown.parts.includes('2H_Staff') || !shown.parts.includes('Mage_Cape') || shown.parts.includes('1H_Wand') || shown.parts.includes('Barbarian_Cape')) {
      throw new Error(`le héros à l'écran n'est pas celui du dernier choix : ${shown.parts.join(', ')}`)
    }
    if ((await pos()).join() !== before.join()) throw new Error('le héros reste à sa place après des changements rapprochés')

    // Un bâton à deux mains : la main gauche est libérée et ses choix deviennent impossibles (la raison est dite).
    await page.getByTestId('apparence-arme-2H_Staff').click()
    l = await look()
    if (l.main !== '2H_Staff' || l.off !== '') throw new Error(`le bâton prend les deux mains : ${l.main} / ${l.off}`)
    if ((await stateOf('main-gauche-Spellbook')) !== 'impossible') throw new Error('le grimoire est impossible avec un bâton à deux mains')
    await page.getByTestId('apparence-main-gauche-Spellbook').click({ force: true })
    if ((await look()).off !== '') throw new Error('un choix impossible ne change rien')
    if (!(await page.getByTestId('apparence-message').innerText()).includes('deux mains')) throw new Error('la raison est dite')

    // La cape d'or (trois lieux), puis retirée, puis une couleur : la cape revient.
    await page.getByTestId('apparence-cape-couleur-or').click()
    if ((await look()).cape_color !== 'or') throw new Error('la cape d’or')
    await page.getByTestId('apparence-cape-non').click()
    if ((await look()).cape !== false) throw new Error('la cape retirée')
    await page.getByTestId('apparence-cape-couleur-rouge').click()
    l = await look()
    if (!l.cape || l.cape_color !== 'rouge') throw new Error('choisir une couleur remet la cape')
    await page.getByTestId('apparence-couvre-chef-non').click()
    if ((await look()).head !== false) throw new Error('le chapeau retiré')

    // Le renard (monde lumineux) : son pelage et son nom.
    await page.getByTestId('apparence-renard-pelage-arctique').click()
    await page.getByTestId('apparence-renard-nom-Comète').click()
    l = await look()
    if (l.pet_fur !== 'arctique' || l.pet_name !== 'Comète') throw new Error(`le renard : ${l.pet_fur} / ${l.pet_name}`)
    await page.waitForTimeout(800 * SLOW)
    await page.screenshot({ path: `${OUT}/06b-apparence-mage.png` })

    // La partie garde tout (elle part au serveur) ; l'interface est revenue à l'île et le héros marche.
    const saved = await savedLook()
    for (const k of ['model', 'main', 'off', 'head', 'cape', 'cape_color', 'pet_fur', 'pet_name']) {
      if (saved[k] !== l[k]) throw new Error(`la partie garde ${k} : ${saved[k]} au lieu de ${l[k]}`)
    }
    await close()
    await page.getByTestId('apparence').waitFor({ state: 'detached', timeout: 5000 * SLOW })
    if ((await badge()) !== 0) throw new Error('rien de nouveau après avoir tout vu')
    await page.keyboard.down('KeyS') // un pas en arrière : le héros fait face au lieu, on ne le pousse pas contre ses murs
    await page.waitForTimeout(900 * SLOW)
    await page.keyboard.up('KeyS')
    const after = await pos()
    if (after.join() === before.join()) throw new Error('le héros doit pouvoir marcher de nouveau')

    // Ce qui est choisi est rouvert tel quel.
    await open()
    if ((await stateOf('silhouette-Mage')) !== 'choisi' || (await stateOf('cape-couleur-rouge')) !== 'choisi') throw new Error('l’écran rouvre l’apparence choisie')
    await close()
  })

  await step('fin de séance fixée par le parent : l’île se fige, on peut terminer, l’écran titre revient', async () => {
    // Mode découverte : pas de parent, donc pas de limite. On fait comme si l'enfant était connecté (rien n'est
    // envoyé : aucune réponse n'est donnée) avec une séance de 5 minutes déjà jouée à 6,7.
    await page.evaluate(() => {
      const s = window.__aldoria.services.session
      s.demo = false
      s.clock.sync({ session_max_minutes: 5, break_minutes: 30, played_seconds: 400, idle_seconds: 0 })
    })
    await page.getByRole('heading', { name: 'Belle séance !' }).waitFor({ timeout: 10_000 * SLOW })
    await page.screenshot({ path: `${OUT}/10-fin-seance.png` })
    const text = (await page.getByTestId('fin-seance').textContent()) ?? ''
    if (!/Tu as joué 7 minutes/.test(text) || !/Ta progression est sauvegardée/.test(text)) throw new Error(`phrase de fin de séance : ${text}`)
    await page.getByRole('button', { name: 'Terminer' }).click()
    await page.getByTestId('decouvrir').waitFor({ timeout: 10_000 * SLOW })
  })

  await step('le village de la 2nde (Brumegarde) : les enquêtes de Vesna et du capitaine Brann dessinent leur tableau et se terminent', async () => {
    await page.goto(`${BASE}/?decouverte&e2e&classe=2nde&monde=brouillard&qualite=${QUALITY}&musique=0&sons=0`)
    await page.waitForFunction(() => window.__aldoria?.world, null, { timeout: 180_000 * SLOW })
    await page.waitForFunction(() => window.__aldoria.world.villagers.size >= 4, null, { timeout: 60_000 * SLOW }) // les quatre habitants de Brumegarde
    const enquete = async (code, captionPattern, shot) => {
      const npc = await page.evaluate((c) => {
        const i = window.__aldoria.world.interactables.find((x) => x.id === `habitant-${c}`)
        return i ? { x: i.x, z: i.z, label: i.label } : null
      }, code)
      if (!npc) throw new Error(`l'habitant ${code} manque dans Brumegarde`)
      await page.evaluate(({ x, z }) => window.__aldoria.world.teleport(x + 1.8, z, x, z), npc)
      await page.getByTestId('invite').filter({ hasText: `Parler à ${npc.label}` }).waitFor({ timeout: 10_000 * SLOW })
      await page.keyboard.press('KeyE')
      await page.getByRole('button', { name: "Je t'aide !" }).click()
      for (let i = 1; i <= 3; i += 1) {
        await page.getByRole('heading', { name: new RegExp(`${i} / 3`) }).waitFor({ timeout: 10_000 * SLOW })
        const table = page.locator('figure.visual.table table')
        await table.waitFor({ timeout: 5000 * SLOW })
        const caption = await table.locator('caption').innerText()
        if (!captionPattern.test(caption)) throw new Error(`titre du tableau de ${code} : ${caption}`)
        if ((await table.locator('th[scope="col"]').count()) < 3 || (await table.locator('tbody tr').count()) < 1) throw new Error(`le tableau de ${code} est incomplet`)
        if (i === 1) await page.screenshot({ path: `${OUT}/${shot}` })
        await answerQuestion(true)
      }
      await page.getByRole('button', { name: 'Avec plaisir !' }).waitFor({ timeout: 10_000 * SLOW })
      const thanks = await page.getByTestId('habitant').innerText()
      if (!thanks.includes('3 bonnes réponses sur 3. +80 XP')) throw new Error(`fin de la quête de ${code} : ${thanks}`)
      await page.getByRole('button', { name: 'Avec plaisir !' }).click()
      await page.getByTestId('habitant').waitFor({ state: 'detached', timeout: 5000 * SLOW })
    }
    await enquete('vesna', /./, '11a-enquete-releve.png') // relevé statistique : valeurs et effectifs
    await enquete('brann', /Registre/, '11b-enquete-croisee.png') // tableau croisé, avec ses totaux
  })
} catch (error) {
  const where = error instanceof Error ? (error.stack ?? '').split('\n').find((l) => l.includes('smoke.mjs'))?.trim() ?? '?' : '?'
  problems.push(error instanceof Error ? `${error.message.split('\n')[0]} (${where})` : String(error))
  await page.screenshot({ path: `${OUT}/echec.png` }).catch(() => {})
} finally {
  await browser.close()
}

if (problems.length > 0) {
  console.error('\n✗ Parcours en échec :\n  ' + problems.join('\n  '))
  process.exit(1)
}
console.log(`\nParcours réussi. Captures : ${OUT}`)
