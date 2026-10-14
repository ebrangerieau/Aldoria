// Test de bout en bout du jeu web : titre → liaison de l'appareil (code à 8 chiffres)
// → profil → PIN → carte du royaume → seuil de la Tour des Fractions → donjon (marche au clavier)
// → Quitter → carte → Citadelle → Archives → Citadelle → Apparence → Citadelle → défi du jour
// (1re question) → Quitter → Citadelle → carte → seuil de Clairval → village → Quitter → carte
// → Changer de joueur → profils. Positions des lieux de la carte : `--places=1` (world_map.gd).
// Pilote Edge (ou Chrome) en headless via playwright-core, sur le banc local
// (tools/e2e_web.ps1) : jamais sur la production avec les vrais codes des enfants.
//
// Usage : node login_flow.js <url> <dossier captures> <code de liaison> [pin]
// Échoue (code 1) si un appel /api/ ne répond pas 2xx ou si la console du jeu
// signale une erreur [Aldoria/api].
const { chromium } = require('playwright-core');

(async () => {
  const [url, outDir, pairing, pin = '1234'] = process.argv.slice(2);
  let paired = false;
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const problems = [];
  const api = [];
  page.on('console', (m) => {
    // Avant la liaison, le refus attendu de /play/profiles (401) est journalisé par le navigateur.
    if (!paired && m.text().includes('status of 401')) return;
    if (m.text().includes('[Aldoria/api]') || m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    if (!r.url().includes('/api/')) return;
    api.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
    // Navigateur neuf : la liste des profils est refusée tant que l'appareil n'est pas relié.
    if (!paired && r.status() === 401 && r.url().endsWith('/play/profiles')) return;
    if (r.status() >= 300) problems.push(`api: ${r.status()} ${r.url()}`);
  });

  const shot = async (name) => page.screenshot({ path: `${outDir}/e2e_${name}.png` });
  await page.goto(url);
  await page.waitForTimeout(8000);   // chargement du moteur
  await page.mouse.click(640, 400);  // écran titre
  await page.waitForTimeout(2500);
  await shot('0_liaison');
  for (const digit of pairing) {     // code de liaison (espace parent → Famille → Appareils)
    await page.keyboard.press(digit);
    await page.waitForTimeout(120);
  }
  paired = true;
  await page.waitForTimeout(3000);
  await shot('1_profils');
  await page.mouse.click(640, 403);  // premier profil (Jules)
  await page.waitForTimeout(800);
  for (const digit of pin) {
    await page.keyboard.press(digit);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(5000);   // connexion + sauvegarde → carte du royaume
  await shot('2_carte');
  await page.keyboard.press('Enter'); // accueil de Maître Ysaline (première fois seulement)
  await page.waitForTimeout(800);
  await page.mouse.click(771, 329);  // la Tour des Fractions → son seuil
  await page.waitForTimeout(1000);
  await shot('2b_seuil');
  await page.keyboard.press('Enter'); // « J'y vais » (paquet + scène 3D)
  await page.waitForTimeout(6000);
  await shot('3_donjon_intro');
  await page.mouse.click(640, 730);  // « En avant ! »
  await page.waitForTimeout(800);
  await page.keyboard.down('d');     // marcher vers l'est (D, ou → )
  await page.waitForTimeout(1500);
  await page.keyboard.up('d');
  await page.waitForTimeout(500);
  await shot('4_donjon_marche');
  await page.mouse.click(1210, 63);  // « Quitter » → carte
  await page.waitForTimeout(4000);
  await page.mouse.click(659, 384);  // la Citadelle → son seuil
  await page.waitForTimeout(1000);
  await page.keyboard.press('Enter'); // « Entrer »
  await page.waitForTimeout(2500);
  await shot('4b_citadelle');
  await page.mouse.click(1000, 724); // « Archives »
  await page.waitForTimeout(3000);
  await shot('5_archives');
  await page.mouse.click(1170, 52);  // « Retour au camp » (la Citadelle)
  await page.waitForTimeout(2500);
  await page.mouse.click(1159, 724); // « Apparence » (héros et renard en 3D)
  await page.waitForTimeout(3000);
  await shot('5b_apparence');
  await page.mouse.click(1135, 52);  // « Retour au camp » (la Citadelle)
  await page.waitForTimeout(2500);
  await page.mouse.click(1138, 405); // « Relever » le défi du jour
  await page.waitForTimeout(4000);
  await page.mouse.click(640, 530);  // « C'est parti ! »
  await page.waitForTimeout(1500);
  await shot('7_defi');
  await page.mouse.click(1190, 53);  // « Quitter » → Citadelle
  await page.waitForTimeout(3000);
  await page.mouse.click(377, 550);  // « Ouvrir la carte du royaume »
  await page.waitForTimeout(4000);
  await page.mouse.click(496, 504);  // Clairval → son seuil
  await page.waitForTimeout(1000);
  await page.keyboard.press('Enter'); // « J'y vais »
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 730);  // « Entrer dans le village »
  await page.waitForTimeout(1200);
  await shot('6_village');
  await page.mouse.click(1210, 63);  // « Quitter » → carte
  await page.waitForTimeout(4000);
  await page.mouse.click(1143, 47);  // « Changer de joueur » (carte)
  await page.waitForTimeout(2500);
  await shot('8_changer_joueur');

  // Lecture à voix haute (aménagement « dys ») : voix françaises du navigateur, pour information.
  const voices = await page.evaluate(() =>
    'speechSynthesis' in window ? speechSynthesis.getVoices().filter((v) => v.lang.startsWith('fr')).map((v) => v.name) : null,
  );
  console.log(`Voix françaises du navigateur : ${voices === null ? 'synthèse vocale absente' : voices.join(', ') || 'aucune'}`);
  console.log('Appels API :\n  ' + api.join('\n  '));
  for (const call of ['200 POST /api/v1/play/devices/pair', '200 POST /api/v1/play/session/start', '200 GET /api/v1/play/save', '200 GET /api/v1/play/progress']) {
    if (!api.includes(call)) problems.push(`appel manquant : ${call}`);
  }
  const starts = api.filter((line) => line === '200 POST /api/v1/play/session/start').length;
  if (starts < 3) problems.push("le village ou le défi du jour n'a pas ouvert de session");
  const profileLoads = api.filter((line) => line === '200 GET /api/v1/play/profiles').length;
  if (profileLoads < 2) problems.push('« Changer de joueur » n\'a pas rouvert le choix des profils');
  if (problems.length) {
    console.log('ÉCHEC :\n  ' + problems.join('\n  '));
    process.exitCode = 1;
  } else {
    console.log('OK : parcours complet sans erreur');
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
