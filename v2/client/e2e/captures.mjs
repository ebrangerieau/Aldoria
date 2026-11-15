// Captures de vérification visuelle de l'île (skill « captures » de la v2). Serveur de prévisualisation
// lancé (npm run preview), puis : npm run captures [-- vue1 vue2…]. Captures dans $E2E_OUT
// (défaut : e2e/captures). Qualité : $E2E_QUALITE (haut par défaut ; « bas » en rendu logiciel lent).
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
const QUALITY = process.env.E2E_QUALITE ?? 'haut'
mkdirSync(OUT, { recursive: true })

// Vue : où poser le héros (x, z), vers où il regarde, et la caméra (hauteur, distance, décalage) ;
// `interface` : garder l'interface (mini-carte, bandeau) au lieu de la cacher.
const VIEWS = {
  depart: { query: '', at: [0, -30], face: [0, 30], beta: 1.3, radius: 9, turn: 0 },
  panorama: { query: '', at: [0, -30], face: [0, 30], beta: 1.05, radius: 18, turn: 0.5 },
  cimes: { query: '', at: [70, 60], face: [120, 105], beta: 1.32, radius: 9, turn: 0.15 },
  lieu: { query: '', at: [80, 104], face: [94, 120], beta: 1.25, radius: 10, turn: 0.4 },
  foret: { query: '', at: [-10, -100], face: [0, -140], beta: 1.3, radius: 8, turn: -0.3 },
  cote: { query: '', at: [-200, -10], face: [-260, -10], beta: 1.35, radius: 9, turn: 0.2 },
  sphinx: { query: '', at: [318, 10], face: [345, 15], beta: 1.3, radius: 11, turn: 0.3 },
  brouillard: { query: '&monde=brouillard&classe=2nde', at: [0, -30], face: [0, 30], beta: 1.25, radius: 12, turn: 0.3 },
  carte: { query: '', at: [70, 60], face: [120, 105], beta: 1.32, radius: 9, turn: 0.15, interface: true },
  // La barque de l'île du Sphinx, vue depuis la plage (côte est, `barque` de ile.json), puis dans le Brouillard.
  barque: { query: '', at: [236, 20], face: [247, 20], beta: 1.25, radius: 9, turn: 0.45 },
  'barque-brouillard': { query: '&monde=brouillard&classe=2nde', at: [236, 20], face: [247, 20], beta: 1.25, radius: 9, turn: 0.45 },
  // La Table des Reliques (plateau de la Citadelle, `table_reliques` de ile.json), vue de trois quarts, puis dans le Brouillard.
  table: { query: '', at: [-22.2, 8.4], face: [-18, 12], beta: 1.2, radius: 7, turn: 0.45 },
  'table-brouillard': { query: '&monde=brouillard&classe=2nde', at: [-22.2, 8.4], face: [-18, 12], beta: 1.2, radius: 7, turn: 0.45 },
  // Apparence du héros et du renard (core/wardrobe.ts) : le héros de dos, de près, avec son renard.
  'apparence-chevalier': { query: '', at: [0, -30], face: [0, 30], beta: 1.25, radius: 5.5, turn: 0.55, look: { model: 'Knight', main: '2H_Sword', off: '', head: true, cape: true, cape_color: 'bleu', pet_name: 'Roux', pet_fur: 'roux', seen: 0 } },
  'apparence-mage': { query: '', at: [0, -30], face: [0, 30], beta: 1.25, radius: 5.5, turn: 0.55, look: { model: 'Mage', main: '2H_Staff', off: '', head: true, cape: true, cape_color: 'or', pet_name: 'Comète', pet_fur: 'arctique', seen: 0 } },
  'apparence-barbare': { query: '', at: [0, -30], face: [0, 30], beta: 1.25, radius: 5.5, turn: 0.55, look: { model: 'Barbarian', main: '1H_Axe', off: 'Barbarian_Round_Shield', head: false, cape: true, cape_color: 'violet', pet_name: 'Filou', pet_fur: 'sable', seen: 0 } },
  'apparence-rodeur': { query: '&monde=brouillard&classe=2nde', at: [0, -30], face: [0, 30], beta: 1.25, radius: 5.5, turn: 0.55, look: { model: 'Rogue_Hooded', main: '1H_Crossbow', off: 'Knife_Offhand', head: false, cape: true, cape_color: 'vert', pet_name: 'Roux', pet_fur: 'roux', seen: 0 } },
  // L'écran d'apparence ouvert (bouton « Apparence » de l'interface) : niveau 3 et deux lieux terminés, donc le Mage (niveau 5) et la cape d'or
  // (trois lieux) restent verrouillés ; la caméra passe devant le héros et le décale à gauche du panneau.
  'apparence-ecran': { query: '', at: [0, -30], face: [0, 30], beta: 1.3, radius: 9, turn: 0, interface: true, progress: [600, 2], wardrobe: true },
  'apparence-ecran-brouillard': { query: '&monde=brouillard&classe=2nde', at: [0, -30], face: [0, 30], beta: 1.3, radius: 9, turn: 0, interface: true, progress: [600, 2], wardrobe: true },
  // Le village (Clairval en 6e, Brumegarde en 2nde) : les habitants autour du puits, chacun avec son « ! » doré tant que sa quête du jour attend.
  village: { query: '', at: [-82, 18], face: [-82, 6], beta: 0.95, radius: 17, turn: 0 },
  'village-brumegarde': { query: '&monde=brouillard&classe=2nde', at: [-82, 18], face: [-82, 6], beta: 0.95, radius: 17, turn: 0 },
  // Le dialogue d'un habitant : le héros devant Barnabé, la demande ouverte (bouton « Parler » par E).
  'village-dialogue': { query: '', at: [-72.5, 8.7], face: [-74.5, 8.7], beta: 1.25, radius: 5, turn: 0.4, interface: true, talk: 'barnabe' },
  // L'enquête de Vesna (relevé statistique) et celle du capitaine Brann (tableau croisé) : la première question de la quête, avec son tableau.
  'village-enquete': { query: '&monde=brouillard&classe=2nde', at: [-82.9, 13.5], face: [-84.7, 13.5], beta: 1.25, radius: 6, turn: 0.4, interface: true, talk: 'vesna', accept: true },
  'village-enquete-croisee': { query: '&monde=brouillard&classe=2nde', at: [-87.7, 3.3], face: [-89.5, 3.3], beta: 1.25, radius: 6, turn: 0.4, interface: true, talk: 'brann', accept: true },
  // Le pont des fractions de la Lice : sa passerelle et son tas de planches sur le plateau de la Citadelle, puis l'écran du jeu (une planche posée, puis la bonne somme).
  pont: { query: '', at: [-28, 22], face: [-28, 30], beta: 1.15, radius: 12, turn: 0.45 },
  'pont-jeu': { query: '', at: [-28, 28], face: [-28, 30], beta: 1.2, radius: 6, turn: 0.2, interface: true, lice: 'pont', planks: 2 },
  'pont-tient': { query: '', at: [-28, 28], face: [-28, 30], beta: 1.2, radius: 6, turn: 0.2, interface: true, lice: 'pont', planks: 'solution' },
  // Le stand de tir de la Lice (comptoir, piquets et cible peinte), puis l'écran du jeu : un tir raté (la flèche reste dessinée) et une cible touchée.
  tir: { query: '', at: [28, 22], face: [28, 30], beta: 1.15, radius: 12, turn: 0.45 },
  'tir-brouillard': { query: '&monde=brouillard&classe=2nde', at: [28, 22], face: [28, 30], beta: 1.15, radius: 12, turn: 0.45 },
  'tir-jeu': { query: '', at: [28, 28], face: [28, 30], beta: 1.2, radius: 6, turn: 0.2, interface: true, lice: 'tir', shot: 'rate' },
  'tir-touche': { query: '', at: [28, 28], face: [28, 30], beta: 1.2, radius: 6, turn: 0.2, interface: true, lice: 'tir', shot: 'juste' },
  'tir-droite': { query: '&monde=brouillard&classe=2nde', at: [28, 28], face: [28, 30], beta: 1.2, radius: 6, turn: 0.2, interface: true, lice: 'tir', shot: 'rate' },
  'tir-droite-touche': { query: '&monde=brouillard&classe=2nde', at: [28, 28], face: [28, 30], beta: 1.2, radius: 6, turn: 0.2, interface: true, lice: 'tir', shot: 'juste' },
  // Les régions s'éclairent page après page (6e) : la Vallée du Vivant n'a pas de lieu (brouillard, avec son texte), le Forum des Citoyens (EMC) avant et après ses pages.
  'region-brume': { query: '', at: [-112, -104], face: [-112, -112], beta: 1.2, radius: 14, turn: 0.4, interface: true },
  'region-endormie': { query: '', at: [-50, -40], face: [-50, -62], beta: 1.1, radius: 26, turn: 0.4 },
  'region-eclairee': { query: '', at: [-50, -40], face: [-50, -62], beta: 1.1, radius: 26, turn: 0.4, region: 'emc' },
  'region-panorama': { query: '', at: [0, -30], face: [0, 30], beta: 1.05, radius: 60, turn: 0.2 },
  // La mini-carte voile les régions pas encore éclairées (ici : les Cimes Fractales ont toutes leurs pages, la Vallée du Vivant et le Carrefour des Messagers sont sous le brouillard).
  'carte-lumiere': { query: '', at: [0, -30], face: [0, 30], beta: 1.25, radius: 6, turn: 0, interface: true, region: 'maths' },
  // Le sac consulté sur l'île : vide (où trouver des objets), puis garni (quatre objets, ce qu'ils font, où ils servent).
  'sac-vide': { query: '', at: [0, -30], face: [0, 30], beta: 1.25, radius: 6, turn: 0, interface: true, bag: 'vide' },
  'sac-garni': { query: '&monde=brouillard', at: [0, -30], face: [0, 30], beta: 1.25, radius: 6, turn: 0, interface: true, bag: 'garni' },
  // Une relique de l'île par élément (reliques.json) : le héros à 2,6 m, l'éclat et son anneau devant lui.
  'relique-flamme': { query: '', at: [-62.6, -42], face: [-60, -42], beta: 1.3, radius: 6, turn: 0.35 },
  'relique-onde': { query: '', at: [-148.6, 132], face: [-146, 132], beta: 1.3, radius: 6, turn: 0.35 },
  'relique-feuille': { query: '', at: [-164.6, -126], face: [-162, -126], beta: 1.3, radius: 6, turn: 0.35 },
  'relique-etoile': { query: '', at: [73.4, 52], face: [76, 52], beta: 1.3, radius: 6, turn: 0.35 },
  // Les quatre autres reliques de l'île : le décor (arbres, rochers) ne doit ni les cacher ni les toucher.
  'relique-anglais': { query: '', at: [-190.6, 30], face: [-188, 30], beta: 1.3, radius: 6, turn: 0.35 },
  'relique-francais': { query: '', at: [-28.6, -186], face: [-26, -186], beta: 1.3, radius: 6, turn: 0.35 },
  'relique-histoire': { query: '', at: [203.4, -10], face: [206, -10], beta: 1.3, radius: 6, turn: 0.35 },
  'relique-snt': { query: '', at: [123.4, -138], face: [126, -138], beta: 1.3, radius: 6, turn: 0.35 },
  'relique-brouillard': { query: '&monde=brouillard&classe=2nde', at: [-62.6, -42], face: [-60, -42], beta: 1.3, radius: 6, turn: 0.35 },
  // Intérieur d'un lieu : `lieu` (code), `salle` (0 à 5), `at` : [x dans la salle, profondeur], caméra : écart au sud, inclinaison, distance.
  interieur: { query: '', lieu: 'tour_fractions', salle: 0, at: [6, 9], turn: 0, beta: 1.05, radius: 12, interface: true },
  escalier: { query: '', lieu: 'tour_fractions', salle: 0, at: [13.5, 10], turn: -0.4, beta: 1.0, radius: 11, interface: true },
  'interieur-brouillard': { query: '&monde=brouillard&classe=2nde', lieu: 'labyrinthe_vecteurs', salle: 2, at: [8, 9], turn: -0.25, beta: 1.05, radius: 12, interface: true },
}

// Salle de l'Effaceur : `boss` « loin » (le héros à 7 m, l'Effaceur endormi) ou « combat » (à la distance du combat, 4,8 m) ; `chest` : le coffre
// « ferme » (apparu) ou « ouvert ». Un lieu par modèle d'Effaceur (celui de plus grande échelle) : de 1,1 à 1,8 fois la taille de base.
const BOSSES = {
  mushnub: ['tour_fractions', ''], goleling: ['atelier_balances', ''], dragon: ['observatoire_angles', ''], mage: ['bibliotheque_langues', ''],
  yeti: ['porte_transitions', '&classe=2nde'], ghost: ['port_couronnes', '&classe=2nde'], bluedemon: ['labyrinthe_vecteurs', '&classe=2nde'],
  demon: ['forge_algebre', '&classe=2nde'], orc: ['puits_contes', ''], blob: ['alambic_elements', '&classe=2nde'], guerrier: ['bibliotheque_engloutie', '&classe=2nde'],
}
for (const [name, [lieu, query]] of Object.entries(BOSSES)) {
  VIEWS[`boss-${name}`] = { query, lieu, salle: 5, boss: 'loin', turn: 0, beta: 1.05, radius: 12, interface: true }
}
for (const name of ['blob', 'dragon', 'ghost', 'yeti', 'guerrier']) {
  const [lieu, query] = BOSSES[name]
  VIEWS[`boss-combat-${name}`] = { query, lieu, salle: 5, boss: 'combat', turn: 0, beta: 1.0, radius: 10, interface: true }
}
// Salle-énigme (quatrième salle) : les trois cristaux endormis, puis `cristaux` d'entre eux éveillés (verts, plus grands, immobiles).
VIEWS['enigme'] = { query: '', lieu: 'tour_fractions', salle: 3, at: [6, 10], turn: 0, beta: 1.05, radius: 12, interface: true }
VIEWS['enigme-eveillee'] = { query: '', lieu: 'tour_fractions', salle: 3, at: [6, 10], cristaux: 2, turn: 0, beta: 1.05, radius: 12, interface: true }
VIEWS['enigme-brouillard'] = { query: '&monde=brouillard&classe=2nde', lieu: 'labyrinthe_vecteurs', salle: 3, at: [6, 10], turn: 0, beta: 1.05, radius: 12, interface: true }
VIEWS['coffre'] = { query: '', lieu: 'tour_fractions', salle: 5, chest: 'ferme', turn: -0.2, beta: 1.0, radius: 8, interface: true }
VIEWS['coffre-ouvert'] = { query: '', lieu: 'tour_fractions', salle: 5, chest: 'ouvert', turn: -0.2, beta: 1.0, radius: 8, interface: true }

const wanted = process.argv.slice(2).filter((v) => v in VIEWS)
const views = wanted.length > 0 ? wanted : Object.keys(VIEWS)
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
let failed = false
for (const name of views) {
  const view = VIEWS[name]
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => {
    failed = true
    console.error(`${name} : ${e.message}`)
  })
  await page.goto(`${BASE}/?decouverte&e2e&qualite=${QUALITY}${view.query}`)
  await page.waitForFunction(() => window.__aldoria?.world, null, { timeout: 300_000 })
  await page.waitForFunction(() => window.__aldoria.world.villagers.size > 0, null, { timeout: 120_000 }) // les habitants arrivent après l'île
  if (view.lieu) {
    // Intérieur d'un lieu : x dans le monde intérieur = 16 × salle + x ; z = -profondeur.
    await page.evaluate(async (v) => {
      const w = window.__aldoria.world
      await w.enterPlace(v.lieu)
      const interior = w.interior
      if (v.boss) {
        // L'Effaceur de la salle : le héros se place à l'ouest de lui, hors de portée d'engagement (3,6 m).
        const boss = interior.enemies.find((e) => e.boss)
        interior.teleport(boss.x - (v.boss === 'combat' ? 4.8 : 7), boss.z)
      } else if (v.chest) {
        // Le coffre apparaît (comme après la défaite de l'Effaceur), puis s'ouvre ; le héros est à 3 m à l'ouest.
        const at = interior.dungeon.chestPoint(v.salle)
        interior.teleport(at.x - 3, at.z)
        interior.revealChest()
        if (v.chest === 'ouvert') interior.openChest()
      } else {
        interior.teleport(16 * v.salle + v.at[0], -v.at[1])
        for (const ped of interior.pedestals.slice(0, v.cristaux ?? 0)) interior.solvePedestal(ped)
      }
      interior.frame(v.turn, v.beta, v.radius)
    }, view)
  } else {
    await page.evaluate(async (v) => {
      const w = window.__aldoria.world
      if (v.look) await w.setLook(v.look) // l'apparence de la vue (silhouette, cape, pelage), sans passer par les déblocages
      if (v.region) window.__aldoria.giveRegion(v.region) // toutes les pages d'une région (elle s'éclaire)
      if (v.progress) window.__aldoria.giveProgress(...v.progress) // niveau et lieux terminés (mode découverte seulement)
      w.teleport(v.at[0], v.at[1], v.face[0], v.face[1])
      w.frame(w.camera.alpha + v.turn, v.beta, v.radius)
    }, view)
  }
  if (view.talk) {
    await page.getByTestId('invite').filter({ hasText: 'Parler à' }).waitFor({ timeout: 20_000 })
    await page.keyboard.press('KeyE')
    await page.getByTestId('habitant').waitFor()
  }
  if (view.lice === 'tir') {
    await page.getByTestId('invite').filter({ hasText: 'Tirer au stand' }).waitFor({ timeout: 20_000 })
    await page.keyboard.press('KeyE')
    await page.getByRole('button', { name: 'À mes cibles !' }).click()
    await page.getByTestId('tir-jeu').waitFor({ timeout: 20_000 })
    await page.waitForFunction(() => window.__aldoria.tir?.round === 0, null, { timeout: 10_000 })
    const t = await page.evaluate(() => window.__aldoria.tir)
    const press = async (id, times) => { for (let i = 0; i < times; i += 1) await page.getByTestId(id).click() }
    if (t.mode === 'angle') {
      // Raté : un pas de plus que la cible (ou un seul, si c'est déjà le cas) ; touché : l'angle de la cible.
      const steps = view.shot === 'juste' ? t.angle / t.minor : t.angle / t.minor + 1 > 180 / t.minor ? t.angle / t.minor - 1 : t.angle / t.minor + 1
      await press('tir-valeur-plus', steps)
    } else if (view.shot === 'juste') {
      if (t.n >= 1) await press('tir-num-plus', t.n - 1)
      else await press('tir-num-moins', 1 - t.n)
      await press('tir-den-plus', t.d - 1)
    } else if (t.n === 1 && t.d === 1) await press('tir-num-moins', 1) // 1/1 est la bonne droite : un tir à côté, 0
    await page.getByTestId('tir-tirer').click()
    await page.getByTestId('tir-message').filter({ hasText: /\S/ }).waitFor({ timeout: 10_000 })
  }
  if (view.lice === 'pont') {
    await page.getByTestId('invite').filter({ hasText: 'Franchir le pont' }).waitFor({ timeout: 20_000 })
    await page.keyboard.press('KeyE')
    await page.getByRole('button', { name: 'Au premier ravin !' }).click()
    await page.getByTestId('pont-jeu').waitFor({ timeout: 20_000 })
    if (view.planks === 'solution') {
      const p = await page.evaluate(() => window.__aldoria.pont)
      for (const length of p.solution) await page.getByTestId(`pont-prendre-${p.stock.findIndex((s) => s.length === length)}`).click()
      await page.getByTestId('pont-poser').click()
    } else {
      for (let i = 0; i < view.planks; i += 1) await page.getByTestId('pont-prendre-0').click()
    }
  }
  if (view.accept) {
    await page.getByRole('button', { name: "Je t'aide !" }).click()
    await page.locator('figure.visual.table').waitFor({ timeout: 15_000 })
  }
  if (view.bag) {
    if (view.bag === 'garni') await page.evaluate(() => { window.__aldoria.give('plume', 3); window.__aldoria.give('parchemin', 1); window.__aldoria.give('potion', 2) })
    await page.getByTestId('bouton-sac').click()
    await page.getByTestId('sac-ile').waitFor()
  }
  if (view.wardrobe) {
    await page.getByTestId('bouton-apparence').click()
    await page.getByTestId('apparence').waitFor()
  }
  // Interface cachée (sauf vue `interface`), le temps que les ombres et le halo se stabilisent.
  if (!view.interface) await page.evaluate(() => document.documentElement.classList.add('sans-interface'))
  await page.waitForTimeout(6000)
  await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 180_000 })
  console.log(`✓ ${name}`)
  await page.close()
}
await browser.close()
process.exit(failed ? 1 : 0)
