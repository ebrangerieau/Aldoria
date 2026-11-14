// Parcours de fumée dans un vrai navigateur : écran titre → île (mode découverte) → le héros
// avance → la mini-carte le suit et se cache avec M → la musique joue, se coupe et se tait pendant
// une question → l'intérieur d'un lieu (entrée par le seuil, étage 2 au clavier, sortie) → un combat (repli sans perte,
// victoire, porte qui s'ouvre) → pierre d'éveil → question → bonne réponse → la pierre s'éveille. Échoue sur toute
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

/** Répond à la question ouverte (celle de `window.__aldoria.question`), juste ou faux, puis « Continuer ». */
const answerQuestion = async (correct) => {
  await page.getByRole('dialog').waitFor({ timeout: 10_000 * SLOW })
  const item = await page.evaluate(() => window.__aldoria.question)
  if (!correct) {
    // Faux : un autre choix que le bon, ou un nombre absurde.
    if (item.answer.kind === 'choice') await page.locator('.choice').nth((item.answer.index + 1) % (await page.locator('.choice').count())).click()
    else {
      await page.getByLabel('Ta réponse').fill('99999')
      await page.getByRole('button', { name: 'Valider' }).click()
    }
    await page.locator('.feedback.bad').waitFor({ timeout: 5000 * SLOW })
  } else {
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
    } else throw new Error(`type de réponse non géré par le test : ${item.answer.kind}`)
    await page.locator('.feedback.good').waitFor({ timeout: 5000 * SLOW })
  }
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

  await step('un lieu de quête : on entre par le seuil, on monte à l’étage 2 au clavier, on sort', async () => {
    // Devant la porte de la Tour des Fractions (le premier lieu de maths de la 6e), face à elle.
    const door = await page.evaluate(() => {
      const w = window.__aldoria.world
      const it = w.interactables.find((i) => i.id === 'tour_fractions')
      w.teleport(it.x, it.z - 1.5, it.x, it.z)
      return { x: it.x, z: it.z }
    })
    await page.getByTestId('invite').waitFor({ timeout: 10_000 * SLOW })
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
    const turn = async (key, correct) => {
      await page.getByTestId('actions').waitFor({ timeout: 30_000 * SLOW })
      await page.keyboard.press(key)
      await answerQuestion(correct)
      await page.waitForFunction(() => !document.querySelector('[data-testid=pv-ennemi]') || document.querySelector('[data-testid=actions]') || document.querySelector('[role=dialog]'), null, { timeout: 30_000 * SLOW })
    }
    // Un coup porté, puis le héros n'a plus qu'un point de vie : une erreur le replie, l'ennemi garde ses blessures.
    await turn('1', true)
    const hurt = await interior()
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

  await step('le boss : l’Effaceur parle de sa voix enregistrée, huit sceaux, le coffre, la page rendue, le lieu suivant s’ouvre, Maître Ysaline salue', async () => {
    const heard = (url) => page.waitForResponse((r) => r.url().includes(url), { timeout: 15_000 * SLOW })
    const soundOk = async (pending, what) => {
      const res = await pending
      // 200 sur l'aperçu local, 206 en production (nginx sert le son par morceaux).
      if (![200, 206].includes(res.status()) || !(res.headers()['content-type'] ?? '').startsWith('audio/mpeg')) throw new Error(`${what} : ${res.status()} ${res.headers()['content-type']} ${res.url()}`)
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
      await page.screenshot({ path: `${OUT}/03g-page.png` })
      await page.getByRole('button', { name: "Retour sur l'île" }).click()
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
